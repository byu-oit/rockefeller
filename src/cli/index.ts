/*
 * Copyright 2017 Brigham Young University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import * as AWS from 'aws-sdk';
import { AccountConfig } from 'handel-extension-api';
import { ParsedArgs } from 'minimist';
import * as winston from 'winston';
import * as iamCalls from '../aws/iam-calls';
import * as s3Calls from '../aws/s3-calls';
import * as util from '../common/util';
import { PhaseDeployers, PhaseSecretQuestion, WaterworksFile } from '../datatypes/index';
import * as input from '../input';
import * as lifecycle from '../lifecycle';

function configureLogger(argv: ParsedArgs) {
    let level = 'info';
    if (argv.d) {
        level = 'debug';
    }
    winston!.level = level;
    winston.cli();
}

function getCodePipelineBucketName(accountConfig: AccountConfig) {
    return `codepipeline-${accountConfig.region}-${accountConfig.account_id}`;
}

function validateWaterworksFile(waterworksFile: WaterworksFile) {
    const validateErrors = lifecycle.validatePipelineSpec(waterworksFile);
    if (validateErrors.length > 0) {
        winston.error('Errors while validating waterworks.yml file:');
        winston.error(validateErrors.join('\n'));
        process.exit(1);
    }
}

function checkPhases(waterworksFile: WaterworksFile, phaseDeployers: PhaseDeployers) {
    const pipelinePhaseErrors = lifecycle.checkPhases(waterworksFile, phaseDeployers);
    let hadErrors = false;
    for (const pipelineName in pipelinePhaseErrors) {
        if (pipelinePhaseErrors.hasOwnProperty(pipelineName)) {
            const pipelineErrors = pipelinePhaseErrors[pipelineName];
            if (pipelineErrors.length > 0) {
                winston.error(`Errors in pipeline '${pipelineName}': `);
                winston.error(pipelineErrors.join('\n'));
                hadErrors = true;
            }
        }
    }

    if (hadErrors) {
        winston.error('Errors were found while validating your Waterworks file');
        process.exit(1);
    }
}

// TODO - Give name of account instead of ID
async function validateCredentials(accountConfig: AccountConfig) {
    const deployAccount = accountConfig.account_id;
    winston.debug(`Checking that current credentials match account ${deployAccount}`);
    const discoveredId = await iamCalls.showAccount();
    winston.debug(`Currently logged in under account ${discoveredId}`);
    if (!discoveredId) {
        winston.error(`You are not logged into the account ${deployAccount}`);
        process.exit(1);
    }
    else if (deployAccount === discoveredId) {
        return;
    }
    else {
        winston.error(`You are trying to deploy to the account ${deployAccount}, but you are logged into the account ${discoveredId}`);
        process.exit(1);
    }
}

// TODO - ADD SOME PIPELINECONTEXT OBJECT. This would replace the many things we pass around individually
export async function deployAction(waterworksFile: WaterworksFile, argv: ParsedArgs) {
    configureLogger(argv);
    const phaseDeployers = util.getPhaseDeployers();
    validateWaterworksFile(waterworksFile);
    checkPhases(waterworksFile, phaseDeployers);
    const nonInteractive = (argv.pipeline && argv.account_name && argv.secrets);

    try {
        if(!nonInteractive) {
            winston.info('Welcome to the Waterworks setup wizard');
        }
        const pipelineParameters = await input.getPipelineParameters(argv);
        const accountName = pipelineParameters.accountName;
        const accountConfig = util.getAccountConfig(pipelineParameters.accountConfigsPath, accountName);
        winston.debug(`Using account config: ${JSON.stringify(accountConfig)}`);

        await validateCredentials(accountConfig);
        AWS.config.update({ region: accountConfig.region });
        const pipelineName = pipelineParameters.pipelineToDeploy;
        if (!waterworksFile.pipelines[pipelineName]) {
            throw new Error(`The pipeline '${pipelineName}' you specified doesn't exist in your Waterworks file`);
        }
        const codePipelineBucketName = getCodePipelineBucketName(accountConfig);
        await s3Calls.createBucketIfNotExists(codePipelineBucketName, accountConfig.region);
        let phasesSecrets;
        if(nonInteractive) {
            phasesSecrets = lifecycle.getSecretsFromArgv(waterworksFile, argv);
        } else {
            phasesSecrets = await lifecycle.getPhaseSecrets(phaseDeployers, waterworksFile, pipelineName);
        }
        const pipelinePhases = await lifecycle.deployPhases(phaseDeployers, waterworksFile, pipelineName, accountConfig, phasesSecrets, codePipelineBucketName);
        await lifecycle.deployPipeline(waterworksFile, pipelineName, accountConfig, pipelinePhases, codePipelineBucketName);
        await lifecycle.addWebhooks(phaseDeployers, waterworksFile, pipelineName, accountConfig, codePipelineBucketName);
        winston.info(`Finished creating pipeline in ${accountConfig.account_id}`);
    } catch(err) {
        winston.error(`Error setting up Waterworks: ${err.message}`);
        winston.error(err);
        process.exit(1);
    }
}

export function checkAction(waterworksFile: WaterworksFile, argv: ParsedArgs) {
    configureLogger(argv);
    const phaseDeployers = util.getPhaseDeployers();
    lifecycle.validatePipelineSpec(waterworksFile);
    checkPhases(waterworksFile, phaseDeployers);
    winston.info('No errors were found in your Handel-CodePipeline file');
}

export async function deleteAction(waterworksFile: WaterworksFile, argv: ParsedArgs) {
    configureLogger(argv);
    if(!(argv.pipeline && argv.account_name)) {
        winston.info('Welcome to the Handel CodePipeline deletion wizard');
    }

    const phaseDeployers = util.getPhaseDeployers();

    const pipelineConfig = await input.getPipelineConfigForDelete(argv);
    const accountName = pipelineConfig.accountName;
    const accountConfig = util.getAccountConfig(pipelineConfig.accountConfigsPath, accountName);

    await validateCredentials(accountConfig);
    AWS.config.update({ region: accountConfig.region });
    const codePipelineBucketName = getCodePipelineBucketName(accountConfig);
    const pipelineName = pipelineConfig.pipelineToDelete;
    const appName = waterworksFile.name;

    try {
        await lifecycle.removeWebhooks(phaseDeployers, waterworksFile, pipelineName, accountConfig, codePipelineBucketName);
        await lifecycle.deletePipeline(appName, pipelineName);
        return lifecycle.deletePhases(phaseDeployers, waterworksFile, pipelineName, accountConfig, codePipelineBucketName);
    }
    catch (err) {
        winston.error(`Error deleting Handel CodePipeline: ${err}`);
        winston.error(err);
        process.exit(1);
    }
}

export async function listSecretsAction(waterworksFile: WaterworksFile, argv: ParsedArgs) {
    if(!argv.pipeline) {
        winston.error('The --pipeline argument is required');
        process.exit(1);
    }
    if (!waterworksFile.pipelines[argv.pipeline]) {
        throw new Error(`The pipeline '${argv.pipeline}' you specified doesn't exist in your Handel-Codepipeline file`);
    }
    const phaseDeployers = util.getPhaseDeployers();
    const phaseDeployerSecretsQuestions: PhaseSecretQuestion[] = [];
    const pipelineConfig = waterworksFile.pipelines[argv.pipeline];
    for(const phaseConfig of pipelineConfig.phases) {
        const phaseDeployer = phaseDeployers[phaseConfig.type];
        const questions = phaseDeployer.getSecretQuestions(phaseConfig);
        questions.forEach((question: PhaseSecretQuestion) => {
            phaseDeployerSecretsQuestions.push(question);
        });
        // phaseDeployerSecretsQuestions.concat(questions);
    }
    // tslint:disable-next-line:no-console
    console.log(JSON.stringify(phaseDeployerSecretsQuestions));
}

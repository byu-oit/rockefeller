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
import * as stsCalls from '../aws/sts-calls';
import * as util from '../common/util';
import { PhaseDeployers, PhaseSecretQuestion, RockefellerFile } from '../datatypes/index';
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

function validateRockefellerFile(rockefellerFile: RockefellerFile) {
    const validateErrors = lifecycle.validatePipelineSpec(rockefellerFile);
    if (validateErrors.length > 0) {
        winston.error('Errors while validating rockefeller.yml file:');
        winston.error(validateErrors.join('\n'));
        process.exit(1);
    }
}

function checkPhases(rockefellerFile: RockefellerFile, phaseDeployers: PhaseDeployers) {
    const pipelinePhaseErrors = lifecycle.checkPhases(rockefellerFile, phaseDeployers);
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
        winston.error('Errors were found while validating your Rockefeller file');
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
export async function deployAction(rockefellerFile: RockefellerFile, argv: ParsedArgs) {
    await stsCalls.validateLoggedIn();
    configureLogger(argv);
    const phaseDeployers = await util.getPhaseDeployers();
    validateRockefellerFile(rockefellerFile);
    checkPhases(rockefellerFile, phaseDeployers);
    const nonInteractive = (argv.pipeline && argv.account_name && argv.secrets);

    try {
        if (!nonInteractive) {
            winston.info('Welcome to the Rockefeller setup wizard');
        }
        const pipelineParameters = await input.getPipelineParameters(argv);
        const accountName = pipelineParameters.accountName;
        const accountConfig = util.getAccountConfig(pipelineParameters.accountConfigsPath, accountName);
        winston.debug(`Using account config: ${JSON.stringify(accountConfig)}`);

        await validateCredentials(accountConfig);
        AWS.config.update({ region: accountConfig.region });
        const pipelineName = pipelineParameters.pipelineToDeploy;
        if (!rockefellerFile.pipelines[pipelineName]) {
            throw new Error(`The pipeline '${pipelineName}' you specified doesn't exist in your Rockefeller file`);
        }
        const codePipelineBucketName = getCodePipelineBucketName(accountConfig);
        await s3Calls.createBucketIfNotExists(codePipelineBucketName, accountConfig.region);
        let phasesSecrets;
        if (nonInteractive) {
            phasesSecrets = lifecycle.getSecretsFromArgv(rockefellerFile, argv);
        } else {
            phasesSecrets = await lifecycle.getPhaseSecrets(phaseDeployers, rockefellerFile, pipelineName);
        }
        const pipelinePhases = await lifecycle.deployPhases(phaseDeployers, rockefellerFile, pipelineName, accountConfig, phasesSecrets, codePipelineBucketName);
        await lifecycle.deployPipeline(rockefellerFile, pipelineName, accountConfig, pipelinePhases, codePipelineBucketName);
        await lifecycle.addWebhooks(phaseDeployers, rockefellerFile, pipelineName, accountConfig, codePipelineBucketName);
        winston.info(`Finished creating pipeline in ${accountConfig.account_id}`);
    } catch (err) {
        // when the account_config_path is not correct, then this block of code is hit.
        // Have it ask again instead
        winston.error(`Error setting up Rockefeller: ${err.message}`);
        winston.error(err);
        process.exit(1);
    }
}

export async function checkAction(rockefellerFile: RockefellerFile, argv: ParsedArgs) {
    configureLogger(argv);
    const phaseDeployers = await util.getPhaseDeployers();
    lifecycle.validatePipelineSpec(rockefellerFile);
    checkPhases(rockefellerFile, phaseDeployers);
    winston.info('No errors were found in your Handel-CodePipeline file');
}

export async function deleteAction(rockefellerFile: RockefellerFile, argv: ParsedArgs) {
    configureLogger(argv);
    if (!(argv.pipeline && argv.account_name)) {
        winston.info('Welcome to the Handel CodePipeline deletion wizard');
    }

    const phaseDeployers = await util.getPhaseDeployers();

    const pipelineConfig = await input.getPipelineConfigForDelete(argv);
    const accountName = pipelineConfig.accountName;
    const accountConfig = util.getAccountConfig(pipelineConfig.accountConfigsPath, accountName);

    await validateCredentials(accountConfig);
    AWS.config.update({ region: accountConfig.region });
    const codePipelineBucketName = getCodePipelineBucketName(accountConfig);
    const pipelineName = pipelineConfig.pipelineToDelete;
    const appName = rockefellerFile.name;

    try {
        await lifecycle.removeWebhooks(phaseDeployers, rockefellerFile, pipelineName, accountConfig, codePipelineBucketName);
        await lifecycle.deletePipeline(appName, pipelineName);
        return lifecycle.deletePhases(phaseDeployers, rockefellerFile, pipelineName, accountConfig, codePipelineBucketName);
    }
    catch (err) {
        winston.error(`Error deleting Handel CodePipeline: ${err}`);
        winston.error(err);
        process.exit(1);
    }
}

export async function listSecretsAction(rockefellerFile: RockefellerFile, argv: ParsedArgs) {
    if (!argv.pipeline) {
        winston.error('The --pipeline argument is required');
        process.exit(1);
    }
    if (!rockefellerFile.pipelines[argv.pipeline]) {
        throw new Error(`The pipeline '${argv.pipeline}' you specified doesn't exist in your Handel-Codepipeline file`);
    }
    const phaseDeployers = await util.getPhaseDeployers();
    const phaseDeployerSecretsQuestions: PhaseSecretQuestion[] = [];
    const pipelineConfig = rockefellerFile.pipelines[argv.pipeline];
    for (const phaseConfig of pipelineConfig.phases) {
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

export async function redefineAccountConfigsPath(argv: ParsedArgs) {
    winston.info('This command will overwrite your account configs path.');
    try {
        // Double check that this is all I need to do
        const newPath = await input.redefineAccountConfigsPathSetup(argv);
        winston.info(`Your account_configs_path is now set to ${newPath}.`);
    } catch(e) {
        throw new Error(`Unable to redefine account_configs_path: ${e}`);
    }
}

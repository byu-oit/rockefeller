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
import * as inquirer from 'inquirer';
import * as winston from 'winston';
import * as cloudformationCalls from '../../aws/cloudformation-calls';
import * as deployersCommon from '../../common/deployers-common';
import * as util from '../../common/util';
import { PhaseConfig, PhaseContext, PhaseSecretQuestion, PhaseSecrets } from '../../datatypes/index';

export interface SlackNotifyConfig extends PhaseConfig {
    message: string;
    channel: string;
}

const STACK_NAME = 'RockefellerSlackNotifyLambda';

function getSlackNotifyPhaseSpec(phaseContext: PhaseContext<SlackNotifyConfig>, notifyFunctionName: string): AWS.CodePipeline.StageDeclaration {
    const userParameters = {
        webhook: phaseContext.secrets.slackUrl,
        message: phaseContext.params.message,
        username: 'CodePipeline Notify',
        channel: phaseContext.params.channel
    };

    return {
        name: phaseContext.phaseName,
        actions: [
            {
                inputArtifacts: [],
                name: phaseContext.phaseName,
                actionTypeId: {
                    category: 'Invoke',
                    owner: 'AWS',
                    version: '1',
                    provider: 'Lambda'
                },
                configuration: {
                    FunctionName: notifyFunctionName,
                    UserParameters: JSON.stringify(userParameters)
                },
                runOrder: 1
            }
        ]
    };
}

export function check(phaseConfig: SlackNotifyConfig): string[] {
    const errors = [];

    if(!phaseConfig.channel) {
        errors.push(`Slack Notify - The 'channel' parameter is required`);
    }
    if(!phaseConfig.message) {
        errors.push(`Slack Notify - The 'message' parameter is required`);
    }

    return errors;
}

export function getSecretsForPhase(phaseConfig: SlackNotifyConfig): Promise<PhaseSecrets> {
    return inquirer.prompt(getQuestions(phaseConfig));
}

function getQuestions(phaseConfig: PhaseConfig) {
    return [
        {
            type: 'input',
            name: 'slackUrl',
            message: `'${phaseConfig.name}' phase - Please enter the URL for Slack Notifications`,
        }
    ];
}

export function getSecretQuestions(phaseConfig: PhaseConfig): PhaseSecretQuestion[] {
    const questions = getQuestions(phaseConfig);
    const result: PhaseSecretQuestion[] = [];
    questions.forEach((question) => {
        result.push({
            phaseName: phaseConfig.name,
            name: question.name,
            message: question.message
        });
    });
    return result;
}

export async function deployPhase(phaseContext: PhaseContext<SlackNotifyConfig>): Promise<AWS.CodePipeline.StageDeclaration> {
    winston.info(`Creating slack_notify phase '${phaseContext.phaseName}'`);

    let stack = await cloudformationCalls.getStack(STACK_NAME);
    if (!stack) {
        winston.info(`Creating Lambda function for Slack notifications`);
        const role = await deployersCommon.createLambdaCodePipelineRole(phaseContext.accountConfig.account_id);
        if(!role) {
            throw new Error(`Could not create role for Slack Notify lambda`);
        }
        const directoryToUpload = `${__dirname}/slack-notify-code`;
        const s3FileName = 'rockefeller/slackNotifyLambda';
        const s3BucketName = `codepipeline-${phaseContext.accountConfig.region}-${phaseContext.accountConfig.account_id}`;
        const s3ObjectInfo = await deployersCommon.uploadDirectoryToBucket(directoryToUpload, s3FileName, s3BucketName);
        const template = util.loadFile(`${__dirname}/lambda.yml`);
        if(!template) {
            throw new Error(`Could not load template for Slack Notify Lambda`);
        }
        const parameters = {
            S3Bucket: s3ObjectInfo.Bucket,
            S3Key: s3ObjectInfo.Key,
            Description: 'Lambda Function for the Slack notify phase in Rockefeller',
            FunctionName: STACK_NAME,
            Handler: 'notify.send_post',
            MemorySize: '128',
            RoleArn: role.Arn,
            Runtime: 'python3.6',
            Timeout: '5'
        };
        stack = await cloudformationCalls.createStack(STACK_NAME, template, cloudformationCalls.getCfStyleStackParameters(parameters));
    }
    const functionName = cloudformationCalls.getOutput('FunctionName', stack);
    return getSlackNotifyPhaseSpec(phaseContext, functionName);
}

export function deletePhase(phaseContext: PhaseContext<SlackNotifyConfig>): Promise<boolean> {
    winston.info(`Nothing to delete for slack_notify phase '${phaseContext.phaseName}'`);
    return Promise.resolve(true); // Nothing to delete
}

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
import * as  winston from 'winston';
import * as codeBuildCalls from '../../aws/codebuild-calls';
import * as iamCalls from '../../aws/iam-calls';
import * as checkPhase from '../../common/check-phase';
import * as util from '../../common/util';
import {
    PhaseConfig,
    PhaseContext,
    PhaseDeployer,
    PhaseSecretQuestion,
    PhaseSecrets
} from '../../datatypes/index';

export interface HandelDeleteConfig extends PhaseConfig {
    environments_to_delete: string[];
}

function getDeleteProjectName(phaseContext: PhaseContext<HandelDeleteConfig>): string {
    return `${phaseContext.appName}-${phaseContext.pipelineName}-${phaseContext.phaseName}`;
}

const DELETE_PHASE_ROLE_NAME = 'RockefellerDeletePhaseServiceRole';

function getDeleteServiceRoleArn(accountId: string): string {
    return `arn:aws:iam::${accountId}:policy/rockefeller/${DELETE_PHASE_ROLE_NAME}`;
}

async function createDeletePhaseServiceRole(accountId: string): Promise<AWS.IAM.Role | null> {
    const roleName = DELETE_PHASE_ROLE_NAME;
    const policyArn = getDeleteServiceRoleArn(accountId);
    const policyDocument = util.loadJsonFile(`${__dirname}/delete-phase-service-policy.json`);
    return iamCalls.createOrUpdateRoleAndPolicy(roleName, ['codebuild.amazonaws.com'], policyArn, policyDocument);
}

async function createDeletePhaseCodeBuildProject(phaseContext: PhaseContext<HandelDeleteConfig>): Promise<AWS.CodeBuild.Project> {
    const {appName, pipelineName, phaseName} = phaseContext;
    const deleteProjectName = getDeleteProjectName(phaseContext);
    const deletePhaseRole = await createDeletePhaseServiceRole(phaseContext.accountConfig.account_id);
    if(!deletePhaseRole) {
        throw new Error(`Could not create Handel delete phase role`);
    }
    const handelDeleteEnvVars = {
        ENVS_TO_DELETE: phaseContext.params.environments_to_delete.join(','),
        HANDEL_ACCOUNT_CONFIG: new Buffer(JSON.stringify(phaseContext.accountConfig)).toString('base64')
    };
    const handelDeleteImage = 'aws/codebuild/nodejs:6.3.1';
    const handelDeleteBuildSpecPath = `${__dirname}/delete-buildspec.yml`;
    const handelDeleteBuildSpec = util.loadFile(handelDeleteBuildSpecPath);
    if(!handelDeleteBuildSpec) {
        throw new Error(`Could not load Handel delete phase build spec from ${handelDeleteBuildSpecPath}`);
    }

    const buildProject = await codeBuildCalls.getProject(deleteProjectName);
    if (!buildProject) {
        winston.info(`Creating Handel delete phase CodeBuild project ${deleteProjectName}`);
        return codeBuildCalls.createProject({
            projectName: deleteProjectName,
            appName: appName,
            pipelineName: pipelineName,
            phaseName: phaseName,
            imageName: handelDeleteImage,
            environmentVariables: handelDeleteEnvVars,
            accountId: phaseContext.accountConfig.account_id.toString(),
            serviceRoleArn: deletePhaseRole.Arn,
            region: phaseContext.accountConfig.region,
            buildSpec: handelDeleteBuildSpec
        });
    }
    else {
        winston.info(`Updating Handel delete phase CodeBuild project ${deleteProjectName}`);
        return codeBuildCalls.updateProject({
            projectName: deleteProjectName,
            appName: appName,
            pipelineName: pipelineName,
            phaseName: phaseName,
            imageName: handelDeleteImage,
            environmentVariables: handelDeleteEnvVars,
            accountId: phaseContext.accountConfig.account_id.toString(),
            serviceRoleArn: deletePhaseRole.Arn,
            region: phaseContext.accountConfig.region,
            buildSpec: handelDeleteBuildSpec
        });
    }
}

function getCodePipelinePhaseSpec(phaseContext: PhaseContext<HandelDeleteConfig>): AWS.CodePipeline.StageDeclaration {
    return {
        name: phaseContext.phaseName,
        actions: [
            {
                inputArtifacts: [
                    {
                        name: `Output_Build`
                    }
                ],
                name: phaseContext.phaseName,
                actionTypeId: {
                    category: 'Test',
                    owner: 'AWS',
                    version: '1',
                    provider: 'CodeBuild'
                },
                configuration: {
                    ProjectName: getDeleteProjectName(phaseContext)
                },
                runOrder: 1
            }
        ]
    };
}

export class Phase implements PhaseDeployer {
    public check(phaseConfig: HandelDeleteConfig): string[] {
        return checkPhase.checkJsonSchema(`${__dirname}/params-schema.json`, phaseConfig);
    }

    public getSecretsForPhase(phaseConfig: HandelDeleteConfig): Promise<PhaseSecrets> {
        return Promise.resolve({});
    }

    public getSecretQuestions(phaseConfig: PhaseConfig): PhaseSecretQuestion[] {
        return [];
    }

    public async deployPhase(phaseContext: PhaseContext<HandelDeleteConfig>): Promise<AWS.CodePipeline.StageDeclaration> {
        await createDeletePhaseCodeBuildProject(phaseContext);
        return getCodePipelinePhaseSpec(phaseContext);
    }

    public async deletePhase(phaseContext: PhaseContext<HandelDeleteConfig>): Promise<boolean> {
        const codeBuildProjectName = getDeleteProjectName(phaseContext);
        winston.info(`Delete CodeBuild project for '${codeBuildProjectName}'`);
        await codeBuildCalls.deleteProject(codeBuildProjectName);
        return true;
    }
}

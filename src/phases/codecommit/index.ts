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
import * as winston from 'winston';
import {
    PhaseConfig,
    PhaseContext,
    PhaseDeployer,
    PhaseSecretQuestion,
    PhaseSecrets
} from '../../datatypes/index';

export interface CodeCommitConfig extends PhaseConfig {
    repo: string;
    branch: string;
}

export class Phase implements PhaseDeployer {
    public check(phaseConfig: CodeCommitConfig): string[] {
        const errors = [];

        if (!phaseConfig.repo) {
            errors.push(`GitHub - The 'repo' parameter is required`);
        }
        if (!phaseConfig.branch) {
            errors.push(`GitHub - The 'branch' parameter is required`);
        }

        return errors;
    }

    public getSecretsForPhase(phaseConfig: CodeCommitConfig): Promise<PhaseSecrets> {
        return Promise.resolve({});
    }

    public getSecretQuestions(phaseConfig: PhaseConfig): PhaseSecretQuestion[] {
        return [];
    }

    public deployPhase(phaseContext: PhaseContext<CodeCommitConfig>): Promise<AWS.CodePipeline.StageDeclaration> {
        winston.info(`Creating source phase '${phaseContext.phaseName}'`);
        const branch = phaseContext.params.branch || 'master';

        return Promise.resolve({
            name: phaseContext.phaseName,
            actions: [
                {
                    inputArtifacts: [],
                    name: phaseContext.phaseName,
                    actionTypeId: {
                        category: 'Source',
                        owner: 'AWS',
                        version: '1',
                        provider: 'CodeCommit'
                    },
                    outputArtifacts: [
                        {
                            name: `Output_Source`
                        }
                    ],
                    configuration: {
                        RepositoryName: phaseContext.params.repo,
                        BranchName: branch
                    },
                    runOrder: 1
                }
            ]
        });
    }

    public deletePhase(phaseContext: PhaseContext<CodeCommitConfig>): Promise<boolean> {
        winston.info(`Nothing to delete for source phase '${phaseContext.phaseName}'`);
        return Promise.resolve(true); // Nothing to delete
    }
}

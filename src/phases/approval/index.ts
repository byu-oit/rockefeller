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
import * as winston from 'winston';
import { PhaseConfig, PhaseContext, PhaseSecretQuestion, PhaseSecrets } from '../../datatypes/index';

function getApprovalPhaseSpec(phaseContext: PhaseContext<PhaseConfig>): AWS.CodePipeline.StageDeclaration {
    return {
        name: phaseContext.phaseName,
        actions: [
            {
                inputArtifacts: [],
                outputArtifacts: [],
                name: phaseContext.phaseName,
                actionTypeId: {
                    category: 'Approval',
                    owner: 'AWS',
                    version: '1',
                    provider: 'Manual'
                },
                configuration: {},
                runOrder: 1
            }
        ]
    };
}

// TODO - Document PhaseDeploy contract in user documentation (part of extensions work)

// TODO - Make check optional
export function check(phaseConfig: PhaseConfig): string[] {
    // No required parameters
    return [];
}

// TODO - Make getSecretsForPhase optional
export async function getSecretsForPhase(phaseConfig: PhaseConfig): Promise<PhaseSecrets> {
    return {};
}

// TODO - Make getSecretQuestions optional
export function getSecretQuestions(phaseConfig: PhaseConfig): PhaseSecretQuestion[] {
    return [];
}

export async function deployPhase(phaseContext: PhaseContext<PhaseConfig>, accountConfig: AccountConfig): Promise<AWS.CodePipeline.StageDeclaration> {
    winston.info(`Creating manual approval phase '${phaseContext.phaseName}'`);
    return getApprovalPhaseSpec(phaseContext);
}

export async function deletePhase(phaseContext: PhaseContext<PhaseConfig>, accountConfig: AccountConfig): Promise<boolean> {
    winston.info(`Nothing to delete for source phase '${phaseContext.phaseName}'`);
    return true; // Nothing to delete
}

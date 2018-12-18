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
import * as checkPhase from '../../common/check-phase';
import {
    PhaseConfig,
    PhaseContext,
    PhaseDeployer,
    PhaseSecretQuestion,
    PhaseSecrets,
} from '../../datatypes/index';

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

export class Phase implements PhaseDeployer {
    // TODO - Make check optional
    public check(phaseConfig: PhaseConfig): string[] {
        // The parameters are (whereToFindTheSchema, WhatTypeToCheckAgainst)
        // The function is made to function off of handel file types, so I will rewrite the function to allow
        // for rockefeller file checks
        return checkPhase.checkJsonSchema(`${__dirname}/params-schema.json`, phaseConfig);
    }

    // TODO - Make getSecretsForPhase optional
    public async getSecretsForPhase(phaseConfig: PhaseConfig): Promise<PhaseSecrets> {
        return {};
    }

    // TODO - Make getSecretQuestions optional
    public getSecretQuestions(phaseConfig: PhaseConfig): PhaseSecretQuestion[] {
        return [];
    }

    public async deployPhase(phaseContext: PhaseContext<PhaseConfig>): Promise<AWS.CodePipeline.StageDeclaration> {
        winston.info(`Creating manual approval phase '${phaseContext.phaseName}'`);
        return getApprovalPhaseSpec(phaseContext);
    }

    public async deletePhase(phaseContext: PhaseContext<PhaseConfig>): Promise<boolean> {
        winston.info(`Nothing to delete for source phase '${phaseContext.phaseName}'`);
        return true; // Nothing to delete
    }

}

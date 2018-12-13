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
import { ParsedArgs } from 'minimist';
import * as codepipelineCalls from '../aws/codepipeline-calls';
import {
    PhaseConfig,
    PhaseContext,
    PhaseDeployers,
    PhaseSecrets,
    PhasesSecrets,
    PipelineContext,
    RockefellerFile
} from '../datatypes';

interface PipelineCheckErrors {
    [pipelineName: string]: string[];
}

function deployPhase(
    phaseContext: PhaseContext<PhaseConfig>,
    phaseDeployers: PhaseDeployers
): Promise<AWS.CodePipeline.StageDeclaration> {
    return Promise.resolve()
        .then(async () => {
            const phaseDeployer = phaseDeployers[phaseContext.phaseType];
            if (!phaseDeployer) {
                throw new Error(`Invalid or unsupported pipeline phase type ${phaseContext.phaseType}`);
            }
            else {
                // TODO - Remove second accountConfig parameter (it is already inside phaseContext)
                return await phaseDeployer.deployPhase(phaseContext);
            }
        });
}

export function checkPhases(
    rockefellerFile: RockefellerFile,
    phaseDeployers: PhaseDeployers
): PipelineCheckErrors {
    const pipelineErrors: PipelineCheckErrors = {};

    for (const pipelineName in rockefellerFile.pipelines) {
        if (rockefellerFile.pipelines.hasOwnProperty(pipelineName)) {
            pipelineErrors[pipelineName] = [];
            const pipelineConfig = rockefellerFile.pipelines[pipelineName];
            for (const phaseConfig of pipelineConfig.phases) {
                const phaseType = phaseConfig.type;
                const phaseDeployer = phaseDeployers[phaseType];
                if (!phaseDeployer) {
                    pipelineErrors[pipelineName] = [
                        `You specified an invalid phase type: '${phaseType}'`
                    ];
                }
                else {
                    const errors = phaseDeployer.check(phaseConfig);
                    pipelineErrors[pipelineName] = pipelineErrors[pipelineName].concat(errors);
                }
            }
        }
    }

    return pipelineErrors;
}

// TODO - Turn this into a JSON schema document
export function validatePipelineSpec(rockefellerFile: RockefellerFile): string[] {
    const errors: string[] = [];

    if (!rockefellerFile.name) {
        errors.push(`The top-level 'name' field is required`);
    }

    if (!rockefellerFile.pipelines || Object.keys(rockefellerFile.pipelines).length === 0) {
        errors.push(`You must specify at least one or more pipelines in the 'pipelines' field`);
    }
    else {
        for (const pipelineName in rockefellerFile.pipelines) {
            if (rockefellerFile.pipelines.hasOwnProperty(pipelineName)) {
                const pipelineDef = rockefellerFile.pipelines[pipelineName];
                if (!pipelineDef.phases) {
                    errors.push(`You must specify at least one or more phases in your pipeline ${pipelineName}`);
                }
                else {
                    // TODO - Don't make them have a build phase
                    // Validate first phase is github
                    if (pipelineDef.phases.length < 2) {
                        errors.push(`You must specify at least two phases: github and codebuild`);
                    }
                    else {
                        if (pipelineDef.phases[0].type !== 'github' && pipelineDef.phases[0].type !== 'codecommit') {
                            errors.push(`The first phase in your pipeline ${pipelineName} must be a 'github' or 'codecommit' phase`);
                        }
                        if (pipelineDef.phases[1].type !== 'codebuild') {
                            errors.push(`The second phase in your application ${pipelineName} must be a codebuild phase`);
                        }
                    }

                    // Validate each phase has a type and name
                    for (const phaseSpec of pipelineDef.phases) {
                        if (!phaseSpec.type) {
                            errors.push(`You must specify a type for all the phases in your pipeline ${pipelineName}`);
                        }
                        if (!phaseSpec.name) {
                            errors.push(`You must specify a name for all the phases in your pipeline ${pipelineName}`);
                        }
                    }
                }
            }
        }
    }

    return errors;
}

export async function getPhaseSecrets(
    phaseDeployers: PhaseDeployers,
    rockefellerFile: RockefellerFile,
    pipelineName: string
) {
    const pipelineSecrets: PhasesSecrets = {};

    for(const phaseSpec of rockefellerFile.pipelines[pipelineName].phases) {
        const phaseType = phaseSpec.type;
        const phaseDeployer = phaseDeployers[phaseType];
        const phaseSecrets = await phaseDeployer.getSecretsForPhase(phaseSpec);
        pipelineSecrets[phaseSpec.name] = phaseSecrets;
    }

    return pipelineSecrets;
}

export function getSecretsFromArgv(
    rockefellerFile: RockefellerFile,
    argv: ParsedArgs
): PhasesSecrets {
    argv.secrets = JSON.parse(new Buffer(argv.secrets, 'base64').toString());
    const pipelinePhases = rockefellerFile.pipelines[argv.pipeline].phases;
    const result: PhasesSecrets = {};
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < pipelinePhases.length; i++) {
        const phase = pipelinePhases[i];
        const phaseSecrets: PhaseSecrets = {};
        for(const secret of argv.secrets) {
            if(secret.phaseName === phase.name) {
                phaseSecrets[secret.name] = secret.value;
            }
        }
        result[phase.name] = phaseSecrets;
    }
    return result;
}

export function deployPhases(
    phaseDeployers: PhaseDeployers,
    pipelineContext: PipelineContext
) {
    // This is not populating when I run the function in the tests, is it just this function, or the test?
    const deployPromises = [];

    // tslint:disable-next-line:forin
    for (const phaseName in pipelineContext.phaseContexts) {
        const phaseContext = pipelineContext.phaseContexts[phaseName];
        deployPromises.push(deployPhase(phaseContext, phaseDeployers));
    }

    return Promise.all(deployPromises);
}

export async function deployPipeline(
    pipelinePhases: AWS.CodePipeline.StageDeclaration[],
    pipelineContext: PipelineContext
) {
    const appName = pipelineContext.appName;
    const pipelineProjectName = codepipelineCalls.getPipelineProjectName(appName, pipelineContext.pipelineName);

    const pipeline = await codepipelineCalls.getPipeline(pipelineProjectName);
    if (!pipeline) {
        return codepipelineCalls.createPipeline(appName, pipelineContext.pipelineName, pipelineContext.accountConfig, pipelinePhases, pipelineContext.codepipelineBucketName);
    }
    else {
        return codepipelineCalls.updatePipeline(appName, pipelineContext.pipelineName, pipelineContext.accountConfig, pipelinePhases, pipelineContext.codepipelineBucketName);
    }
}

export function deletePhases(
    phaseDeployers: PhaseDeployers,
    pipelineContext: PipelineContext
) {
    const deletePromises = [];

    // tslint:disable-next-line:forin
    for (const phaseName in pipelineContext.phaseContexts) {
        const phaseContext = pipelineContext.phaseContexts[phaseName];
        const phaseDeployer = phaseDeployers[phaseContext.phaseType];
        deletePromises.push(phaseDeployer.deletePhase(phaseContext));
    }

    return Promise.all(deletePromises);
}

export function deletePipeline(pipelineContext: PipelineContext) {
    return codepipelineCalls.deletePipeline(pipelineContext.appName, pipelineContext.pipelineName);
}

export async function addWebhooks(
    phaseDeployers: PhaseDeployers,
    pipelineContext: PipelineContext
) {
    // tslint:disable-next-line:forin
    for (const phaseName in pipelineContext.phaseContexts) {
        const phaseContext = pipelineContext.phaseContexts[phaseName];
        const phaseDeployer = phaseDeployers[phaseContext.phaseType];
        if (phaseDeployer.addWebhook) {
            await phaseDeployer.addWebhook(phaseContext);
        }
    }
}

export async function removeWebhooks(
    phaseDeployers: PhaseDeployers,
    pipelineContext: PipelineContext
) {
    // tslint:disable-next-line:forin
    for (const phaseName in pipelineContext.phaseContexts) {
        const phaseContext = pipelineContext.phaseContexts[phaseName];
        const phaseDeployer = phaseDeployers[phaseContext.phaseType];
        if (phaseDeployer.removeWebhook) {
            await phaseDeployer.removeWebhook(phaseContext);
        }
    }
}

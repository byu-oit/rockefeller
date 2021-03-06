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
import { expect } from 'chai';
import { AccountConfig } from 'handel-extension-api';
import * as sinon from 'sinon';
import * as codepipelineCalls from '../../src/aws/codepipeline-calls';
import * as util from '../../src/common/util';
import {
    PhaseConfig,
    PhaseContext,
    PhaseDeployers,
    PipelineContext,
    RockefellerFile
} from '../../src/datatypes/index';
import * as lifecycle from '../../src/lifecycle';

describe('lifecycle module', () => {
    let sandbox: sinon.SinonSandbox;
    let rockefellerFile: RockefellerFile;
    let phaseDeployers: PhaseDeployers;
    let accountConfig: AccountConfig;
    let pipelineContext: PipelineContext;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();

        accountConfig = util.loadYamlFile(`${__dirname}/../example-account-config.yml`);

        rockefellerFile = {
            version: 1,
            name: 'FakePipeline',
            pipelines: {
                prd: {
                    phases: [
                        {
                            type: 'github',
                            name: 'Source'
                        },
                        {
                            type: 'codebuild',
                            name: 'Build'
                        }
                    ]
                }
            }
        };

        phaseDeployers = {
            github: {
                check: (phaseConfig: PhaseConfig) => { throw new Error('NOT IMPLEMENTED'); },
                getSecretsForPhase: (phaseConfig: PhaseConfig) => { throw new Error('NOT IMPLEMENTED'); },
                getSecretQuestions: (phaseConfig: PhaseConfig) => { throw new Error('NOT IMPLEMENTED'); },
                deployPhase: (phaseContext: PhaseContext<PhaseConfig>) => { throw new Error('NOT IMPLEMENTED'); },
                deletePhase: (phaseContext: PhaseContext<PhaseConfig>) => { throw new Error('NOT IMPLEMENTED'); }
            },
            codebuild: {
                check: (phaseConfig: PhaseConfig) => { throw new Error('NOT IMPLEMENTED'); },
                getSecretsForPhase: (phaseConfig: PhaseConfig) => { throw new Error('NOT IMPLEMENTED'); },
                getSecretQuestions: (phaseConfig: PhaseConfig) => { throw new Error('NOT IMPLEMENTED'); },
                deployPhase: (phaseContext: PhaseContext<PhaseConfig>) => { throw new Error('NOT IMPLEMENTED'); },
                deletePhase: (phaseContext: PhaseContext<PhaseConfig>) => { throw new Error('NOT IMPLEMENTED'); }
            }
        };

        const pipelineName = 'prd';
        const codePipelineBucketName = 'someCodepieplineBucketName';
        pipelineContext = new PipelineContext(rockefellerFile.version, rockefellerFile.name, pipelineName, accountConfig, codePipelineBucketName);
        for(const phase of rockefellerFile.pipelines[pipelineName].phases) {
            pipelineContext.phaseContexts[phase.name] = new PhaseContext(rockefellerFile.name, phase.name, phase.type, codePipelineBucketName, pipelineName, accountConfig, phase, {});
        }
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('checkPhases', () => {
        it('should execute check on each phase', () => {
            const error = 'SomeError';
            rockefellerFile.pipelines.prd.phases = [{
                type: 'github',
                name: 'Source'
            }];
            phaseDeployers.github.check = (phaseConfig: PhaseConfig) => [ error ];

            const pipelineErrors = lifecycle.checkPhases(rockefellerFile, phaseDeployers);
            expect(pipelineErrors.prd.length).to.equal(1);
            expect(pipelineErrors.prd[0]).to.equal(error);
        });
    });

    describe('validatePipelineSpec', () => {
        it('should require the name field', () => {
            delete rockefellerFile.name;

            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain(`'name' field is required`);
        });

        it('should return an error if no pipelines are specified', () => {
            rockefellerFile.pipelines = {};

            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain('You must specify at least one or more pipelines');
        });

        it('should return an error if no phases are specified in a pipeline', () => {
            delete rockefellerFile.pipelines.prd.phases;

            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain('You must specify at least one or more phases');
        });

        it('should return an error if there are fewer than 2 phases in the pipeline',  () => {
            rockefellerFile.pipelines.prd.phases = [];

            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain('You must specify at least two phases');
        });

        it('should return an error if the first phase is not a github or codecommit phase', () => {
            rockefellerFile.pipelines.prd.phases = [
                {
                    type: 'codebuild',
                    name: 'Build'
                },
                {
                    type: 'codebuild',
                    name: 'Build'
                }
            ];

            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain(`must be a 'github' or 'codecommit' phase`);
        });

        it('should return an error if the second phase is not a codebuild phase', () => {
            rockefellerFile.pipelines.prd.phases = [
                {
                    type: 'github',
                    name: 'Build'
                },
                {
                    type: 'github',
                    name: 'Build'
                }
            ];

            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain('must be a codebuild phase');
        });

        it('should return an error if any phase does not have a type field', () => {
            rockefellerFile.pipelines.prd.phases.push({
                type: 'handel',
                name: 'Deploy'
            });
            delete rockefellerFile.pipelines.prd.phases[2].type;

            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain('must specify a type');
        });

        it('should return an error if any phase does not have a name field', () => {
            delete rockefellerFile.pipelines.prd.phases[1].name;

            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain('must specify a name');
        });

        it('should work if there are no errors', () => {
            const errors = lifecycle.validatePipelineSpec(rockefellerFile);
            expect(errors.length).to.equal(0);
        });
    });

    describe('getPhaseSecrets', () => {
        it('should prompt for secrets from each phase', async () => {
            phaseDeployers.github.getSecretsForPhase = (phaseConfig: PhaseConfig) => Promise.resolve({ githubSecret: 'mysecret' });
            phaseDeployers.codebuild.getSecretsForPhase = (phaseConfig: PhaseConfig) => Promise.resolve({ codeBuildSecret: 'mysecret2' });
            rockefellerFile = util.loadYamlFile(`${__dirname}/handel-codepipeline-example.yml`);
            const pipelineToDeploy = 'dev';

            const results = await lifecycle.getPhaseSecrets(phaseDeployers, rockefellerFile, pipelineToDeploy);

            expect(Object.keys(results).length).to.equal(2);
            expect(results.Source.githubSecret).to.equal('mysecret');
            expect(results.Build.codeBuildSecret).to.equal('mysecret2');
        });
    });

    describe('deployPhases', () => {
        it('should deploy each phase in the pipeline', async () => {
            const githubPhaseResult = {
                name: 'FakeName',
                actions: []
            };
            phaseDeployers.github.deployPhase = (phaseContext) => Promise.resolve(githubPhaseResult);
            const codebuildPhaseResult = {
                name: 'FakeName',
                actions: []
            };
            phaseDeployers.codebuild.deployPhase = (phaseContext) => Promise.resolve(codebuildPhaseResult);
            rockefellerFile = util.loadYamlFile(`${__dirname}/handel-codepipeline-example.yml`);

            const phases = await lifecycle.deployPhases(phaseDeployers, pipelineContext);
            expect(phases.length).to.equal(2);
            expect(phases[0]).to.deep.equal(githubPhaseResult);
            expect(phases[1]).to.deep.equal(codebuildPhaseResult);
        });
    });

    describe('deployPipeline', () => {
        rockefellerFile = util.loadYamlFile(`${__dirname}/handel-codepipeline-example.yml`);
        const pipelinePhases: AWS.CodePipeline.StageDeclaration[] = [];

        it('should create the pipeline', async () => {
            const getPipelineStub = sandbox.stub(codepipelineCalls, 'getPipeline').returns(Promise.resolve(null));
            const createPipelineStub = sandbox.stub(codepipelineCalls, 'createPipeline').returns(Promise.resolve({}));

            const pipeline = await lifecycle.deployPipeline(pipelinePhases, pipelineContext);
            expect(pipeline).to.deep.equal({});
            expect(getPipelineStub.callCount).to.equal(1);
            expect(createPipelineStub.callCount).to.equal(1);
        });

        it('should update the pipeline when it already exists', async () => {
            const getPipelineStub = sandbox.stub(codepipelineCalls, 'getPipeline').returns(Promise.resolve({}));
            const updatePipelineStub = sandbox.stub(codepipelineCalls, 'updatePipeline').returns(Promise.resolve({}));

            const pipeline = await lifecycle.deployPipeline(pipelinePhases, pipelineContext);
            expect(pipeline).to.deep.equal({});
            expect(getPipelineStub.callCount).to.equal(1);
            expect(updatePipelineStub.callCount).to.equal(1);
        });
    });

    describe('deletePhases', () => {
        it('should delete each phase in the pipeline', async () => {
            phaseDeployers.github.deletePhase = (phaseContext) => Promise.resolve(true);
            phaseDeployers.codebuild.deletePhase = (phaseContext) => Promise.resolve(true);
            rockefellerFile = util.loadYamlFile(`${__dirname}/handel-codepipeline-example.yml`);

            const results = await lifecycle.deletePhases(phaseDeployers, pipelineContext);
            expect(results.length).to.equal(2);
            expect(results[0]).to.deep.equal(true);
            expect(results[1]).to.deep.equal(true);
        });
    });

    describe('deletePipeline', () => {
        it('should delete the pipeline', async () => {
            const deletePipelineStub = sandbox.stub(codepipelineCalls, 'deletePipeline').returns(Promise.resolve({}));
            const result = await lifecycle.deletePipeline(pipelineContext);
            expect(result).to.deep.equal({});
            expect(deletePipelineStub.callCount).to.equal(1);
        });
    });

    describe('addWebhooks', () => {
        it('should put webhook and register it', async () => {
            rockefellerFile = util.loadYamlFile(`${__dirname}/handel-codepipeline-example.yml`);
            const addWebhookStub = sandbox.stub().resolves();
            phaseDeployers.github.addWebhook = addWebhookStub;

            await lifecycle.addWebhooks(phaseDeployers, pipelineContext);
            expect(addWebhookStub.callCount).to.equal(1);
        });
    });

    describe('removeWebhooks', () => {
        it('should deregister webhook and delete it', async () => {
            rockefellerFile = util.loadYamlFile(`${__dirname}/handel-codepipeline-example.yml`);
            const removeWebhookStub = sandbox.stub().resolves();
            phaseDeployers.github.removeWebhook = removeWebhookStub;

            await lifecycle.removeWebhooks(phaseDeployers, pipelineContext);
            expect(removeWebhookStub.callCount).to.equal(1);
        });
    });
});

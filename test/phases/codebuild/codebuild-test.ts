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
import * as chai from 'chai';
import {AccountConfig} from 'handel-extension-api';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as codebuildCalls from '../../../src/aws/codebuild-calls';
import * as iamCalls from '../../../src/aws/iam-calls';
// we deleted the handel file
// import * as handel from '../../../src/common/handel';
import * as util from '../../../src/common/util';
import {PhaseContext} from '../../../src/datatypes/index';
import * as codebuild from '../../../src/phases/codebuild';
// import {HandelExtraResources} from '../../../src/phases/codebuild';

chai.use(sinonChai);
const expect = chai.expect;

describe('codebuild phase module', () => {
    let sandbox: sinon.SinonSandbox;
    let accountConfig: AccountConfig;
    let phaseConfig: codebuild.CodeBuildConfig;
    let phaseContext: PhaseContext<codebuild.CodeBuildConfig>;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();

        accountConfig = util.loadYamlFile(`${__dirname}/../../example-account-config.yml`);

        phaseConfig = {
            type: 'codebuild',
            name: 'SomeFunction',
            build_image: 'MyImage'
        };

        phaseContext = new PhaseContext<codebuild.CodeBuildConfig>(
            'myapp',
            'myphase',
            'codebuild',
            'SomeBucket',
            'dev',
            accountConfig,
            phaseConfig,
            {}
        );
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('check', () => {
        it('should require the build_image parameter', () => {
            delete phaseConfig.build_image;
            const errors = codebuild.check(phaseConfig);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`The 'build_image' parameter is required`);
        });

        it('should work when all required parameters are provided', () => {
            const errors = codebuild.check(phaseConfig);
            expect(errors.length).to.equal(0);
        });
    });

    describe('getSecretsForPhase', () => {
        it('should return an empty object', async () => {
            const results = await codebuild.getSecretsForPhase(phaseConfig);
            expect(results).to.deep.equal({});
        });
    });

    describe('deployPhase', () => {
        const role = {
            Arn: 'FakeArn'
        };

        it('should create the codebuild project and return the phase config', async () => {
            const createOrUpdateRoleStub = sandbox.stub(iamCalls, 'createOrUpdateRoleAndPolicy').resolves(role);
            const getProjectStub = sandbox.stub(codebuildCalls, 'getProject').resolves(null);
            const createProjectStub = sandbox.stub(codebuildCalls, 'createProject').resolves({});

            const phase = await codebuild.deployPhase(phaseContext, accountConfig);
            expect(createOrUpdateRoleStub.callCount).to.equal(1);
            expect(getProjectStub.callCount).to.equal(1);
            expect(createProjectStub.callCount).to.equal(1);
        });

        it('should update the codebuild project when it exists', async () => {
            const createOrUpdateRoleStub = sandbox.stub(iamCalls, 'createOrUpdateRoleAndPolicy').resolves(role);
            const getProjectStub = sandbox.stub(codebuildCalls, 'getProject').resolves({});
            const updateProjectStub = sandbox.stub(codebuildCalls, 'updateProject').resolves({});

            const phase = await codebuild.deployPhase(phaseContext, accountConfig);
            expect(createOrUpdateRoleStub.callCount).to.equal(1);
            expect(getProjectStub.callCount).to.equal(1);
            expect(updateProjectStub.callCount).to.equal(1);
        });
    });

    describe('deletePhase', () => {
        it('should delete the codebuild project', async () => {
            const deleteProjectStub = sandbox.stub(codebuildCalls, 'deleteProject').resolves(true);
            const deleteRoleStub = sandbox.stub(iamCalls, 'deleteRole').resolves(true);
            const deletePolicyStub = sandbox.stub(iamCalls, 'deletePolicy').resolves(true);
            const detachPolicyStub = sandbox.stub(iamCalls, 'detachPolicyFromRole').resolves(true);

            const result = await codebuild.deletePhase(phaseContext, accountConfig);
            expect(result).to.equal(true);
            expect(deleteRoleStub.callCount).to.equal(1);
            expect(deletePolicyStub.callCount).to.equal(1);
            expect(detachPolicyStub.callCount).to.equal(1);
            expect(deleteProjectStub.callCount).to.equal(1);
        });
    });
});

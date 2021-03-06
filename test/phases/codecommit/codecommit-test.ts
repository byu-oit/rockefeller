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
import * as util from '../../../src/common/util';
import { PhaseContext } from '../../../src/datatypes/index';
import { Phase } from '../../../src/phases/codecommit';
import * as codecommitParams from '../../../src/phases/codecommit';

describe('github phase module', () => {
    let sandbox: sinon.SinonSandbox;
    let codecommit: Phase;
    let accountConfig: AccountConfig;
    let phaseConfig: codecommitParams.CodeCommitConfig;
    let phaseContext: PhaseContext<codecommitParams.CodeCommitConfig>;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
        codecommit = new Phase();

        accountConfig = util.loadYamlFile(`${__dirname}/../../example-account-config.yml`);

        phaseConfig = {
            type: 'codecommit',
            name: 'Source',
            repo: 'MyRepo',
            branch: 'MyBranch'
        };

        phaseContext = new PhaseContext<codecommitParams.CodeCommitConfig>(
            'myapp',
            'myphase',
            'codecommit',
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
        it('should require the repo parameter', () => {
            delete phaseConfig.repo;
            const errors = codecommit.check(phaseConfig);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`The 'repo' field is required`);
        });

        it('should require the branch parameter', () => {
            delete phaseConfig.branch;
            const errors = codecommit.check(phaseConfig);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`The 'branch' field is required`);
        });

        it('should work when all required parameters are provided', () => {
            const errors = codecommit.check(phaseConfig);
            expect(errors.length).to.equal(0);
        });
    });

    describe('getSecretsForPhase', () => {
        it('should return an empty object', async () => {
            const results = await codecommit.getSecretsForPhase(phaseConfig);
            expect(results).to.deep.equal({});
        });
    });

    describe('deployPhase', () => {
        it('should create the codebuild project and return the phase config', async () => {
            const phase = await codecommit.deployPhase(phaseContext);
            expect(phase.name).to.equal(phaseContext.phaseName);
        });
    });

    describe('deletePhase', () => {
        it('should do nothing', async () => {
            const result = await codecommit.deletePhase(phaseContext);
            expect(result).to.equal(true);
        });
    });
});

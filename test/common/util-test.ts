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
import * as fs from 'fs';
import * as util from '../../src/common/util';

describe('util module', () => {
    describe('loadYamlFile', () => {
        it('should load the file on success', () => {
            const loadedYaml = util.loadYamlFile(`${__dirname}/test.yml`);
            expect(loadedYaml.key).to.equal('value');
        });

        it('should return null on error', () => {
            const loadedYaml = util.loadYamlFile(`${__dirname}/nonexistent.yml`);
            expect(loadedYaml).to.equal(null);
        });
    });

    describe('getAccountConfig', () => {
        it('should return the requested yaml file', () => {
            const config = util.getAccountConfig(__dirname, 'test');
            expect(config.key).to.equal('value');
        });
    });

    describe('getPhaseDeployers', () => {
        it('should load and return the deployers', () => {
            const phaseDeployers = util.getPhaseDeployers();
            expect(phaseDeployers.github).to.not.equal(null);
        });
    });

    describe('zipDirectoryToFile', () => {
        const zippedPath = `${__dirname}/zipped-test-file.zip`;

        afterEach(() => {
            if(fs.existsSync(zippedPath)) {
                fs.unlinkSync(zippedPath); // Ensure created ZIP archive gets deleted
            }
        });

        it('should zip the given directory if it exists', async () => {
            await util.zipDirectoryToFile(__dirname, zippedPath);
            expect(fs.existsSync(zippedPath)).to.equal(true);
        });

        it('should throw an error if the given directory doesnt exist', async () => {
            try {
                await util.zipDirectoryToFile('${__dirname}/myfakedir/', zippedPath);
                expect(true).to.equal(false); // Should not get here
            }
            catch(err) {
                expect(err.message).to.contain('Directory path to be zipped does not exist');
            }
        });
    });
});

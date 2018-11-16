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
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import { ParsedArgs } from 'minimist';
import * as os from 'os';
import * as util from '../common/util';
import { PhaseSecrets } from '../datatypes/index';

const WATERWORKS_DIR = `${os.homedir()}/.waterworks`;
const WATERWORKS_CONFIG = `${WATERWORKS_DIR}/config.yml`;

interface ConfigParamCache {
    [key: string]: string;
}

function inquirerValidateFilePath(filePath: string): string | boolean {
    if(!fs.existsSync(filePath)) {
        return `File path doesn't exist: ${filePath}`;
    }
    return true;
}

function ensureConfigDirExists(): void {
    if(!fs.existsSync(WATERWORKS_DIR)) {
        fs.mkdirSync(WATERWORKS_DIR);
    }
}

function getConfigParam(paramName: string): string | null {
    if(fs.existsSync(WATERWORKS_CONFIG)) {
        const waterworksConfig = util.loadYamlFile(WATERWORKS_CONFIG) as ConfigParamCache;
        if(waterworksConfig[paramName]) {
            return waterworksConfig[paramName];
        }
    }
    return null;
}

function cacheConfigParam(paramName: string, paramValue: string) {
    if(fs.existsSync(WATERWORKS_CONFIG)) {
        const waterworksConfig = util.loadYamlFile(WATERWORKS_CONFIG) as ConfigParamCache;
        waterworksConfig[paramName] = paramValue;
        util.saveYamlFile(WATERWORKS_CONFIG, waterworksConfig);
    }
    else {
        const waterworksConfig: ConfigParamCache = {};
        waterworksConfig[paramName] = paramValue;
        util.saveYamlFile(WATERWORKS_CONFIG, waterworksConfig);
    }
}

function askAccountConfigsQuestionIfNeeded(configs: PhaseSecrets, questions: inquirer.Question[]) {
    const accountConfigsPath = getConfigParam('account_configs_path');
    if(accountConfigsPath) {
        configs.accountConfigsPath = accountConfigsPath;
    }
    else {
        questions.push({
            type: 'input',
            name: 'accountConfigsPath',
            message: 'Please enter the path to the directory containing the Handel account configuration files',
            validate: inquirerValidateFilePath
        });
    }
}

export async function getPipelineConfigForDelete(argv: ParsedArgs): Promise<PhaseSecrets> {
    const secrets: PhaseSecrets = {};

    const questions: inquirer.Question[] = [
        {
            type: 'input',
            name: 'pipelineToDelete',
            message: 'Please enter the name of the pipeline from your waterworks.yml file that you would like to delete',
        },
        {
            type: 'input',
            name: 'accountName',
            message: 'Please enter the name of the account for the pipeline you wish to delete',
        }
    ];

    if(argv.pipeline && argv.account_name) {
        if(!fs.existsSync(WATERWORKS_DIR)) {
            throw new Error('Waterworks config directory must exist when deploying with CLI params');
        }
        const accountConfigsPath = getConfigParam('account_configs_path');
        if(accountConfigsPath) {
            secrets.accountConfigsPath = accountConfigsPath;
        } else {
            throw new Error('account_configs_path not found in Waterworks config directory');
        }
        secrets.pipelineToDelete = argv.pipeline;
        secrets.accountName = argv.account_name;
    } else {
        ensureConfigDirExists();

        askAccountConfigsQuestionIfNeeded(secrets, questions);

        const answers = await inquirer.prompt(questions);
        if(answers.accountConfigsPath) {
            secrets.accountConfigsPath = answers.accountConfigsPath;
            cacheConfigParam('account_configs_path', answers.accountConfigsPath);
        }
        secrets.pipelineToDelete = answers.pipelineToDelete;
        secrets.accountName = answers.accountName;
    }
    return secrets;
}

// TODO - Split out the config service from the Q/A service
export async function getPipelineParameters(argv: ParsedArgs): Promise<PhaseSecrets> {
    const secrets: PhaseSecrets = {};

    const questions: inquirer.Question[] = [
        {
            type: 'input',
            name: 'pipelineToDeploy',
            message: 'Please enter the name of the pipeline from your waterworks.yml file that you would like to deploy',
        },
        {
            type: 'input',
            name: 'accountName',
            message: 'Please enter the name of the account where your pipeline will be deployed',
        }
    ];

    // Get account configs
    if(argv.pipeline && argv.account_name && argv.secrets) {
        // TODO - ALLOW PEOPLE TO CLEAR THIS CACHE? Another option is to ask again if we can't find the account config in the path they gave
        if(!fs.existsSync(WATERWORKS_DIR)) {
            throw new Error('Waterworks config directory must exist when deploying with CLI params');
        }
        const accountConfigsPath = getConfigParam('account_configs_path');
        if(accountConfigsPath) {
            secrets.accountConfigsPath = accountConfigsPath;
        } else {
            throw new Error('account_configs_path not found in Waterworks config directory');
        }
        secrets.pipelineToDeploy = argv.pipeline;
        secrets.accountName = argv.account_name;
    } else {
        ensureConfigDirExists();

        // Get account configs
        askAccountConfigsQuestionIfNeeded(secrets, questions);

        const answers = await inquirer.prompt(questions);
        if(answers.accountConfigsPath) {
            secrets.accountConfigsPath = answers.accountConfigsPath;
            cacheConfigParam('account_configs_path', answers.accountConfigsPath);
        }
        secrets.pipelineToDeploy = answers.pipelineToDeploy;
        secrets.accountName = answers.accountName;
    }
    return secrets;
}

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

const ROCKEFELLER_DIR = `${os.homedir()}/.rockefeller`;
const ROCKEFELLER_CONFIG = `${ROCKEFELLER_DIR}/config.yml`;

interface ConfigParamCache {
    [key: string]: string;
}

function inquirerValidateFilePath(filePath: string): string | boolean {
    if (!fs.existsSync(filePath)) {
        return `File path doesn't exist: ${filePath}`;
    }
    return true;
}

function ensureConfigDirExists(): void {
    if (!fs.existsSync(ROCKEFELLER_DIR)) {
        fs.mkdirSync(ROCKEFELLER_DIR);
    }
}

function getConfigParam(paramName: string): string | null {
    if (fs.existsSync(ROCKEFELLER_CONFIG)) {
        const rockefellerConfig = util.loadYamlFile(ROCKEFELLER_CONFIG) as ConfigParamCache;
        if (rockefellerConfig[paramName]) {
            return rockefellerConfig[paramName];
        }
    }
    return null;
}

function cacheConfigParam(paramName: string, paramValue: string) {
    if (fs.existsSync(ROCKEFELLER_CONFIG)) {
        const rockefellerConfig = util.loadYamlFile(ROCKEFELLER_CONFIG) as ConfigParamCache;
        rockefellerConfig[paramName] = paramValue;
        util.saveYamlFile(ROCKEFELLER_CONFIG, rockefellerConfig);
    }
    else {
        const rockefellerConfig: ConfigParamCache = {};
        rockefellerConfig[paramName] = paramValue;
        util.saveYamlFile(ROCKEFELLER_CONFIG, rockefellerConfig);
    }
}

function askAccountConfigsQuestionIfNeeded(
    configs: PhaseSecrets,
    questions: inquirer.Question[]
) {
    const accountConfigsPath = getConfigParam('account_configs_path');
    if (accountConfigsPath) {
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
            message: 'Please enter the name of the pipeline from your rockefeller.yml file that you would like to delete',
        },
        {
            type: 'input',
            name: 'accountName',
            message: 'Please enter the name of the account for the pipeline you wish to delete',
        }
    ];

    if (argv.pipeline && argv.account_name) {
        if (!fs.existsSync(ROCKEFELLER_DIR)) {
            throw new Error('Rockefeller config directory must exist when deploying with CLI params');
        }
        const accountConfigsPath = getConfigParam('account_configs_path');
        if (accountConfigsPath) {
            secrets.accountConfigsPath = accountConfigsPath;
        } else {
            throw new Error('account_configs_path not found in Rockefeller config directory');
        }
        secrets.pipelineToDelete = argv.pipeline;
        secrets.accountName = argv.account_name;
    } else {
        ensureConfigDirExists();

        askAccountConfigsQuestionIfNeeded(secrets, questions);

        const answers = await inquirer.prompt(questions);
        if (answers.accountConfigsPath) {
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
            message: 'Please enter the name of the pipeline from your rockefeller.yml file that you would like to deploy',
        },
        {
            type: 'input',
            name: 'accountName',
            message: 'Please enter the name of the account where your pipeline will be deployed',
        }
    ];

    // Get account configs
    if (argv.pipeline && argv.account_name && argv.secrets) {
        // TODO - ALLOW PEOPLE TO CLEAR THIS CACHE? Another option is to ask again if we can't find the account config in the path they gave
        if (!fs.existsSync(ROCKEFELLER_DIR)) {
            throw new Error('Rockefeller config directory must exist when deploying with CLI params');
        }
        const accountConfigsPath = getConfigParam('account_configs_path');
        if (accountConfigsPath) {
            secrets.accountConfigsPath = accountConfigsPath;
        } else {
            throw new Error('account_configs_path not found in Rockefeller config directory');
        }
        secrets.pipelineToDeploy = argv.pipeline;
        secrets.accountName = argv.account_name;
    } else {
        ensureConfigDirExists();

        // Get account configs
        askAccountConfigsQuestionIfNeeded(secrets, questions);

        const answers = await inquirer.prompt(questions);
        if (answers.accountConfigsPath) {
            secrets.accountConfigsPath = answers.accountConfigsPath;
            cacheConfigParam('account_configs_path', answers.accountConfigsPath);
        }
        secrets.pipelineToDeploy = answers.pipelineToDeploy;
        secrets.accountName = answers.accountName;
    }
    return secrets;
}

// Have a separate copmmand that will run this function, and wallow you to redefine the path
// This function allows you to redefine your account configs path, should it be invalid
export async function redefineAccountConfigsPathSetup(argv: ParsedArgs): Promise<string> {
    // Setup
    ensureConfigDirExists();
    const secrets: PhaseSecrets = {};
    const questions: inquirer.Question[] = [
        {
            type: 'input',
            name: 'accountConfigsPath',
            message: 'Please enter the path to the directory containing the Handel account configuration files',
            validate: inquirerValidateFilePath
        }
    ];
    const answers = await inquirer.prompt(questions);

    // Overwrite the old file path
    if (answers.accountConfigsPath) {
        secrets.accountConfigsPath = answers.accountConfigsPath;
        cacheConfigParam('account_configs_path', answers.accountConfigsPath);
    } else {
        throw new Error(`The path ${answers.accountConfigsPath} did not lead to the handel-account-configs directory`);
    }

    // return the new file path
    return secrets.accountConfigsPath;
}

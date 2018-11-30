import dedent = require('dedent');
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as minimist from 'minimist';
import * as cli from './cli';
import { RockefellerFile } from './datatypes';

function printAndExit(msg: string): void {
    // tslint:disable-next-line:no-console
    console.log(msg);
    process.exit(1);
}

function printGeneralUsage(): void {
    const usageMsg = dedent`Usage: rockefeller <action>

    Action:
    check -- Checks the contents of your Rockefeller file for errors.
    deploy -- Deploys the given pipeline from your Rockefeller file.
    delete -- Deletes the given pipeline from your AWS account.
    list-required-secrets -- List required secrets for all phases. Requires the --pipeline parameter.`;
    printAndExit(usageMsg);
}

function loadRockefellerFile(): RockefellerFile | undefined {
    try {
        // TODO - Support loading a handel-codepipeline.yml file
        const rockefellerFile = yaml.safeLoad(fs.readFileSync('./rockefeller.yml', 'utf8'));
        return rockefellerFile;
    }
    catch (e) {
        if (e.code === 'ENOENT') {
            printAndExit(`No 'rockefeller.yml' file found in this directory. You must run Handel in the directory containing the Handel file.`);
        }
        else if (e.name === 'YAMLException') {
            printAndExit(`Malformed 'rockefeller.yml' file. Make sure your Rockefeller file is a properly formatted YAML file. You're probably missing a space or two somewhere`);
        }
        else {
            printAndExit(`Unexpected error while loading 'rockefeller.yml' file: ${e}`);
        }
    }
}

export function run() {
    const rockefellerFile = loadRockefellerFile();
    if(!rockefellerFile) {
        return printAndExit('Program did not receive a correct Rockefeller file');
    }
    const argv = minimist(process.argv.slice(2));
    const phase = process.argv[2] ? process.argv[2].toLowerCase() : '';
    switch (phase) {
        case 'deploy':
            cli.deployAction(rockefellerFile, argv);
            break;
        case 'check':
            cli.checkAction(rockefellerFile, argv);
            break;
        case 'delete':
            cli.deleteAction(rockefellerFile, argv);
            break;
        case 'list-required-secrets':
            cli.listSecretsAction(rockefellerFile, argv);
            break;
        default:
            printGeneralUsage();
    }
}

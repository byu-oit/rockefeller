import dedent = require('dedent');
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as minimist from 'minimist';
import * as cli from './cli';
import { WaterworksFile } from './datatypes';

function printAndExit(msg: string): void {
    // tslint:disable-next-line:no-console
    console.log(msg);
    process.exit(1);
}

function printGeneralUsage(): void {
    const usageMsg = dedent`Usage: waterworks <action>

    Action:
    check -- Checks the contents of your Waterworks file for errors.
    deploy -- Deploys the given pipeline from your Waterworks file.
    delete -- Deletes the given pipeline from your AWS account.
    list-required-secrets -- List required secrets for all phases. Requires the --pipeline parameter.`;
    printAndExit(usageMsg);
}

function loadWaterworksFile(): WaterworksFile | undefined {
    try {
        // TODO - Support loading a handel-codepipeline.yml file
        const waterworksFile = yaml.safeLoad(fs.readFileSync('./waterworks.yml', 'utf8'));
        return waterworksFile;
    }
    catch (e) {
        if (e.code === 'ENOENT') {
            printAndExit(`No 'waterworks.yml' file found in this directory. You must run Handel in the directory containing the Handel file.`);
        }
        else if (e.name === 'YAMLException') {
            printAndExit(`Malformed 'waterworks.yml' file. Make sure your Waterworks file is a properly formatted YAML file. You're probably missing a space or two somewhere`);
        }
        else {
            printAndExit(`Unexpected error while loading 'waterworks.yml' file: ${e}`);
        }
    }
}

export function run() {
    const waterworksFile = loadWaterworksFile();
    if(!waterworksFile) {
        return printAndExit('Program did not receive a correct Waterworks file');
    }
    const argv = minimist(process.argv.slice(2));
    const phase = process.argv[2] ? process.argv[2].toLowerCase() : '';
    switch (phase) {
        case 'deploy':
            cli.deployAction(waterworksFile, argv);
            break;
        // case 'check':
        //     cli.checkAction(waterworksFile, argv);
        //     break;
        // case 'delete':
        //     cli.deleteAction(waterworksFile, argv);
        //     break;
        // case 'list-required-secrets':
        //     cli.listSecretsAction(waterworksFile, argv);
        //     break;
        default:
            printGeneralUsage();
    }
}

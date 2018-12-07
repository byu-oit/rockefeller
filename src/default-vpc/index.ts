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
import { AccountConfig } from 'handel-extension-api';
import { awsCalls, handlebars } from 'handel-extension-support';
import * as inquirer from 'inquirer';
import * as winston from 'winston';
import * as ec2Calls from '../aws/ec2-calls';
import * as stsCalls from '../aws/sts-calls';

export async function useDefaultVpc(): Promise<AccountConfig> {
    const questions: inquirer.Question[] = [
        {
            type: 'input',
            name: 'regionToDeployTo',
            message: 'What region would you like to deploy into?'
        }
    ];

    const answers = await inquirer.prompt(questions);
    // I cannot figure out what the format should be for the region, and so I cannot test to know what should be entered
    const region: string = answers.regionToDeployTo;
    const validRegion = await isValidRegion(region);

    if(validRegion) {
        const defaultVpc = await ec2Calls.getDefaultVpc();
        const accountConfig: any = {
            region,
            vpc: defaultVpc.VpcId
        };

        accountConfig.account_id = await stsCalls.getAccountId();

        const subnets = await getDefaultVpcSubnets(accountConfig.vpc);
        // The default VPC only has three public subnets, so we just have to use those for all the different tiers Handel supports
        accountConfig.public_subnets = subnets;
        accountConfig.private_subnets = subnets;
        accountConfig.data_subnets = subnets;

        const cfStack = await getSubnetGroups(accountConfig.vpc, accountConfig.data_subnets);
        accountConfig.rds_subnet_group = awsCalls.cloudFormation.getOutput('RdsSubnetGroupName', cfStack);
        accountConfig.elasticache_subnet_group = awsCalls.cloudFormation.getOutput('ElastiCacheSubnetGroupName', cfStack);
        return accountConfig as AccountConfig;
    } else {
        throw new Error(`Invalid region: ${region}`);
    }
}

async function isValidRegion(region: string): Promise<boolean|undefined> {
    try {
        const regions = await ec2Calls.getRegions();
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < regions.length; i++) {
            if (regions[i] === region) {
                return true;
            }
        }
    }
    catch {
        return false;
    }
}

async function getDefaultVpcSubnets(vpcId: string) {
    const subnets = await ec2Calls.getSubnets(vpcId);
    return subnets.map(subnet => subnet.SubnetId);
}

async function getSubnetGroups(vpcId: string, subnetIds: string[]): Promise<AWS.CloudFormation.Stack> {
    const stackName = getSubnetGroupName(vpcId);
    const handlebarsParams = {
        stackName,
        subnetGroupDescription: 'Handel-created subnet group for Default VPC',
        subnetIds
    };
    const compiledTemplate = await handlebars.compileTemplate(`${__dirname}/default-vpc-subnet-groups-template.yml`, handlebarsParams);
    const stack = await awsCalls.cloudFormation.getStack(stackName);
    if (!stack) {
        winston.info(`Creating subnet groups for default VPC`);
        const cfStack = await awsCalls.cloudFormation.createStack(stackName, compiledTemplate, [], 30, {});
        winston.info(`Created subnet groups for default VPC`);
        return cfStack;
    }
    else {
        return stack;
    }
}

function getSubnetGroupName(vpcId: string): string {
    return `rockefeller-subnet-groups-${vpcId}`;
}

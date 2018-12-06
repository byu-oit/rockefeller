/*
 * Copyright 2018 Brigham Young University
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
import * as winston from 'winston';

export async function getRegions(): Promise<string[]> {
    winston.verbose(`Getting current list of regions`);
    const regionsResponse = await describeRegions({});
    return regionsResponse.Regions!.map(item => item.RegionName!);
}

function describeRegions(params: AWS.EC2.DescribeRegionsRequest) {
    const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
    return ec2.describeRegions(params).promise();
}

export async function getDefaultVpc(): Promise<AWS.EC2.Vpc> {
    winston.verbose(`Getting default VPC in account`);
    const describeParams = {
        Filters: [
            {
                Name: 'isDefault',
                Values: [
                    'true'
                ]
            }
        ]
    };
    const describeResponse = await describeVpcs(describeParams);
    return describeResponse.Vpcs![0];
}

async function describeVpcs(params: AWS.EC2.DescribeVpcsRequest) {
    const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
    return ec2.describeVpcs(params).promise();
}

export async function getSubnets(vpcId: string): Promise<AWS.EC2.Subnet[]> {
    winston.verbose(`Getting subnets list for VPC '${vpcId}'`);
    const describeParams = {
        Filters: [
            {
                Name: 'vpc-id',
                Values: [vpcId]
            }
        ]
    };
    const describeResponse = await describeSubnets(describeParams);
    return describeResponse.Subnets!;
}

async function describeSubnets(params: AWS.EC2.DescribeSubnetsRequest) {
    const ec2 = new AWS.EC2({ apiVersion: '2016-11-15' });
    return ec2.describeSubnets(params).promise();
}

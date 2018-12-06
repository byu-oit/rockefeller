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
import * as AWS from 'aws-sdk';
import * as winston from 'winston';

export async function validateLoggedIn(): Promise<void> {
    winston.debug('Checking that the user is logged in');
    const accountId = await getAccountId();
    if (!accountId) {
        winston.error(`You are not logged into an AWS account`);
        process.exit(1);
    }
}

async function getAccountId(): Promise<string|null> {
    try {
        const getResponse = await getCallerIdentity({});
        return getResponse.Account!;
    }
    catch (err) {
        if (err.code === 'CredentialsError') {
            return null;
        }
        else {
            throw err;
        }
    }
}

function getCallerIdentity(params: AWS.STS.GetCallerIdentityRequest) {
    const sts = new AWS.STS({
        apiVersion: '2011-06-15',
        maxRetries: 1,
        retryDelayOptions: {
            base: 50
        }
    });
    return sts.getCallerIdentity(params).promise();
}

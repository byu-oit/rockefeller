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
import * as Ajv from 'ajv';
import * as fs from 'fs';
import { PhaseConfig } from '../datatypes/index';

export function checkJsonSchema(schemaPath: string, phaseConfig: PhaseConfig): string[] {
    const ajv = new Ajv({allErrors: true, jsonPointers: true});
    require('ajv-errors')(ajv);
    let schema;
    try {
        schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    }
    catch (e) {
        return [`Couldn't read schema file to check the service schema`];
    }
    const valid = ajv.validate(schema, phaseConfig);
    if (!valid) {
        return ajv.errors!.map(error => {
            const errorParams = error.params as any; // The types don't seem to be right on AJV when using AJV-errors, so we cast it to any here
            const additionalPropsErrors = errorParams.errors.filter((errorParam: any) => errorParam.keyword === 'additionalProperties');
            if(additionalPropsErrors.length > 0) { // Special error message for the 'additionalProps' error to make it more understandable
                const additionalPropsError = additionalPropsErrors[0];
                return `Invalid property '${error.dataPath}/${additionalPropsError.params.additionalProperty}' specified. Make sure to check your spelling!`;
            }
            else {
                const dataPath = error.dataPath || '/';
                return `Error at path '${dataPath}': ${error.message}`;
            }
        });
    }
    else {
        return [];
    }
}

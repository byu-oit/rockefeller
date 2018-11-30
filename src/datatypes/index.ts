import * as AWS from 'aws-sdk';
import { AccountConfig } from 'handel-extension-api';

export interface PhaseConfig {
    type: string;
    name: string;
}

export interface PhaseSecrets {
    [key: string]: string;
}

export interface EnvironmentVariables {
    [key: string]: string;
}

export class PipelineContext {
    public rockefellerVersion: number;
    public appName: string;
    public pipelineName: string;
    public accountConfig: AccountConfig;

    constructor(rockefellerVersion: number, appName: string, pipelineName: string, accountConfig: AccountConfig) {
        this.rockefellerVersion = rockefellerVersion;
        this.appName = appName;
        this.pipelineName = pipelineName;
        this.accountConfig = accountConfig;
    }
}

export class PhaseContext<Config extends PhaseConfig> {
    public appName: string;
    public phaseName: string;
    public phaseType: string;
    public codePipelineBucketName: string;
    public pipelineName: string;
    public accountConfig: AccountConfig;
    public params: Config;
    public secrets: any; // TODO - Change this to its own type later

    constructor(appName: string, phaseName: string, phaseType: string, codePipelineBucketName: string, pipelineName: string,
                accountConfig: AccountConfig, params: Config, secrets: any) {
        this.appName = appName;
        this.phaseName = phaseName;
        this.phaseType = phaseType;
        this.codePipelineBucketName = codePipelineBucketName;
        this.pipelineName = pipelineName;
        this.accountConfig = accountConfig;
        this.params = params;
        this.secrets = secrets;
    }
}

export interface PhaseDeployers {
    [key: string]: PhaseDeployer;
}

export interface PhaseDeployer {
    check(phaseConfig: PhaseConfig): string[];
    getSecretsForPhase(phaseConfig: PhaseConfig): Promise<PhaseSecrets>;
    getSecretQuestions(phaseConfig: PhaseConfig): PhaseSecretQuestion;
    deployPhase(phaseContext: PhaseContext<PhaseConfig>, accountConfig: AccountConfig): Promise<AWS.CodePipeline.StageDeclaration>;
    deletePhase(phaseContext: PhaseContext<PhaseConfig>, accountConfig: AccountConfig): Promise<boolean>;
    addWebhook?(phaseContext: PhaseContext<PhaseConfig>): Promise<void>;
    removeWebhook?(phaseContext: PhaseContext<PhaseConfig>): Promise<void>;

}

export interface RockefellerFile {
    version: number;
    name: string;
    pipelines: PipelineDefinition;
}

export interface PipelineDefinition {
    [pipelineName: string]: {
        phases: PhaseConfig[];
    };
}

export interface PhaseSecretQuestion {
    phaseName: string;
    name: string;
    message: string;
}

export interface PhaseSecretQuestionResponse extends PhaseSecretQuestion {
    value: string;
}

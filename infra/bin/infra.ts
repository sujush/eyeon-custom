#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();
new InfraStack(app, 'HsCodeAutomationStack', {
  env: { 
    region: 'ap-northeast-2', // 서울 리전
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: 'HS Code Automation System Infrastructure',
});
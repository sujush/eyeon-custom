// infra/lib/infra-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DynamoDBTableStack } from './dynamodb-tables';
import { S3BucketStack } from './s3-buckets';
import { LambdaFunctionStack } from './lambda-functions';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB 테이블 생성
    const dbStack = new DynamoDBTableStack(this, 'DynamoDBStack', props);
    
    // S3 버킷 생성
    const s3Stack = new S3BucketStack(this, 'S3Stack', props);
    
    // Lambda 함수 생성
    const lambdaStack = new LambdaFunctionStack(this, 'LambdaStack', {
      ...props,
      productsTable: dbStack.productsTable,
      carriersTable: dbStack.carriersTable,
      templatesTable: dbStack.templatesTable,
      companiesTable: dbStack.companiesTable, // 추가한 부분이 반영되지 않았음
      uploadBucket: s3Stack.uploadBucket,
      resultBucket: s3Stack.resultBucket,
    });

    // 출력 값 설정
    new cdk.CfnOutput(this, 'UploadBucketName', {
      value: s3Stack.uploadBucket.bucketName,
      description: 'The name of the upload bucket',
    });

    new cdk.CfnOutput(this, 'ResultBucketName', {
      value: s3Stack.resultBucket.bucketName,
      description: 'The name of the result bucket',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: lambdaStack.api.url,
      description: 'The URL of the API endpoint',
    });
  }
}
// infra/lib/lambda-functions.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path'; // 경로 조작 위해 필요

interface LambdaFunctionStackProps extends cdk.StackProps {
  productsTable: dynamodb.Table;
  carriersTable: dynamodb.Table;
  templatesTable: dynamodb.Table;
  companiesTable: dynamodb.Table;
  uploadBucket: s3.Bucket;
  resultBucket: s3.Bucket;
}

export class LambdaFunctionStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: LambdaFunctionStackProps) {
    super(scope, id, props);

    // API Gateway 생성
    this.api = new apigateway.RestApi(this, 'HsCodeApi', {
      restApiName: 'HS Code API',
      description: `HS Code API - recreated attempt ${new Date().toISOString()}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // 엑셀 파일 처리 Lambda 함수
    const processExcelFunction = new NodejsFunction(this, 'ProcessExcelFunction', {
      functionName: 'process-excel',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      entry: path.join(__dirname, '../../src/lambda/processExcel/index.ts'), // 해당 함수의 .ts 진입점 파일 경로
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        PRODUCTS_TABLE: props.productsTable.tableName,
        TEMPLATES_TABLE: props.templatesTable.tableName,
        COMPANIES_TABLE: props.companiesTable.tableName,
        UPLOAD_BUCKET: props.uploadBucket.bucketName,
        RESULT_BUCKET: props.resultBucket.bucketName,
      },
      bundling: {
        //externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // 필요한 권한 부여
    props.productsTable.grantReadWriteData(processExcelFunction);
    props.templatesTable.grantReadData(processExcelFunction);
    props.companiesTable.grantReadWriteData(processExcelFunction);
    props.uploadBucket.grantRead(processExcelFunction);
    props.resultBucket.grantWrite(processExcelFunction);
    
    // S3에 대한 추가 권한 부여
    processExcelFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        resources: [
          props.uploadBucket.arnForObjects('*'),
          props.resultBucket.arnForObjects('*'),
          props.uploadBucket.bucketArn,
          props.resultBucket.bucketArn
        ],
      })
    );

    // 제품 관리 Lambda 함수
    const productManagementFunction = new NodejsFunction(this, 'ProductManagementFunction', {
      functionName: 'product-management',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      entry: path.join(__dirname, '../../src/lambda/productManagement/index.ts'),
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      environment: {
        PRODUCTS_TABLE: props.productsTable.tableName,
        COMPANIES_TABLE: props.companiesTable.tableName,
        CARRIERS_TABLE: props.carriersTable.tableName,
        TEMPLATES_TABLE: props.templatesTable.tableName,
        UPLOAD_BUCKET: props.uploadBucket.bucketName,
        RESULT_BUCKET: props.resultBucket.bucketName,
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    // 권한 부여
    props.productsTable.grantReadWriteData(productManagementFunction);
    props.companiesTable.grantReadWriteData(productManagementFunction);
    props.carriersTable.grantReadWriteData(productManagementFunction);
    props.templatesTable.grantReadData(productManagementFunction);
    props.uploadBucket.grantRead(productManagementFunction);
    props.resultBucket.grantReadWrite(productManagementFunction);

    // API Gateway 엔드포인트 설정 - 모든 엔드포인트를 두 함수에 연결
    const processExcelIntegration = new apigateway.LambdaIntegration(processExcelFunction);
    const productManagementIntegration = new apigateway.LambdaIntegration(productManagementFunction);

    // 엑셀 처리 엔드포인트
    const excelResource = this.api.root.addResource('excel');
    excelResource.addResource('process').addMethod('POST', processExcelIntegration);
    const processResultResource = excelResource.addResource('process-result');
    processResultResource.addMethod('GET', processExcelIntegration);
    processResultResource.addResource('{resultKey}').addMethod('GET', processExcelIntegration);
    excelResource.addResource('extract-preview').addMethod('GET', processExcelIntegration);

    // 제품 관리 엔드포인트
    const productsResource = this.api.root.addResource('products');
    productsResource.addMethod('GET', productManagementIntegration);
    productsResource.addMethod('POST', productManagementIntegration);
    productsResource.addResource('{productId}').addMethod('PUT', productManagementIntegration);
    productsResource.addResource('select-hs-codes').addMethod('POST', productManagementIntegration);

    // 운송사 관리 엔드포인트 (productManagementFunction 재사용)
    const carriersResource = this.api.root.addResource('carriers');
    carriersResource.addMethod('GET', productManagementIntegration);
    carriersResource.addMethod('POST', productManagementIntegration);
    const carrierTemplatesResource = carriersResource.addResource('{carrierId}').addResource('templates');
    carrierTemplatesResource.addMethod('GET', productManagementIntegration);

    // 회사 관리 엔드포인트
    const companiesResource = this.api.root.addResource('companies');
    companiesResource.addMethod('GET', productManagementIntegration);
    companiesResource.addResource('update').addMethod('POST', productManagementIntegration);

    // 업로드 관련 엔드포인트 (processExcelFunction 재사용)
    const uploadResource = this.api.root.addResource('upload');
    uploadResource.addResource('presigned').addMethod('POST', processExcelIntegration);

    // 다운로드 관련 엔드포인트
    const apiResource = this.api.root.addResource('api');
    apiResource.addResource('download').addMethod('GET', processExcelIntegration);
  }
}
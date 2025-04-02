// infra/lib/dynamodb-tables.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DynamoDBTableStack extends cdk.Stack {
  public readonly productsTable: dynamodb.Table;
  public readonly carriersTable: dynamodb.Table;
  public readonly templatesTable: dynamodb.Table;
  public readonly companiesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Products 테이블 - 제품 및 HS 코드 정보 저장
    this.productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: 'Products',
      partitionKey: { name: 'CompanyID', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 온디맨드 용량 모드
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 스택 삭제 시 테이블 보존
    });

    // Carriers 테이블 - 운송사 정보 저장
    this.carriersTable = new dynamodb.Table(this, 'CarriersTable', {
      tableName: 'Carriers',
      partitionKey: { name: 'CarrierID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Templates 테이블 - 엑셀 양식 정보 저장
    this.templatesTable = new dynamodb.Table(this, 'TemplatesTable', {
      tableName: 'Templates',
      partitionKey: { name: 'TemplateID', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'CarrierID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Templates 테이블에 CarrierID로 조회할 수 있는 GSI 추가
    this.templatesTable.addGlobalSecondaryIndex({
      indexName: 'CarrierID-index',
      partitionKey: { name: 'CarrierID', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Companies 테이블 - 업체 정보 저장
    this.companiesTable = new dynamodb.Table(this, 'CompaniesTable', {
      tableName: 'Companies',
      partitionKey: { name: 'CompanyID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Products 테이블에 GSI 추가 - 제품명으로 검색
    this.productsTable.addGlobalSecondaryIndex({
      indexName: 'ProductNameIndex',
      partitionKey: { name: 'CompanyID', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ProductName', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Companies 테이블에 GSI 추가 - 영문 업체명으로 검색
    this.companiesTable.addGlobalSecondaryIndex({
      indexName: 'CompanyNameEN-index',
      partitionKey: { name: 'CompanyNameEN', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
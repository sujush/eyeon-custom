// src/lambda/productManagement/index.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { 
  Company,
  Product,
} from '../../types/database-types';

const dynamoDB = new DynamoDB.DocumentClient();
const COMPANIES_TABLE = process.env.COMPANIES_TABLE || '';
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || '';
const CARRIERS_TABLE = process.env.CARRIERS_TABLE || '';
const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE || '';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'
};

interface UpdateCompanyRequest {
  companyNameEN: string;
  companyNameKR: string;
  products: {
    productName: string;
    hsCode: string;
    variantAttributes?: Record<string, string>;
  }[];
}

interface SelectProductHsCodesRequest {
  companyId: string;
  products: {
    productName: string;
    selectedHsCode: string;
  }[];
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const path = event.path;
    const method = event.httpMethod;
    
    // OPTIONS 요청 처리 (CORS)
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }
    
    // 운송사 목록 조회 엔드포인트
    if (path.endsWith('/carriers') && method === 'GET') {
      return await getCarriers();
    }
    
    // 운송사별 템플릿 조회 엔드포인트
    if (path.match(/\/carriers\/[^/]+\/templates$/) && method === 'GET') {
      const carrierId = path.split('/')[2]; // URL에서 carrierId 추출
      return await getTemplatesByCarrier(carrierId);
    }
    
    // 회사 정보 업데이트 엔드포인트
    if (path.endsWith('/update-company') && method === 'POST') {
      return await handleUpdateCompany(event);
    } 
    
    // HS 코드 선택 엔드포인트
    if (path.endsWith('/select-product-hs-codes') && method === 'POST') {
      return await handleSelectProductHsCodes(event);
    }
    
    // 기본 응답 (엔드포인트를 찾을 수 없음)
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Not Found' }),
    };
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Internal Server Error',
        error: (error as Error).message,
      }),
    };
  }
}

// 운송사 목록 조회 함수
async function getCarriers(): Promise<APIGatewayProxyResult> {
  try {
    const params = {
      TableName: CARRIERS_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify(result.Items || [])
    };
  } catch (error) {
    console.error('Error fetching carriers:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Error fetching carriers',
        error: (error as Error).message,
      }),
    };
  }
}

// 운송사별 템플릿 조회 함수
async function getTemplatesByCarrier(carrierId: string): Promise<APIGatewayProxyResult> {
  try {
    const params = {
      TableName: TEMPLATES_TABLE,
      IndexName: 'CarrierID-index', // 해당 인덱스가 존재해야 함
      KeyConditionExpression: 'CarrierID = :carrierId',
      ExpressionAttributeValues: {
        ':carrierId': carrierId
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify(result.Items || [])
    };
  } catch (error) {
    console.error('Error fetching templates:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Error fetching templates',
        error: (error as Error).message,
      }),
    };
  }
}

async function handleUpdateCompany(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Missing request body' }),
    };
  }
  
  const request = JSON.parse(event.body) as UpdateCompanyRequest;
  const { companyNameEN, companyNameKR, products } = request;
  
  // 1. 회사 정보 저장
  const companyId = uuidv4();
  const timestamp = new Date().toISOString();
  
  const company: Company = {
    CompanyID: companyId,
    CompanyNameEN: companyNameEN,
    CompanyNameKR: companyNameKR,
    LastUpdated: timestamp,
  };
  
  await dynamoDB.put({
    TableName: COMPANIES_TABLE,
    Item: company,
  }).promise();
  
  // 2. 제품 정보 저장
  const productPromises = products.map(async (product) => {
    const variantId = product.variantAttributes 
      ? Object.values(product.variantAttributes).join('-') 
      : 'default';
    
    const newProduct: Product = {
      CompanyID: companyId,
      SK: `${product.productName}#${variantId}`,
      ProductName: product.productName,
      HSCode: product.hsCode,
      CompanyNameKR: companyNameKR,
      CompanyNameEN: companyNameEN,
      VariantAttributes: product.variantAttributes,
      DefaultVariant: !product.variantAttributes,
      LastUpdated: timestamp,
    };
    
    return dynamoDB.put({
      TableName: PRODUCTS_TABLE,
      Item: newProduct,
    }).promise();
  });
  
  await Promise.all(productPromises);
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ 
      message: 'Company and products updated successfully',
      companyId,
    }),
  };
}

async function handleSelectProductHsCodes(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Missing request body' }),
    };
  }
  
  const request = JSON.parse(event.body) as SelectProductHsCodesRequest;
  const { companyId, products } = request;
  
  // 회사 정보 조회
  const companyResult = await dynamoDB.get({
    TableName: COMPANIES_TABLE,
    Key: { CompanyID: companyId },
  }).promise();
  
  const company = companyResult.Item as Company;
  
  if (!company) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Company not found' }),
    };
  }
  
  const timestamp = new Date().toISOString();
  
  // (이하 코드는 기존과 동일)
  // 제품별로 선택된 HS 코드 업데이트
  const updatePromises = products.map(async (product) => {
    // ... (기존 코드 유지)
    // 기존 제품 정보 조회
    const productParams = {
      TableName: PRODUCTS_TABLE,
      IndexName: 'CompanyID-ProductName-index',
      KeyConditionExpression: 'CompanyID = :companyId AND ProductName = :productName',
      ExpressionAttributeValues: {
        ':companyId': companyId,
        ':productName': product.productName,
      },
    };
    
    const productResult = await dynamoDB.query(productParams).promise();
    
    if (!productResult.Items || productResult.Items.length === 0) {
      // 기존 제품이 없으면 새로 추가
      const newProduct: Product = {
        CompanyID: companyId,
        SK: `${product.productName}#default`,
        ProductName: product.productName,
        HSCode: product.selectedHsCode,
        CompanyNameKR: company.CompanyNameKR,
        CompanyNameEN: company.CompanyNameEN,
        DefaultVariant: true,
        LastUpdated: timestamp,
      };
      
      return dynamoDB.put({
        TableName: PRODUCTS_TABLE,
        Item: newProduct,
      }).promise();
    } else {
      // 해당 HS 코드에 맞는 Variant가 있는지 확인
      const matchingVariant = productResult.Items.find(
        item => (item as Product).HSCode === product.selectedHsCode
      );
      
      if (matchingVariant) {
        // 이미 해당 HS 코드를 가진 Variant가 있으면 DefaultVariant로 표시
        const updatePromises = productResult.Items.map(item => {
          const isMatch = (item as Product).HSCode === product.selectedHsCode;
          
          return dynamoDB.update({
            TableName: PRODUCTS_TABLE,
            Key: {
              CompanyID: companyId,
              SK: (item as Product).SK,
            },
            UpdateExpression: 'SET DefaultVariant = :defaultVariant, LastUpdated = :timestamp',
            ExpressionAttributeValues: {
              ':defaultVariant': isMatch,
              ':timestamp': timestamp,
            },
          }).promise();
        });
        
        return Promise.all(updatePromises);
      } else {
        // 없으면 새 Variant 추가
        const newProduct: Product = {
          CompanyID: companyId,
          SK: `${product.productName}#selected`,
          ProductName: product.productName,
          HSCode: product.selectedHsCode,
          CompanyNameKR: company.CompanyNameKR,
          CompanyNameEN: company.CompanyNameEN,
          DefaultVariant: true,
          LastUpdated: timestamp,
        };
        
        // 기존 Variant의 DefaultVariant를 false로 설정
        const updateExistingPromises = productResult.Items.map(item => {
          return dynamoDB.update({
            TableName: PRODUCTS_TABLE,
            Key: {
              CompanyID: companyId,
              SK: (item as Product).SK,
            },
            UpdateExpression: 'SET DefaultVariant = :defaultVariant, LastUpdated = :timestamp',
            ExpressionAttributeValues: {
              ':defaultVariant': false,
              ':timestamp': timestamp,
            },
          }).promise();
        });
        
        // 새 Variant 추가
        const addNewPromise = dynamoDB.put({
          TableName: PRODUCTS_TABLE,
          Item: newProduct,
        }).promise();
        
        return Promise.all([...updateExistingPromises, addNewPromise]);
      }
    }
  });
  
  await Promise.all(updatePromises);
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ 
      message: 'Product HS codes updated successfully',
    }),
  };
}
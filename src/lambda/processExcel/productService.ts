// src/lambda/processExcel/productService.ts

import { DynamoDB } from 'aws-sdk';
import { Product } from '../../types/database-types';

const dynamoDB = new DynamoDB.DocumentClient();
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || '';

export interface ProductData {
  productName: string;
  hsCode: string;
  variantAttributes?: Record<string, string>;
}

export interface ProductWithMultipleHSCodes {
  productName: string;
  hsCodes: string[];
  variants: {
    hsCode: string;
    attributes?: Record<string, string>;
  }[];
}

export async function getProductsByCompany(
  companyId: string
): Promise<ProductData[]> {
  try {
    const params = {
      TableName: PRODUCTS_TABLE,
      KeyConditionExpression: 'CompanyID = :companyId',
      ExpressionAttributeValues: {
        ':companyId': companyId,
      },
    };

    const result = await dynamoDB.query(params).promise();
    
    if (result.Items && result.Items.length > 0) {
      return result.Items.map((item) => {
        const product = item as Product;
        return {
          productName: product.ProductName,
          hsCode: product.HSCode,
          variantAttributes: product.VariantAttributes,
        };
      });
    }
    
    return [];
  } catch (error) {
    console.error('Error getting products by company:', error);
    throw error;
  }
}

export async function getProductVariantsByName(
  companyId: string,
  productName: string
): Promise<ProductWithMultipleHSCodes | null> {
  try {
    // GSI를 사용하여 제품명으로 조회
    const params = {
      TableName: PRODUCTS_TABLE,
      IndexName: 'CompanyID-ProductName-index',
      KeyConditionExpression: 'CompanyID = :companyId AND ProductName = :productName',
      ExpressionAttributeValues: {
        ':companyId': companyId,
        ':productName': productName,
      },
    };

    const result = await dynamoDB.query(params).promise();
    
    if (result.Items && result.Items.length > 0) {
      const variants = result.Items.map((item) => {
        const product = item as Product;
        return {
          hsCode: product.HSCode,
          attributes: product.VariantAttributes,
        };
      });
      
      const hsCodes = variants.map(v => v.hsCode);
      
      return {
        productName,
        hsCodes,
        variants,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting product variants by name:', error);
    throw error;
  }
}

export async function createProduct(
  companyId: string,
  productName: string,
  hsCode: string,
  variantAttributes?: Record<string, string>
): Promise<ProductData> {
  try {
    const timestamp = new Date().toISOString();
    const variantId = variantAttributes ? Object.values(variantAttributes).join('-') : 'default';
    
    const newProduct: Product = {
      CompanyID: companyId,
      SK: `${productName}#${variantId}`,
      ProductName: productName,
      HSCode: hsCode,
      VariantAttributes: variantAttributes,
      DefaultVariant: !variantAttributes,
      LastUpdated: timestamp,
      CompanyNameKR: '',
      CompanyNameEN: '',
    };
    
    await dynamoDB.put({
      TableName: PRODUCTS_TABLE,
      Item: newProduct,
    }).promise();
    
    return {
      productName,
      hsCode,
      variantAttributes,
    };
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
}
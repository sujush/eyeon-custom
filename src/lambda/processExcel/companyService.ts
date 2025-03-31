// src/lambda/processExcel/companyService.ts

import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { Company } from '../../types/database-types';

const dynamoDB = new DynamoDB.DocumentClient();
const COMPANIES_TABLE = process.env.COMPANIES_TABLE || 'Companies_1';
export interface CompanyData {
  companyId: string;
  companyNameEN: string;
  companyNameKR: string;
}

export async function getCompanyByName(
  companyNameEN: string
): Promise<CompanyData | null> {
  try {
    // CompanyNameEN으로 GSI를 사용하여 조회
    const params = {
      TableName: COMPANIES_TABLE,
      IndexName: 'CompanyNameEN-index',
      KeyConditionExpression: 'CompanyNameEN = :companyNameEN',
      ExpressionAttributeValues: {
        ':companyNameEN': companyNameEN,
      },
    };

    const result = await dynamoDB.query(params).promise();
    
    if (result.Items && result.Items.length > 0) {
      const company = result.Items[0] as Company;
      return {
        companyId: company.CompanyID,
        companyNameEN: company.CompanyNameEN,
        companyNameKR: company.CompanyNameKR,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting company by name:', error);
    throw error;
  }
}

export async function createCompany(
  companyNameEN: string,
  companyNameKR: string
): Promise<CompanyData> {
  try {
    const companyId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const newCompany: Company = {
      CompanyID: companyId,
      CompanyNameEN: companyNameEN,
      CompanyNameKR: companyNameKR,
      LastUpdated: timestamp,
    };
    
    await dynamoDB.put({
      TableName: COMPANIES_TABLE,
      Item: newCompany,
    }).promise();
    
    return {
      companyId,
      companyNameEN,
      companyNameKR,
    };
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
}
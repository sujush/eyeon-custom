// src/lambda/processExcel/getTemplateInfo.ts

import { DynamoDB } from 'aws-sdk';
import { Template } from '../../types/database-types';

const dynamoDB = new DynamoDB.DocumentClient();
const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE || '';

export interface TemplateInfo {
  productColumn: string;
  hsCodeColumn: string;
  companyNameRow: number;
  companyNameColumn: string;
  startRow: number;
}

export async function getTemplateInfo(
  carrierId: string,
  templateId: string
): Promise<TemplateInfo> {
  try {
    const params = {
      TableName: TEMPLATES_TABLE,
      Key: {
        TemplateID: templateId,
        CarrierID: carrierId,
      },
    };

    const result = await dynamoDB.get(params).promise();
    const template = result.Item as Template;

    if (!template) {
      throw new Error(`Template not found for carrier ${carrierId} and template ${templateId}`);
    }

    return {
      productColumn: template.ProductColumn,
      hsCodeColumn: template.HSCodeColumn,
      companyNameRow: template.CompanyNameRow,
      companyNameColumn: template.CompanyNameColumn,
      startRow: template.StartRow,
    };
  } catch (error) {
    console.error('Error getting template info:', error);
    throw error;
  }
}
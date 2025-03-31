// src/lambda/processExcel/index.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as XLSX from 'xlsx';
import { S3 } from 'aws-sdk';
import { getTemplateInfo, TemplateInfo } from './getTemplateInfo';
import { getCompanyByName } from './companyService';


const s3 = new S3();
const BUCKET_NAME = process.env.UPLOAD_BUCKET || '';
const RESULT_BUCKET = process.env.RESULT_BUCKET || '';

interface ProcessFileRequest {
  fileKey: string;
  templateId: string;
  carrierId: string;
}

interface ProductInfo {
  productName: string;
  rowIndex: number;
  hsCode?: string;
  hasMultipleHSCodes?: boolean;
  variants?: {
    hsCode: string;
    attributes?: Record<string, string>;
  }[];
}

interface CompanyResult {
  companyNameEN: string;
  companyNameKR: string;
  companyId?: string;
  isNew: boolean;
  products: ProductInfo[];
}

interface ProcessFileResponse {
  resultFileKey: string;
  pendingCompanies: CompanyResult[];
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' }),
      };
    }

    const request = JSON.parse(event.body) as ProcessFileRequest;
    const { fileKey, templateId, carrierId } = request;

    // 템플릿 정보 가져오기
    const templateInfo = await getTemplateInfo(carrierId, templateId);

    // S3에서 파일 가져오기
    const s3Object = await s3
      .getObject({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      })
      .promise();

    const workbook = XLSX.read(s3Object.Body, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // 업체별 처리 결과 수집
    const companiesResult: CompanyResult[] = [];
    
    // 업체명 추출
    const companyNameCell = worksheet[
      XLSX.utils.encode_cell({
        r: templateInfo.companyNameRow - 1,
        c: XLSX.utils.decode_col(templateInfo.companyNameColumn),
      })
    ];
    
    if (!companyNameCell) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Company name not found in the file' }),
      };
    }
    
    const companyNameEN = companyNameCell.v.toString().trim();
    
    // 회사 정보 조회
    const companyData = await getCompanyByName(companyNameEN);
    
    // 제품 정보 추출 및 처리
    const productInfoList = extractProductInfo(worksheet, templateInfo);
    
    // 회사별 처리 결과 저장
    companiesResult.push({
      companyNameEN,
      companyNameKR: companyData?.companyNameKR || '',
      companyId: companyData?.companyId,
      isNew: !companyData,
      products: productInfoList,
    });
    
    // 결과 파일 생성 (이 단계에서는 HS 코드가 확인된 제품만 업데이트)
    await updateExcelWithHSCodes(workbook, companiesResult, templateInfo);
    
    // 결과 파일 S3에 저장
    const resultFileKey = `results/${fileKey}`;
    
    await s3
      .putObject({
        Bucket: RESULT_BUCKET,
        Key: resultFileKey,
        Body: XLSX.write(workbook, { type: 'buffer' }),
        ContentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        resultFileKey,
        pendingCompanies: companiesResult,
      } as ProcessFileResponse),
    };
  } catch (error) {
    console.error('Error processing file:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing file',
        error: (error as Error).message,
      }),
    };
  }
}

function extractProductInfo(
  worksheet: XLSX.IWorkSheet,
  templateInfo: TemplateInfo
): ProductInfo[] {
  const productList: ProductInfo[] = [];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let rowIndex = templateInfo.startRow - 1; rowIndex <= range.e.r; rowIndex++) {
    const productCell = worksheet[
      XLSX.utils.encode_cell({
        r: rowIndex,
        c: XLSX.utils.decode_col(templateInfo.productColumn),
      })
    ];
    
    if (productCell && productCell.v) {
      const productName = productCell.v.toString().trim();
      
      if (productName) {
        productList.push({
          productName,
          rowIndex,
        });
      }
    }
  }
  
  return productList;
}

async function updateExcelWithHSCodes(
  workbook: XLSX.IWorkBook,
  companies: CompanyResult[],
  templateInfo: TemplateInfo
): Promise<void> {
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  
  for (const company of companies) {
    if (!company.companyId) continue; // 신규 업체는 건너뜀
    
    for (const product of company.products) {
      if (product.hsCode) {
        const hsCodeCell = XLSX.utils.encode_cell({
          r: product.rowIndex,
          c: XLSX.utils.decode_col(templateInfo.hsCodeColumn),
        });
        
        worksheet[hsCodeCell] = { t: 's', v: product.hsCode };
      }
    }
  }
}
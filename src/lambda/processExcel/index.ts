// src/lambda/processExcel/index.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as XLSX from 'xlsx';
import { S3 } from 'aws-sdk';
import { getTemplateInfo, TemplateInfo } from './getTemplateInfo';
import { getCompanyByName } from './companyService';
import { getProductVariantsByName } from './productService';

const s3 = new S3();
const BUCKET_NAME = process.env.UPLOAD_BUCKET || '';
const RESULT_BUCKET = process.env.RESULT_BUCKET || '';

interface ProcessFileRequest {
  fileKey: string;
  templateId: string;
  carrierId: string;
  verifiedData?: {
    companyName: string;
    firstProductName: string;
  };
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
    // 미리보기 추출 API 처리
    if (event.httpMethod === 'GET' && event.path && event.path.includes('/excel/extract-preview')) {
      const queryParams = event.queryStringParameters || {};
      const { fileKey, templateId, carrierId } = queryParams;
      
      if (!fileKey || !templateId || !carrierId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: '필요한 파라미터가 누락되었습니다.' }),
        };
      }
      
      try {
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
            body: JSON.stringify({ message: '파일에서 업체명을 찾을 수 없습니다.' }),
          };
        }
        
        // 첫 번째 제품명 추출
        let firstProductName = '';
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        for (let rowIndex = templateInfo.startRow - 1; rowIndex <= range.e.r; rowIndex++) {
          const productCell = worksheet[
            XLSX.utils.encode_cell({
              r: rowIndex,
              c: XLSX.utils.decode_col(templateInfo.productColumn),
            })
          ];
          
          if (productCell && productCell.v) {
            firstProductName = productCell.v.toString().trim();
            if (firstProductName) break;
          }
        }
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            companyName: companyNameCell.v.toString().trim(),
            firstProduct: firstProductName,
          }),
        };
      } catch (error) {
        console.error('Error extracting preview data:', error);
        
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: '미리보기 데이터 추출 중 오류가 발생했습니다.',
            error: (error as Error).message,
          }),
        };
      }
    }

    // 결과 조회 API 처리
    if (event.httpMethod === 'GET' && event.path && event.path.includes('/excel/process-result/')) {
      const resultKey = event.pathParameters?.resultKey || 
                        (event.path.split('/excel/process-result/')[1] || '');
      
      // 여기에 결과 조회 로직 구현
      // ...
      return {
        statusCode: 200,
        body: JSON.stringify({
          resultFileKey: resultKey,
          pendingCompanies: [], // 실제로는 저장된 결과를 조회
        }),
      };
    }

    // 기존 POST 요청 처리
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' }),
      };
    }

    const request = JSON.parse(event.body) as ProcessFileRequest;
    const { fileKey, templateId, carrierId, verifiedData } = request;

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
    
    // 검증된 데이터가 있으면 해당 값 사용, 없으면 엑셀에서 추출한 값 사용
    const companyNameEN = verifiedData?.companyName || companyNameCell.v.toString().trim();
    
    // 회사 정보 조회
    const companyData = await getCompanyByName(companyNameEN);
    
    // 제품 정보 추출 및 처리
    const productInfoList = await extractProductInfo(worksheet, templateInfo, companyData?.companyId);
    
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

// 제품 정보 추출 함수 - 비동기 함수로 변경
async function extractProductInfo(
  worksheet: XLSX.IWorkSheet,
  templateInfo: TemplateInfo,
  companyId?: string
): Promise<ProductInfo[]> {
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
        const productInfo: ProductInfo = {
          productName,
          rowIndex,
        };
        
        // 회사ID가 있고 (기존 회사인 경우) 제품 정보 조회
        if (companyId) {
          try {
            const productVariants = await getProductVariantsByName(companyId, productName);
            
            if (productVariants) {
              // 다중 HS 코드가 있는 경우
              if (productVariants.hsCodes.length > 1) {
                productInfo.hasMultipleHSCodes = true;
                productInfo.variants = productVariants.variants;
              } else if (productVariants.hsCodes.length === 1) {
                // 단일 HS 코드 적용
                productInfo.hsCode = productVariants.hsCodes[0];
              }
            }
          } catch (error) {
            console.error(`Error fetching product variants for ${productName}:`, error);
            // 에러가 발생하더라도 계속 진행
          }
        }
        
        productList.push(productInfo);
      }
    }
  }
  
  return productList;
}

// 엑셀에 HS 코드 업데이트 함수
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
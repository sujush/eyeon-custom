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
  // 로그: 전체 이벤트 객체 출력
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // 미리보기 추출 API 처리

    console.log('event.path:', event.path); // 실제: "/prod/excel/extract-preview"
    console.log('event.resource:', event.resource); // "/excel/extract-preview"


    if (
      event.httpMethod === 'GET' &&
      event.resource === '/excel/extract-preview'
    ) {
      console.log("Handling extract-preview request.");
      const queryParams = event.queryStringParameters || {};
      console.log("Query Parameters:", JSON.stringify(queryParams));
    
      const { fileKey, templateId, carrierId } = queryParams;
    
      if (!fileKey || !templateId || !carrierId) {
        console.error("Missing query parameters: fileKey, templateId, or carrierId.");
        return {
          statusCode: 400,
          body: JSON.stringify({ message: '필요한 파라미터가 누락되었습니다.' }),
        };
      }
      
      try {
        console.log("Retrieving template info for carrierId:", carrierId, "templateId:", templateId);
        const templateInfo: TemplateInfo = await getTemplateInfo(carrierId, templateId);
        console.log("Template info retrieved:", JSON.stringify(templateInfo, null, 2));
        
        console.log("Fetching file from S3. Bucket:", BUCKET_NAME, "Key:", fileKey);
        const s3Object = await s3
          .getObject({
            Bucket: BUCKET_NAME,
            Key: fileKey,
          })
          .promise();
        console.log("S3 object retrieved. Size:", s3Object.ContentLength);
        
        const workbook = XLSX.read(s3Object.Body, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        console.log("Worksheet loaded. Sheet name:", workbook.SheetNames[0]);
        
        // 업체명 추출
        const companyNameCellAddress = XLSX.utils.encode_cell({
          r: templateInfo.companyNameRow - 1,
          c: XLSX.utils.decode_col(templateInfo.companyNameColumn),
        });
        console.log("Looking for company name cell at:", companyNameCellAddress);
        const companyNameCell = worksheet[companyNameCellAddress];
        
        if (!companyNameCell) {
          console.error("Company name cell not found at address:", companyNameCellAddress);
          return {
            statusCode: 400,
            body: JSON.stringify({ message: '파일에서 업체명을 찾을 수 없습니다.' }),
          };
        }
        
        // 첫 번째 제품명 추출
        let firstProductName = '';
        const sheetRef = worksheet['!ref'] || 'A1';
        const range = XLSX.utils.decode_range(sheetRef);
        console.log("Worksheet range:", JSON.stringify(range));
        
        for (let rowIndex = templateInfo.startRow - 1; rowIndex <= range.e.r; rowIndex++) {
          const productCellAddress = XLSX.utils.encode_cell({
            r: rowIndex,
            c: XLSX.utils.decode_col(templateInfo.productColumn),
          });
          const productCell = worksheet[productCellAddress];
          if (productCell && productCell.v) {
            firstProductName = productCell.v.toString().trim();
            console.log(`Found product at row ${rowIndex + 1} (${productCellAddress}):`, firstProductName);
            if (firstProductName) break;
          }
        }
        
        console.log("Extracted company name:", companyNameCell.v.toString().trim(), "and first product:", firstProductName);
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
      console.log("Handling process-result request.");
      const resultKey = event.pathParameters?.resultKey || (event.path.split('/excel/process-result/')[1] || '');
      console.log("Result Key:", resultKey);
      // 결과 조회 로직 구현 (현재는 기본 응답)
      return {
        statusCode: 200,
        body: JSON.stringify({
          resultFileKey: resultKey,
          pendingCompanies: [],
        }),
      };
    }

    // 기존 POST 요청 처리
    if (!event.body) {
      console.error("Missing request body for POST request.");
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' }),
      };
    }

    console.log("Handling POST request. Body:", event.body);
    const request = JSON.parse(event.body) as ProcessFileRequest;
    const { fileKey, templateId, carrierId, verifiedData } = request;
    console.log("POST parameters:", { fileKey, templateId, carrierId, verifiedData });

    // 템플릿 정보 가져오기
    console.log("Retrieving template info for POST request.");
    const templateInfo = await getTemplateInfo(carrierId, templateId);
    console.log("Template info:", JSON.stringify(templateInfo, null, 2));

    // S3에서 파일 가져오기
    console.log("Fetching file from S3 for POST. Bucket:", BUCKET_NAME, "Key:", fileKey);
    const s3Object = await s3
      .getObject({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      })
      .promise();
    console.log("S3 object retrieved for POST. Size:", s3Object.ContentLength);
    
    const workbook = XLSX.read(s3Object.Body, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    console.log("Worksheet loaded for POST. Sheet name:", workbook.SheetNames[0]);

    // 업체별 처리 결과 수집
    const companiesResult: CompanyResult[] = [];
    
    // 업체명 추출
    const companyNameCellAddress = XLSX.utils.encode_cell({
      r: templateInfo.companyNameRow - 1,
      c: XLSX.utils.decode_col(templateInfo.companyNameColumn),
    });
    console.log("Extracting company name from cell:", companyNameCellAddress);
    const companyNameCell = worksheet[companyNameCellAddress];
    
    if (!companyNameCell) {
      console.error("Company name not found in file at address:", companyNameCellAddress);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Company name not found in the file' }),
      };
    }
    
    // 검증된 데이터가 있으면 해당 값 사용, 없으면 엑셀에서 추출한 값 사용
    const companyNameEN = verifiedData?.companyName || companyNameCell.v.toString().trim();
    console.log("Using companyNameEN:", companyNameEN);
    
    // 회사 정보 조회
    console.log("Fetching company data for:", companyNameEN);
    const companyData = await getCompanyByName(companyNameEN);
    console.log("Company data retrieved:", JSON.stringify(companyData, null, 2));
    
    // 제품 정보 추출 및 처리
    console.log("Extracting product information starting from row:", templateInfo.startRow);
    const productInfoList = await extractProductInfo(worksheet, templateInfo, companyData?.companyId);
    console.log("Extracted product information:", JSON.stringify(productInfoList, null, 2));
    
    // 회사별 처리 결과 저장
    companiesResult.push({
      companyNameEN,
      companyNameKR: companyData?.companyNameKR || '',
      companyId: companyData?.companyId,
      isNew: !companyData,
      products: productInfoList,
    });
    
    // 결과 파일 생성: HS 코드가 확인된 제품만 업데이트
    console.log("Updating worksheet with HS codes using template info:", templateInfo.hsCodeColumn);
    await updateExcelWithHSCodes(workbook, companiesResult, templateInfo);
    
    // 결과 파일 S3에 저장
    const resultFileKey = `results/${fileKey}`;
    console.log("Saving updated workbook to S3. Bucket:", RESULT_BUCKET, "Key:", resultFileKey);
    await s3
      .putObject({
        Bucket: RESULT_BUCKET,
        Key: resultFileKey,
        Body: XLSX.write(workbook, { type: 'buffer' }),
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .promise();
    console.log("Workbook saved successfully to S3.");
    
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
  console.log("Starting product information extraction.");
  const productList: ProductInfo[] = [];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  console.log("Worksheet range for product extraction:", JSON.stringify(range));
  
  for (let rowIndex = templateInfo.startRow - 1; rowIndex <= range.e.r; rowIndex++) {
    const cellAddress = XLSX.utils.encode_cell({
      r: rowIndex,
      c: XLSX.utils.decode_col(templateInfo.productColumn),
    });
    const productCell = worksheet[cellAddress];
    if (productCell && productCell.v) {
      const productName = productCell.v.toString().trim();
      if (productName) {
        console.log(`Found product at row ${rowIndex + 1} (${cellAddress}):`, productName);
        const productInfo: ProductInfo = {
          productName,
          rowIndex,
        };
        // 회사ID가 있고 (기존 회사인 경우) 제품 정보 조회
        if (companyId) {
          try {
            console.log(`Fetching product variants for product "${productName}" (companyId: ${companyId})`);
            const productVariants = await getProductVariantsByName(companyId, productName);
            console.log("Product variants retrieved:", JSON.stringify(productVariants, null, 2));
            if (productVariants) {
              if (productVariants.hsCodes.length > 1) {
                productInfo.hasMultipleHSCodes = true;
                productInfo.variants = productVariants.variants;
                console.log(`Multiple HS codes found for product "${productName}".`);
              } else if (productVariants.hsCodes.length === 1) {
                productInfo.hsCode = productVariants.hsCodes[0];
                console.log(`Single HS code found for product "${productName}": ${productInfo.hsCode}`);
              }
            }
          } catch (error) {
            console.error(`Error fetching product variants for ${productName}:`, error);
          }
        }
        productList.push(productInfo);
      }
    }
  }
  
  console.log("Completed product extraction. Total products extracted:", productList.length);
  return productList;
}

// 엑셀에 HS 코드 업데이트 함수
async function updateExcelWithHSCodes(
  workbook: XLSX.IWorkBook,
  companies: CompanyResult[],
  templateInfo: TemplateInfo
): Promise<void> {
  console.log("Starting HS code update in workbook.");
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  
  for (const company of companies) {
    if (!company.companyId) {
      console.log("Skipping HS code update for new company:", company.companyNameEN);
      continue; // 신규 업체는 건너뜀
    }
    
    for (const product of company.products) {
      if (product.hsCode) {
        const hsCodeCellAddress = XLSX.utils.encode_cell({
          r: product.rowIndex,
          c: XLSX.utils.decode_col(templateInfo.hsCodeColumn),
        });
        console.log(`Updating HS code for product "${product.productName}" at cell ${hsCodeCellAddress} with value: ${product.hsCode}`);
        worksheet[hsCodeCellAddress] = { t: 's', v: product.hsCode };
      }
    }
  }
  console.log("Completed HS code update in workbook.");
}

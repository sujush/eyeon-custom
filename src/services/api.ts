// src/services/api.ts
 /* eslint-disable */
import axios, { AxiosResponse } from 'axios';

// API 기본 URL 설정 - 현재 프록시 사용 ,추후 로컬환경 탈피시 수정
const API_BASE_URL = '/api';

// S3 업로드 URL 설정

const S3_UPLOAD_URL = process.env.NEXT_PUBLIC_S3_UPLOAD_URL || 'https://hs-code-uploads.s3.amazonaws.com';

// API 클라이언트 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 인터페이스 정의
interface ProductVariant {
  HSCode: string;
  VariantAttributes?: Record<string, string>;
  DefaultVariant?: boolean;
}

interface Product {
  CompanyID: string;
  SK: string;
  ProductName: string;
  variants: ProductVariant[];
}

interface Template {
  TemplateID: string;
  CarrierID: string;
  TemplateName: string;
  ProductColumn: string;
  HSCodeColumn: string;
  CompanyNameRow: number;
  CompanyNameColumn: string;
  StartRow: number;
}

interface Carrier {
  CarrierID: string;
  CarrierName: string;
  Templates: Template[];
}

interface ProcessFileRequest {
  fileKey: string;
  templateId: string;
  carrierId: string;
}

export interface ProcessFileResponse {
  resultFileKey: string;
  pendingCompanies: CompanyResult[];
}

export interface CompanyResult {
  companyNameEN: string;
  companyNameKR: string;
  companyId?: string;
  isNew: boolean;
  products: ProductInfo[];
}

export interface ProductInfo {
  productName: string;
  rowIndex: number;
  hsCode?: string;
  hasMultipleHSCodes?: boolean;
  variants?: {
    hsCode: string;
    attributes?: Record<string, string>;
  }[];
}

// 업체 정보 업데이트 요청
export interface UpdateCompanyRequest {
  companyNameEN: string;
  companyNameKR: string;
  products: {
    productName: string;
    hsCode: string;
    variantAttributes?: Record<string, string>;
  }[];
}

// 제품 HS 코드 선택 요청
export interface SelectProductHsCodesRequest {
  companyId: string;
  products: {
    productName: string;
    selectedHsCode: string;
  }[];
}

// CarrierResponse 인터페이스 정의
interface CarrierResponse {
  id: string;
  name: string;
}

// API 서비스 클래스
export class ApiService {
  // 운송사 목록 조회
  static async getCarriers(): Promise<CarrierResponse[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/carriers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('API Response Status:', response.status);
      const data = await response.json();
      console.log('API Response Data:', data);
      
      // 응답 구조에 따라 적절히 처리
      return Array.isArray(data) ? data : (data.carriers || []);
    } catch (error) {
      console.error('Error fetching carriers:', error);
      // 오류가 발생해도 빈 배열 반환
      return [];
    }
  }

  // 운송사별 템플릿 목록 조회
  static async getTemplatesByCarrier(carrierId: string): Promise<Template[]> {
    try {
      const response: AxiosResponse<{ templates: Template[] }> = await apiClient.get(`/carriers/${carrierId}/templates`);
      return response.data.templates;
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  // 제품 목록 조회
  static async getProducts(companyId: string, searchTerm?: string): Promise<Product[]> {
    try {
      const params = { companyId, search: searchTerm };
      const response: AxiosResponse<{ products: Product[] }> = await apiClient.get('/products', { params });
      return response.data.products;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  // 제품 추가
  static async addProduct(product: Omit<Product, 'SK'>): Promise<Product> {
    try {
      const response: AxiosResponse<{ product: Product }> = await apiClient.post('/products', product);
      return response.data.product;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  // 제품 업데이트
  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    try {
      const response: AxiosResponse<{ product: Product }> = await apiClient.put(`/products/${productId}`, updates);
      return response.data.product;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  // 제품 삭제
  static async deleteProduct(productId: string): Promise<void> {
    try {
      await apiClient.delete(`/products/${productId}`);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // S3 직접 업로드를 위한 사전 서명된 URL 가져오기
  static async getPresignedUrl(fileName: string, contentType: string): Promise<{url: string, fileKey: string}> {
    try {
      const response: AxiosResponse<{ url: string, fileKey: string }> = await apiClient.post('/upload/presigned', {
        fileName,
        contentType
      });
      return response.data;
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      throw error;
    }
  }

  // 파일 S3에 업로드
  static async uploadFileToS3(presignedUrl: string, file: File): Promise<void> {
    try {
      await axios.put(presignedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
      });
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw error;
    }
  }

  // 파일 업로드 (편의 함수)
  static async uploadFile(file: File): Promise<{ fileKey: string }> {
    try {
      // 1. 사전 서명된 URL 요청
      const { url, fileKey } = await this.getPresignedUrl(file.name, file.type);
      
      // 2. 사전 서명된 URL로 직접 업로드
      await this.uploadFileToS3(url, file);
      
      return { fileKey };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  // 엑셀 파일 처리 요청
  static async processFile(request: ProcessFileRequest): Promise<ProcessFileResponse> {
    try {
      const response: AxiosResponse<ProcessFileResponse> = await apiClient.post('/excel/process', request);
      return response.data;
    } catch (error) {
      console.error('Error processing file:', error);
      throw error;
    }
  }

  // 처리 결과 조회
  static async getProcessResult(resultKey: string): Promise<ProcessFileResponse> {
    try {
      const response: AxiosResponse<ProcessFileResponse> = await apiClient.get(`/excel/process-result/${resultKey}`);
      return response.data;
    } catch (error) {
      console.error('Error getting process result:', error);
      throw error;
    }
  }

  // 업체 정보 업데이트
  static async updateCompanyInfo(request: UpdateCompanyRequest): Promise<void> {
    try {
      await apiClient.post('/companies/update', request);
    } catch (error) {
      console.error('Error updating company info:', error);
      throw error;
    }
  }

  // 제품 HS 코드 선택
  static async selectProductHsCodes(request: SelectProductHsCodesRequest): Promise<void> {
    try {
      await apiClient.post('/products/select-hs-codes', request);
    } catch (error) {
      console.error('Error selecting product HS codes:', error);
      throw error;
    }
  }
}

// 함수형 API를 위한 wrapper
export const getCarriers = ApiService.getCarriers;
export const getTemplatesByCarrier = ApiService.getTemplatesByCarrier;
export const getProducts = ApiService.getProducts;
export const addProduct = ApiService.addProduct;
export const updateProduct = ApiService.updateProduct;
export const deleteProduct = ApiService.deleteProduct;
export const uploadFile = ApiService.uploadFile;
export const processFile = ApiService.processFile;
export const getProcessResult = ApiService.getProcessResult;
export const updateCompanyInfo = ApiService.updateCompanyInfo;
export const selectProductHsCodes = ApiService.selectProductHsCodes;
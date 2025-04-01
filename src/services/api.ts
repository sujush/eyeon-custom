/* eslint-disable */
import axios, { AxiosResponse, isAxiosError } from 'axios'; // isAxiosError 임포트 추가

// API 기본 URL 설정 - 현재 프록시 사용 ,추후 로컬환경 탈피시 수정
const API_BASE_URL = '/api';

// API 클라이언트 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- 인터페이스 정의 (기존과 동일) ---
interface ProductVariant { HSCode: string; VariantAttributes?: Record<string, string>; DefaultVariant?: boolean; }
interface Product { CompanyID: string; SK: string; ProductName: string; variants: ProductVariant[]; }
interface Template { TemplateID: string; CarrierID: string; TemplateName: string; ProductColumn: string; HSCodeColumn: string; CompanyNameRow: number; CompanyNameColumn: string; StartRow: number; }
// interface Carrier { CarrierID: string; CarrierName: string; Templates: Template[]; } // Carrier 인터페이스가 사용되지 않으면 제거 가능
export interface ProcessFileResponse { resultFileKey: string; pendingCompanies: CompanyResult[]; }
export interface CompanyResult { companyNameEN: string; companyNameKR: string; companyId?: string; isNew: boolean; products: ProductInfo[]; }
export interface ProductInfo { productName: string; rowIndex: number; hsCode?: string; hasMultipleHSCodes?: boolean; variants?: { hsCode: string; attributes?: Record<string, string>; }[]; }
export interface UpdateCompanyRequest { companyNameEN: string; companyNameKR: string; products: { productName: string; hsCode: string; variantAttributes?: Record<string, string>; }[]; }
export interface SelectProductHsCodesRequest { companyId: string; products: { productName: string; selectedHsCode: string; }[]; }
interface CarrierResponse { id: string; name: string; }
interface ProcessFileRequest {
  fileKey: string;
  templateId: string;
  carrierId: string;
  verifiedData?: {
    companyName: string;
    firstProductName: string;
  };
}
// --- 인터페이스 정의 끝 ---

// API 서비스 클래스
export class ApiService {
  // --- 운송사 목록 조회 (기존 로그 유지) ---
  static async getCarriers(): Promise<CarrierResponse[]> {
    console.log('[DEBUG][ApiService] Entering getCarriers...'); // 함수 시작 로그 추가
    try {
      const response = await fetch(`/api/carriers`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('[INFO][ApiService] getCarriers - API Response Status:', response.status); // 상태 로그 위치 조정
      if (!response.ok) {
        console.error('[ERROR][ApiService] getCarriers - API error status:', response.status);
        // 에러 응답 본문 로깅 시도
        try {
          const errorBody = await response.text(); // text()는 항상 성공
          console.error('[ERROR][ApiService] getCarriers - API error body:', errorBody);
        } catch (e) { /* ignore */ }
        return [];
      }
      const data = await response.json();
      console.log('[INFO][ApiService] getCarriers - API Response Data:', data);
      // 응답 구조 처리... (기존 로직)
      if (Array.isArray(data)) { return data; }
      else if (data && Array.isArray(data.carriers)) { return data.carriers; }
      else { console.warn('[WARN][ApiService] getCarriers - Unexpected API response format:', data); return []; }
    } catch (error) {
      console.error('[ERROR][ApiService] Error fetching carriers:', error);
      return [];
    }
  }

  // --- 운송사별 템플릿 목록 조회 ---
  static async getTemplatesByCarrier(carrierId: string): Promise<Template[]> {
    console.log(`[DEBUG][ApiService] Entering getTemplatesByCarrier for carrierId: ${carrierId}`); // 로그 추가
    try {
      const response: AxiosResponse<{ templates: Template[] }> = await apiClient.get(`/carriers/${carrierId}/templates`);
      console.log(`[INFO][ApiService] Fetched ${response.data.templates?.length || 0} templates for carrier ${carrierId}.`); // 결과 로그 추가
      return response.data.templates;
    } catch (error) {
      console.error(`[ERROR][ApiService] Error fetching templates for carrier ${carrierId}:`, error);
      // Axios 에러 상세 로깅 추가
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }

  // --- 제품 목록 조회 ---
  static async getProducts(companyId: string, searchTerm?: string): Promise<Product[]> {
    console.log(`[DEBUG][ApiService] Entering getProducts. CompanyId: ${companyId}, SearchTerm: ${searchTerm}`); // 로그 추가
    try {
      const params = { companyId, search: searchTerm };
      const response: AxiosResponse<{ products: Product[] }> = await apiClient.get('/products', { params });
      console.log(`[INFO][ApiService] Fetched ${response.data.products?.length || 0} products.`); // 결과 로그 추가
      return response.data.products;
    } catch (error) {
      console.error('[ERROR][ApiService] Error fetching products:', error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }

  // --- 제품 추가 ---
  static async addProduct(product: Omit<Product, 'SK'>): Promise<Product> {
    console.log(`[DEBUG][ApiService] Entering addProduct for product: ${product.ProductName}`); // 로그 추가
    try {
      const response: AxiosResponse<{ product: Product }> = await apiClient.post('/products', product);
      console.log(`[INFO][ApiService] Product added successfully: ${response.data.product?.ProductName}`); // 성공 로그 추가
      return response.data.product;
    } catch (error) {
      console.error('[ERROR][ApiService] Error adding product:', error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }

  // --- 제품 업데이트 ---
  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    console.log(`[DEBUG][ApiService] Entering updateProduct for productId: ${productId}`); // 로그 추가
    try {
      const response: AxiosResponse<{ product: Product }> = await apiClient.put(`/products/${productId}`, updates);
      console.log(`[INFO][ApiService] Product updated successfully: ${productId}`); // 성공 로그 추가
      return response.data.product;
    } catch (error) {
      console.error(`[ERROR][ApiService] Error updating product ${productId}:`, error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }

  // --- 제품 삭제 ---
  static async deleteProduct(productId: string): Promise<void> {
    console.log(`[DEBUG][ApiService] Entering deleteProduct for productId: ${productId}`); // 로그 추가
    try {
      await apiClient.delete(`/products/${productId}`);
      console.log(`[INFO][ApiService] Product deleted successfully: ${productId}`); // 성공 로그 추가
    } catch (error) {
      console.error(`[ERROR][ApiService] Error deleting product ${productId}:`, error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }

  // --- S3 직접 업로드를 위한 사전 서명된 URL 가져오기 ---
  static async getPresignedUrl(fileName: string, contentType: string): Promise<{ url: string, fileKey: string }> {
    console.log(`[DEBUG][ApiService] Entering getPresignedUrl for fileName: ${fileName}, contentType: ${contentType}`); // 로그 추가
    try {
      const response: AxiosResponse<{ url: string, fileKey: string }> = await apiClient.post('/upload/presigned', {
        fileName,
        contentType
      });
      console.log(`[INFO][ApiService] Got presigned URL successfully. FileKey: ${response.data?.fileKey}`); // 성공 로그 추가
      // console.log(`[DEBUG][ApiService] Presigned URL: ${response.data?.url}`); // URL 로깅은 보안상 주의
      return response.data;
    } catch (error) {
      console.error('[ERROR][ApiService] Error getting presigned URL:', error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }

  // --- *** 파일 S3에 업로드 (상세 로그 추가) *** ---
  static async uploadFileToS3(presignedUrl: string, file: File): Promise<void> {
    console.log(`[DEBUG][ApiService] Entering uploadFileToS3 for file: ${file.name}`); // 함수 시작 로그
    try {
      console.log(`[DEBUG][ApiService] Attempting axios.put to S3 URL (length: ${presignedUrl?.length}) for file: ${file.name}`); // PUT 시도 로그
      const response = await axios.put(presignedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        // 타임아웃 설정 (옵션)
        // timeout: 60000, // 예: 60초
        // 업로드 진행률 콜백 (옵션)
        // onUploadProgress: (progressEvent) => {
        //   if (progressEvent.total) {
        //     const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        //     console.log(`[DEBUG][ApiService] S3 Upload Progress: ${percentCompleted}%`);
        //   }
        // }
      });
      // 성공 로그: 상태 코드 포함
      console.log(`[INFO][ApiService] axios.put to S3 successful! Status: ${response.status}`);
    } catch (error) {
      // 실패 로그: 상세 오류 포함
      console.error(`[ERROR][ApiService] axios.put to S3 FAILED for file: ${file.name}:`, error);
      // Axios 에러인 경우, 응답 데이터와 상태 코드 로깅
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response data:', error.response?.data); // S3의 XML 오류 메시지 확인 가능
        console.error('[ERROR][ApiService] Axios error response status:', error.response?.status); // 403, 400 등 상태 코드 확인
        console.error('[ERROR][ApiService] Axios error request headers:', error.request?.headers); // 요청 헤더 확인 (디버깅용)
      }
      throw error; // 에러를 다시 던져서 useFileUpload 훅에서 처리하도록 함
    }
  }

  // --- 파일 업로드 (편의 함수 - 수정된 버전 적용됨) ---
  static async uploadFile(file: File): Promise<{ fileKey: string }> {
    console.log(`[DEBUG][ApiService] Entering uploadFile convenience function for: ${file.name}`);
    try {
      // 1. 사전 서명된 URL 요청 (클래스명으로 호출)
      const { url, fileKey } = await ApiService.getPresignedUrl(file.name, file.type);

      // 2. 사전 서명된 URL로 직접 업로드 (클래스명으로 호출)
      await ApiService.uploadFileToS3(url, file);

      console.log(`[INFO][ApiService] uploadFile convenience function successful for: ${file.name}, fileKey: ${fileKey}`);
      return { fileKey };
    } catch (error) {
      // 여기서 잡힌 에러는 getPresignedUrl 또는 uploadFileToS3에서 발생한 에러임
      console.error(`[ERROR][ApiService] Error in uploadFile convenience function for ${file.name}:`, error);
      // 여기서 에러를 다시 throw 해야 상위 호출부(예: useFileUpload)에서 인지 가능
      throw error;
    }
  }

  // processFile 함수 수정
  static async processFile(request: ProcessFileRequest): Promise<ProcessFileResponse> {
    console.log(`[DEBUG][ApiService] Entering processFile for fileKey: ${request.fileKey}`);
    try {
      const response: AxiosResponse<ProcessFileResponse> = await apiClient.post('/excel/process', request);
      console.log(`[INFO][ApiService] processFile call successful for fileKey: ${request.fileKey}`);
      return response.data;
    } catch (error) {
      console.error(`[ERROR][ApiService] Error processing file ${request.fileKey}:`, error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }

  // --- 처리 결과 조회 ---
  static async getProcessResult(resultKey: string): Promise<ProcessFileResponse> {
    console.log(`[DEBUG][ApiService] Entering getProcessResult for resultKey: ${resultKey}`); // 로그 추가
    try {
      const response: AxiosResponse<ProcessFileResponse> = await apiClient.get(`/excel/process-result/${resultKey}`);
      console.log(`[INFO][ApiService] getProcessResult call successful for resultKey: ${resultKey}`); // 성공 로그 추가
      return response.data;
    } catch (error) {
      // 이전 로그에서 이 부분 에러(403)가 확인되었음
      console.error(`[ERROR][ApiService] Error getting process result for ${resultKey}:`, error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data); // 403 에러 시 응답 본문 확인 중요
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status); // 403 상태 코드 확인
      }
      throw error;
    }
  }

  // --- 업체 정보 업데이트 ---
  static async updateCompanyInfo(request: UpdateCompanyRequest): Promise<void> {
    console.log(`[DEBUG][ApiService] Entering updateCompanyInfo for company: ${request.companyNameEN}`); // 로그 추가
    try {
      await apiClient.post('/companies/update', request);
      console.log(`[INFO][ApiService] updateCompanyInfo call successful for company: ${request.companyNameEN}`); // 성공 로그 추가
    } catch (error) {
      console.error(`[ERROR][ApiService] Error updating company info for ${request.companyNameEN}:`, error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }

  // --- 제품 HS 코드 선택 ---
  static async selectProductHsCodes(request: SelectProductHsCodesRequest): Promise<void> {
    console.log(`[DEBUG][ApiService] Entering selectProductHsCodes for companyId: ${request.companyId}`); // 로그 추가
    try {
      await apiClient.post('/products/select-hs-codes', request);
      console.log(`[INFO][ApiService] selectProductHsCodes call successful for companyId: ${request.companyId}`); // 성공 로그 추가
    } catch (error) {
      console.error(`[ERROR][ApiService] Error selecting product HS codes for companyId ${request.companyId}:`, error);
      if (isAxiosError(error)) {
        console.error('[ERROR][ApiService] Axios error response:', error.response?.data);
        console.error('[ERROR][ApiService] Axios error status:', error.response?.status);
      }
      throw error;
    }
  }
}

// 함수형 API를 위한 wrapper (기존과 동일)
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
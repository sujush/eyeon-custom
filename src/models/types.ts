
// src/models/types.ts
export interface Product {
    CompanyID: string;
    SK: string; // ProductName#VariantID
    HSCode: string;
    ProductName: string; // GSI용 중복 필드
    VariantID?: string;
    VariantAttributes?: Record<string, string>;
    DefaultVariant?: boolean;
    LastUpdated: string;
    UpdatedBy?: string;
  }
  
  export interface Carrier {
    CarrierID: string;
    CarrierName: string;
    TemplateIDs: string[];
  }
  
  export interface Template {
    TemplateID: string;
    CarrierID: string;
    TemplateName: string;
    ProductColumn: string;
    HSCodeColumn: string;
    StartRow: number;
    EndIndicator?: string;
    AdditionalMappings?: Record<string, string>;
  }
  
  export interface ProcessRequest {
    fileKey: string;
    companyId: string;
    templateId: string;
  }
  
  export interface ProcessResult {
    resultUrl: string;
    stats: {
      total: number;
      matched: number;
      multipleMatches: number;
      notFound: number;
      newProducts: string[];
    };
  }
  
  export interface ProductSearchResult {
    products: Product[];
    nextToken?: string;
  }
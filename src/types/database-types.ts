// src/types/database-types.ts

// Products 테이블 수정 - 업체별 제품 관리
interface Product {
    CompanyID: string; // 파티션 키 (업체 식별자)
    SK: string; // 정렬 키 (ProductName#VariantID)
    HSCode: string;
    ProductName: string; // GSI용 중복 필드
    VariantAttributes?: Record<string, string>;
    DefaultVariant: boolean;
    LastUpdated: string;
    CompanyNameKR?: string;  // 선택적
    CompanyNameEN?: string;  // 선택적
}

// Carriers 테이블 유지
interface Carrier {
    CarrierID: string; // 파티션 키
    CarrierName: string;
    Templates: Template[];
}

// Templates 테이블 수정 - 업체명 위치 정보 추가
interface Template {
    TemplateID: string; // 파티션 키
    CarrierID: string; // 정렬 키
    TemplateName: string;
    ProductColumn: string; // 제품명 위치
    HSCodeColumn: string; // HS 코드 입력 위치
    CompanyNameRow: number; // 업체명 행 위치
    CompanyNameColumn: string; // 업체명 열 위치
    StartRow: number; // 데이터 시작 행
}

// 회사 정보를 저장하는 새 테이블
interface Company {
    CompanyID: string; // 파티션 키 (고유 ID)
    CompanyNameEN: string; // 영문 업체명 (GSI용)
    CompanyNameKR: string; // 한글 업체명
    LastUpdated: string;
}

export type { Product, Carrier, Template, Company };
'use client';  // Next.js 13 이상이라면 필요

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';

// Material UI v7에서는 Grid 대신 Box를 사용하여 유사한 레이아웃 구현
import { CompanyResult, ProductInfo, UpdateCompanyRequest } from '../../services/api';

// 이 컴포넌트가 받아야 할 props 정의
interface CompanyProductsListProps {
  company: CompanyResult;
  onUpdateCompany: (data: UpdateCompanyRequest) => Promise<void>;
}

export const CompanyProductsList: React.FC<CompanyProductsListProps> = ({
  company,
  onUpdateCompany,
}) => {
  // 회사명 (한글) 상태
  const [companyNameKR, setCompanyNameKR] = useState(company.companyNameKR);

  // 제품 목록 상태 (tempHsCode는 임시 입력값)
  const [products, setProducts] = useState<Array<ProductInfo & { tempHsCode?: string }>>(
    company.products
  );

  // HS 코드 직접 입력
  const handleHsCodeChange = (index: number, value: string) => {
    const updated = [...products];
    updated[index] = { ...updated[index], tempHsCode: value };
    setProducts(updated);
  };

  // HS 코드 variants 선택
  const handleVariantSelection = (index: number, hsCode: string) => {
    const updated = [...products];
    updated[index] = { ...updated[index], hsCode };
    setProducts(updated);
  };

  // 저장 버튼
  const handleSave = async () => {
    // 신규 업체인데 한글 업체명이 비어있으면 경고
    if (company.isNew && !companyNameKR.trim()) {
      alert('한글 업체명을 입력해주세요.');
      return;
    }

    // 모든 제품이 HS 코드(또는 tempHsCode)를 갖고 있는지 체크
    const missingHsCode = products.some(
      (p) => !p.hsCode && (!p.tempHsCode || !p.tempHsCode.trim())
    );
    if (missingHsCode) {
      alert('모든 제품에 HS 코드를 입력해주세요.');
      return;
    }

    // 업데이트할 데이터 구조
    const updateData: UpdateCompanyRequest = {
      companyNameEN: company.companyNameEN,
      companyNameKR,
      products: products.map((p) => ({
        productName: p.productName,
        // 최종적으로 hsCode가 있으면 쓰고, 없으면 tempHsCode 활용
        hsCode: p.hsCode || p.tempHsCode || '',
      })),
    };

    // 실제 업데이트 함수 호출
    await onUpdateCompany(updateData);
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        {company.isNew ? '신규 업체' : '기존 업체'}: {company.companyNameEN}
      </Typography>

      {company.isNew && (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="한글 업체명"
            value={companyNameKR}
            onChange={(e) => setCompanyNameKR(e.target.value)}
            required
            helperText="영문 업체명에 대응하는 한글 업체명을 입력해주세요"
          />
        </Box>
      )}

      <Typography variant="h6" gutterBottom>
        제품 목록
      </Typography>

      <List>
        {products.map((product, index) => (
          <React.Fragment key={`${product.productName}-${index}`}>
            <ListItem sx={{ py: 2 }}>
              {/* Grid 대신 Flexbox 기반 Box 사용 */}
              <Box sx={{ width: '100%' }}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', md: 'row' }, 
                    gap: 2,
                    width: '100%' 
                  }}
                >
                  {/* 제품명 영역 */}
                  <Box sx={{ width: { xs: '100%', md: '33.333%' } }}>
                    <Typography variant="body1">{product.productName}</Typography>
                  </Box>

                  {/* HS 코드 영역 */}
                  <Box sx={{ width: { xs: '100%', md: '66.666%' } }}>
                    {/* 여러 가지 HS 코드를 가질 수 있는 경우 */}
                    {product.hasMultipleHSCodes && product.variants ? (
                      <FormControl fullWidth>
                        <InputLabel>HS 코드 선택</InputLabel>
                        <Select
                          value={product.hsCode || ''}
                          label="HS 코드 선택"
                          onChange={(e: SelectChangeEvent<string>) =>
                            handleVariantSelection(index, e.target.value)
                          }
                        >
                          {product.variants.map((variant) => (
                            <MenuItem key={variant.hsCode} value={variant.hsCode}>
                              {/* 예: HS코드 + 속성 */}
                              {variant.hsCode}
                              {variant.attributes &&
                                ` (${Object.entries(variant.attributes)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(', ')})`}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      // 단일 HS 코드만 가지는 경우
                      <TextField
                        fullWidth
                        label="HS 코드"
                        value={product.hsCode || product.tempHsCode || ''}
                        onChange={(e) => handleHsCodeChange(index, e.target.value)}
                        required
                      />
                    )}
                  </Box>
                </Box>
              </Box>
            </ListItem>
            <Divider />
          </React.Fragment>
        ))}
      </List>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" color="primary" onClick={handleSave}>
          저장
        </Button>
      </Box>
    </Paper>
  );
};
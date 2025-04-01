//src/app/upload-result/CompanyProductList.tsx
'use client'

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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { CompanyResult, ProductInfo, UpdateCompanyRequest } from '../../services/api';

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

  // 신규 HS 코드 추가를 위한 상태
  const [isAddHsCodeDialogOpen, setIsAddHsCodeDialogOpen] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const [newHsCode, setNewHsCode] = useState('');

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

  // 신규 HS 코드 추가 다이얼로그 열기
  const handleOpenAddHsCodeDialog = (index: number) => {
    setSelectedProductIndex(index);
    setNewHsCode('');
    setIsAddHsCodeDialogOpen(true);
  };

  // 신규 HS 코드 추가
  const handleAddNewHsCode = () => {
    if (selectedProductIndex === null || !newHsCode.trim()) return;

    const updated = [...products];
    const product = updated[selectedProductIndex];

    // 기존 variants가 없으면 생성
    if (!product.variants) {
      product.variants = [];
    }

    // 기존 HS 코드가 있으면 variants에 추가
    if (product.hsCode && !product.variants.some(v => v.hsCode === product.hsCode)) {
      product.variants.push({ hsCode: product.hsCode });
    }

    // 새 HS 코드 추가
    product.variants.push({ hsCode: newHsCode });
    product.hasMultipleHSCodes = true;
    product.hsCode = newHsCode; // 새로 추가한 코드를 현재 선택된 코드로 설정

    setProducts(updated);
    setIsAddHsCodeDialogOpen(false);
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
                  <Box sx={{ 
                    width: { xs: '100%', md: '60%' },
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 1
                  }}>
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
                    
                    {/* 새 HS 코드 추가 버튼 */}
                    <IconButton 
                      color="primary" 
                      onClick={() => handleOpenAddHsCodeDialog(index)}
                      title="새 HS 코드 추가"
                    >
                      <AddIcon />
                    </IconButton>
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

      {/* 새 HS 코드 추가 다이얼로그 */}
      <Dialog open={isAddHsCodeDialogOpen} onClose={() => setIsAddHsCodeDialogOpen(false)}>
        <DialogTitle>새 HS 코드 추가</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="새 HS 코드"
            fullWidth
            value={newHsCode}
            onChange={(e) => setNewHsCode(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddHsCodeDialogOpen(false)}>취소</Button>
          <Button onClick={handleAddNewHsCode} color="primary">추가</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
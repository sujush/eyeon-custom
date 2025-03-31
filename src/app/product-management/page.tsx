// src/app/product-management/page.tsx
'use client';

import { useState } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  TextField, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  SelectChangeEvent
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface ProductVariant {
  id: string;
  hsCode: string;
  attributes: { [key: string]: string };
  isDefault: boolean;
}

interface Product {
  id: string;
  name: string;
  companyId: string;
  variants: ProductVariant[];
}

// 샘플 데이터
const initialProducts: Product[] = [
  {
    id: 'p1',
    name: 'Key ring',
    companyId: 'company-1',
    variants: [
      {
        id: 'v1',
        hsCode: '3926.90.9000',
        attributes: { material: 'plastic' },
        isDefault: true
      },
      {
        id: 'v2',
        hsCode: '7326.90.9000',
        attributes: { material: 'metal' },
        isDefault: false
      }
    ]
  },
  {
    id: 'p2',
    name: 'Toy car',
    companyId: 'company-1',
    variants: [
      {
        id: 'v3',
        hsCode: '9503.00.1000',
        attributes: { material: 'plastic', battery: 'no' },
        isDefault: true
      },
      {
        id: 'v4',
        hsCode: '9503.00.2000',
        attributes: { material: 'plastic', battery: 'yes' },
        isDefault: false
      }
    ]
  }
];

interface MaterialOption {
  value: string;
  label: string;
}

const materialOptions: MaterialOption[] = [
  { value: 'plastic', label: '플라스틱' },
  { value: 'metal', label: '금속' },
  { value: 'wood', label: '목재' },
  { value: 'paper', label: '종이' },
  { value: 'glass', label: '유리' },
  { value: 'ceramic', label: '세라믹' },
  { value: 'textile', label: '직물' },
  { value: 'leather', label: '가죽' },
  { value: 'rubber', label: '고무' },
  { value: 'other', label: '기타' }
];

export default function ProductManagement(): React.ReactElement {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [newVariantDialog, setNewVariantDialog] = useState<boolean>(false);
  const [newProduct, setNewProduct] = useState<{ name: string; companyId: string }>({
    name: '',
    companyId: 'company-1'
  });
  const [newVariant, setNewVariant] = useState<{
    hsCode: string;
    material: string;
    isDefault: boolean;
  }>({
    hsCode: '',
    material: '',
    isDefault: false
  });

  // 제품 검색
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 제품 추가 모달 열기
  const handleOpenAddDialog = (): void => {
    setEditMode(false);
    setCurrentProduct(null);
    setNewProduct({ name: '', companyId: 'company-1' });
    setOpenDialog(true);
  };

  // 제품 편집 모달 열기
  const handleOpenEditDialog = (product: Product): void => {
    setEditMode(true);
    setCurrentProduct(product);
    setNewProduct({ name: product.name, companyId: product.companyId });
    setOpenDialog(true);
  };

  // 모달 닫기
  const handleCloseDialog = (): void => {
    setOpenDialog(false);
    setNewVariantDialog(false);
  };

  // 제품 저장
  const handleSaveProduct = (): void => {
    if (editMode && currentProduct) {
      // 제품 업데이트
      setProducts(products.map(p => 
        p.id === currentProduct.id 
          ? { ...p, name: newProduct.name, companyId: newProduct.companyId } 
          : p
      ));
    } else {
      // 새 제품 추가
      const newId = `p${Date.now()}`;
      setProducts([
        ...products,
        {
          id: newId,
          name: newProduct.name,
          companyId: newProduct.companyId,
          variants: []
        }
      ]);
    }
    handleCloseDialog();
  };

  // 제품 삭제
  const handleDeleteProduct = (id: string): void => {
    if (window.confirm('이 제품을 삭제하시겠습니까?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  // 새 변형 추가 모달 열기
  const handleOpenNewVariantDialog = (product: Product): void => {
    setCurrentProduct(product);
    setNewVariant({
      hsCode: '',
      material: '',
      isDefault: product.variants.length === 0 // 첫 변형은 기본값으로 설정
    });
    setNewVariantDialog(true);
  };

  // 변형 저장
  const handleSaveVariant = (): void => {
    if (!currentProduct) return;

    const newVariantObj: ProductVariant = {
      id: `v${Date.now()}`,
      hsCode: newVariant.hsCode,
      attributes: {
        material: newVariant.material
      },
      isDefault: newVariant.isDefault
    };

    // 기본 변형이 변경되면 다른 변형들의 기본값을 해제
    let updatedVariants = [...currentProduct.variants];
    if (newVariant.isDefault) {
      updatedVariants = updatedVariants.map(v => ({
        ...v,
        isDefault: false
      }));
    }

    // 새 변형 추가
    updatedVariants.push(newVariantObj);

    // 변형이 하나만 있으면 자동으로 기본값으로 설정
    if (updatedVariants.length === 1) {
      updatedVariants[0].isDefault = true;
    }

    // 제품 업데이트
    setProducts(products.map(p => 
      p.id === currentProduct.id 
        ? { ...p, variants: updatedVariants } 
        : p
    ));

    handleCloseDialog();
  };

  // 변형 삭제
  const handleDeleteVariant = (productId: string, variantId: string): void => {
    if (window.confirm('이 변형을 삭제하시겠습니까?')) {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const updatedVariants = product.variants.filter(v => v.id !== variantId);
      
      // 삭제된 변형이 기본값이고 다른 변형이.있으면 첫 번째 변형을 기본값으로 설정
      if (product.variants.find(v => v.id === variantId)?.isDefault && updatedVariants.length > 0) {
        updatedVariants[0].isDefault = true;
      }

      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, variants: updatedVariants } 
          : p
      ));
    }
  };

  // 기본 변형 설정
  const handleSetDefaultVariant = (productId: string, variantId: string): void => {
    setProducts(products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          variants: p.variants.map(v => ({
            ...v,
            isDefault: v.id === variantId
          }))
        };
      }
      return p;
    }));
  };

  // 속성 옵션 변경 핸들러
  const handleMaterialChange = (event: SelectChangeEvent): void => {
    setNewVariant({
      ...newVariant,
      material: event.target.value
    });
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          제품 및 HS 코드 관리
        </Typography>
        
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <TextField
              label="제품명 검색"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: '40%' }}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenAddDialog}
            >
              새 제품 추가
            </Button>
          </Box>
          
          {filteredProducts.length === 0 ? (
            <Typography variant="body1" align="center" sx={{ my: 3 }}>
              검색 결과가 없습니다.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>제품명</TableCell>
                    <TableCell>HS 코드 변형</TableCell>
                    <TableCell width="150">관리</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell component="th" scope="row">
                        {product.name}
                      </TableCell>
                      <TableCell>
                        {product.variants.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            등록된 HS 코드 없음
                          </Typography>
                        ) : (
                          <Box>
                            {product.variants.map((variant) => (
                              <Box key={variant.id} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ mr: 1 }}>
                                  {variant.hsCode}
                                </Typography>
                                {Object.entries(variant.attributes).map(([key, value]) => (
                                  <Chip 
                                    key={key} 
                                    label={`${key}: ${value}`} 
                                    size="small" 
                                    sx={{ mr: 0.5 }} 
                                  />
                                ))}
                                {variant.isDefault && (
                                  <Chip 
                                    label="기본" 
                                    color="primary" 
                                    size="small"
                                    sx={{ ml: 0.5 }}
                                  />
                                )}
                                <IconButton
                                  size="small"
                                  aria-label="set-default"
                                  onClick={() => handleSetDefaultVariant(product.id, variant.id)}
                                  disabled={variant.isDefault}
                                  sx={{ ml: 0.5 }}
                                >
                                  {variant.isDefault ? null : <EditIcon fontSize="small" />}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label="delete"
                                  onClick={() => handleDeleteVariant(product.id, variant.id)}
                                  sx={{ ml: 0.5 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>
                        )}
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenNewVariantDialog(product)}
                          sx={{ mt: 1 }}
                        >
                          HS 코드 추가
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex' }}>
                          <IconButton
                            aria-label="edit"
                            onClick={() => handleOpenEditDialog(product)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            aria-label="delete"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* 제품 추가/편집 모달 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? '제품 정보 편집' : '새 제품 추가'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="제품명"
            type="text"
            fullWidth
            variant="outlined"
            value={newProduct.name}
            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel id="company-select-label">수입업체</InputLabel>
            <Select
              labelId="company-select-label"
              value={newProduct.companyId}
              onChange={(e) => setNewProduct({ ...newProduct, companyId: e.target.value })}
              label="수입업체"
            >
              <MenuItem value="company-1">A 수입업체</MenuItem>
              <MenuItem value="company-2">B 수입업체</MenuItem>
              <MenuItem value="company-3">C 수입업체</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button 
            onClick={handleSaveProduct} 
            variant="contained" 
            color="primary"
            disabled={!newProduct.name}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* HS 코드 변형 추가 모달 */}
      <Dialog open={newVariantDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          HS 코드 추가 - {currentProduct?.name}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="HS 코드"
            type="text"
            fullWidth
            variant="outlined"
            value={newVariant.hsCode}
            onChange={(e) => setNewVariant({ ...newVariant, hsCode: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
            <InputLabel id="material-select-label">재질</InputLabel>
            <Select
              labelId="material-select-label"
              value={newVariant.material}
              onChange={handleMaterialChange}
              label="재질"
            >
              {materialOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl fullWidth sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ mr: 2 }}>
                이 HS 코드를 기본값으로 설정:
              </Typography>
              <Select
                value={newVariant.isDefault.toString()}
                onChange={(e) => setNewVariant({ 
                  ...newVariant, 
                  isDefault: e.target.value === 'true' 
                })}
                size="small"
              >
                <MenuItem value="true">예</MenuItem>
                <MenuItem value="false">아니오</MenuItem>
              </Select>
            </Box>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button 
            onClick={handleSaveVariant} 
            variant="contained" 
            color="primary"
            disabled={!newVariant.hsCode || !newVariant.material}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
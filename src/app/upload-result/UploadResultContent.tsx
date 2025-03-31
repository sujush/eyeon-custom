// src/app/upload-result/UploadResultContent.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Typography, 
  Paper, 
  Box, 
  Button, 
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import { 
  getProcessResult, 
  updateCompanyInfo, 
  selectProductHsCodes, 
  ProcessFileResponse,
  UpdateCompanyRequest, 
  SelectProductHsCodesRequest 
} from '../../services/api';
import { CompanyProductsList } from './CompanyProductsList';

export default function UploadResultContent() {
  const searchParams = useSearchParams();
  const resultKey = searchParams.get('resultKey');
  
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ProcessFileResponse | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [processedCompanies, setProcessedCompanies] = useState<string[]>([]);
  
  useEffect(() => {
    if (resultKey) {
      loadResult(resultKey);
    }
  }, [resultKey]);
  
  const loadResult = async (key: string) => {
    try {
      setLoading(true);
      const data = await getProcessResult(key);
      setResult(data);
    } catch (error) {
      console.error('Error loading process result:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateCompany = async (data: UpdateCompanyRequest) => {
    try {
      setLoading(true);
      
      // 기존 회사인 경우 - HS 코드 선택
      const company = result?.pendingCompanies[activeTabIndex];
      
      if (company && !company.isNew && company.companyId) {
        const selectRequest: SelectProductHsCodesRequest = {
          companyId: company.companyId,
          products: data.products.map(p => ({
            productName: p.productName,
            selectedHsCode: p.hsCode
          }))
        };
        
        await selectProductHsCodes(selectRequest);
      } else {
        // 신규 회사인 경우 - 회사 정보 업데이트
        await updateCompanyInfo(data);
      }
      
      // 처리 완료된 회사 목록에 추가
      setProcessedCompanies([...processedCompanies, company?.companyNameEN || '']);
      
      // 다음 탭으로 이동 또는 모두 완료 처리
      if (activeTabIndex < (result?.pendingCompanies.length || 0) - 1) {
        setActiveTabIndex(activeTabIndex + 1);
      } else {
        // 모든 회사 처리 완료 - 결과 페이지 다시 로드
        if (resultKey) {
          loadResult(resultKey);
        }
      }
    } catch (error) {
      console.error('Error updating company info:', error);
      alert('업체 정보 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTabIndex(newValue);
  };
  
  const downloadResult = () => {
    if (result?.resultFileKey) {
      // S3 URL로 다운로드
      window.open(`/api/download?key=${encodeURIComponent(result.resultFileKey)}`, '_blank');
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>데이터를 불러오는 중입니다...</Typography>
      </Box>
    );
  }
  
  if (!result) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          처리 결과를 찾을 수 없습니다.
        </Typography>
        <Button variant="contained" href="/">
          홈으로 돌아가기
        </Button>
      </Paper>
    );
  }
  
  // 모든 회사가 처리되었는지 확인
  const allCompaniesProcessed = processedCompanies.length === result.pendingCompanies.length;
  
  return (
    <>
      {allCompaniesProcessed ? (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            모든 업체 정보가 처리되었습니다.
          </Typography>
          <Box sx={{ mt: 3 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={downloadResult}
              sx={{ mr: 2 }}
            >
              결과 파일 다운로드
            </Button>
            <Button variant="outlined" href="/">
              홈으로 돌아가기
            </Button>
          </Box>
        </Paper>
      ) : (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {result.pendingCompanies.length}개 업체의 정보를 확인해주세요.
            </Typography>
            <Typography variant="body1">
              신규 업체는 한글 업체명을 입력하고, 모든 제품에 HS 코드를 지정해주세요.
            </Typography>
          </Paper>
          
          {result.pendingCompanies.length > 1 && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs 
                value={activeTabIndex} 
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
              >
                {result.pendingCompanies.map((company) => (
                  <Tab 
                    key={company.companyNameEN} 
                    label={`${company.companyNameKR || company.companyNameEN} ${processedCompanies.includes(company.companyNameEN) ? '✓' : ''}`}
                    disabled={processedCompanies.includes(company.companyNameEN)}
                  />
                ))}
              </Tabs>
            </Box>
          )}
          
          {result.pendingCompanies.length > 0 && (
            <CompanyProductsList
              company={result.pendingCompanies[activeTabIndex]}
              onUpdateCompany={handleUpdateCompany}
            />
          )}
        </>
      )}
    </>
  );
}
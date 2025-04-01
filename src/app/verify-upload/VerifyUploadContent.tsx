// src/app/verify-upload/VerifyUploadContent.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Paper, 
  Box, 
  TextField,
  Button,
  CircularProgress,
  Alert,
  Typography // Typography 컴포넌트 추가
} from '@mui/material';
import { processFile } from '../../services/api';

export default function VerifyUploadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const fileKey = searchParams.get('fileKey');
  const templateId = searchParams.get('templateId');
  const carrierId = searchParams.get('carrierId');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [firstProductName, setFirstProductName] = useState('');
  
  useEffect(() => {
    const fetchExtractedData = async () => {
      try {
        setLoading(true);
        // API 호출로 엑셀 파일에서 추출한 기본 정보 가져오기
        const response = await fetch(`/api/excel/extract-preview?fileKey=${fileKey}&templateId=${templateId}&carrierId=${carrierId}`);
        
        if (!response.ok) {
          throw new Error('데이터 추출 중 오류가 발생했습니다.');
        }
        
        const data = await response.json();
        setCompanyName(data.companyName);
        setFirstProductName(data.firstProduct);
      } catch (error) {
        console.error('Error fetching extracted data:', error);
        setError('데이터 추출 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (fileKey && templateId && carrierId) {
      fetchExtractedData();
    } else {
      setError('필요한 파라미터가 누락되었습니다.');
      setLoading(false);
    }
  }, [fileKey, templateId, carrierId]);
  
  const handleConfirm = async () => {
    if (!fileKey || !templateId || !carrierId) {
      setError('필요한 정보가 누락되었습니다.');
      return;
    }
    
    try {
      setLoading(true);
      // API 호출로 확인된 정보로 처리 진행
      const result = await processFile({
        fileKey,
        templateId,
        carrierId,
        verifiedData: {
          companyName,
          firstProductName
        }
      });
      
      // 결과 페이지로 이동
      router.push(`/upload-result?resultKey=${result.resultFileKey}`);
    } catch (error) {
      console.error('Error processing file:', error);
      setError('파일 처리 중 오류가 발생했습니다.');
      setLoading(false);
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
  
  return (
    <Paper sx={{ p: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Typography variant="body1" gutterBottom>
        업로드하신 엑셀 파일에서 추출한 정보를 확인해주세요. 정보가 정확하지 않은 경우 수정할 수 있습니다.
      </Typography>
      
      <Box sx={{ mt: 3 }}>
        <TextField
          fullWidth
          label="업체명 (영문)"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          sx={{ mb: 2 }}
        />
        
        <TextField
          fullWidth
          label="첫 번째 제품명"
          value={firstProductName}
          onChange={(e) => setFirstProductName(e.target.value)}
          sx={{ mb: 3 }}
        />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            variant="outlined" 
            onClick={() => router.push('/')}
          >
            취소
          </Button>
          
          <Button 
            variant="contained" 
            onClick={handleConfirm}
            disabled={!companyName || !firstProductName}
          >
            확인 및 계속
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
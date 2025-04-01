// src/app/verify-upload/page.tsx
'use client';

import React, { Suspense } from 'react';
import { Container, Typography, CircularProgress } from '@mui/material';
import VerifyUploadContent from './VerifyUploadContent';

// 로딩 상태를 보여주는 컴포넌트
function LoadingFallback() {
  return (
    <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
      <CircularProgress />
      <Typography sx={{ mt: 2 }}>데이터를 불러오는 중입니다...</Typography>
    </Container>
  );
}

export default function VerifyUploadPage() {
  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        업로드 파일 확인
      </Typography>
      
      <Suspense fallback={<LoadingFallback />}>
        <VerifyUploadContent />
      </Suspense>
    </Container>
  );
}
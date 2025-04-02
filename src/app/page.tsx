//src/app/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Stack,
  Alert,
  SelectChangeEvent,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  getCarriers,
  getTemplatesByCarrier,
  uploadFile,
  CarrierResponse
} from '../services/api';


interface Carrier {
  carrierId: string;
  carrierName: string;
}

interface Template {
  templateId: string;
  templateName: string;
}

export default function HomePage() {
  const router = useRouter();

  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCarriers();
  }, []);

  // selectedCarrier 상태가 변경될 때 호출되는 useEffect
  useEffect(() => {
    if (selectedCarrier) {
      console.log("선택된 운송사에 대한 템플릿 로드:", selectedCarrier); // 선택된 carrierId 출력 (디버깅용)
      loadTemplates(selectedCarrier); // 선택된 carrierId로 템플릿 로드 함수 호출
    } else {
      setTemplates([]); // carrierId가 없으면 템플릿 초기화
      setSelectedTemplate(''); // 선택된 템플릿 상태도 초기화
    }
  }, [selectedCarrier]);

  const loadCarriers = async () => {
    try {
      const response = await getCarriers();
      console.log('API Response:', response); // 디버깅용 로그

      const mappedCarriers: Carrier[] = response.map((carrier: CarrierResponse) => ({
        carrierId: carrier.CarrierID,
        carrierName: carrier.CarrierName,
      }));

      console.log('Mapped Carriers:', mappedCarriers);
      setCarriers(mappedCarriers);
    } catch (error) {
      console.error('Error loading carriers:', error);
      setError('운송사 정보를 불러오는데 실패했습니다.');
    }
  };

  const loadTemplates = async (carrierId: string) => {
    try {
      const response = await getTemplatesByCarrier(carrierId);
      console.log('Templates API Response:', response);

      // 응답이 항상 배열이므로 바로 매핑
      const mappedTemplates: Template[] = response.map((template) => ({
        templateId: template.TemplateID,
        templateName: template.TemplateName,
      }));

      console.log('Mapped Templates:', mappedTemplates);
      setTemplates(mappedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error instanceof Error ? error.message : String(error));
      setTemplates([]);
      setError('양식 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleCarrierChange = (event: SelectChangeEvent<string>) => {
    const carrierId = event.target.value; // 선택된 운송사 ID 추출
    console.log("운송사 선택됨:", carrierId); // 선택된 carrierId를 콘솔에 출력 (디버깅용)
    setSelectedCarrier(carrierId); // 선택된 carrierId를 상태로 저장
  };

  const handleTemplateChange = (event: SelectChangeEvent<string>) => {
    setSelectedTemplate(event.target.value);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const fileList = Array.from(event.target.files);
      const excelFiles = fileList.filter(
        file => file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.type === 'application/vnd.ms-excel'
      );
      if (excelFiles.length !== fileList.length) {
        setError('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
      }
      setFiles(excelFiles);
    }
  };

  // 폼 제출 시 호출되는 핸들러
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); // 기본 폼 제출 이벤트 방지
    console.log("폼 제출 시 선택된 운송사:", selectedCarrier); // 폼 제출 시 현재 선택된 carrierId 출력 (디버깅용)

    // 필수 필드가 모두 입력되었는지 확인
    if (!selectedCarrier || !selectedTemplate || files.length === 0) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 파일 업로드 로직 (첫 번째 파일만 사용)
      const file = files[0];
      const uploadResult = await uploadFile(file);

      // 업로드 결과에 따라 검증 페이지로 이동 (쿼리 파라미터로 carrierId 포함)
      router.push(`/verify-upload?fileKey=${uploadResult.fileKey}&templateId=${selectedTemplate}&carrierId=${selectedCarrier}`);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };


  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        HS 코드 자동화 시스템
      </Typography>

      <Paper sx={{ p: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>운송사 선택</InputLabel>
              <Select
                value={selectedCarrier}
                onChange={handleCarrierChange}
                label="운송사 선택"
                disabled={uploading}
              >
                {carriers.map((carrier) => (
                  <MenuItem key={carrier.carrierId} value={carrier.carrierId}>
                    {carrier.carrierName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>양식 선택</InputLabel>
              <Select
                value={selectedTemplate}
                onChange={handleTemplateChange}
                label="양식 선택"
                disabled={uploading || !selectedCarrier}
              >
                {templates.map((template) => (
                  <MenuItem key={template.templateId} value={template.templateId}>
                    {template.templateName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <input
                type="file"
                id="file-upload"
                multiple
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={uploading || !selectedTemplate}
              />
              <label htmlFor="file-upload">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  disabled={uploading || !selectedTemplate}
                  fullWidth
                >
                  엑셀 파일 선택 {files.length > 0 && `(${files.length}개 선택됨)`}
                </Button>
              </label>

              {files.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">선택된 파일:</Typography>
                  <ul>
                    {files.map((file, index) => (
                      <li key={index}>
                        <Typography variant="body2">{file.name}</Typography>
                      </li>
                    ))}
                  </ul>
                </Box>
              )}
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={uploading || !selectedTemplate || files.length === 0}
              sx={{ mt: 2 }}
            >
              {uploading ? (
                <>
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                  처리 중... {uploadProgress > 0 && `(${uploadProgress}%)`}
                </>
              ) : (
                '파일 업로드 및 처리'
              )}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

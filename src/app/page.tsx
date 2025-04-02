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

  useEffect(() => {
    if (selectedCarrier) {
      loadTemplates(selectedCarrier);
    } else {
      setTemplates([]);
      setSelectedTemplate('');
    }
  }, [selectedCarrier]);

  const loadCarriers = async () => {
    try {
      const response = await getCarriers(); // 이제 response는 CarrierApiResponse[] 타입으로 추론될 수 있음
      const mappedCarriers: Carrier[] = response.map((carrier: CarrierApiResponse) => ({ // any 대신 CarrierApiResponse 사용
        carrierId: carrier.CarrierID,
        carrierName: carrier.CarrierName,
      }));
      setCarriers(mappedCarriers);
    } catch (error) {
      console.error('Error loading carriers:', error);
      setError('운송사 정보를 불러오는데 실패했습니다.');
    }
  };

  const loadTemplates = async (carrierId: string) => {
    try {
      const response = await getTemplatesByCarrier(carrierId);
      const mappedTemplates: Template[] = response.map((template) => ({
        templateId: template.TemplateID,
        templateName: template.TemplateName,
      }));
      setTemplates(mappedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      setError('양식 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleCarrierChange = (event: SelectChangeEvent<string>) => {
    setSelectedCarrier(event.target.value);
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedCarrier || !selectedTemplate || files.length === 0) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 파일 업로드 (첫 번째 파일만 검증)
      const file = files[0];
      const uploadResult = await uploadFile(file);

      // 검증 페이지로 이동
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

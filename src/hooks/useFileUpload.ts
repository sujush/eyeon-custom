import { useState } from 'react';
import { ApiService } from '../services/api';

interface UseFileUploadProps {
  carrierId: string;  // companyId 대신 carrierId 사용
  templateId: string;
}

interface FileStats {
  size: number;
  type: string;
}

interface UseFileUploadReturn {
  uploadFiles: (files: File[]) => Promise<{ resultUrls: string[]; stats: FileStats[] }>;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useFileUpload({ carrierId, templateId }: UseFileUploadProps): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // 여러 파일 업로드 및 처리
  const uploadFiles = async (files: File[]): Promise<{ resultUrls: string[]; stats: FileStats[] }> => {
    if (!carrierId || !templateId || files.length === 0) {
      setError('운송사, 템플릿을 선택하고 파일을 업로드해주세요.');
      throw new Error('운송사, 템플릿을 선택하고 파일을 업로드해주세요.');
    }

    try {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      const resultUrls: string[] = [];
      const statsArray: FileStats[] = [];
      
      // 각 파일마다 처리
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 1. 사전 서명된 URL 가져오기
        const fileName = `${Date.now()}-${file.name}`;
        const { url, fileKey } = await ApiService.getPresignedUrl(fileName, file.type);
        
        // 2. 파일 S3에 업로드 - url을 전달
        await ApiService.uploadFileToS3(url, file);
        
        // 3. 엑셀 처리 API 호출 - api.ts의 ProcessFileRequest에 맞게 매개변수 전달
        const result = await ApiService.processFile({
          fileKey,
          templateId,
          carrierId
        });
        
        // resultFileKey를 resultUrl로 사용
        resultUrls.push(`/api/download?key=${encodeURIComponent(result.resultFileKey)}`);
        
        // pendingCompanies에서 통계 정보 추출 (필요하다면 실제 데이터에 맞게 조정)
        const stats: FileStats = {
          size: file.size,
          type: file.type
        };
        statsArray.push(stats);
        
        // 진행률 업데이트
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      
      return { resultUrls, stats: statsArray };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.';
      setError(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFiles, isUploading, progress, error };
}
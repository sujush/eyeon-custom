import { useState } from 'react';
import { ApiService } from '../services/api'; // ApiService 경로 확인

interface UseFileUploadProps {
  carrierId: string;
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
    console.log('[DEBUG][useFileUpload] Starting uploadFiles function...'); // 함수 시작 로그

    if (!carrierId || !templateId || files.length === 0) {
      const errorMsg = '운송사, 템플릿을 선택하고 파일을 업로드해주세요.';
      console.error(`[ERROR][useFileUpload] Validation failed: ${errorMsg}`); // 유효성 검사 실패 로그
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);
    console.log(`[INFO][useFileUpload] Upload starting for ${files.length} file(s). Carrier: ${carrierId}, Template: ${templateId}`);

    const resultUrls: string[] = [];
    const statsArray: FileStats[] = [];

    try {
      // 각 파일마다 처리
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`[INFO][useFileUpload] Processing file ${i + 1}/${files.length}: ${file.name}`);

        let url: string | null = null;
        let fileKey: string | null = null;

        try {
          // 1. 사전 서명된 URL 가져오기
          const fileName = `${Date.now()}-${file.name}`; // 파일명 생성 시점 유의
          console.log(`[DEBUG][useFileUpload] Requesting presigned URL for fileName: ${fileName}, contentType: ${file.type}`);
          const presignedData = await ApiService.getPresignedUrl(fileName, file.type);
          url = presignedData.url;
          fileKey = presignedData.fileKey;
          console.log(`[DEBUG][useFileUpload] Received Presigned URL: ${url}`);
          console.log(`[DEBUG][useFileUpload] Received File Key: ${fileKey}`);

          if (!url || !fileKey) {
            throw new Error('Failed to get valid presigned URL or fileKey from backend.');
          }

          // 2. 파일 S3에 업로드 - url을 전달
          console.log(`[DEBUG][useFileUpload] Calling ApiService.uploadFileToS3 for file: ${file.name}`);
          await ApiService.uploadFileToS3(url, file); // 실제 업로드 시도
          // uploadFileToS3 내부에서 성공/실패 로그 기록됨
          console.log(`[INFO][useFileUpload] S3 upload potentially successful for: ${file.name} (Check ApiService logs)`);

          // 3. 엑셀 처리 API 호출 - api.ts의 ProcessFileRequest에 맞게 매개변수 전달
          console.log(`[DEBUG][useFileUpload] Calling ApiService.processFile with fileKey: ${fileKey}`);
          const result = await ApiService.processFile({
            fileKey,
            templateId,
            carrierId
          });
          console.log(`[DEBUG][useFileUpload] Received processFile result for ${fileKey}:`, result); // 결과 로그

          // resultFileKey를 resultUrl로 사용
          if (result && result.resultFileKey) {
              resultUrls.push(`/api/download?key=${encodeURIComponent(result.resultFileKey)}`);
          } else {
              console.warn(`[WARN][useFileUpload] No resultFileKey found in processFile response for ${fileKey}`);
              resultUrls.push(''); // 또는 오류 처리
          }

          // pendingCompanies에서 통계 정보 추출 (필요하다면 실제 데이터에 맞게 조정)
          const stats: FileStats = {
            size: file.size,
            type: file.type
          };
          statsArray.push(stats);

          // 진행률 업데이트
          const currentProgress = Math.round(((i + 1) / files.length) * 100);
          setProgress(currentProgress);
          console.log(`[INFO][useFileUpload] Progress: ${currentProgress}%`);

        } catch (loopError) {
            // 루프 내에서 발생한 특정 파일 처리 오류 로깅
            console.error(`[ERROR][useFileUpload] Failed processing file ${file.name}:`, loopError);
            // 전체 업로드를 중단할지, 아니면 계속 진행할지 결정 필요
            // 여기서는 에러 상태 설정 후 다시 throw하여 전체 중단
            const loopErrorMessage = loopError instanceof Error ? loopError.message : `Failed to process ${file.name}.`;
            setError(`파일 처리 중 오류: ${loopErrorMessage}`);
            throw loopError; // 전체 try-catch로 전달
        }
      } // end for loop

      console.log('[INFO][useFileUpload] All files processed.');
      return { resultUrls, stats: statsArray };

    } catch (error) { // 전체 업로드 프로세스 중 발생한 에러 (루프에서 throw된 에러 포함)
      console.error('[ERROR][useFileUpload] Upload process failed:', error);
      // setError는 이미 루프 내 catch 또는 여기서 설정될 수 있음
      if (!error) { // 에러 상태가 아직 설정 안됐으면 기본 메시지 설정
          const errorMessage = error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.';
          setError(errorMessage);
      }
      // 에러를 다시 throw하여 상위 컴포넌트 등에서 인지할 수 있도록 함
      throw error;
    } finally {
      console.log('[INFO][useFileUpload] Upload process finished. Setting isUploading to false.');
      setIsUploading(false);
    }
  };

  return { uploadFiles, isUploading, progress, error };
}
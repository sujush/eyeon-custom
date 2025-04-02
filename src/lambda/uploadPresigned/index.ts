// src/lambda/uploadPresigned/index.ts

// AWS Lambda와 API Gateway 타입을 임포트합니다.
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// AWS S3 SDK를 임포트합니다.
import { S3 } from 'aws-sdk';

// S3 클라이언트를 생성합니다.
const s3 = new S3();
// 환경 변수에서 UPLOAD_BUCKET 값을 가져옵니다. (CDK에서 Lambda 함수에 전달)
const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET || '';

/**
 * Lambda 핸들러 함수
 * 이 함수는 presigned URL을 생성하여 클라이언트에 반환합니다.
 * 클라이언트는 POST 요청으로 { fileName, contentType } JSON 데이터를 보내야 합니다.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // 전체 이벤트 객체를 로그에 출력하여 디버깅에 활용합니다.
  console.log("Received event:", JSON.stringify(event, null, 2));

  // 요청 본문을 JSON으로 파싱합니다.
  let requestBody;
  try {
    requestBody = JSON.parse(event.body || '{}');
  } catch (error) {
    console.error("Error parsing request body:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: '요청 본문에 올바른 JSON이 필요합니다.' }),
    };
  }

  // fileName과 contentType을 요청 본문에서 추출합니다.
  const { fileName, contentType } = requestBody;

  // fileName과 contentType이 모두 제공되었는지 검증합니다.
  if (!fileName || !contentType) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'fileName 및 contentType 값이 필요합니다.' }),
    };
  }

  try {
    // S3에 업로드될 파일의 Key를 설정합니다.
    const fileKey = `uploads/${fileName}`;

    // presigned URL 생성을 위한 파라미터를 설정합니다.
    const params = {
      Bucket: UPLOAD_BUCKET,
      Key: fileKey,
      Expires: 60, // URL 유효 기간 (초), 필요에 따라 조정하세요.
      ContentType: contentType,
    };

    // S3의 putObject 작업에 대한 presigned URL을 생성합니다.
    const url = await s3.getSignedUrlPromise('putObject', params);

    // 성공적으로 URL이 생성되면, URL과 fileKey를 클라이언트에 반환합니다.
    return {
      statusCode: 200,
      body: JSON.stringify({ url, fileKey }),
    };
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'presigned URL 생성 중 오류가 발생했습니다.',
        error: (error as Error).message,
      }),
    };
  }
}

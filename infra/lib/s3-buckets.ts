// infra/lib/s3-buckets.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class S3BucketStack extends cdk.Stack {
  public readonly uploadBucket: s3.Bucket;
  public readonly resultBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 업로드된 원본 파일을 저장할 버킷
    this.uploadBucket = new s3.Bucket(this, 'UploadBucket', {
      // bucketName 속성 제거 - AWS에서 자동 생성
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30), // 30일 후 자동 삭제
          id: 'CleanupUploads',
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // 실제 배포 시 제한 필요
          allowedHeaders: ['*'],
        },
      ],
    });

    // 처리 결과 파일을 저장할 버킷
    this.resultBucket = new s3.Bucket(this, 'ResultBucket', {
      // bucketName 속성 제거 - AWS에서 자동 생성
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90), // 90일 후 자동 삭제
          id: 'CleanupResults',
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'], // 실제 배포 시 제한 필요
          allowedHeaders: ['*'],
        },
      ],
    });
  }
}
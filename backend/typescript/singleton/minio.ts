import { Client } from 'minio';

/**
 * Classe singleton per la gestione della connessione a MinIO.
 * Garantisce un'unica istanza del client MinIO e la creazione dei bucket necessari.
 */
class MinioStorage {
  private static instance: Client;
  static readonly DOCUMENTS_BUCKET = process.env.MINIO_DOCUMENTS_BUCKET || 'compliance-documents';
  static readonly REPORTS_BUCKET   = process.env.MINIO_REPORTS_BUCKET   || 'compliance-reports';

  static getInstance(): Client {
    if (!MinioStorage.instance) {
      MinioStorage.instance = new Client({
        endPoint:  process.env.MINIO_ENDPOINT  || 'minio',
        port:      Number(process.env.MINIO_PORT) || 9000,
        useSSL:    false,
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
      });
    }
    return MinioStorage.instance;
  }

  static async ensureBuckets(): Promise<void> {
    const client = MinioStorage.getInstance();
    for (const bucket of [MinioStorage.DOCUMENTS_BUCKET, MinioStorage.REPORTS_BUCKET]) {
      if (!(await client.bucketExists(bucket))) {
        await client.makeBucket(bucket);
      }
    }
  }
}

export default MinioStorage;
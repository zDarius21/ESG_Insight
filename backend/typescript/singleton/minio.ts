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

  /**
   * Legge un oggetto da un bucket e ne restituisce l'intero contenuto in memoria.
   * @param bucket Il bucket che contiene l'oggetto
   * @param key La chiave dell'oggetto
   * @returns Il contenuto dell'oggetto come Buffer
   */
  static async getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
    const stream = await MinioStorage.getInstance().getObject(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

export default MinioStorage;
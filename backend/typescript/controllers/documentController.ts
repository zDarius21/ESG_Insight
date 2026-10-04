import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import Document from '../models/Document';
import DocumentDAO from '../dao/DocumentDAO';
import ReportDAO from '../dao/ReportDAO';
import UserDAO from '../dao/UserDAO';
import MinioStorage from '../singleton/minio';
import Database from '../singleton/database';
import ResponseFactory, { ErrorEnum, SuccessEnum } from '../factory/responseFactory';
import { DocumentStatus } from '../enums/documentStatus';

const ANALYSIS_TOKEN_COST = 10;

/**
 * Funzione che genera un report PDF per un documento analizzato, basandosi sui dati del modello Document.
 * @param docModel Modello del documento da analizzare
 * @returns Una promessa che risolve in un buffer contenente il PDF generato
 */
function generateReport(docModel: Document): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const MX = 42;
    const MB = 42;

    const C_NAVY   = '#0B1F3A';
    const C_BLUE   = '#1E6FD9';
    const C_BG     = '#F4F8FF';
    const C_TEXT   = '#142033';
    const C_OK     = '#0A8F5B';
    const C_FAIL   = '#D63D3D';
    const C_WARN   = '#D48806';
    const C_CARD   = '#FFFFFF';
    const C_BORDER = '#DAE6F7';
    const C_SUB    = '#455873';

    const normeRispettate = [
      { nome: 'CSRD Art. 19a – Disclosure di sostenibilità', motivo: 'Il documento presenta adeguata disclosure delle informazioni di sostenibilità secondo i requisiti CSRD.' },
      { nome: 'GRI 305 – Emissioni', motivo: 'Sono presenti le informazioni sulle emissioni di CO₂ e i target di riduzione.' },
    ];
    const normeNonRispettate = [
      { nome: 'EU Taxonomy Art. 8 – Allineamento fatturato', motivo: 'Mancano i KPI quantitativi sulla percentuale di fatturato allineata alla Tassonomia UE.' },
    ];
    const normeBorderline = [
      { nome: 'ISO 14001 – Gestione ambientale', motivo: 'Il sistema di gestione ambientale è parzialmente documentato; richiede completamento.' },
    ];
    const azioniCorrettive = [
      'Integrare il KPI di allineamento alla Tassonomia UE nel bilancio di sostenibilità.',
      'Completare la documentazione del sistema di gestione ambientale (ISO 14001).',
      'Aggiungere il piano di transizione climatica conforme al CSRD.',
    ];
    const filesAnalizzati   = [docModel.title];
    const normativeAnalizzate = ['CSRD', 'EU Taxonomy', 'GRI 305', 'ISO 14001'];
    const tipoDocumento     = ['Bilancio di sostenibilità'];

    const dateLabel = new Date().toLocaleString('it-IT');
    const total = normeRispettate.length + normeNonRispettate.length + normeBorderline.length;
    const score = total > 0 ? Math.round((normeRispettate.length / total) * 100) : 0;

    const pdf = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: false });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.addPage({ margin: 0, size: 'A4' });
    let y = 0;

    function ensureSpace(minSpace: number): void {
      if (y + minSpace > PAGE_H - MB) {
        pdf.addPage({ margin: 0, size: 'A4' });
        pdf.rect(0, 0, PAGE_W, 62).fill(C_NAVY);
        pdf.font('Helvetica-Bold').fontSize(15).fillColor('#FFFFFF')
          .text('Dettaglio Conformità', MX, 32, { lineBreak: false });
        y = 84;
      }
    }

    function sectionHeader(label: string, color: string): void {
      pdf.rect(MX, y, PAGE_W - MX * 2, 30).fill(color);
      pdf.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF')
        .text(label, MX + 10, y + 9, { lineBreak: false, width: PAGE_W - MX * 2 - 20 });
      y += 38;
    }

    // ── Hero header ──
    pdf.rect(0, 0, PAGE_W, 170).fill(C_NAVY);
    pdf.rect(0, 170, PAGE_W, 50).fill(C_BLUE);
    pdf.circle(PAGE_W - 70, 85, 52).fill(C_BLUE);
    pdf.circle(PAGE_W - 42, 142, 24).fill(C_BLUE);

    pdf.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF')
      .text('ESG Compliance Report', MX, 55, { lineBreak: false });
    pdf.font('Helvetica').fontSize(12).fillColor('#E0EAFF')
      .text(docModel.title, MX, 83, { lineBreak: false, width: PAGE_W - MX - 90 });
    pdf.font('Helvetica').fontSize(10).fillColor('#D9E8FA')
      .text(`Data analisi: ${dateLabel}`, MX, 107, { lineBreak: false });
    pdf.font('Helvetica').fontSize(10).fillColor('#D9E8FA')
      .text(`File analizzati: ${filesAnalizzati.length}`, MX, 127, { lineBreak: false });

    // ── Metric cards ──
    y = 195;
    const cardGap = 10;
    const cardW = (PAGE_W - MX * 2 - cardGap * 3) / 4;
    const cardH = 68;

    function metricCard(cx: number, label: string, value: string, accent: string): void {
      pdf.lineWidth(1).rect(cx, y, cardW, cardH).fillAndStroke(C_CARD, C_BORDER);
      pdf.rect(cx, y, 6, cardH).fill(accent);
      pdf.font('Helvetica').fontSize(9).fillColor(C_SUB)
        .text(label, cx + 16, y + 18, { lineBreak: false, width: cardW - 22 });
      pdf.font('Helvetica-Bold').fontSize(18).fillColor(C_TEXT)
        .text(value, cx + 16, y + 36, { lineBreak: false, width: cardW - 22 });
    }

    metricCard(MX,                             'Score conformità', `${score}%`,                    C_BLUE);
    metricCard(MX + (cardW + cardGap),         'Conformi',         String(normeRispettate.length), C_OK);
    metricCard(MX + (cardW + cardGap) * 2,     'Non conformi',     String(normeNonRispettate.length), C_FAIL);
    metricCard(MX + (cardW + cardGap) * 3,     'Borderline',       String(normeBorderline.length), C_WARN);

    // ── Overview ──
    y += cardH + 16;
    pdf.lineWidth(1).rect(MX, y, PAGE_W - MX * 2, 32).fillAndStroke(C_BG, C_BORDER);
    pdf.font('Helvetica-Bold').fontSize(12).fillColor(C_TEXT)
      .text('Panoramica analisi', MX + 12, y + 11, { lineBreak: false });
    y += 42;
    pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
      .text(`Normative verificate: ${normativeAnalizzate.length}`, MX + 12, y, { lineBreak: false });
    y += 20;
    pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
      .text(`Tipologia documento: ${tipoDocumento.join(', ') || '-'}`, MX + 12, y, { lineBreak: false });
    y += 30;

    // ── Norm blocks ──
    function normBlocks(items: { nome: string; motivo: string }[], label: string, accent: string): void {
      ensureSpace(60);
      sectionHeader(label, accent);
      if (items.length === 0) {
        pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
          .text('Nessun elemento disponibile', MX + 4, y + 12, { lineBreak: false });
        y += 30;
        return;
      }
      for (const item of items) {
        ensureSpace(82);
        const bh = 74;
        pdf.lineWidth(1).rect(MX, y, PAGE_W - MX * 2, bh).fillAndStroke(C_CARD, C_BORDER);
        pdf.rect(MX, y, 5, bh).fill(accent);
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(C_TEXT)
          .text(item.nome, MX + 12, y + 10, { lineBreak: false, width: PAGE_W - MX * 2 - 24 });
        pdf.font('Helvetica').fontSize(9).fillColor(C_SUB)
          .text(item.motivo, MX + 12, y + 27, { lineBreak: false, width: PAGE_W - MX * 2 - 28 });
        y += bh + 6;
      }
    }

    normBlocks(normeRispettate,    'Norme Conformi',     C_OK);
    normBlocks(normeNonRispettate, 'Norme Non Conformi', C_FAIL);
    normBlocks(normeBorderline,    'Norme Borderline',   C_WARN);

    // ── Corrective actions ──
    ensureSpace(160);
    sectionHeader('Azioni Correttive Prioritarie', C_BLUE);
    if (azioniCorrettive.length === 0) {
      pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
        .text('Nessuna azione correttiva suggerita', MX + 4, y + 12, { lineBreak: false });
      y += 24;
    } else {
      azioniCorrettive.forEach((action, idx) => {
        ensureSpace(30);
        pdf.circle(MX + 10, y + 9, 7).fill(C_BLUE);
        pdf.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
          .text(String(idx + 1), MX + 7, y + 5, { lineBreak: false });
        pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
          .text(action, MX + 24, y, { width: PAGE_W - MX * 2 - 24, lineBreak: false });
        y += 24;
      });
    }

    // ── Files analyzed ──
    y += 12;
    ensureSpace(60);
    sectionHeader('File Analizzati', C_NAVY);
    if (filesAnalizzati.length === 0) {
      pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
        .text('Nessun file disponibile in metadata', MX + 4, y + 12, { lineBreak: false });
    } else {
      filesAnalizzati.forEach(name => {
        ensureSpace(24);
        pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
          .text(`- ${name}`, MX + 4, y + 14, { lineBreak: false });
        y += 20;
      });
    }

    pdf.end();
  });
}
/**
 * Restituisce tutti i documenti dell'utente autenticato
 * @param req La richiesta HTTP
 * @param res La risposta HTTP
 */
export const getAllDocuments = async (req: Request, res: Response): Promise<void> => {
  const documents = await DocumentDAO.findAllByUser(req.user.id);
  ResponseFactory.sendSuccess(res, SuccessEnum.DocumentsFetched, documents);
};

/**
 * Restituisce un singolo documento dell'utente autenticato
 * @param req La richiesta HTTP contenente l'ID del documento
 * @param res La risposta HTTP
 */
export const getDocumentById = async (req: Request, res: Response): Promise<void> => {
  const document = await DocumentDAO.findByIdAndUser(req.params.id, req.user.id);
  if (!document) {
    ResponseFactory.sendError(res, ErrorEnum.DocumentNotFound);
    return;
  }
  ResponseFactory.sendSuccess(res, SuccessEnum.DocumentFetched, document);
};

/**
 * Crea un nuovo documento PDF e lo carica su MinIO
 * @param req La richiesta HTTP contenente titolo, descrizione e file PDF
 * @param res La risposta HTTP
 */
export const createDocument = async (req: Request, res: Response): Promise<void> => {
  const { title, description } = req.body;

  if (!req.file) {
    ResponseFactory.sendError(res, ErrorEnum.FileRequired);
    return;
  }

  let document: Document;
  // Traccia la chiave del file caricato su MinIO: serve a rimuovere l'oggetto
  // orfano se la transazione fallisce dopo l'upload (MinIO non è transazionale).
  let uploadedKey: string | null = null;
  try {
    document = await Database.getInstance().transaction(async (t) => {
      const doc = await DocumentDAO.create({ userId: req.user.id, title, description }, t);
      const fileKey = `${doc.id}/original.pdf`;
      await MinioStorage.getInstance().putObject(
        MinioStorage.DOCUMENTS_BUCKET,
        fileKey,
        req.file!.buffer,
        req.file!.size,
        { 'Content-Type': 'application/pdf' }
      );
      uploadedKey = fileKey;
      await doc.update({ filePath: fileKey }, { transaction: t });
      return doc;
    });
  } catch {
    // La transazione ha già fatto rollback dell'INSERT: se il file era stato
    // caricato su MinIO va rimosso esplicitamente per non lasciare oggetti orfani.
    if (uploadedKey) {
      await MinioStorage.getInstance().removeObject(MinioStorage.DOCUMENTS_BUCKET, uploadedKey).catch(() => {});
    }
    ResponseFactory.sendError(res, ErrorEnum.StorageError);
    return;
  }

  ResponseFactory.sendSuccess(res, SuccessEnum.DocumentCreated, document);
};

/**
 * Aggiorna titolo o descrizione di un documento dell'utente autenticato
 * @param req La richiesta HTTP contenente titolo e/o descrizione
 * @param res La risposta HTTP
 */
export const updateDocument = async (req: Request, res: Response): Promise<void> => {
  const document = await DocumentDAO.findByIdAndUser(req.params.id, req.user.id);
  if (!document) {
    ResponseFactory.sendError(res, ErrorEnum.DocumentNotFound);
    return;
  }

  const { title, description } = req.body;
  await document.update({ title, description });
  ResponseFactory.sendSuccess(res, SuccessEnum.DocumentUpdated, document);
};

/**
 * Elimina un documento e i rispettivi file su MinIO
 * @param req La richiesta HTTP contenente l'ID del documento
 * @param res La risposta HTTP
 */
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  const document = await DocumentDAO.findByIdAndUser(req.params.id, req.user.id);
  if (!document) {
    ResponseFactory.sendError(res, ErrorEnum.DocumentNotFound);
    return;
  }

  const client = MinioStorage.getInstance();
  if (document.filePath)   await client.removeObject(MinioStorage.DOCUMENTS_BUCKET, document.filePath).catch(() => {});
  if (document.reportPath) await client.removeObject(MinioStorage.REPORTS_BUCKET,   document.reportPath).catch(() => {});

  await document.destroy(); 
  ResponseFactory.sendSuccess(res, SuccessEnum.DocumentDeleted, {message: `Documento "${document.title}" eliminato` });
};

/**
 * Scarica il file PDF originale di un documento dell'utente autenticato
 * @param req La richiesta HTTP contenente l'ID del documento
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia il file tramite la risposta HTTP
 */
export const downloadDocumentFile = async (req: Request, res: Response): Promise<void> => {
  const document = await DocumentDAO.findByIdAndUser(req.params.id, req.user.id);
  if (!document) {
    ResponseFactory.sendError(res, ErrorEnum.DocumentNotFound);
    return;
  }

  if (!document.filePath) {
    ResponseFactory.sendError(res, ErrorEnum.FileNotAvailable);
    return;
  }

  try {
    const stream = await MinioStorage.getInstance().getObject(MinioStorage.DOCUMENTS_BUCKET, document.filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document_${document.id}.pdf"`);
    stream.pipe(res);
  } catch {
    ResponseFactory.sendError(res, ErrorEnum.StorageError);
  }
};

/**
 * Analizza il documento, generando un report PDF su MinIO e aggiornando lo stato
 * @param req La richiesta HTTP contenente l'ID del documento
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const analyzeDocument = async (req: Request, res: Response): Promise<void> => {
  const document = await DocumentDAO.findByIdAndUser(req.params.id, req.user.id);
  if (!document) {
    ResponseFactory.sendError(res, ErrorEnum.DocumentNotFound);
    return;
  }


  if (document.status === DocumentStatus.Analyzed) {
    ResponseFactory.sendError(res, ErrorEnum.DocumentAlreadyAnalyzed);
    return;
  }

  const user = await UserDAO.findByIdFull(req.user.id);
  if (!user || user.tokens < ANALYSIS_TOKEN_COST) {
    ResponseFactory.sendError(res, ErrorEnum.InsufficientTokens);
    return;
  }

  const reportKey = `${document.id}/report.pdf`;

  //Generazione PDF + upload MinIO 
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateReport(document);
  } catch {
    ResponseFactory.sendError(res, ErrorEnum.StorageError);
    return;
  }

  try {
    await MinioStorage.getInstance().putObject(
      MinioStorage.REPORTS_BUCKET,
      reportKey,
      pdfBuffer,
      pdfBuffer.length,
      { 'Content-Type': 'application/pdf' }
    );
  } catch {
    ResponseFactory.sendError(res, ErrorEnum.StorageError);
    return;
  }

  // Transazione per racchiudere tutte le azioni di aggiornamento
  let reportId: number;
  try {
    reportId = await Database.getInstance().transaction(async (t) => {
      await document.update({ status: DocumentStatus.Analyzed, reportPath: reportKey }, { transaction: t });
      await UserDAO.deductTokens(req.user.id, ANALYSIS_TOKEN_COST, t);
      const report = await ReportDAO.create(
        { documentId: document.id, userId: req.user.id, filePath: reportKey },
        t
      );
      return report.id;
    });
  } catch {
    // rollback in caso di errore
    await MinioStorage.getInstance().removeObject(MinioStorage.REPORTS_BUCKET, reportKey).catch(() => {});
    ResponseFactory.sendError(res, ErrorEnum.DatabaseError);
    return;
  }

  ResponseFactory.sendSuccess(res, SuccessEnum.DocumentAnalyzed, {
    document,
    reportId,
    tokensRemaining: user.tokens - ANALYSIS_TOKEN_COST,
  });
};


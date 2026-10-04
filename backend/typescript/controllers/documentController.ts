import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import Document from '../models/Document';
import DocumentDAO from '../dao/DocumentDAO';
import ReportDAO from '../dao/ReportDAO';
import UserDAO from '../dao/UserDAO';
import MinioStorage from '../singleton/minio';
import Database from '../singleton/database';
import AiEngine, { AnalysisResult, NormResult } from '../singleton/aiEngine';
import ResponseFactory, { ErrorEnum, SuccessEnum } from '../factory/responseFactory';
import { DocumentStatus } from '../enums/documentStatus';

const ANALYSIS_TOKEN_COST = 10;

// Documenti con un'analisi in corso: l'analisi AI può durare alcuni minuti, quindi si evita che
// richieste ripetute sullo stesso documento avviino analisi parallele (e un doppio addebito di token).
const analysesInProgress = new Set<number>();

// I font standard di PDFKit (Helvetica) supportano solo la codifica WinAnsi: i caratteri fuori set
// che possono comparire nei testi generati dal motore AI vengono sostituiti con equivalenti leggibili.
const PDF_CHAR_REPLACEMENTS: Record<string, string> = {
  '≥': '>=', '≤': '<=', '→': '->', '←': '<-', '−': '-', '₂': '2', '₃': '3', '✓': 'v', '✔': 'v', '✗': 'x',
};
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

function pdfText(value: string): string {
  return Array.from(value)
    .map((ch) => ((ch.codePointAt(0) ?? 0) <= 0xff || WIN_ANSI_EXTRA.includes(ch) ? ch : PDF_CHAR_REPLACEMENTS[ch] ?? ''))
    .join('');
}

/**
 * Funzione che genera il report PDF di un documento analizzato a partire dai risultati del motore AI.
 * @param docModel Modello del documento analizzato
 * @param analysis Risultato dell'analisi di conformità restituito dal motore AI
 * @returns Una promessa che risolve in un buffer contenente il PDF generato
 */
export function generateReport(docModel: Document, analysis: AnalysisResult): Promise<Buffer> {
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

    const normeRispettate     = analysis.norme_rispettate;
    const normeNonRispettate  = analysis.norme_non_rispettate;
    const normeBorderline     = analysis.norme_borderline;
    const azioniCorrettive    = analysis.azioni_correttive;
    const filesAnalizzati     = [docModel.title];
    const normativeAnalizzate = analysis.normative_analizzate;
    const tipoDocumento       = analysis.tipo_documento;

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
      .text(pdfText(docModel.title), MX, 83, { width: PAGE_W - MX - 140, height: 16, ellipsis: true });
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
      .text(pdfText(`Tipologia documento: ${tipoDocumento.join(', ') || '-'}`), MX + 12, y,
        { width: PAGE_W - MX * 2 - 24, height: 14, ellipsis: true });
    y += 30;

    // ── Norm blocks ──
    // L'altezza di ogni blocco dipende dal testo: le motivazioni del motore AI hanno lunghezza variabile
    const blockTextW = PAGE_W - MX * 2 - 24;
    function normBlocks(items: NormResult[], label: string, accent: string): void {
      ensureSpace(60);
      sectionHeader(label, accent);
      if (items.length === 0) {
        pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
          .text('Nessun elemento disponibile', MX + 4, y + 12, { lineBreak: false });
        y += 30;
        return;
      }
      for (const item of items) {
        const nome = pdfText(item.norma);
        const motivo = pdfText(item.motivo || 'Nessuna motivazione disponibile');
        const titleH = pdf.font('Helvetica-Bold').fontSize(10).heightOfString(nome, { width: blockTextW });
        const reasonH = pdf.font('Helvetica').fontSize(9).heightOfString(motivo, { width: blockTextW });
        const bh = Math.max(50, titleH + reasonH + 26);
        ensureSpace(bh + 8);
        pdf.lineWidth(1).rect(MX, y, PAGE_W - MX * 2, bh).fillAndStroke(C_CARD, C_BORDER);
        pdf.rect(MX, y, 5, bh).fill(accent);
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(C_TEXT)
          .text(nome, MX + 12, y + 10, { width: blockTextW });
        pdf.font('Helvetica').fontSize(9).fillColor(C_SUB)
          .text(motivo, MX + 12, y + 16 + titleH, { width: blockTextW });
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
        const text = pdfText(action);
        const textH = pdf.font('Helvetica').fontSize(10).heightOfString(text, { width: blockTextW });
        ensureSpace(textH + 14);
        pdf.circle(MX + 10, y + 7, 7).fill(C_BLUE);
        pdf.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
          .text(String(idx + 1), MX + 3, y + 3, { width: 14, align: 'center', lineBreak: false });
        pdf.font('Helvetica').fontSize(10).fillColor(C_TEXT)
          .text(text, MX + 24, y, { width: blockTextW });
        y += Math.max(textH, 16) + 8;
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
          .text(pdfText(`- ${name}`), MX + 4, y + 14, { width: blockTextW, height: 14, ellipsis: true });
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
 * Scarica il report PDF generato dall'analisi di un documento dell'utente autenticato
 * @param req La richiesta HTTP contenente l'ID del documento
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia il file tramite la risposta HTTP
 */
export const downloadDocumentReport = async (req: Request, res: Response): Promise<void> => {
  const document = await DocumentDAO.findByIdAndUser(req.params.id, req.user.id);
  if (!document) {
    ResponseFactory.sendError(res, ErrorEnum.DocumentNotFound);
    return;
  }

  if (!document.reportPath) {
    const error = document.status === DocumentStatus.Analyzed ? ErrorEnum.ReportNotFound : ErrorEnum.ReportNotReady;
    ResponseFactory.sendError(res, error);
    return;
  }

  try {
    const stream = await MinioStorage.getInstance().getObject(MinioStorage.REPORTS_BUCKET, document.reportPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report_documento_${document.id}.pdf"`);
    stream.pipe(res);
  } catch {
    ResponseFactory.sendError(res, ErrorEnum.StorageError);
  }
};

/**
 * Restituisce l'anteprima dell'anonimizzazione di un PDF senza salvarlo né addebitare token:
 * permette all'utente di verificare quali dati sensibili verranno mascherati prima dell'analisi.
 * @param req La richiesta HTTP contenente il file PDF
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const previewAnonymization = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    ResponseFactory.sendError(res, ErrorEnum.FileRequired);
    return;
  }

  const preview = await AiEngine.getInstance().anonymizePreview(req.file.buffer, req.file.originalname);
  ResponseFactory.sendSuccess(res, SuccessEnum.AnonymizationPreviewed, preview);
};

/**
 * Analizza il documento tramite il motore AI, salva il risultato, genera il report PDF su MinIO e aggiorna lo stato
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

  // L'analisi lavora sul PDF originale: senza file su MinIO non c'è nulla da analizzare
  if (!document.filePath) {
    ResponseFactory.sendError(res, ErrorEnum.FileNotAvailable);
    return;
  }

  const user = await UserDAO.findByIdFull(req.user.id);
  if (!user || user.tokens < ANALYSIS_TOKEN_COST) {
    ResponseFactory.sendError(res, ErrorEnum.InsufficientTokens);
    return;
  }

  if (analysesInProgress.has(document.id)) {
    ResponseFactory.sendError(res, ErrorEnum.AnalysisInProgress);
    return;
  }
  analysesInProgress.add(document.id);

  try {
    let originalPdf: Buffer;
    try {
      originalPdf = await MinioStorage.getObjectBuffer(MinioStorage.DOCUMENTS_BUCKET, document.filePath);
    } catch {
      ResponseFactory.sendError(res, ErrorEnum.StorageError);
      return;
    }

    // Analisi di conformità delegata al motore AI. Il file viene inviato con un nome neutro, così il titolo
    // (che può contenere dati identificativi) non finisce nel testo analizzato. Gli errori (AppError)
    // sono gestiti dall'error handler centralizzato e nessun token viene addebitato.
    const analysis = await AiEngine.getInstance().analyze(originalPdf, `documento_${document.id}.pdf`);

    const reportKey = `${document.id}/report.pdf`;

    //Generazione PDF + upload MinIO
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateReport(document, analysis);
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
        await document.update(
          { status: DocumentStatus.Analyzed, reportPath: reportKey, analysisResult: analysis },
          { transaction: t }
        );
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
  } finally {
    analysesInProgress.delete(document.id);
  }
};


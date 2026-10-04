import { AppError, ErrorEnum } from '../factory/error';

// Tempo massimo di attesa per una risposta del motore AI (l'analisi semantica con LLM locale può richiedere minuti)
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Esito della verifica di una singola norma.
 */
export interface NormResult {
  norma: string;
  motivo: string;
}

/**
 * Risultato dell'analisi di conformità ESG prodotto dal motore AI e salvato sul documento.
 * Le chiavi ricalcano il formato del servizio Django (ai-engine), così il frontend può
 * mostrarle senza ulteriori trasformazioni.
 */
export interface AnalysisResult {
  tipo_documento: string[];
  normative_analizzate: string[];
  norme_rispettate: NormResult[];
  norme_non_rispettate: NormResult[];
  norme_borderline: NormResult[];
  azioni_correttive: string[];
  data_analisi: string;
}

/**
 * Anteprima dell'anonimizzazione di un PDF: conteggio delle entità mascherate per categoria
 * ed estratto del testo così come verrà elaborato dal modello.
 */
export interface AnonymizationPreview {
  file_name: string;
  original_characters: number;
  anonymized_characters: number;
  placeholder_counts: Record<string, number>;
  preview_text: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

const toStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(toText).filter(Boolean) : [];

const toNormList = (value: unknown): NormResult[] =>
  Array.isArray(value)
    ? value
        .map((item): Record<string, unknown> => (isRecord(item) ? item : { norma: item }))
        .map((item) => ({ norma: toText(item.norma), motivo: toText(item.motivo) }))
        .filter((item) => item.norma)
    : [];

// Il motore AI accetta solo file con estensione .pdf
const withPdfExtension = (fileName: string): string => (/\.pdf$/i.test(fileName) ? fileName : `${fileName}.pdf`);

/**
 * Pattern Singleton che incapsula le chiamate HTTP verso il motore di analisi AI (servizio Django in ai-engine/).
 * Il backend resta l'unico punto di accesso per il frontend: il motore AI non è esposto pubblicamente
 * e riceve solo richieste già autenticate e validate.
 */
class AiEngine {
  private static instance: AiEngine;

  private constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  /**
   * Crea o restituisce l'istanza singleton, configurata tramite AI_ENGINE_URL e AI_ENGINE_TIMEOUT_MS.
   * @returns L'istanza singleton del client verso il motore AI.
   */
  static getInstance(): AiEngine {
    if (!AiEngine.instance) {
      const url = process.env.AI_ENGINE_URL || 'http://localhost:8000';
      AiEngine.instance = new AiEngine(
        url.endsWith('/') ? url.slice(0, -1) : url,
        Number(process.env.AI_ENGINE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
      );
    }
    return AiEngine.instance;
  }

  /**
   * Esegue l'analisi di conformità ESG di un PDF: estrazione del testo, anonimizzazione,
   * recupero semantico delle normative e valutazione (LLM locale con fallback a regole).
   * @param pdf Il contenuto del PDF da analizzare
   * @param fileName Il nome con cui il file viene inviato al motore AI
   * @returns Il risultato dell'analisi, normalizzato
   */
  async analyze(pdf: Buffer, fileName: string): Promise<AnalysisResult> {
    const payload = await this.postPdf('/api/analyze/', pdf, fileName);
    return {
      tipo_documento: toStringList(payload.tipo_documento),
      normative_analizzate: toStringList(payload.normative_analizzate),
      norme_rispettate: toNormList(payload.norme_rispettate),
      norme_non_rispettate: toNormList(payload.norme_non_rispettate),
      norme_borderline: toNormList(payload.norme_borderline),
      azioni_correttive: toStringList(payload.azioni_correttive),
      data_analisi: new Date().toISOString(),
    };
  }

  /**
   * Restituisce l'anteprima dell'anonimizzazione di un PDF, senza eseguire l'analisi.
   * @param pdf Il contenuto del PDF
   * @param fileName Il nome del file, mostrato nell'anteprima
   * @returns L'anteprima dell'anonimizzazione del file
   */
  async anonymizePreview(pdf: Buffer, fileName: string): Promise<AnonymizationPreview> {
    const payload = await this.postPdf('/api/anonymize-preview/', pdf, fileName);
    const [preview] = Array.isArray(payload.preview_files) ? payload.preview_files : [];
    if (!isRecord(preview)) {
      throw new AppError(ErrorEnum.DocumentNotReadable);
    }
    return preview as unknown as AnonymizationPreview;
  }

  /**
   * Invia un PDF al motore AI come multipart/form-data (campo "files") e restituisce il JSON di risposta,
   * traducendo gli esiti negativi negli errori applicativi corrispondenti.
   */
  private async postPdf(path: string, pdf: Buffer, fileName: string): Promise<Record<string, unknown>> {
    const form = new FormData();
    form.append('files', new Blob([pdf], { type: 'application/pdf' }), withPdfExtension(fileName));

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      // Servizio non avviato, connessione rifiutata o timeout superato
      throw new AppError(ErrorEnum.AiEngineUnavailable);
    }

    const payload: unknown = await response.json().catch(() => null);

    // Il motore AI risponde 400 quando dal PDF non si ricava testo utile (es. scansioni senza OCR)
    if (response.status === 400) {
      throw new AppError(ErrorEnum.DocumentNotReadable);
    }
    if (!response.ok || !isRecord(payload) || 'error' in payload) {
      throw new AppError(ErrorEnum.AiEngineError);
    }
    return payload;
  }
}

export default AiEngine;

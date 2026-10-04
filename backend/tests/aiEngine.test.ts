import AiEngine from '../typescript/singleton/aiEngine';
import { AppError } from '../typescript/factory/error';
import { ErrorMessagesEnum } from '../typescript/enums/errorMessages';

/**
 * Test del client verso il motore AI (fetch simulata, nessun servizio reale).
 * - Risposta ok        -> risultato normalizzato
 * - Servizio assente   -> AiEngineUnavailable (503)
 * - Risposta 400       -> DocumentNotReadable (422)
 * - Risposta 5xx       -> AiEngineError (502)
 */

/** Crea una risposta HTTP finta con il body JSON indicato */
const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const PDF = Buffer.from('%PDF-1.4 test');

describe('AiEngine', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('invia il PDF al motore AI e normalizza il risultato dell\'analisi', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      tipo_documento: ['Bilancio ESG'],
      normative_analizzate: ['CSRD', 'GRI'],
      norme_rispettate: [{ norma: 'CSRD', motivo: 'Requisiti presenti.' }],
      norme_non_rispettate: [{ norma: 'GRI' }, { norma: '' }],
      azioni_correttive: ['Completare GRI 300', ''],
    }));

    const result = await AiEngine.getInstance().analyze(PDF, 'documento_1');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/analyze/', expect.objectContaining({ method: 'POST' }));
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect((form.get('files') as File).name).toBe('documento_1.pdf');

    expect(result.norme_rispettate).toEqual([{ norma: 'CSRD', motivo: 'Requisiti presenti.' }]);
    expect(result.norme_non_rispettate).toEqual([{ norma: 'GRI', motivo: '' }]);
    expect(result.norme_borderline).toEqual([]);
    expect(result.azioni_correttive).toEqual(['Completare GRI 300']);
    expect(result.data_analisi).toEqual(expect.any(String));
  });

  it('restituisce l\'anteprima di anonimizzazione del file', async () => {
    const preview = { file_name: 'bilancio.pdf', placeholder_counts: { EMAIL: 2 }, preview_text: '[EMAIL]' };
    fetchMock.mockResolvedValue(jsonResponse(200, { preview_files: [preview] }));

    await expect(AiEngine.getInstance().anonymizePreview(PDF, 'bilancio.pdf')).resolves.toEqual(preview);
  });

  it('lancia AiEngineUnavailable se il servizio non risponde', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(AiEngine.getInstance().analyze(PDF, 'doc.pdf')).rejects.toMatchObject({
      status: 503,
      message: ErrorMessagesEnum.ERR_AI_ENGINE_UNAVAILABLE,
    });
  });

  it('lancia DocumentNotReadable se il motore AI non estrae testo dal PDF (400)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Documento vuoto o non leggibile' }));

    await expect(AiEngine.getInstance().analyze(PDF, 'doc.pdf')).rejects.toMatchObject({
      status: 422,
      message: ErrorMessagesEnum.ERR_DOCUMENT_NOT_READABLE,
    });
  });

  it('lancia AiEngineError per errori interni del motore AI', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'Traceback...' }));

    const error = await AiEngine.getInstance().analyze(PDF, 'doc.pdf').catch((err) => err);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 502, message: ErrorMessagesEnum.ERR_AI_ENGINE_ERROR });
  });
});

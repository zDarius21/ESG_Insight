import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { uploadPdf } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { idParamSchema, createDocumentSchema, updateDocumentSchema } from '../validation/schemas';
import {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  analyzeDocument,
  downloadDocumentFile,
  downloadDocumentReport,
  previewAnonymization,
} from '../controllers/documentController';

const router = Router();
//----------------------------------------------------------\\
// Tutte le rotte /documents richiedono autenticazione JWT. \\
//----------------------------------------------------------\\


router.use(authenticate);

//-----------------------------------------------------------------------------------------------------\\
//Rotte per la gestione dei documenti: creazione, lettura, aggiornamento, cancellazione e analisi ESG. \\
//-----------------------------------------------------------------------------------------------------\\

/**
 * Rotta per ottenere tutti i documenti caricati dall'utente autenticato. Restituisce un array di oggetti contenenti i dettagli dei documenti.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /documents
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 */
router.get('/',            getAllDocuments);

/**
 * Rotta per ottenere i dettagli di un documento specifico, identificato dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /documents/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_DOCUMENT_NOT_FOUND} Documento non trovato
 */
router.get('/:id',         validate({ params: idParamSchema }), getDocumentById);

/**
 * Rotta per scaricare il file PDF originale di un documento specifico, identificato dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /documents/:id/file
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_DOCUMENT_NOT_FOUND} Documento non trovato
 * @throws {ERR_FILE_NOT_AVAILABLE} Il file originale non è disponibile per questo documento
 * @throws {ERR_STORAGE_ERROR} Errore durante l'operazione sul file storage
 */
router.get('/:id/file',    validate({ params: idParamSchema }), downloadDocumentFile);

/**
 * Rotta per scaricare il report PDF generato dall'analisi di un documento specifico, identificato dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /documents/:id/report
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_DOCUMENT_NOT_FOUND} Documento non trovato
 * @throws {ERR_REPORT_NOT_READY} Il report non è ancora disponibile, eseguire prima l'analisi del documento
 * @throws {ERR_REPORT_NOT_FOUND} Report non trovato
 * @throws {ERR_STORAGE_ERROR} Errore durante l'operazione sul file storage
 */
router.get('/:id/report',  validate({ params: idParamSchema }), downloadDocumentReport);

/**
 * Rotta per ottenere l'anteprima dell'anonimizzazione di un PDF prima del caricamento. Accetta un file PDF nel campo "file".
 * Il file non viene salvato e non vengono addebitati token.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route POST /documents/anonymize-preview
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_INVALID_FILE_TYPE} Solo file PDF sono accettati
 * @throws {ERR_FILE_REQUIRED} Il file PDF è obbligatorio
 * @throws {ERR_DOCUMENT_NOT_READABLE} Il PDF non contiene testo analizzabile
 * @throws {ERR_AI_ENGINE_UNAVAILABLE} Il motore di analisi AI non è raggiungibile
 * @throws {ERR_AI_ENGINE_ERROR} Errore durante l'analisi AI del documento
 */
router.post('/anonymize-preview', uploadPdf, previewAnonymization);


/**
 * Rotta per creare un nuovo documento. Accetta un file PDF nel campo "file".
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route POST /documents
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_INVALID_FILE_TYPE} Solo file PDF sono accettati
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_FILE_REQUIRED} Il file PDF è obbligatorio
 * @throws {ERR_STORAGE_ERROR} Errore durante l'operazione sul file storage
 */
router.post('/',  uploadPdf, validate({ body: createDocumentSchema }), createDocument);


/**
 * Rotta per aggiornare un documento esistente, identificato dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route PATCH /documents/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_DOCUMENT_NOT_FOUND} Documento non trovato
 */
router.patch('/:id',         validate({ params: idParamSchema, body: updateDocumentSchema }), updateDocument);
/**
 * Rotta per eliminare un documento specifico, identificato dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route DELETE /documents/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_DOCUMENT_NOT_FOUND} Documento non trovato
 */
router.delete('/:id',      validate({ params: idParamSchema }), deleteDocument);


/**
 * Rotta per avviare l'analisi ESG di un documento specifico, identificato dal suo ID.
 * L'analisi viene eseguita dal motore AI (ai-engine) sul PDF originale salvato su MinIO.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route POST /documents/:id/analyze
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_DOCUMENT_NOT_FOUND} Documento non trovato
 * @throws {ERR_DOCUMENT_ALREADY_ANALYZED} Il documento è già stato analizzato
 * @throws {ERR_FILE_NOT_AVAILABLE} Il file originale non è disponibile per questo documento
 * @throws {ERR_INSUFFICIENT_TOKENS} Token insufficienti per eseguire l'analisi
 * @throws {ERR_ANALYSIS_IN_PROGRESS} L'analisi del documento è già in corso
 * @throws {ERR_DOCUMENT_NOT_READABLE} Il PDF non contiene testo analizzabile
 * @throws {ERR_AI_ENGINE_UNAVAILABLE} Il motore di analisi AI non è raggiungibile
 * @throws {ERR_AI_ENGINE_ERROR} Errore durante l'analisi AI del documento
 * @throws {ERR_STORAGE_ERROR} Errore durante l'operazione sul file storage
 * @throws {ERR_DATABASE_ERROR} Errore durante l'operazione sul database
 */
router.post('/:id/analyze',  validate({ params: idParamSchema }), analyzeDocument);

export default router;

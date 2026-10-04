import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { idParamSchema } from '../validation/schemas';
import { getAllAnalyses, getAnalysisById } from '../controllers/analysisController';

const router = Router();

// Tutte le rotte /analyses richiedono autenticazione JWT
router.use(authenticate);


/**
 * Rotta per ottenere tutte le analisi ESG effettuate dall'utente autenticato. Restituisce un array di oggetti contenenti i dettagli delle analisi.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /analyses
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 */
router.get('/', getAllAnalyses);


/**
 * Rotta per ottenere i dettagli di una specifica analisi ESG di un documento, identificata dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /analyses/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_ANALYSIS_NOT_FOUND} Analisi non trovata
 */
router.get('/:id', validate({ params: idParamSchema }), getAnalysisById);

export default router;
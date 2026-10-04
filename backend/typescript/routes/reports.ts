import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { idParamSchema } from '../validation/schemas';
import { downloadReport } from '../controllers/reportController';

const router = Router();
//-------------------------------------------------------\\
// Tutte le rotte /reports richiedono autenticazione JWT \\
//-------------------------------------------------------\\
router.use(authenticate);


/**
 * Rotta per scaricare un report PDF generato dall'analisi di un documento, identificato dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /reports/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_REPORT_NOT_FOUND} Report non trovato
 * @throws {ERR_STORAGE_ERROR} Errore durante l'operazione sul file storage
 */
router.get('/:id', validate({ params: idParamSchema }), downloadReport);

export default router;
import { Router } from 'express';
import { getAllRegulations, getRegulationById, createRegulation, updateRegulation, deleteRegulation } from '../controllers/regulationController';
import { authenticate } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/roleMiddleware';
import { uploadPdf } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { idParamSchema, createRegulationSchema, updateRegulationSchema } from '../validation/schemas';

const router = Router();

//-----------------------------------------------------------------------------\\
// Rotte accessibili a tutti gli utenti autenticati per operazioni di lettura. \\
//-----------------------------------------------------------------------------\\

/**
 * Rotta per ottenere tutte le normative disponibili nel sistema. Restituisce un array di oggetti contenenti i dettagli delle normative.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /regulations
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 */
router.get('/', authenticate, getAllRegulations);

/**
 * Rotta per ottenere i dettagli di una specifica normativa, identificata dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /regulations/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_REGULATION_NOT_FOUND} Normativa non trovata
 */
router.get('/:id', authenticate, validate({ params: idParamSchema }), getRegulationById);

//------------------------------------------------\\
// Rotte riservate agli admin per operazioni CUD. \\
//------------------------------------------------\\

/**
 * Rotta per creare una nuova normativa. Accetta un file PDF nel campo "file" e un oggetto JSON con i dettagli della normativa.
 * Richiede un token JWT valido nell'intestazione Authorization e che l'utente abbia il ruolo di admin.
 *
 * @route POST /regulations
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 * @throws {ERR_INVALID_FILE_TYPE} Solo file PDF sono accettati
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_REGULATION_FIELDS_REQUIRED} name, description e version sono obbligatori
 * @throws {ERR_REGULATION_ALREADY_EXISTS} Normativa già esistente
 */
router.post('/', authenticate, requireAdmin, uploadPdf, validate({ body: createRegulationSchema }), createRegulation);

/**
 * Rotta per aggiornare una normativa esistente, identificata dal suo ID. Accetta un oggetto JSON con i dettagli aggiornati della normativa.
 * Richiede un token JWT valido nell'intestazione Authorization e che l'utente abbia il ruolo di admin.
 *
 * @route PATCH /regulations/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_REGULATION_NOT_FOUND} Normativa non trovata
 */
router.patch('/:id', authenticate, requireAdmin, validate({ params: idParamSchema, body: updateRegulationSchema }), updateRegulation);

/**
 * Rotta per eliminare una normativa esistente, identificata dal suo ID.
 * Richiede un token JWT valido nell'intestazione Authorization e che l'utente abbia il ruolo di admin.
 *
 * @route DELETE /regulations/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_REGULATION_NOT_FOUND} Normativa non trovata
 */
router.delete('/:id', authenticate, requireAdmin, validate({ params: idParamSchema }), deleteRegulation);

export default router;
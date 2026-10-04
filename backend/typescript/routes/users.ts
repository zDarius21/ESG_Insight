import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/roleMiddleware';
import { validate } from '../middleware/validationMiddleware';
import {
  idParamSchema,
  createUserSchema,
  updateUserSchema,
  rechargeTokensSchema,
} from '../validation/schemas';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getMyTokens,
  rechargeTokens,
} from '../controllers/userController';

const router = Router();

/**
 * Rotta accessibile a qualsiasi utente autenticato per controllare i propri token.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /users/tokens
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_USER_NOT_FOUND} Utente non trovato
 */
router.get('/tokens', authenticate, getMyTokens);


//-----------------------------------------------------------------\\
// Le rotte seguenti richiedono un token JWT valido con ruolo admin\\
//-----------------------------------------------------------------\\
router.use(authenticate, requireAdmin);

/**
 * Rotta per ottenere tutti gli utenti del sistema. Richiede un token JWT valido con ruolo admin.
 *
 * @route GET /users
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 */
router.get('/', getAllUsers);

/**
 * Rotta per ottenere i dettagli di un utente specifico, identificato dal suo ID. Richiede un token JWT valido con ruolo admin.
 *
 * @route GET /users/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_USER_NOT_FOUND} Utente non trovato
 */
router.get('/:id', validate({ params: idParamSchema }), getUserById);

/**
 * Rotta per creare un nuovo utente. Richiede un token JWT valido con ruolo admin.
 *
 * @route POST /users
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_EMAIL_ALREADY_USED} Email già utilizzata
 */
router.post('/', validate({ body: createUserSchema }), createUser);

/**
 * Rotta per aggiornare i dettagli di un utente specifico, identificato dal suo ID. Richiede un token JWT valido con ruolo admin.
 *
 * @route PATCH /users/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_USER_NOT_FOUND} Utente non trovato
 * @throws {ERR_EMAIL_IN_USE} Email già in uso
 */
router.patch('/:id', validate({ params: idParamSchema, body: updateUserSchema }), updateUser);

/**
 * Rotta per eliminare un utente specifico, identificato dal suo ID. Richiede un token JWT valido con ruolo admin.
 *
 * @route DELETE /users/:id
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_USER_NOT_FOUND} Utente non trovato
 */
router.delete('/:id', validate({ params: idParamSchema }), deleteUser);

/**
 * Rotta per ricaricare i token di un utente specifico, identificato dal suo ID. Richiede un token JWT valido con ruolo admin.
 *
 * @route POST /users/:id/tokens
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_FORBIDDEN} Accesso riservato agli admin
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_USER_NOT_FOUND} Utente non trovato
 * @throws {ERR_TOKEN_CAP_EXCEEDED} La ricarica supera il massimo consentito di 100 token
 */
router.post('/:id/tokens', validate({ params: idParamSchema, body: rechargeTokensSchema }), rechargeTokens);

export default router;

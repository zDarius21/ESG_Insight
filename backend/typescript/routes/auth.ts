import { Router } from 'express';
import { register, login, getMe, updateMe } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';
import { validate } from '../middleware/validationMiddleware';
import { registerSchema, loginSchema, updateMeSchema } from '../validation/schemas';

const router = Router();

//------------------------------------------------------------------------------------------------\\
// Rotte pubbliche per la registrazione e per il login degli utenti. Non necessitano del token JWT\\
//------------------------------------------------------------------------------------------------\\

/**
 * Rotta per la registrazione di un nuovo utente. Richiede un oggetto JSON con email, password e ruolo.
 * Valida i dati in ingresso e, in caso di successo, crea un nuovo utente nel database.
 * Restituisce un token JWT per l'autenticazione dell'utente appena registrato.
 *
 * @route POST /auth/register
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_EMAIL_ALREADY_REGISTERED} Email già registrata
 */
router.post('/register', validate({ body: registerSchema }), register);

/**
 * Rotta per il login di un utente esistente. Richiede un oggetto JSON con email e password.
 * Valida i dati in ingresso e, in caso di successo, restituisce un token JWT per l'autenticazione dell'utente.
 *
 * @route POST /auth/login
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_INVALID_CREDENTIALS} Credenziali non valide
 */
router.post('/login', validate({ body: loginSchema }), login);

//---------------------------------------------------------------------------------------------\\
// Rotte autenticate che permettono all'utente di ottenere e aggiornare le proprie informazioni\\
//---------------------------------------------------------------------------------------------\\

/**
 * Rotta per ottenere le informazioni dell'utente autenticato.
 * Richiede un token JWT valido nell'intestazione Authorization.
 *
 * @route GET /auth/me
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_USER_NOT_FOUND} Utente non trovato
 */
router.get('/me', authenticate, getMe);

/**
 * Rotta per aggiornare le informazioni dell'utente autenticato.
 * Richiede un token JWT valido nell'intestazione Authorization e un oggetto JSON con i dati da aggiornare.
 *
 * @route PATCH /auth/me
 * @throws {ERR_TOKEN_MISSING} Token mancante
 * @throws {ERR_TOKEN_INVALID} Token non valido o scaduto
 * @throws {ERR_VALIDATION} Dati della richiesta non validi
 * @throws {ERR_USER_NOT_FOUND} Utente non trovato
 * @throws {ERR_EMAIL_IN_USE} Email già in uso
 */
router.patch('/me', authenticate, validate({ body: updateMeSchema }), updateMe);

export default router;
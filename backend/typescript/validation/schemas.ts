import { z } from 'zod';
import { ErrorMessagesEnum as Messages } from '../enums/errorMessages';
import { Role } from '../enums/role';

/**
 * Schemi di validazione Zod per body e params delle richieste HTTP.
 *
 * Vengono applicati nelle rotte tramite il middleware `validate` (validationMiddleware.ts),
 * che esegue `schema.parse()` prima del controller: se i dati non sono validi la richiesta
 * viene interrotta con una risposta 400 e il dettaglio dei campi.
 *
 * Confine di responsabilità: qui vive solo la validazione di forma/tipo degli input;
 * i controlli di business (esistenza risorsa, unicità email, cap dei token, presenza file)
 * restano nei controller. I messaggi di errore sono centralizzati in
 * factory/errorMessages.ts come costanti `VAL_*`.
 */

/**
 * Schema per il parametro di rotta `:id`.
 * Accetta solo una stringa composta da cifre (intero positivo), così da evitare che
 * un id non numerico raggiunga le query sul DB generando errori 500.
 */
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, Messages.VAL_ID_INVALID),
});

// Caratteri speciali ammessi per la complessità della password
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()\-_=+[\]{};':",.<>/?\\|`~]/;

/**
 * Validatore email riutilizzabile: stringa non vuota, trimmata, in formato email valido.
 */
const email = z
  .string({ required_error: Messages.VAL_EMAIL_REQUIRED })
  .trim()
  .email(Messages.VAL_EMAIL_INVALID);

/**
 * Validatore password riutilizzabile con regole forti: almeno 8 caratteri, senza spazi,
 * con almeno una maiuscola, una minuscola, una cifra e un carattere speciale.
 * Stesse regole per registrazione, creazione utente e aggiornamenti.
 * NON usato nel login (vedi loginSchema), dove serve solo confrontare con l'hash esistente.
 */
const password = z
  .string({ required_error: Messages.VAL_PASSWORD_REQUIRED })
  .trim()
  .regex(/^\S+$/, Messages.VAL_PASSWORD_NO_SPACES)
  .min(8, Messages.VAL_PASSWORD_MIN)
  .regex(/[A-Z]/, Messages.VAL_PASSWORD_UPPERCASE)
  .regex(/[a-z]/, Messages.VAL_PASSWORD_LOWERCASE)
  .regex(/\d/, Messages.VAL_PASSWORD_NUMBER)
  .regex(SPECIAL_CHAR_REGEX, Messages.VAL_PASSWORD_SPECIAL);

/* ----------------------------- AUTH ----------------------------- */

/**
 * Body della registrazione (`POST /auth/register`): email valida + password forte.
 * Il ruolo non è accettato dal client: la registrazione pubblica crea sempre `Role.User`.
 */
export const registerSchema = z.object({ email, password });

/**
 * Body del login (`POST /auth/login`): email valida + password presente.
 * Sulla password non si impone la lunghezza minima, perché serve solo al confronto
 * con quella già salvata (eventualmente creata con regole precedenti).
 */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, Messages.VAL_PASSWORD_REQUIRED),
});


/**
 * Body dell'aggiornamento del proprio profilo (`PATCH /auth/me`).
 * Entrambi i campi sono opzionali, ma almeno uno deve essere presente.
 */
export const updateMeSchema = z
  .object({
    email: email.optional(),
    password: password.optional(),
  })
  .refine((d) => d.email !== undefined || d.password !== undefined, {
    message: Messages.VAL_NOTHING_TO_UPDATE,
  });

/* ----------------------------- USERS (admin) ----------------------------- */

/**
 * Body della creazione utente da parte di un admin (`POST /users`): email valida + password >= 8.
 */
export const createUserSchema = z.object({
  email,
  password,
});

/**
 * Body dell'aggiornamento utente da parte di un admin (`PATCH /users/:id`).
 * Tutti i campi sono opzionali ma almeno uno deve essere presente; `role` è limitato
 * ai valori dell'enum Role.
 */
export const updateUserSchema = z
  .object({
    email: email.optional(),
    password: password.optional(),
    role: z.nativeEnum(Role).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: Messages.VAL_NOTHING_TO_UPDATE,
  });

/**
 * Body della ricarica token (`POST /users/:id/tokens`).
 * `z.coerce` converte automaticamente stringhe numeriche in numero; il valore deve essere
 * un intero positivo non superiore a 100. Il controllo del cap sul saldo attuale resta nel controller.
 */
export const rechargeTokensSchema = z.object({
  tokens: z.coerce
    .number({ invalid_type_error: Messages.VAL_TOKENS_TYPE })
    .int(Messages.VAL_TOKENS_INT)
    .positive(Messages.VAL_TOKENS_POSITIVE)
    .max(100, Messages.VAL_TOKENS_MAX),
});

/* ----------------------------- DOCUMENTS ----------------------------- */

/**
 * Body della creazione documento (`POST /documents`): title e description non vuoti.
 * Il file PDF viaggia su `req.file` (multer) e viene validato a parte nel controller.
 */
export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, Messages.VAL_TITLE_REQUIRED),
  description: z.string().trim().min(1, Messages.VAL_DESCRIPTION_REQUIRED),
});

/**
 * Body dell'aggiornamento documento (`PATCH /documents/:id`).
 * Campi opzionali ma almeno uno presente; se forniti non possono essere stringhe vuote.
 */
export const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1, Messages.VAL_TITLE_EMPTY).optional(),
    description: z.string().trim().min(1, Messages.VAL_DESCRIPTION_EMPTY).optional(),
  })
  .refine((d) => d.title !== undefined || d.description !== undefined, {
    message: Messages.VAL_NOTHING_TO_UPDATE,
  });

/* ----------------------------- REGULATIONS ----------------------------- */

/**
 * Body della creazione normativa (`POST /regulations`): name e version obbligatori.
 * La `description` è opzionale qui perché può arrivare dal testo estratto dal PDF allegato;
 * il controller verifica che, dopo l'eventuale estrazione, sia comunque presente.
 */
export const createRegulationSchema = z.object({
  name: z.string().trim().min(1, Messages.VAL_NAME_REQUIRED),
  version: z.string().trim().min(1, Messages.VAL_VERSION_REQUIRED),
  description: z.string().trim().min(1).optional(),
});

/**
 * Body dell'aggiornamento normativa (`PATCH /regulations/:id`).
 * Tutti i campi sono opzionali ma almeno uno deve essere presente e non vuoto.
 */
export const updateRegulationSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    version: z.string().trim().min(1).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: Messages.VAL_NOTHING_TO_UPDATE,
  });

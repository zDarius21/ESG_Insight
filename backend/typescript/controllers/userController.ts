import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import UserDAO from '../dao/UserDAO';
import DocumentDAO from '../dao/DocumentDAO';
import MinioStorage from '../singleton/minio';
import ResponseFactory, { ErrorEnum, SuccessEnum } from '../factory/responseFactory';
import { Role } from '../enums/role';

/**
 * Implementazione della rotta /users di tipo "GET". Si restituiscono le informazioni sicure di tutti gli utenti
 * @param _req La richiesta HTTP
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await UserDAO.findAll();
  ResponseFactory.sendSuccess(res, SuccessEnum.UsersFetched, users);
};

/**
 * Implementazione della rotta /users/:id di tipo "GET". Si restituiscono le informazioni sicure di un singolo utente, scegliendolo in base all'ID
 * @param req La richiesta HTTP contenente l'ID dell'utente
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const user = await UserDAO.findById(req.params.id);
  if (!user) {
    ResponseFactory.sendError(res, ErrorEnum.UserNotFound);
    return;
  }
  ResponseFactory.sendSuccess(res, SuccessEnum.UserFetched, user);
};

/**
 * Implementazione della rotta /users di tipo "POST". Si crea un nuovo utente impostando email e password hashata. Il ruolo è impostato di default a "user"
 * @param req La richiesta HTTP contenente i dati del nuovo utente
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const existing = await UserDAO.findByEmail(email);
  if (existing) {
    ResponseFactory.sendError(res, ErrorEnum.EmailAlreadyUsed);
    return;
  }

  const passwordHashed = await bcrypt.hash(password, 10);
  const user = await UserDAO.create({ email, password: passwordHashed, role: Role.User });

  ResponseFactory.sendSuccess(res, SuccessEnum.UserCreated, { id: user.id, email: user.email, role: user.role });
};


/**
 * Implementazione della rotta /users/:id di tipo "PUT". Si aggiornano email, password dell'utente. Si può modificare il ruolo di un utente soltanto se il ruolo attuale è "user".
 * @param req La richiesta HTTP contenente i dati aggiornati dell'utente
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const user = await UserDAO.findByIdFull(req.params.id);
  if (!user) {
    ResponseFactory.sendError(res, ErrorEnum.UserNotFound);
    return;
  }

  const { email, password, role } = req.body;

  if (email !== undefined) {
    const conflict = await UserDAO.findByEmail(email);
    if (conflict && conflict.id !== user.id) {
      ResponseFactory.sendError(res, ErrorEnum.EmailInUse);
      return;
    }
    user.email = email;
  }

  if (password !== undefined) {
    user.password = await bcrypt.hash(password, 10);
  }

  if (role === Role.Admin && user.role === Role.User) {
    user.role = Role.Admin;
  }

  await user.save();
  ResponseFactory.sendSuccess(res, SuccessEnum.UserUpdated, { id: user.id, email: user.email, role: user.role });
};

/**
 * Implementazione della rotta /users/:id di tipo "DELETE". Si elimina un utente selezionandolo in base all'ID
 * @param req La richiesta HTTP contenente l'ID dell'utente
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const user = await UserDAO.findByIdFull(req.params.id);
  if (!user) {
    ResponseFactory.sendError(res, ErrorEnum.UserNotFound);
    return;
  }

  // Le righe di documenti e report vengono eliminate a cascata dal DB (ON DELETE CASCADE),
  // ma i relativi file su MinIO vanno rimossi esplicitamente per non lasciare oggetti orfani.
  const documents = await DocumentDAO.findAllByUser(user.id);
  const client = MinioStorage.getInstance();
  for (const document of documents) {
    if (document.filePath)   await client.removeObject(MinioStorage.DOCUMENTS_BUCKET, document.filePath).catch(() => {});
    if (document.reportPath) await client.removeObject(MinioStorage.REPORTS_BUCKET,   document.reportPath).catch(() => {});
  }

  await user.destroy();
  ResponseFactory.sendSuccess(res, SuccessEnum.UserDeleted, { message: `${user.email}: Utente eliminato` });
};

/**
 * Implementazione della rotta /users/me/tokens di tipo "GET". Si restituisce il saldo token dell'utente autenticato
 * @param req La richiesta HTTP
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const getMyTokens = async (req: Request, res: Response): Promise<void> => {
  const user = await UserDAO.findById(req.user.id);
  if (!user) {
    ResponseFactory.sendError(res, ErrorEnum.UserNotFound);
    return;
  }
  ResponseFactory.sendSuccess(res, SuccessEnum.TokensFetched, { tokens: user.tokens });
};

/**
 * Implementazione della rotta /users/:id/tokens di tipo "POST". Si ricaricano manualmente i token di un utente (solo admin). Il valore viene aggiunto al saldo attuale fino al cap di 100.
 * @param req La richiesta HTTP contenente l'ID dell'utente e il numero di token da ricaricare
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const rechargeTokens = async (req: Request, res: Response): Promise<void> => {
  // tokens è già validato e convertito a numero intero positivo dallo schema Zod
  const amount = req.body.tokens as number;

  const user = await UserDAO.findById(req.params.id);
  if (!user) {
    ResponseFactory.sendError(res, ErrorEnum.UserNotFound);
    return;
  }

  if (user.tokens + amount > 100) {
    ResponseFactory.sendError(res, ErrorEnum.TokenCapExceeded);
    return;
  }

  const newBalance = await UserDAO.addTokens(Number(req.params.id), amount);
  ResponseFactory.sendSuccess(res, SuccessEnum.TokensRecharged, {
    id: user.id,
    email: user.email,
    tokens: newBalance,
  });
};

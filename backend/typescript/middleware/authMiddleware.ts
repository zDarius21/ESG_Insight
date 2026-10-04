import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import ResponseFactory, { ErrorEnum } from '../factory/responseFactory';
import { Role } from '../enums/role';

// La chiave pubblica viene usata per verificare la firma dei token in entrata
const PUBLIC_KEY = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH ?? '', 'utf8');


/**
 * Interfaccia che rappresenta il payload del token JWT decodificato.
 * Contiene le informazioni dell'utente che sono state codificate nel token.
 */
export interface AuthPayload {
  id: number;
  email: string;
  role: Role;
}

// Estendiamo il tipo Request di Express per aggiungere il campo user
declare global {
  namespace Express {
    interface Request {
      user: AuthPayload;
    }
  }
}


/**
 * Middleware che verifica la presenza e la validità del token Bearer.
 * Se il token è valido, aggiunge il payload decodificato a req.user.
 * 
 * @param req La richiesta HTTP
 * @param res La risposta HTTP
 * @param next La funzione per passare al prossimo middleware
 * @returns void
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    ResponseFactory.sendError(res, ErrorEnum.TokenMissing);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Se la verifica va a buon fine, salviamo il payload in req.user per i middleware successivi
    req.user = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }) as AuthPayload;
    next();
  } catch {
    ResponseFactory.sendError(res, ErrorEnum.TokenInvalid);
  }
};
import { Request, Response, NextFunction } from 'express';
import ResponseFactory, { ErrorEnum } from '../factory/responseFactory';
import { Role } from '../enums/role';

/**
 * Middleware che blocca l'accesso se l'utente non ha il ruolo admin.
 * 
 * @param req La richiesta HTTP
 * @param res La risposta HTTP
 * @param next La funzione per passare al prossimo middleware
 * @returns void
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== Role.Admin) {
    ResponseFactory.sendError(res, ErrorEnum.Forbidden);
    return;
  }
  next();
};
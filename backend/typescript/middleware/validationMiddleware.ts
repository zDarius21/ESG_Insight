import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import ResponseFactory from '../factory/responseFactory';

/**
 * Insieme di schemi Zod applicabili alle diverse parti della richiesta.
 */
export interface RequestSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Middleware factory che valida body, params e query secondo gli schemi forniti.
 * I valori validati (con eventuali coercizioni, es. tokens stringa -> numero)
 * sostituiscono quelli originali nella richiesta.
 * In caso di errore invia una risposta 400 con il dettaglio dei campi non validi.
 *
 * @param schemas Gli schemi Zod da applicare a body/params/query
 * @returns Il middleware Express
 */
export const validate =
  (schemas: RequestSchemas) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        ResponseFactory.sendValidationError(res, err);
        return;
      }
      next(err);
    }
  };

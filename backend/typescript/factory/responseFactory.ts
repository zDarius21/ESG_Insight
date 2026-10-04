import { Response } from 'express';
import { ZodError } from 'zod';
import { getError, ErrorEnum } from './error';
import { getSuccess } from './success';
import { SuccessEnum } from '../enums/success';

// Pattern Factory per generare le risposte HTTP standard
class ResponseFactory {

/**
 * Metodo statico per inviare una risposta di errore standardizzata. 
 * @param res La risposta Express
 * @param type Il tipo di errore da inviare
 * @returns La risposta HTTP
 */

static sendError(res: Response, type: ErrorEnum): Response {
    const { status, message } = getError(type).getErrorObj();
    return res.status(status).json({ success: false, error: message });
  }

  /**
   * Metodo statico per inviare una risposta di errore di validazione (Zod), con il dettaglio dei campi non validi.
   * @param res La risposta Express
   * @param error L'errore Zod contenente i dettagli della validazione
   * @returns La risposta HTTP
   */
  static sendValidationError(res: Response, error: ZodError): Response {
    const { status, message } = getError(ErrorEnum.ValidationError).getErrorObj();
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    return res.status(status).json({ success: false, error: message, details });
  }

  /**
   * Metodo statico per inviare una risposta di successo standardizzata.
   * @param res La risposta Express
   * @param type Il tipo di successo da inviare
   * @param data I dati da includere nella risposta
   * @returns La risposta HTTP
   */
  static sendSuccess(res: Response, type: SuccessEnum, data: unknown): Response {
    const { status } = getSuccess(type).getSuccessObj();
    return res.status(status).json({ success: true, data });
  }
}

export { ErrorEnum, SuccessEnum };
export default ResponseFactory;

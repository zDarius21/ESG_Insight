import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import ResponseFactory, { ErrorEnum } from '../factory/responseFactory';

/**
 * Middleware per gestire l'upload di file PDF. Utilizza multer per gestire il caricamento dei file in memoria.
 * Limita la dimensione del file a 10 MB e accetta solo file con estensione .pdf o mimetype 'application/pdf'.
 * In caso di errore (file non valido o troppo grande), invia una risposta di errore standardizzata.
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; 
const MIME_TYPE = 'application/pdf';

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === MIME_TYPE || file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error('InvalidFileType'));
    }
  },
});

/**
 * Middleware per gestire l'upload di file PDF. Utilizza multer per gestire il caricamento dei file in memoria.
 * Limita la dimensione del file a 10 MB e accetta solo file con estensione .pdf o mimetype 'application/pdf'.
 * In caso di errore (file non valido o troppo grande), invia una risposta di errore standardizzata.
 * @param req La richiesta Express
 * @param res La risposta Express
 * @param next La funzione next di Express
 */

const FILE_TYPE = 'file';

export const uploadPdf = (req: Request, res: Response, next: NextFunction): void => {
  multerInstance.single(FILE_TYPE)(req, res, (err) => {
    if (err) {
      ResponseFactory.sendError(res, ErrorEnum.InvalidFileType);
      return;
    }
    next();
  });
};

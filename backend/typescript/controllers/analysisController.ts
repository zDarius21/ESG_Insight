import { Request, Response } from 'express';
import DocumentDAO from '../dao/DocumentDAO';
import ResponseFactory, { ErrorEnum, SuccessEnum } from '../factory/responseFactory';

/**
 * Restituisce tutti i documenti analizzati dell'utente autenticato
 * @param req La richiesta HTTP
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const getAllAnalyses = async (req: Request, res: Response): Promise<void> => {
  const analyses = await DocumentDAO.findAllAnalyzedByUser(req.user.id);
  ResponseFactory.sendSuccess(res, SuccessEnum.AnalysesFetched, analyses);
};

/**
 * Restituisce i dettagli di una singola analisi dell'utente autenticato
 * @param req La richiesta HTTP contenente l'ID del documento
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const getAnalysisById = async (req: Request, res: Response): Promise<void> => {
  const document = await DocumentDAO.findAnalyzedByIdAndUser(req.params.id, req.user.id);

  if (!document) {
    ResponseFactory.sendError(res, ErrorEnum.AnalysisNotFound);
    return;
  }

  ResponseFactory.sendSuccess(res, SuccessEnum.AnalysisFetched, document);
};
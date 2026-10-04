import { Request, Response } from 'express';
import { PDFParse } from 'pdf-parse';
import RegulationDAO from '../dao/RegulationDAO';
import ResponseFactory, { ErrorEnum, SuccessEnum } from '../factory/responseFactory';

/**
 * Restituisce la lista di tutte le normative presenti
 * @param req La richiesta HTTP
 * @param res La risposta HTTP
 */
export const getAllRegulations = async (req: Request, res: Response): Promise<void> => {
  const regulations = await RegulationDAO.findAll();
  ResponseFactory.sendSuccess(res, SuccessEnum.RegulationsFetched, regulations);
};

/**
 * Restituisce i dettagli di una singola normativa ricercandola per id
 * @param req La richiesta HTTP contenente l'ID della normativa
 * @param res La risposta HTTP
 */
export const getRegulationById = async (req: Request, res: Response): Promise<void> => {
  const regulation = await RegulationDAO.findById(req.params.id);
  if (!regulation) {
    ResponseFactory.sendError(res, ErrorEnum.RegulationNotFound);
    return;
  }
  ResponseFactory.sendSuccess(res, SuccessEnum.RegulationFetched, regulation);
};

/**
 * Crea una nuova normativa. Se viene allegato un PDF, il testo estratto sostituisce la description
 * @param req La richiesta HTTP contenente i dati della normativa e opzionalmente un file PDF
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const createRegulation = async (req: Request, res: Response): Promise<void> => {
  const { name, version } = req.body;
  let { description } = req.body;

  if (req.file) {
    const parser = new PDFParse({ data: req.file.buffer });
    const result = await parser.getText();
    description = result.text.trim();
  }

  // name e version sono già validati da Zod; la description può provenire dal PDF estratto
  if (!description) {
    ResponseFactory.sendError(res, ErrorEnum.RegulationFieldsRequired);
    return;
  }

  const existing = await RegulationDAO.findByName(name);
  if (existing) {
    ResponseFactory.sendError(res, ErrorEnum.RegulationAlreadyExists);
    return;
  }

  const regulation = await RegulationDAO.create({ name, description, version });
  ResponseFactory.sendSuccess(res, SuccessEnum.RegulationCreated, regulation);
};

/**
 * Aggiorna una normativa esistente, controllando che esista la normativa e che i campi siano compilati
 * @param req La richiesta HTTP contenente i dati aggiornati della normativa
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const updateRegulation = async (req: Request, res: Response): Promise<void> => {
  const regulation = await RegulationDAO.findById(req.params.id);
  if (!regulation) {
    ResponseFactory.sendError(res, ErrorEnum.RegulationNotFound);
    return;
  }

  const { name, description, version } = req.body;
  await regulation.update({ name, description, version });
  ResponseFactory.sendSuccess(res, SuccessEnum.RegulationUpdated, regulation);
};

/**
 * Elimina una normativa, controllando che esista la normativa e restituendo un messaggio di conferma
 * @param req La richiesta HTTP contenente l'ID della normativa
 * @param res La risposta HTTP
 * @returns Nessun valore restituito direttamente, invia la risposta tramite ResponseFactory
 */
export const deleteRegulation = async (req: Request, res: Response): Promise<void> => {
  const regulation = await RegulationDAO.findById(req.params.id);
  if (!regulation) {
    ResponseFactory.sendError(res, ErrorEnum.RegulationNotFound);
    return;
  }

  await regulation.destroy();
  ResponseFactory.sendSuccess(res, SuccessEnum.RegulationDeleted, { message: `Normativa ${regulation.name} eliminata` });
};

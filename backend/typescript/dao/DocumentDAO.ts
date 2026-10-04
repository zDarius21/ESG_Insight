import { Transaction } from 'sequelize';
import Document from '../models/Document';
import { IDao } from './IDao';
import { AppError, ErrorEnum } from '../factory/error';
import { DocumentStatus } from '../enums/documentStatus';

export type DocumentCreateData = { userId: number; title: string; description: string };

/**
 * DAO per le operazioni di accesso ai dati dei documenti
 * @param  - Il modello del documento
 */
export class DocumentDAO implements IDao<Document, DocumentCreateData> {
  /** Restituisce tutti i documenti presenti nel database. */
  async findAll() {
    try {
      return await Document.findAll();
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca tramite ID del documento.
   * @param id - L'id del documento da cercare.
   * @returns Restituisce il documento corrispondente all'id fornito, o null se non esiste. 
   * */
  async findById(id: string | number) {
    try {
      return await Document.findByPk(id);
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca tramite ID dell'utente.
   * @param userId - L'id dell'utente da cercare.
   * @returns Restituisce tutti i documenti appartenenti all'utente specificato.
   * */
  async findAllByUser(userId: number) {
    try {
      return await Document.findAll({ where: { userId } });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca tramite ID del documento e ID dell'utente.
   * @param id - L'id del documento da cercare.
   * @param userId - L'id dell'utente da cercare.
   * @returns Restituisce il documento con l'id dato appartenente all'utente, o null se non trovato.
   * */
  async findByIdAndUser(id: string | number, userId: number) {
    try {
      return await Document.findOne({ where: { id, userId } });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca di tutti i documenti analizzati appartenenti all'utente.
   * @param userId - L'id dell'utente da cercare.
   * @returns Restituisce tutti i documenti con status 'analyzed' appartenenti all'utente.
   * */
  async findAllAnalyzedByUser(userId: number) {
    try {
      return await Document.findAll({ where: { userId, status: DocumentStatus.Analyzed } });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca del documento analizzato tramite ID del documento e ID dell'utente.
   * @param id - L'id del documento da cercare.
   * @param userId - L'id dell'utente da cercare.
   * @returns Restituisce il documento analizzato con l'id dato appartenente all'utente, o null se non trovato.
   * */
  async findAnalyzedByIdAndUser(id: string | number, userId: number) {
    try {
      return await Document.findOne({ where: { id, userId, status: DocumentStatus.Analyzed } });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Creazione di un nuovo documento.
   * @param data - I dati del documento da creare.
   * @returns Restituisce il documento creato.
   * */
  async create(data: DocumentCreateData, t?: Transaction) {
    try {
      return await Document.create(data, { transaction: t });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }
}

export default new DocumentDAO();
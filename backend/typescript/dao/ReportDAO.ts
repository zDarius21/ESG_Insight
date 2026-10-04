import { Transaction } from 'sequelize';
import Report from '../models/Report';
import { IDao } from './IDao';
import { AppError, ErrorEnum } from '../factory/error';

export type ReportCreateData = { documentId: number; userId: number; filePath: string };

// DAO per le operazioni di accesso ai dati dei report
export class ReportDAO implements IDao<Report, ReportCreateData> {

  /** 
   * Funzione di Ricerca di tutti i report presenti nel database.
   * @returns Restituisce tutti i report presenti nel database.
   * */
  async findAll() {
    try {
      return await Report.findAll();
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca del report tramite ID.
   * @param id - L'id del report da cercare.
   * @returns Restituisce il report con l'id fornito, o null se non esiste.
   * */
  async findById(id: string | number) {
    try {
      return await Report.findByPk(id);
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca del report tramite ID e ID dell'utente.
   * @param id - L'id del report da cercare.
   * @param userId - L'id dell'utente da cercare.
   * @returns Restituisce il report con l'id dato appartenente all'utente, o null se non trovato.
   * */
  async findByIdAndUser(id: string | number, userId: number) {
    try {
      return await Report.findOne({ where: { id, userId } });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Creazione di un nuovo report.
   * @param data - I dati del report da creare.
   * @returns Restituisce il report creato.
   * */
  async create(data: ReportCreateData, t?: Transaction) {
    try {
      return await Report.create(data, { transaction: t });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }
}

export default new ReportDAO();
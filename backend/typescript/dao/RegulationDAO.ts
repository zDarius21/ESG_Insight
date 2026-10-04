import Regulation from '../models/Regulation';
import { IDao } from './IDao';
import { AppError, ErrorEnum } from '../factory/error';

export type RegulationCreateData = { name: string; description: string; version: string };

// DAO per le operazioni di accesso ai dati delle normative
export class RegulationDAO implements IDao<Regulation, RegulationCreateData> {

  /** 
   * Funzione di Ricerca di tutte le normative presenti nel database.
   * @returns Restituisce tutte le normative presenti nel database.
   * */
  async findAll() {
    try {
      return await Regulation.findAll();
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca tramite ID della normativa.
   * @param id - L'id della normativa da cercare.
   * @returns Restituisce la normativa con l'id fornito, o null se non esiste.
   * */
  async findById(id: string | number) {
    try {
      return await Regulation.findByPk(id);
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Ricerca tramite nome della normativa.
   * @param name - Il nome della normativa da cercare.
   * @returns Restituisce la normativa con il nome fornito, o null se non esiste.
   * */
  async findByName(name: string) {
    try {
      return await Regulation.findOne({ where: { name } });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** 
   * Funzione di Creazione di una nuova normativa.
   * @param data - I dati della normativa da creare.
   * @returns Restituisce la normativa creata.
   * */
  async create(data: RegulationCreateData) {
    try {
      return await Regulation.create(data);
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }
}

export default new RegulationDAO();
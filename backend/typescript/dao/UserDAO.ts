import { Transaction } from 'sequelize';
import User from '../models/User';
import { IDao } from './IDao';
import { AppError, ErrorEnum } from '../factory/error';
import { Role } from '../enums/role';

const SAFE_ATTRIBUTES = ['id', 'email', 'role', 'tokens', 'createdAt', 'updatedAt'];

export type UserCreateData = { email: string; password: string; role: Role };

// DAO per le operazioni di accesso ai dati degli utenti
export class UserDAO implements IDao<User, UserCreateData> {

  
  /** Restituisce tutti gli utenti senza il campo password.
   * @returns Restituisce tutti gli utenti senza il campo password.
   * */
  async findAll() {
    try {
      return await User.findAll({ attributes: SAFE_ATTRIBUTES });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** Restituisce l'utente con l'id fornito senza il campo password, o null se non esiste. 
   * @param id - L'id dell'utente da cercare.
   * @returns Restituisce l'utente con l'id fornito senza il campo password, o null se non esiste.
   * */

  async findById(id: string | number) {
    try {
      return await User.findByPk(id, { attributes: SAFE_ATTRIBUTES });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** Restituisce l'utente con l'id fornito incluso il campo password, o null se non esiste.
   * @param id - L'id dell'utente da cercare.
   * @returns Restituisce l'utente con l'id fornito incluso il campo password, o null se non esiste.
   * */
   
  async findByIdFull(id: string | number) {
    try {
      return await User.findByPk(id);
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** Restituisce l'utente con l'email fornita incluso il campo password, o null se non esiste.
   * @param email - L'email dell'utente da cercare.
   * @returns Restituisce l'utente con l'email fornita incluso il campo password, o null se non esiste.
   * */
  async findByEmail(email: string) {
    try {
      return await User.findOne({ where: { email } });
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /** Crea e salva un nuovo utente nel database con i dati forniti.
   * @param data - I dati dell'utente da creare.
   * @returns Restituisce l'utente creato.
   * */
  async create(data: UserCreateData) {
    try {
      return await User.create(data);
    } catch {
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }

  /**
   * Decrementa il numero di token dell'utente con l'id fornito di 10 token.
   * @param userId - L'id dell'utente.
   * @param amount - L'ammontare di token da decrementare.
   */
  async deductTokens(userId: number, amount: number = 10, t?: Transaction): Promise<void> {
    await User.decrement('tokens', { by: amount, where: { id: userId }, transaction: t });
  }
  /**
   * Ricarica i token degli utenti fino a un massimo specificato, lanciato in automatico, impostato per aggiungere 10 token ogni 6 ore.
   * @param amount - L'ammontare di token da aggiungere.
   * @param cap - Il numero massimo di token consentito.
   */
  async refillTokens(amount: number = 10, cap: number = 100): Promise<void> {
    await User.sequelize?.query(
      `UPDATE users SET tokens = LEAST(tokens + :amount, :cap)`,
      { replacements: { amount, cap } }
    );
  }

 /**
  * Aggiunge token all'utente con l'id fornito fino a un massimo specificato.
  * @param userId - L'id dell'utente.
  * @param amount - L'ammontare di token da aggiungere.
  * @param cap - Il numero massimo di token consentito.
  * @returns Restituisce il numero aggiornato di token dell'utente.

  */
  async addTokens(userId: number, amount: number, cap: number = 100): Promise<number> {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new AppError(ErrorEnum.UserNotFound);
      user.tokens = Math.min(user.tokens + amount, cap);
      await user.save();
      return user.tokens;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorEnum.DatabaseError);
    }
  }
}

export default new UserDAO();
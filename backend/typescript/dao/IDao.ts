
/**
 * Interfaccia che definisce i metodi che le classi DAO devono implementare.
 * In particolare sono definite le operazioni CRUD (Create, Read, Update, Delete) per la gestione dei dati. 
 */
export interface IDao<T, C> {
  findAll(): Promise<T[]>;
  findById(id: string | number): Promise<T | null>;
  create(data: C): Promise<T>;
}

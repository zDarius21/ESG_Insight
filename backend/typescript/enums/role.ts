/**
 * Ruoli applicativi di un utente.
 * I valori ('user'/'admin') coincidono con quelli salvati nel DB,
 * così la migrazione a enum non richiede modifiche ai dati esistenti.
 */
export enum Role {
  User = 'user',
  Admin = 'admin',
}

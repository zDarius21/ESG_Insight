/**
 * Stati possibili di un documento: in attesa di analisi o già analizzato.
 * I valori ('pending'/'analyzed') coincidono con quelli salvati nel DB,
 * così la migrazione a enum non richiede modifiche ai dati esistenti.
 */
export enum DocumentStatus {
  Pending = 'pending',
  Analyzed = 'analyzed',
}

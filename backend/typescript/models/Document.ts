import { DataTypes, Model, Optional } from 'sequelize';
import Database from '../singleton/database';
import { DocumentStatus } from '../enums/documentStatus';

// Attributi completi di un documento
export interface DocumentAttributes {
  id: number;
  userId: number;
  title: string;
  description: string;
  status: DocumentStatus;
  filePath: string | null;
  reportPath: string | null;
}

// In fase di creazione: id è auto-generato, status ha default 'pending', i path sono opzionali

export interface DocumentCreationAttributes extends Optional<DocumentAttributes, 'id' | 'status' | 'filePath' | 'reportPath'> {}
/**
 * Rappresenta un documento caricato nel sistema. Estende il modello Sequelize per interagire con la tabella 'documents' nel database.
 * Contiene informazioni sul documento, come titolo, descrizione, stato e percorsi dei file.
 * 
 * Attributi:
 * - id: Identificativo univoco del documento (auto-generato).
 * - userId: Identificativo dell'utente che ha caricato il documento.
 * - title: Titolo del documento.
 * - description: Descrizione del documento.
 * - status: Stato del documento (es. pending, approved, rejected).
 * - filePath: Percorso del file del documento.
 * - reportPath: Percorso del file del report generato.
 */
class Document extends Model<DocumentAttributes, DocumentCreationAttributes> implements DocumentAttributes {
  declare id: number;
  declare userId: number;
  declare title: string;
  declare description: string;
  declare status: DocumentStatus;
  declare filePath: string | null;
  declare reportPath: string | null;
}

/**
 * Inizializza il modello Document con i suoi attributi e le opzioni di configurazione.
 * @param sequelize L'istanza di Sequelize da utilizzare per la connessione al database.
 */
Document.init(
  {
    id:          { type: DataTypes.INTEGER,                           autoIncrement: true, primaryKey: true },
    userId:      { type: DataTypes.INTEGER,                           allowNull: false },
    title:       { type: DataTypes.STRING,                            allowNull: false },
    description: { type: DataTypes.TEXT,                              allowNull: false },
    status:      { type: DataTypes.ENUM(...Object.values(DocumentStatus)), allowNull: false, defaultValue: DocumentStatus.Pending },
    filePath:    { type: DataTypes.STRING(500),                       allowNull: true },
    reportPath:  { type: DataTypes.STRING(500),                       allowNull: true },
  },
  {
    sequelize: Database.getInstance(),
    tableName: 'documents',
    timestamps: true,
  }
);

export default Document;

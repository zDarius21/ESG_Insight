import { DataTypes, Model, Optional } from 'sequelize';
import Database from '../singleton/database';

// Attributi completi di un report
export interface ReportAttributes {
  id: number;
  documentId: number;
  userId: number;
  filePath: string;
}

// In fase di creazione l'id è auto-generato dal database
export interface ReportCreationAttributes extends Optional<ReportAttributes, 'id'> {}

/**
 * Rappresenta un report generato dall'analisi ESG di un documento. Estende il modello Sequelize per interagire con la tabella 'reports' nel database.
 * Contiene informazioni sul documento analizzato, l'utente che ha richiesto l'analisi e il percorso del file PDF generato.
 * 
 * Attributi:
 * - id: Identificativo univoco del report (auto-generato).
 * - documentId: Identificativo del documento analizzato.
 * - userId: Identificativo dell'utente che ha richiesto l'analisi.
 * - filePath: Percorso del file PDF generato dal report.
 */
class Report extends Model<ReportAttributes, ReportCreationAttributes> implements ReportAttributes {
  declare id: number;
  declare documentId: number;
  declare userId: number;
  declare filePath: string;
}

/**
 * Inizializza il modello Report con i suoi attributi e le opzioni di configurazione.
 * @param sequelize L'istanza di Sequelize da utilizzare per la connessione al database.
 */
Report.init(
  {
    id:         { type: DataTypes.INTEGER,      autoIncrement: true, primaryKey: true },
    documentId: { type: DataTypes.INTEGER,      allowNull: false },
    userId:     { type: DataTypes.INTEGER,      allowNull: false },
    filePath:   { type: DataTypes.STRING(500),  allowNull: false },
  },
  {
    sequelize: Database.getInstance(),
    tableName: 'reports',
    timestamps: true,
  }
);

export default Report;
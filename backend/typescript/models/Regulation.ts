import { DataTypes, Model, Optional } from 'sequelize';
import Database from '../singleton/database';

// Attributi completi di una normativa
export interface RegulationAttributes {
  id: number;
  name: string;
  description: string;
  version: string;
}

// In fase di creazione l'id è opzionale perché lo genera incrementalmente il database
export interface RegulationCreationAttributes extends Optional<RegulationAttributes, 'id'> {}
/**
 * Rappresenta una normativa del sistema. Estende il modello Sequelize per interagire con la tabella 'regulations' nel database.
 * Contiene informazioni sul nome, la descrizione e la versione della normativa.
 * 
 * Attributi:
 * - id: Identificativo univoco della normativa (auto-generato).
 * - name: Nome della normativa.
 * - description: Descrizione della normativa.
 * - version: Versione della normativa.
 */
class Regulation extends Model<RegulationAttributes, RegulationCreationAttributes> implements RegulationAttributes {
  declare id: number;
  declare name: string;
  declare description: string;
  declare version: string;
}

/**
 * Inizializza il modello Regulation con i suoi attributi e le opzioni di configurazione.
 * @param sequelize L'istanza di Sequelize da utilizzare per la connessione al database.
 */
 
Regulation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: false },
    version: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize: Database.getInstance(),
    tableName: 'regulations',
    timestamps: true,
  }
);

export default Regulation;
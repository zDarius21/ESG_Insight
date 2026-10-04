import { DataTypes, Model, Optional } from 'sequelize';
import Database from '../singleton/database';
import { Role } from '../enums/role';

// Attributi completi di un utente
export interface UserAttributes {
  id: number;
  email: string;
  password: string;
  role: Role;
  tokens: number;
}

// In fase di creazione id e tokens sono opzionali poichè creati automaticamente
export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'tokens'> {}

/**
 * Rappresenta un utente del sistema. Estende il modello Sequelize per interagire con la tabella 'users' nel database.
 * Contiene informazioni sull'email, la password, il ruolo e il numero di token disponibili per l'utente.
 * 
 * Attributi:
 * - id: Identificativo univoco dell'utente (auto-generato).
 * - email: Indirizzo email dell'utente.
 * - password: Password dell'utente.
 * - role: Ruolo dell'utente (es. admin, user).
 * - tokens: Numero di token disponibili per l'utente.
 */
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare email: string;
  declare password: string;
  declare role: Role;
  declare tokens: number;
}


/**
 * Inizializza il modello User con i suoi attributi e le opzioni di configurazione.
 * @param sequelize L'istanza di Sequelize da utilizzare per la connessione al database.
 * @returns void
 */
User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM(...Object.values(Role)), allowNull: false, defaultValue: Role.User },
    tokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  },
  {
    sequelize: Database.getInstance(),
    tableName: 'users',
    timestamps: true,
  }
);

export default User;
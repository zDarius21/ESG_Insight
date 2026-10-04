// Import dei messaggi di errore predefiniti
import { ErrorMessagesEnum } from '../enums/errorMessages';

// Interfaccia delle classi "error"
export interface ErrorObj {
  getErrorObj(): { status: number; message: string };
}

// Classi per errori di autenticazione e autorizzazione
class TokenMissing implements ErrorObj {
  getErrorObj() { return { status: 401, message: ErrorMessagesEnum.ERR_TOKEN_MISSING }; }
}
class TokenInvalid implements ErrorObj {
  getErrorObj() { return { status: 401, message: ErrorMessagesEnum.ERR_TOKEN_INVALID }; }
}
class Forbidden implements ErrorObj {
  getErrorObj() { return { status: 403, message: ErrorMessagesEnum.ERR_FORBIDDEN }; }
}

// Classi per errori di Login e Registrazione
class MissingEmailPassword implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_MISSING_EMAIL_PASSWORD }; }
}
class EmailAlreadyRegistered implements ErrorObj {
  getErrorObj() { return { status: 409, message: ErrorMessagesEnum.ERR_EMAIL_ALREADY_REGISTERED }; }
}
class InvalidCredentials implements ErrorObj {
  getErrorObj() { return { status: 401, message: ErrorMessagesEnum.ERR_INVALID_CREDENTIALS }; }
}

// Classi per errori relativi alle operazioni CRUD sugli utenti
class UserNotFound implements ErrorObj {
  getErrorObj() { return { status: 404, message: ErrorMessagesEnum.ERR_USER_NOT_FOUND }; }
}
class EmailPasswordRequired implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_EMAIL_PASSWORD_REQUIRED }; }
}
class EmailAlreadyUsed implements ErrorObj {
  getErrorObj() { return { status: 409, message: ErrorMessagesEnum.ERR_EMAIL_ALREADY_USED }; }
}
class EmailInUse implements ErrorObj {
  getErrorObj() { return { status: 409, message: ErrorMessagesEnum.ERR_EMAIL_IN_USE }; }
}

// Classi per errori relativi alle operazioni CRUD sui documenti
class DocumentNotFound implements ErrorObj {
  getErrorObj() { return { status: 404, message: ErrorMessagesEnum.ERR_DOCUMENT_NOT_FOUND }; }
}
class TitleDescriptionRequired implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_TITLE_DESCRIPTION_REQUIRED }; }
}
class DocumentAlreadyAnalyzed implements ErrorObj {
  getErrorObj() { return { status: 409, message: ErrorMessagesEnum.ERR_DOCUMENT_ALREADY_ANALYZED }; }
}

// Classi per errori relativi alle operazioni CRUD sulle normative
class RegulationNotFound implements ErrorObj {
  getErrorObj() { return { status: 404, message: ErrorMessagesEnum.ERR_REGULATION_NOT_FOUND }; }
}
class RegulationFieldsRequired implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_REGULATION_FIELDS_REQUIRED }; }
}
class RegulationAlreadyExists implements ErrorObj {
  getErrorObj() { return { status: 409, message: ErrorMessagesEnum.ERR_REGULATION_ALREADY_EXISTS }; }
}

// Classi per errori relativi alle operazioni su MinIO
class FileRequired implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_FILE_REQUIRED }; }
}
class InvalidFileType implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_INVALID_FILE_TYPE }; }
}
class FileNotAvailable implements ErrorObj {
  getErrorObj() { return { status: 404, message: ErrorMessagesEnum.ERR_FILE_NOT_AVAILABLE }; }
}
class ReportNotReady implements ErrorObj {
  getErrorObj() { return { status: 409, message: ErrorMessagesEnum.ERR_REPORT_NOT_READY }; }
}
class StorageError implements ErrorObj {
  getErrorObj() { return { status: 503, message: ErrorMessagesEnum.ERR_STORAGE_ERROR }; }
}
class AnalysisNotFound implements ErrorObj {
  getErrorObj() { return { status: 404, message: ErrorMessagesEnum.ERR_ANALYSIS_NOT_FOUND }; }
}
class ReportNotFound implements ErrorObj {
  getErrorObj() { return { status: 404, message: ErrorMessagesEnum.ERR_REPORT_NOT_FOUND }; }
}
class InsufficientTokens implements ErrorObj {
  getErrorObj() { return { status: 402, message: ErrorMessagesEnum.ERR_INSUFFICIENT_TOKENS }; }
}

class DatabaseError implements ErrorObj {
  getErrorObj() { return { status: 500, message: ErrorMessagesEnum.ERR_DATABASE_ERROR }; }
}
class NothingToUpdate implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_NOTHING_TO_UPDATE }; }
}
class InvalidTokenAmount implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_INVALID_TOKEN_AMOUNT }; }
}
class TokenCapExceeded implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_TOKEN_CAP_EXCEEDED }; }
}
class ValidationError implements ErrorObj {
  getErrorObj() { return { status: 400, message: ErrorMessagesEnum.ERR_VALIDATION }; }
}

// Classi per errori relativi all'analisi tramite il motore AI
class AnalysisInProgress implements ErrorObj {
  getErrorObj() { return { status: 409, message: ErrorMessagesEnum.ERR_ANALYSIS_IN_PROGRESS }; }
}
class DocumentNotReadable implements ErrorObj {
  getErrorObj() { return { status: 422, message: ErrorMessagesEnum.ERR_DOCUMENT_NOT_READABLE }; }
}
class AiEngineUnavailable implements ErrorObj {
  getErrorObj() { return { status: 503, message: ErrorMessagesEnum.ERR_AI_ENGINE_UNAVAILABLE }; }
}
class AiEngineError implements ErrorObj {
  getErrorObj() { return { status: 502, message: ErrorMessagesEnum.ERR_AI_ENGINE_ERROR }; }
}

// Enum con tutti i tipi di errore
export enum ErrorEnum {
  TokenMissing             = 'TokenMissing',
  TokenInvalid             = 'TokenInvalid',
  Forbidden                = 'Forbidden',
  MissingEmailPassword     = 'MissingEmailPassword',
  EmailAlreadyRegistered   = 'EmailAlreadyRegistered',
  InvalidCredentials       = 'InvalidCredentials',
  UserNotFound             = 'UserNotFound',
  EmailPasswordRequired    = 'EmailPasswordRequired',
  EmailAlreadyUsed         = 'EmailAlreadyUsed',
  EmailInUse               = 'EmailInUse',
  DocumentNotFound         = 'DocumentNotFound',
  TitleDescriptionRequired = 'TitleDescriptionRequired',
  DocumentAlreadyAnalyzed  = 'DocumentAlreadyAnalyzed',
  RegulationNotFound       = 'RegulationNotFound',
  RegulationFieldsRequired = 'RegulationFieldsRequired',
  RegulationAlreadyExists  = 'RegulationAlreadyExists',
  FileRequired             = 'FileRequired',
  InvalidFileType          = 'InvalidFileType',
  FileNotAvailable         = 'FileNotAvailable',
  ReportNotReady           = 'ReportNotReady',
  StorageError             = 'StorageError',
  AnalysisNotFound         = 'AnalysisNotFound',
  ReportNotFound           = 'ReportNotFound',
  InsufficientTokens       = 'InsufficientTokens',
  DatabaseError            = 'DatabaseError',
  NothingToUpdate          = 'NothingToUpdate',
  InvalidTokenAmount       = 'InvalidTokenAmount',
  TokenCapExceeded         = 'TokenCapExceeded',
  ValidationError          = 'ValidationError',
  AnalysisInProgress       = 'AnalysisInProgress',
  DocumentNotReadable      = 'DocumentNotReadable',
  AiEngineUnavailable      = 'AiEngineUnavailable',
  AiEngineError            = 'AiEngineError',
}

// Funzione che riceve il tipo di enum di errore e restituisce l'istanza della classe corrispondente
export function getError(type: ErrorEnum): ErrorObj {
  switch (type) {
    case ErrorEnum.TokenMissing:             return new TokenMissing();
    case ErrorEnum.TokenInvalid:             return new TokenInvalid();
    case ErrorEnum.Forbidden:                return new Forbidden();
    case ErrorEnum.MissingEmailPassword:     return new MissingEmailPassword();
    case ErrorEnum.EmailAlreadyRegistered:   return new EmailAlreadyRegistered();
    case ErrorEnum.InvalidCredentials:       return new InvalidCredentials();
    case ErrorEnum.UserNotFound:             return new UserNotFound();
    case ErrorEnum.EmailPasswordRequired:    return new EmailPasswordRequired();
    case ErrorEnum.EmailAlreadyUsed:         return new EmailAlreadyUsed();
    case ErrorEnum.EmailInUse:               return new EmailInUse();
    case ErrorEnum.DocumentNotFound:         return new DocumentNotFound();
    case ErrorEnum.TitleDescriptionRequired: return new TitleDescriptionRequired();
    case ErrorEnum.DocumentAlreadyAnalyzed:  return new DocumentAlreadyAnalyzed();
    case ErrorEnum.RegulationNotFound:       return new RegulationNotFound();
    case ErrorEnum.RegulationFieldsRequired: return new RegulationFieldsRequired();
    case ErrorEnum.RegulationAlreadyExists:  return new RegulationAlreadyExists();
    case ErrorEnum.FileRequired:             return new FileRequired();
    case ErrorEnum.InvalidFileType:          return new InvalidFileType();
    case ErrorEnum.FileNotAvailable:         return new FileNotAvailable();
    case ErrorEnum.ReportNotReady:           return new ReportNotReady();
    case ErrorEnum.StorageError:             return new StorageError();
    case ErrorEnum.AnalysisNotFound:         return new AnalysisNotFound();
    case ErrorEnum.ReportNotFound:           return new ReportNotFound();
    case ErrorEnum.InsufficientTokens:       return new InsufficientTokens();
    case ErrorEnum.DatabaseError:            return new DatabaseError();
    case ErrorEnum.NothingToUpdate:          return new NothingToUpdate();
    case ErrorEnum.InvalidTokenAmount:       return new InvalidTokenAmount();
    case ErrorEnum.TokenCapExceeded:         return new TokenCapExceeded();
    case ErrorEnum.ValidationError:          return new ValidationError();
    case ErrorEnum.AnalysisInProgress:       return new AnalysisInProgress();
    case ErrorEnum.DocumentNotReadable:      return new DocumentNotReadable();
    case ErrorEnum.AiEngineUnavailable:      return new AiEngineUnavailable();
    case ErrorEnum.AiEngineError:            return new AiEngineError();
    default: throw new Error(`Errore sconosciuto: ${type}`);
  }
}

// Errore custom che porta status HTTP e messaggio dalla factory
// Usata nei DAO e middleware per propagare errori senza accesso a res
export class AppError extends Error {
  readonly status: number;

  constructor(type: ErrorEnum) {
    const { status, message } = getError(type).getErrorObj();
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

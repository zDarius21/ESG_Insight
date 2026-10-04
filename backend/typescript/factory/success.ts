import { SuccessEnum } from '../enums/success';

// Interfaccia delle classi "success"
export interface SuccessObj {
  getSuccessObj(): { status: number };
}

// Classi per Login e Registrazione
class UserRegistered implements SuccessObj {
  getSuccessObj() { return { status: 201 }; }
}
class UserLoggedIn implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}

// Classi relative alle operazioni CRUD sugli utenti
class UsersFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class UserFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class UserCreated implements SuccessObj {
  getSuccessObj() { return { status: 201 }; }
}
class UserUpdated implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class UserDeleted implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}

// Classi relative alle operazioni CRUD sui documenti
class DocumentsFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class DocumentFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class DocumentCreated implements SuccessObj {
  getSuccessObj() { return { status: 201 }; }
}
class DocumentUpdated implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class DocumentDeleted implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class DocumentAnalyzed implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}

// Classi relative alle operazioni CRUD sulle normative
class RegulationsFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class RegulationFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class RegulationCreated implements SuccessObj {
  getSuccessObj() { return { status: 201 }; }
}
class RegulationUpdated implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class RegulationDeleted implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class AnalysesFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}

class AnalysisFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class TokensFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class ProfileFetched implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class ProfileUpdated implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}
class TokensRecharged implements SuccessObj {
  getSuccessObj() { return { status: 200 }; }
}

// Funzione che riceve il tipo di enum di successo e restituisce l'istanza della classe corrispondente
export function getSuccess(type: SuccessEnum): SuccessObj {
  switch (type) {
    case SuccessEnum.UserRegistered:     return new UserRegistered();
    case SuccessEnum.UserLoggedIn:       return new UserLoggedIn();
    case SuccessEnum.UsersFetched:       return new UsersFetched();
    case SuccessEnum.UserFetched:        return new UserFetched();
    case SuccessEnum.UserCreated:        return new UserCreated();
    case SuccessEnum.UserUpdated:        return new UserUpdated();
    case SuccessEnum.UserDeleted:        return new UserDeleted();
    case SuccessEnum.DocumentsFetched:   return new DocumentsFetched();
    case SuccessEnum.DocumentFetched:    return new DocumentFetched();
    case SuccessEnum.DocumentCreated:    return new DocumentCreated();
    case SuccessEnum.DocumentUpdated:    return new DocumentUpdated();
    case SuccessEnum.DocumentDeleted:    return new DocumentDeleted();
    case SuccessEnum.DocumentAnalyzed:   return new DocumentAnalyzed();
    case SuccessEnum.RegulationsFetched: return new RegulationsFetched();
    case SuccessEnum.RegulationFetched:  return new RegulationFetched();
    case SuccessEnum.RegulationCreated:  return new RegulationCreated();
    case SuccessEnum.RegulationUpdated:  return new RegulationUpdated();
    case SuccessEnum.RegulationDeleted:  return new RegulationDeleted();
    case SuccessEnum.AnalysesFetched:    return new AnalysesFetched();
    case SuccessEnum.AnalysisFetched:    return new AnalysisFetched();
    case SuccessEnum.TokensFetched:      return new TokensFetched();
    case SuccessEnum.ProfileFetched:     return new ProfileFetched();
    case SuccessEnum.ProfileUpdated:     return new ProfileUpdated();
    case SuccessEnum.TokensRecharged:    return new TokensRecharged();
  }
}

# Programmazione Avanzata — Document Compliance Checker

## Indice

| Sezione | Contenuto |
|--------|-----------|
| [Obiettivo del Progetto](#obiettivo-del-progetto) | Scopo del backend e funzionalita principali |
| [Diagramma dei Casi d'Uso](#diagramma-dei-casi-duso) | Attori e interazioni principali con il sistema |
| [Rotte Disponibili](#rotte-disponibili) | Panoramica completa degli endpoint |
| [Autenticazione](#autenticazione) | Login e registrazione |
| [Utenti](#utenti) | CRUD utenti e gestione token |
| [Normative](#normative) | Catalogo normative e operazioni admin |
| [Documenti](#documenti) | Gestione metadati e avvio analisi |
| [Analisi](#analisi) | Recupero analisi precedenti |
| [Report](#report) | Download report generati |
| [Design Pattern Implementati](#design-pattern-implementati) | Pattern architetturali usati |
| [Avvio del Servizio](#avvio-del-servizio) | Esecuzione locale con Docker |
| [Testing](#testing) | Collection Postman ed environment |
| [Note](#note) | Software e tecnologie usate |
| [Autore](#autore) | Team e riferimenti GitHub |

## Obiettivo del Progetto
Il progetto consiste nell'implementare il backend del progetto realizzato per l'Hack-AI-Thon, volto a verificare la conformità di documenti rispetto a normative ESG.
Gli utenti autenticati possono caricare i metadati di un documento e richiederne l'analisi: il sistema produce un'`Analysis` con i relativi `ComplianceResult`, esportabile come report.

Le operazioni principali sono:
* Autenticazione e registrazione con rilascio di JWT firmati in RS256
* Gestione utenti (solo admin)
* Gestione del catalogo normative (lettura pubblica, scrittura solo admin)
* Gestione dei metadati dei documenti e avvio analisi
* Consultazione delle analisi e dei risultati di conformità
* Recupero e download dei report

## Diagramma dei Casi d'Uso

Il diagramma mostra i tre attori del sistema e le operazioni che ciascuno può compiere. L'**Admin** eredita tutti i casi d'uso dell'**Utente autenticato** e ha accesso esclusivo alle operazioni di gestione.

![Diagramma dei Casi d'Uso](res/use_case_diagram.svg)

## Rotte Disponibili

### Autenticazione

Le **rotte di autenticazione** permettono all'utente di registrarsi e di effettuare il login.

| METODO | ROTTA | JWT RICHIESTO | DESCRIZIONE |
|--------|-------|---------------|-------------|
| `POST` | /auth/register | No | Registra un nuovo utente e restituisce un token JWT |
| `POST` | /auth/login | No | Verifica le credenziali e restituisce un token JWT |
| `GET` | /auth/me | Si | Restituisce all'utente le proprie informazioni |
| `PATCH` | /auth/me | Si | Permette all'utente di modificare le proprie informazioni |

---

#### POST /auth/register

Registra un nuovo utente nel sistema assegnandogli automaticamente il ruolo `user`. Dopo la registrazione avvenuta con successo, viene restituito un token JWT pronto all'uso.

**Body richiesta:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
> La password deve contenere almeno 8 caratteri.

**Errori possibili:**
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_EMAIL_ALREADY_REGISTERED` — Email già registrata

**Successo:** `201 Created` — Ritorna il token JWT e il ruolo `user`

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/auth/register
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as AuthController
    participant DAO as UserDAO
    participant DB@{ "type": "database" } as Database
    participant JWT as JWT (RS256)

    Client->>+Router: POST /auth/register<br/>{ email, password }

    Router->>+Validate: validate({ body: registerSchema })

    rect rgb(255, 240, 240)
        note over Validate: Valida body (email valida,<br/>password >= 8 caratteri)
        alt email non valida o password troppo corta
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
    end

    Validate->>+Controller: register(req, res)

    Controller->>+DAO: findByEmail(email)
    DAO->>+DB: SELECT * FROM users<br/>WHERE email = ?
    DB-->>-DAO: User | null
    DAO-->>-Controller: User | null

    rect rgb(255, 240, 240)
        alt email gia registrata
            Controller-->>Client: ERR_EMAIL_ALREADY_REGISTERED<br/>{ error: "Email già registrata" }
        end
    end

    rect rgb(240, 255, 240)
        note over Controller,DB: Creazione utente (sempre Role.User)
        Controller->>+JWT: bcrypt.hash(password, 10)
        JWT-->>-Controller: hashedPassword

        Controller->>+DAO: create({ email, password: hashed, role: Role.User })
        DAO->>+DB: INSERT INTO users (...)
        DB-->>-DAO: User
        DAO-->>-Controller: User

        Controller->>+JWT: jwt.sign({ id, email, role },<br/>privateKey, { algorithm: RS256,<br/>expiresIn: JWT_EXPIRES_IN })
        JWT-->>-Controller: accessToken
    end

    Controller-->>-Validate: { token, role }
    Validate-->>-Router: { token, role }
    Router-->>-Client: 201 Created<br/>{ token: "eyJ...", role: "user" }
```

---

#### POST /auth/login

Verifica le credenziali dell'utente e, se corrette, restituisce un token JWT firmato in RS256 da utilizzare nelle richieste successive.

**Body richiesta:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Errori possibili:**
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_INVALID_CREDENTIALS` — Credenziali non valide

**Successo:** `200 OK` — Ritorna il token JWT e il ruolo dell'utente

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/auth/login
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as AuthController
    participant DAO as UserDAO
    participant DB@{ "type": "database" } as Database
    participant JWT as JWT (RS256)

    Client->>+Router: POST /auth/login<br/>{ email, password }

    Router->>+Validate: validate({ body: loginSchema })

    rect rgb(255, 240, 240)
        note over Validate: Valida body (email valida,<br/>password non vuota)
        alt email non valida o password mancante
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
    end

    Validate->>+Controller: login(req, res)

    Controller->>+DAO: findByEmail(email)
    DAO->>+DB: SELECT * FROM users<br/>WHERE email = ?
    DB-->>-DAO: User | null
    DAO-->>-Controller: User | null

    rect rgb(255, 240, 240)
        alt utente non trovato
            Controller-->>Client: ERR_INVALID_CREDENTIALS<br/>{ error: "Credenziali non valide" }
        end
    end

    Controller->>+JWT: bcrypt.compare(password, user.password)
    JWT-->>-Controller: boolean

    rect rgb(255, 240, 240)
        alt password errata
            Controller-->>Client: ERR_INVALID_CREDENTIALS<br/>{ error: "Credenziali non valide" }
        end
    end

    rect rgb(240, 255, 240)
        note over Controller,JWT: Autenticazione riuscita
        Controller->>+JWT: jwt.sign({ id, email, role },<br/>privateKey, { algorithm: RS256,<br/>expiresIn: JWT_EXPIRES_IN })
        JWT-->>-Controller: accessToken
    end

    Controller-->>-Validate: { token, role }
    Validate-->>-Router: { token, role }
    Router-->>-Client: 200 OK<br/>{ token: "eyJ...", role: "..." }
```

---

#### GET /auth/me

Restituisce le informazioni del profilo dell'utente autenticato (email, ruolo, token rimanenti).


**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_USER_NOT_FOUND` — Utente non trovato

**Successo:** `200 OK` — Ritorna `{ id, email, role, tokens }`

---

#### PATCH /auth/me

Permette all'utente autenticato di aggiornare il proprio profilo (email e/o password).


**Body richiesta** (almeno un campo):
```json
{
  "email": "nuova@email.com",
  "password": "nuovaPassword123"
}
```

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_USER_NOT_FOUND` — Utente non trovato
- `ERR_EMAIL_IN_USE` — Email già in uso

**Successo:** `200 OK` — Ritorna i dati aggiornati dell'utente

---

### Utenti

Le **rotte relative agli utenti** permettono all'**admin** di effettuare operazioni **CRUD** relativamente alle informazioni degli utenti.

| METODO | ROTTA | JWT RICHIESTO | DESCRIZIONE |
|--------|-------|---------------|-------------|
| `GET` | /users | Sì (admin) | Restituisce la lista di tutti gli utenti |
| `GET` | /users/:id | Sì (admin) | Restituisce i dati di un singolo utente |
| `POST` | /users | Sì (admin) | Crea un nuovo utente |
| `PATCH` | /users/:id | Sì (admin) | Modifica i dati di un utente esistente |
| `DELETE` | /users/:id | Sì (admin) | Elimina un utente |
| `GET` | /users/token | Sì | Restituisce il numero di token rimanenti all'utente |
| `POST` | /users/:id/token | Sì (admin) | Permette all'admin di aggiungere token ad un utente |

---

#### GET /users

Restituisce la lista completa di tutti gli utenti registrati nel sistema. Accessibile solo agli amministratori.



**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin

**Successo:** `200 OK` — Ritorna un array di `{ id, email, role, tokens }`

---

#### GET /users/:id

Restituisce i dati di un singolo utente dato il suo `id`. Accessibile solo agli amministratori.



**Parametri URL:**
- `id` — intero positivo, identificatore dell'utente

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_USER_NOT_FOUND` — Utente non trovato

**Successo:** `200 OK` — Ritorna `{ id, email, role, tokens }`

---

#### POST /users

Crea un nuovo utente nel sistema. Operazione riservata agli amministratori. Il ruolo assegnato di default è `user`.


**Body richiesta:**
```json
{
  "email": "nuovo@utente.com",
  "password": "password123"
}
```

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_EMAIL_ALREADY_USED` — Email già utilizzata

**Successo:** `201 Created` — Ritorna `{ id, email, role: "user" }`

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/users
    participant Auth as authenticate<br/>(JWT RS256)
    participant Role as requireAdmin
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as UserController
    participant DAO as UserDAO
    participant DB@{ "type": "database" } as Database

    Client->>+Router: POST /users<br/>Authorization: Bearer token<br/>{ email, password }

    rect rgb(255, 240, 240)
        note over Auth,Validate: Chain of Responsibility (middleware)
        Router->>+Auth: authenticate(req, res, next)
        alt token mancante o non valido
            Auth-->>Client: ERR_TOKEN_MISSING / ERR_TOKEN_INVALID<br/>{ error: "Token mancante / non valido o scaduto" }
        end
        Auth-->>-Router: req.user

        Router->>+Role: requireAdmin(req, res, next)
        alt ruolo != Role.Admin
            Role-->>Client: ERR_FORBIDDEN<br/>{ error: "Accesso riservato agli admin" }
        end
        Role-->>-Router: next()

        Router->>+Validate: validate({ body: createUserSchema })
        alt email non valida o password < 8 caratteri
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
        Validate-->>-Router: next()
    end

    Router->>+Controller: createUser(req, res)

    Controller->>+DAO: findByEmail(email)
    DAO->>+DB: SELECT * FROM users<br/>WHERE email = ?
    DB-->>-DAO: User | null
    DAO-->>-Controller: User | null

    rect rgb(255, 240, 240)
        alt email gia in uso
            Controller-->>Client: ERR_EMAIL_ALREADY_USED<br/>{ error: "Email già utilizzata" }
        end
    end

    rect rgb(240, 255, 240)
        note over Controller,DB: Creazione utente
        Controller->>Controller: bcrypt.hash(password, 10)
        Controller->>+DAO: create({ email, password: hashed, role: Role.User })
        DAO->>+DB: INSERT INTO users (...)
        DB-->>-DAO: User
        DAO-->>-Controller: User
    end

    Controller-->>-Router: { id, email, role }
    Router-->>-Client: 201 Created<br/>{ id, email, role: "user" }
```

---

#### PATCH /users/:id

Aggiorna i dati di un utente esistente (email, password, ruolo). Operazione riservata agli amministratori. Il ruolo può essere promosso solo da `user` ad `admin` e non viceversa.


**Parametri URL:**
- `id` — intero positivo, identificatore dell'utente

**Body richiesta** (almeno un campo):
```json
{
  "email": "aggiornata@email.com",
  "password": "nuovaPassword123",
  "role": "admin"
}
```

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_USER_NOT_FOUND` — Utente non trovato
- `ERR_EMAIL_IN_USE` — Email già in uso

**Successo:** `200 OK` — Ritorna `{ id, email, role }`

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/users/:id
    participant Auth as authenticate<br/>(JWT RS256)
    participant Role as requireAdmin
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as UserController
    participant DAO as UserDAO
    participant DB@{ "type": "database" } as Database

    Client->>+Router: PATCH /users/:id<br/>Authorization: Bearer token<br/>{ email?, password?, role? }

    rect rgb(255, 240, 240)
        note over Auth,Validate: Chain of Responsibility (middleware)
        Router->>+Auth: authenticate(req, res, next)
        alt token mancante o non valido
            Auth-->>Client: ERR_TOKEN_MISSING / ERR_TOKEN_INVALID<br/>{ error: "Token mancante / non valido o scaduto" }
        end
        Auth-->>-Router: req.user

        Router->>+Role: requireAdmin(req, res, next)
        alt ruolo != Role.Admin
            Role-->>Client: ERR_FORBIDDEN<br/>{ error: "Accesso riservato agli admin" }
        end
        Role-->>-Router: next()

        Router->>+Validate: validate({ params: idParamSchema,<br/>body: updateUserSchema })
        alt id non intero, body vuoto o role non valido
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
        Validate-->>-Router: next()
    end

    Router->>+Controller: updateUser(req, res)

    Controller->>+DAO: findByIdFull(req.params.id)
    DAO->>+DB: SELECT * FROM users<br/>WHERE id = ?
    DB-->>-DAO: User | null
    DAO-->>-Controller: User | null

    rect rgb(255, 240, 240)
        alt utente non trovato
            Controller-->>Client: ERR_USER_NOT_FOUND<br/>{ error: "Utente non trovato" }
        end
    end

    rect rgb(240, 240, 255)
        note over Controller,DB: Aggiornamento campi (solo se presenti)
        alt email presente
            Controller->>+DAO: findByEmail(email)
            DAO->>+DB: SELECT * FROM users<br/>WHERE email = ?
            DB-->>-DAO: User | null
            DAO-->>-Controller: User | null
            alt email gia in uso da altro utente
                Controller-->>Client: ERR_EMAIL_IN_USE<br/>{ error: "Email già in uso" }
            end
            Controller->>Controller: user.email = email
        end

        alt password presente
            Controller->>Controller: user.password = bcrypt.hash(password, 10)
        end

        alt role == Role.Admin e ruolo attuale == Role.User
            Controller->>Controller: user.role = Role.Admin
        end
    end

    rect rgb(240, 255, 240)
        Controller->>+DAO: user.save()
        DAO->>+DB: UPDATE users SET ...<br/>WHERE id = ?
        DB-->>-DAO: User
        DAO-->>-Controller: User
    end

    Controller-->>-Router: { id, email, role }
    Router-->>-Client: 200 OK<br/>{ id, email, role }
```

---

#### DELETE /users/:id

Elimina definitivamente un utente dal sistema. Operazione riservata agli amministratori.



**Parametri URL:**
- `id` — intero positivo, identificatore dell'utente

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_USER_NOT_FOUND` — Utente non trovato

**Successo:** `200 OK` — Conferma dell'eliminazione

---

#### GET /users/token

Restituisce il numero di token rimanenti dell'utente autenticato.


**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_USER_NOT_FOUND` — Utente non trovato

**Successo:** `200 OK` — Ritorna `{ tokens: <numero> }`

---

#### POST /users/:id/token

Aggiunge token all'account di un utente specifico. Operazione riservata agli amministratori.


**Parametri URL:**
- `id` — intero positivo, identificatore dell'utente

**Body richiesta:**
```json
{
  "amount": 50
}
```

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_USER_NOT_FOUND` — Utente non trovato
- `ERR_TOKEN_CAP_EXCEEDED` — La ricarica supera il massimo consentito di 100 token

**Successo:** `200 OK` — Ritorna i token aggiornati dell'utente

---

### Normative

Le **rotte delle normative** permettono agli utenti di ottenere la lista delle normative e all'admin di poter modificare quest'ultima.

| METODO | ROTTA | JWT RICHIESTO | DESCRIZIONE |
|--------|-------|---------------|-------------|
| `GET` | /regulations | Sì | Restituisce la lista di tutte le normative |
| `GET` | /regulations/:id | Sì | Restituisce i dettagli di una singola normativa |
| `POST` | /regulations | Sì (admin) | Aggiunge una nuova normativa al catalogo |
| `PATCH` | /regulations/:id | Sì (admin) | Modifica una normativa esistente |
| `DELETE` | /regulations/:id | Sì (admin) | Elimina una normativa dal catalogo |

---

#### GET /regulations

Restituisce la lista completa di tutte le normative presenti nel catalogo.


**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto

**Successo:** `200 OK` — Ritorna un array di `{ id, name, version, description }`

---

#### GET /regulations/:id

Restituisce i dettagli di una singola normativa dato il suo `id`.



**Parametri URL:**
- `id` — intero positivo, identificatore della normativa

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_REGULATION_NOT_FOUND` — Normativa non trovata

**Successo:** `200 OK` — Ritorna `{ id, name, version, description }`

---

#### POST /regulations

Aggiunge una nuova normativa al catalogo. La descrizione può essere fornita direttamente nel body oppure estratta automaticamente da un file PDF allegato. Operazione riservata agli amministratori.



**Body richiesta** (`multipart/form-data`):
```
name        → nome della normativa (es. "ISO 14001")
version     → versione (es. "2015")
file        → (opzionale) file PDF da cui estrarre la descrizione
```
> Se non viene allegato un PDF, il campo `description` deve essere incluso nel body.

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin
- `ERR_INVALID_FILE_TYPE` — Solo file PDF sono accettati
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_REGULATION_FIELDS_REQUIRED` — name, description e version sono obbligatori
- `ERR_REGULATION_ALREADY_EXISTS` — Normativa già esistente

**Successo:** `201 Created` — Ritorna `{ id, name, version, description }`

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/regulations
    participant Auth as authenticate<br/>(JWT RS256)
    participant Role as requireAdmin
    participant Upload as uploadPdf<br/>(multer memoryStorage)
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as RegulationController
    participant PDF as PDFParse<br/>(pdf-parse)
    participant DAO as RegulationDAO
    participant DB@{ "type": "database" } as Database

    Client->>+Router: POST /regulations<br/>Authorization: Bearer token<br/>multipart/form-data { name, version, file? }

    rect rgb(255, 240, 240)
        note over Auth,Validate: Chain of Responsibility (middleware)
        Router->>+Auth: authenticate(req, res, next)
        alt token mancante o non valido
            Auth-->>Client: ERR_TOKEN_MISSING / ERR_TOKEN_INVALID<br/>{ error: "Token mancante / non valido o scaduto" }
        end
        Auth-->>-Router: req.user

        Router->>+Role: requireAdmin(req, res, next)
        alt ruolo != Role.Admin
            Role-->>Client: ERR_FORBIDDEN<br/>{ error: "Accesso riservato agli admin" }
        end
        Role-->>-Router: next()

        Router->>+Upload: uploadPdf(req, res, next)
        alt file non PDF o > 10MB
            Upload-->>Client: ERR_INVALID_FILE_TYPE<br/>{ error: "Solo file PDF sono accettati" }
        end
        Upload-->>-Router: req.file (buffer in RAM)

        Router->>+Validate: validate({ body: createRegulationSchema })
        alt name o version mancanti
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
        Validate-->>-Router: next()
    end

    Router->>+Controller: createRegulation(req, res)

    rect rgb(240, 240, 255)
        note over Controller,PDF: Estrazione testo dal PDF (se allegato)
        alt req.file presente
            Controller->>+PDF: getText({ data: req.file.buffer })
            PDF-->>-Controller: description = result.text.trim()
        end
    end

    rect rgb(255, 240, 240)
        note over Controller: description obbligatoria (dal body o dal PDF)
        alt description mancante
            Controller-->>Client: ERR_REGULATION_FIELDS_REQUIRED<br/>{ error: "name, description e version sono obbligatori" }
        end
    end

    Controller->>+DAO: findByName(name)
    DAO->>+DB: SELECT * FROM regulations<br/>WHERE name = ?
    DB-->>-DAO: Regulation | null
    DAO-->>-Controller: Regulation | null

    rect rgb(255, 240, 240)
        alt normativa gia esistente
            Controller-->>Client: ERR_REGULATION_ALREADY_EXISTS<br/>{ error: "Normativa già esistente" }
        end
    end

    rect rgb(240, 255, 240)
        note over Controller,DB: Creazione normativa
        Controller->>+DAO: create({ name, description, version })
        DAO->>+DB: INSERT INTO regulations (...)
        DB-->>-DAO: Regulation
        DAO-->>-Controller: Regulation
    end

    Controller-->>-Router: Regulation
    Router-->>-Client: 201 Created<br/>{ id, name, version, description }
```

---

#### PATCH /regulations/:id

Aggiorna i campi di una normativa esistente (nome, descrizione, versione). Operazione riservata agli amministratori.


**Parametri URL:**
- `id` — intero positivo, identificatore della normativa

**Body richiesta** (almeno un campo):
```json
{
  "name": "ISO 14001 aggiornata",
  "description": "Nuova descrizione",
  "version": "2024"
}
```

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_REGULATION_NOT_FOUND` — Normativa non trovata

**Successo:** `200 OK` — Ritorna la normativa aggiornata

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/regulations/:id
    participant Auth as authenticate<br/>(JWT Middleware)
    participant Role as requireAdmin<br/>(Role Middleware)
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as RegulationController
    participant DAO as RegulationDAO
    participant DB@{ shape: "database" } as Database

    Client->>+Router: PATCH /regulations/:id<br/>Authorization: Bearer token<br/>{ name?, description?, version? }

    Router->>+Auth: authenticate(req, res, next)

    rect rgb(255, 240, 240)
        note over Auth: Verifica JWT
        alt token mancante o non valido
            Auth-->>Client: ERR_TOKEN_MISSING / ERR_TOKEN_INVALID<br/>{ error: "Token mancante / non valido o scaduto" }
        end
    end

    Auth->>+Role: requireAdmin(req, res, next)

    rect rgb(255, 240, 240)
        alt ruolo != Role.Admin
            Role-->>Client: ERR_FORBIDDEN<br/>{ error: "Accesso riservato agli admin" }
        end
    end

    Role->>+Validate: validate({ params: idParamSchema,<br/>body: updateRegulationSchema })

    rect rgb(255, 240, 240)
        note over Validate: Valida :id (intero) e body<br/>(almeno un campo, non vuoti)
        alt id non intero o body vuoto
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
    end

    Validate->>+Controller: updateRegulation(req, res)

    Controller->>+DAO: findById(req.params.id)
    DAO->>+DB: SELECT * FROM regulations<br/>WHERE id = ?
    DB-->>-DAO: Regulation | null
    DAO-->>-Controller: Regulation | null

    rect rgb(255, 240, 240)
        alt normativa non trovata
            Controller-->>Client: ERR_REGULATION_NOT_FOUND<br/>{ error: "Normativa non trovata" }
        end
    end

    rect rgb(240, 255, 240)
        note over Controller,DB: Aggiornamento normativa
        Controller->>+DAO: regulation.update({ name, description, version })
        DAO->>+DB: UPDATE regulations SET<br/>name, description, version WHERE id = ?
        DB-->>-DAO: ok
        DAO-->>-Controller: Regulation aggiornata
    end

    Controller-->>-Validate: { regulation }
    Validate-->>-Role: { regulation }
    Role-->>-Auth: { regulation }
    Auth-->>-Router: { regulation }
    Router-->>-Client: 200 OK<br/>{ regulation }
```

---

#### DELETE /regulations/:id

Elimina definitivamente una normativa dal catalogo. Operazione riservata agli amministratori.



**Parametri URL:**
- `id` — intero positivo, identificatore della normativa

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_FORBIDDEN` — Accesso riservato agli admin
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_REGULATION_NOT_FOUND` — Normativa non trovata

**Successo:** `200 OK` — Conferma dell'eliminazione

---

### Documenti

Le **rotte dei documenti** permettono agli utenti di ottenere ed inviare nuovi documenti per l'analisi.

| METODO | ROTTA | JWT RICHIESTO | DESCRIZIONE |
|--------|-------|---------------|-------------|
| `GET` | /documents | Sì | Restituisce la lista dei documenti dell'utente |
| `GET` | /documents/:id | Sì | Restituisce i dettagli di un singolo documento |
| `GET` | /documents/:id/file | Sì | Scarica il file PDF originale del documento |
| `POST` | /documents | Sì | Carica i metadati di un nuovo documento |
| `PATCH` | /documents/:id | Sì | Modifica i metadati di un documento esistente |
| `DELETE` | /documents/:id | Sì | Elimina un documento |
| `POST` | /documents/:id/analyze | Sì | Avvia l'analisi di conformità su un documento |

---

#### GET /documents

Restituisce la lista di tutti i documenti caricati dall'utente autenticato.



**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto

**Successo:** `200 OK` — Ritorna un array di `{ id, title, description, status, createdAt }`

---

#### GET /documents/:id

Restituisce i dettagli di un singolo documento dell'utente autenticato.



**Parametri URL:**
- `id` — intero positivo, identificatore del documento

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_DOCUMENT_NOT_FOUND` — Documento non trovato

**Successo:** `200 OK` — Ritorna `{ id, title, description, status, filePath, createdAt }`

---

#### GET /documents/:id/file

Scarica il file PDF originale associato a un documento dell'utente. Il file viene recuperato da MinIO e restituito come stream.



**Parametri URL:**
- `id` — intero positivo, identificatore del documento

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_DOCUMENT_NOT_FOUND` — Documento non trovato
- `ERR_FILE_NOT_AVAILABLE` — Il file originale non è disponibile per questo documento
- `ERR_STORAGE_ERROR` — Errore durante l'operazione sul file storage

**Successo:** `200 OK` — Ritorna il file PDF con `Content-Type: application/pdf`

---

#### POST /documents

Carica un nuovo documento nel sistema. Il file PDF viene salvato su MinIO in maniera atomica: se l'upload fallisce, la riga nel database viene annullata tramite rollback della transazione.



**Body richiesta** (`multipart/form-data`):
```
title       → titolo del documento (stringa non vuota)
description → descrizione del documento (stringa non vuota)
file        → file PDF (max 10 MB)
```

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_INVALID_FILE_TYPE` — Solo file PDF sono accettati
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_FILE_REQUIRED` — Il file PDF è obbligatorio
- `ERR_STORAGE_ERROR` — Errore durante l'operazione sul file storage

**Successo:** `201 Created` — Ritorna i metadati del documento creato

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/documents
    participant Auth as authenticate<br/>(JWT Middleware)
    participant Upload as uploadPdf<br/>(Multer)
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as DocumentController
    participant DAO as DocumentDAO
    participant DB@{ shape: "database" } as Database
    participant Minio as MinIO Storage

    Client->>+Router: POST /documents<br/>multipart/form-data<br/>{ title, description, file }

    Router->>+Auth: authenticate(req, res, next)

    rect rgb(255, 240, 240)
        note over Auth: Verifica JWT
        alt token mancante o non valido
            Auth-->>Client: ERR_TOKEN_MISSING / ERR_TOKEN_INVALID<br/>{ error: "Token mancante / non valido o scaduto" }
        end
    end

    Auth->>+Upload: uploadPdf(req, res, next)

    rect rgb(255, 240, 240)
        note over Upload: Validazione file (max 10MB)
        alt file non PDF
            Upload-->>Client: ERR_INVALID_FILE_TYPE<br/>{ error: "Solo file PDF sono accettati" }
        end
    end

    Upload->>+Validate: validate({ body: createDocumentSchema })

    rect rgb(255, 240, 240)
        note over Validate: Valida body (title, description<br/>stringhe non vuote)
        alt title o description mancanti/vuoti
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
    end

    Validate->>+Controller: createDocument(req, res)

    rect rgb(255, 240, 240)
        alt file assente (req.file)
            Controller-->>Client: ERR_FILE_REQUIRED<br/>{ error: "Il file PDF è obbligatorio" }
        end
    end

    rect rgb(240, 248, 255)
        note over Controller,Minio: Transazione DB (atomica)<br/>create + upload + update filePath
        Controller->>+DB: BEGIN TRANSACTION

        Controller->>DAO: create({ userId, title, description }, transaction)
        DAO->>DB: INSERT INTO documents<br/>{ userId, title, description }

        Controller->>+Minio: putObject(DOCUMENTS_BUCKET,<br/>"<id>/original.pdf", buffer)
        Minio-->>-Controller: ok

        Controller->>DAO: document.update({ filePath }, { transaction })
        DAO->>DB: UPDATE documents SET filePath = ?

        Controller->>DB: COMMIT
        DB-->>-Controller: Document
    end

    rect rgb(255, 240, 240)
        alt errore upload MinIO o scrittura DB
            note over Controller,Minio: ROLLBACK automatico (INSERT annullato)<br/>+ rimozione file orfano se già caricato
            Controller->>+Minio: removeObject(DOCUMENTS_BUCKET, fileKey)
            Minio-->>-Controller: ok
            Controller-->>Client: ERR_STORAGE_ERROR<br/>{ error: "Errore durante l'operazione sul file storage" }
        end
    end

    Controller-->>-Validate: { document }
    Validate-->>-Upload: { document }
    Upload-->>-Auth: { document }
    Auth-->>-Router: { document }
    Router-->>-Client: 201 Created<br/>{ document }
```

---

#### PATCH /documents/:id

Aggiorna i metadati (titolo e/o descrizione) di un documento esistente dell'utente autenticato. Il documento deve appartenere all'utente che effettua la richiesta.



**Parametri URL:**
- `id` — intero positivo, identificatore del documento

**Body richiesta** (almeno un campo):
```json
{
  "title": "Nuovo titolo",
  "description": "Nuova descrizione"
}
```

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_DOCUMENT_NOT_FOUND` — Documento non trovato

**Successo:** `200 OK` — Ritorna il documento aggiornato

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/documents/:id
    participant Auth as authenticate<br/>(JWT Middleware)
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as DocumentController
    participant DAO as DocumentDAO
    participant DB@{ shape: "database" } as Database

    Client->>+Router: PATCH /documents/:id<br/>{ title?, description? }

    Router->>+Auth: authenticate(req, res, next)

    rect rgb(255, 240, 240)
        note over Auth: Verifica JWT
        alt token mancante o non valido
            Auth-->>Client: ERR_TOKEN_MISSING / ERR_TOKEN_INVALID<br/>{ error: "Token mancante / non valido o scaduto" }
        end
    end

    Auth->>+Validate: validate({ params: idParamSchema,<br/>body: updateDocumentSchema })

    rect rgb(255, 240, 240)
        note over Validate: Valida :id (intero) e body<br/>(title?/description?, almeno uno)
        alt dati non validi
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
    end

    Validate->>+Controller: updateDocument(req, res)

    Controller->>+DAO: findByIdAndUser(id, userId)
    DAO->>+DB: SELECT * FROM documents<br/>WHERE id = ? AND userId = ?
    DB-->>-DAO: Document | null
    DAO-->>-Controller: Document | null

    rect rgb(255, 240, 240)
        alt documento non trovato
            Controller-->>Client: ERR_DOCUMENT_NOT_FOUND<br/>{ error: "Documento non trovato" }
        end
    end

    rect rgb(240, 255, 240)
        note over Controller,DB: Aggiornamento documento
        Controller->>+DAO: document.update({ title, description })
        DAO->>+DB: UPDATE documents<br/>SET title = ?, description = ?<br/>WHERE id = ?
        DB-->>-DAO: ok
        DAO-->>-Controller: Document aggiornato
    end

    Controller-->>-Validate: { document }
    Validate-->>-Auth: { document }
    Auth-->>-Router: { document }
    Router-->>-Client: 200 OK<br/>{ document }
```

---

#### DELETE /documents/:id

Elimina un documento dell'utente autenticato. Il documento deve appartenere all'utente che effettua la richiesta.



**Parametri URL:**
- `id` — intero positivo, identificatore del documento

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_DOCUMENT_NOT_FOUND` — Documento non trovato

**Successo:** `200 OK` — Conferma dell'eliminazione

---

#### POST /documents/:id/analyze

Avvia l'analisi di conformità ESG su un documento. Il sistema genera un report PDF, lo carica su MinIO e registra l'analisi nel database tramite transazione atomica. Il costo dell'operazione è **10 token**. Il documento deve essere nello stato `pending` (non ancora analizzato).



**Parametri URL:**
- `id` — intero positivo, identificatore del documento

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_DOCUMENT_NOT_FOUND` — Documento non trovato
- `ERR_DOCUMENT_ALREADY_ANALYZED` — Il documento è già stato analizzato
- `ERR_INSUFFICIENT_TOKENS` — Token insufficienti per eseguire l'analisi
- `ERR_STORAGE_ERROR` — Errore durante l'operazione sul file storage
- `ERR_DATABASE_ERROR` — Errore durante l'operazione sul database

**Successo:** `200 OK` — Ritorna `{ document, reportId, tokensRemaining }`

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Router as Router<br/>/documents/:id/analyze
    participant Auth as authenticate<br/>(JWT Middleware)
    participant Validate as validate<br/>(Zod Middleware)
    participant Controller as DocumentController
    participant DocDAO as DocumentDAO
    participant UserDAO as UserDAO
    participant DB@{ shape: "database" } as Database
    participant Minio as MinIO Storage
    participant ReportDAO as ReportDAO

    Client->>+Router: POST /documents/:id/analyze

    Router->>+Auth: authenticate(req, res, next)

    rect rgb(255, 240, 240)
        note over Auth: Verifica JWT
        alt token mancante o non valido
            Auth-->>Client: ERR_TOKEN_MISSING / ERR_TOKEN_INVALID<br/>{ error: "Token mancante / non valido o scaduto" }
        end
    end

    Auth->>+Validate: validate({ params: idParamSchema })

    rect rgb(255, 240, 240)
        note over Validate: Valida :id (intero positivo)
        alt id non valido
            Validate-->>Client: ERR_VALIDATION<br/>{ error: "Dati della richiesta non validi",<br/>details: [...] }
        end
    end

    Validate->>+Controller: analyzeDocument(req, res)

    Controller->>+DocDAO: findByIdAndUser(id, userId)
    DocDAO->>+DB: SELECT * FROM documents<br/>WHERE id = ? AND userId = ?
    DB-->>-DocDAO: Document | null
    DocDAO-->>-Controller: Document | null

    rect rgb(255, 240, 240)
        alt documento non trovato
            Controller-->>Client: ERR_DOCUMENT_NOT_FOUND<br/>{ error: "Documento non trovato" }
        end
    end

    rect rgb(255, 240, 240)
        alt document.status === "analyzed"
            Controller-->>Client: ERR_DOCUMENT_ALREADY_ANALYZED<br/>{ error: "Il documento è già stato analizzato" }
        end
    end

    Controller->>+UserDAO: findByIdFull(userId)
    UserDAO->>+DB: SELECT * FROM users WHERE id = ?
    DB-->>-UserDAO: User | null
    UserDAO-->>-Controller: User | null

    rect rgb(255, 240, 240)
        alt utente non trovato o tokens < ANALYSIS_TOKEN_COST (10)
            Controller-->>Client: ERR_INSUFFICIENT_TOKENS<br/>{ error: "Token insufficienti per eseguire l'analisi" }
        end
    end

    rect rgb(240, 255, 240)
        note over Controller,Minio: Generazione e upload report ESG
        Controller->>Controller: generateReport(document)
        note over Controller: Genera PDF ESG<br/>con pdfkit in memoria
        Controller->>+Minio: putObject(REPORTS_BUCKET,<br/>"<id>/report.pdf", pdfBuffer)
        Minio-->>-Controller: ok
    end

    rect rgb(255, 240, 240)
        alt errore generazione PDF o upload MinIO
            Controller-->>Client: ERR_STORAGE_ERROR<br/>{ error: "Errore durante l'operazione sul file storage" }
        end
    end

    rect rgb(240, 248, 255)
        note over Controller,ReportDAO: Transazione DB (atomica)<br/>tutte le scritture o nessuna
        Controller->>+DB: BEGIN TRANSACTION

        Controller->>DocDAO: document.update({ status: "analyzed", reportPath }, { transaction })
        DocDAO->>DB: UPDATE documents SET<br/>status, reportPath WHERE id = ?

        Controller->>UserDAO: deductTokens(userId, 10, transaction)
        UserDAO->>DB: UPDATE users SET<br/>tokens = tokens - 10 WHERE id = ?

        Controller->>ReportDAO: create({ documentId, userId, filePath }, transaction)
        ReportDAO->>DB: INSERT INTO reports<br/>{ documentId, userId, filePath }

        Controller->>DB: COMMIT
        DB-->>-Controller: reportId
    end

    rect rgb(255, 240, 240)
        alt errore durante la transazione
            note over Controller,Minio: ROLLBACK + cleanup file orfano
            Controller->>+Minio: removeObject(REPORTS_BUCKET, reportKey)
            Minio-->>-Controller: ok
            Controller-->>Client: ERR_DATABASE_ERROR<br/>{ error: "Errore durante l'operazione sul database" }
        end
    end

    Controller-->>-Validate: { document, reportId, tokensRemaining }
    Validate-->>-Auth: { document, reportId, tokensRemaining }
    Auth-->>-Router: { document, reportId, tokensRemaining }
    Router-->>-Client: 200 OK<br/>{ document, reportId, tokensRemaining }
```

---

### Analisi

Le **rotte dell'analisi** permettono agli utenti di recuperare le analisi effettuate in passato.

| METODO | ROTTA | JWT RICHIESTO | DESCRIZIONE |
|--------|-------|---------------|-------------|
| `GET` | /analyses | Sì | Restituisce la lista di tutte le analisi dell'utente |
| `GET` | /analyses/:id | Sì | Restituisce i dettagli e i risultati di una singola analisi |

---

#### GET /analyses

Restituisce la lista di tutte le analisi effettuate dall'utente autenticato, ordinate dalla più recente.



**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto

**Successo:** `200 OK` — Ritorna un array di `{ id, documentId, createdAt, complianceResults }`

---

#### GET /analyses/:id

Restituisce i dettagli completi di una singola analisi, inclusi tutti i `ComplianceResult` associati. L'analisi deve appartenere all'utente autenticato.



**Parametri URL:**
- `id` — intero positivo, identificatore dell'analisi

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_ANALYSIS_NOT_FOUND` — Analisi non trovata

**Successo:** `200 OK` — Ritorna `{ id, documentId, createdAt, complianceResults: [...] }`

---

### Report

Le **rotte dei report** permettono agli utenti di recuperare i report generati in passato.

| METODO | ROTTA | JWT RICHIESTO | DESCRIZIONE |
|--------|-------|---------------|-------------|
| `GET` | /reports/:id | Sì | Restituisce il report generato da un'analisi |

---

#### GET /reports/:id

Scarica il report PDF generato in seguito all'analisi di conformità ESG di un documento. Il file viene recuperato da MinIO e restituito come stream. Il report deve appartenere all'utente autenticato.


**Parametri URL:**
- `id` — intero positivo, identificatore del report

**Errori possibili:**
- `ERR_TOKEN_MISSING` — Token mancante
- `ERR_TOKEN_INVALID` — Token non valido o scaduto
- `ERR_VALIDATION` — Dati della richiesta non validi
- `ERR_REPORT_NOT_FOUND` — Report non trovato
- `ERR_STORAGE_ERROR` — Errore durante l'operazione sul file storage

**Successo:** `200 OK` — Ritorna il file PDF con `Content-Type: application/pdf`

---

## Design Pattern Implementati

**Singleton** — gestisce la connessione al database ([database.ts](typescript/singleton/database.ts)) e il client MinIO ([minio.ts](typescript/singleton/minio.ts)) garantendo un'unica istanza condivisa lungo tutto il ciclo di vita dell'applicazione.
*Perché:* aprire una nuova connessione/client a ogni richiesta sprecherebbe risorse e potrebbe esaurire il pool del DB; un'unica istanza centralizza la configurazione (un solo punto da modificare) e assicura che tutto il codice lavori sulla stessa connessione.

**Factory** — crea oggetti di risposta standardizzati di successo/errore con HTTP status code e messaggi coerenti ([responseFactory.ts](typescript/factory/responseFactory.ts), [error.ts](typescript/factory/error.ts)).
*Perché:* disaccoppia i controller dalla forma della risposta: aggiungere o modificare un errore significa toccare una sola classe/enum, non tutti gli endpoint, garantendo messaggi e status uniformi su tutta l'API.

**Chain of Responsibility** — filtra le richieste attraverso una catena di middleware: autenticazione JWT → verifica ruolo → validazione (Zod) → logica di business → gestione errori centralizzata.
*Perché:* ogni middleware ha una singola responsabilità ed è componibile e riordinabile per rotta; la richiesta viene interrotta al primo controllo fallito, così i controller restano puliti e non devono conoscere i dettagli di auth e validazione.

**Data Access Object (DAO)** — isola l'accesso ai dati nei [dao/](typescript/dao/), incapsulando le query Sequelize dietro un'interfaccia comune ([IDao.ts](typescript/dao/IDao.ts)).
*Perché:* la logica di business non dipende dai dettagli del DB, le query (e accorgimenti come i `SAFE_ATTRIBUTES` sugli utenti) sono centralizzate e riusabili, e nei test i DAO si possono mockare facilmente senza un database reale.

**Model-View-Controller (MVC)** — separa rotte, controller e modelli Sequelize, dividendo gli incarichi tra i vari elementi.
*Perché:* la separazione delle responsabilità rende il codice più leggibile, testabile e manutenibile, permettendo di modificare un livello (es. la persistenza) senza impattare gli altri.

## Avvio del Servizio
Requisiti: Docker installato

```bash
$ docker-compose up
```

Il servizio è disponibile sulla porta **3000** tramite cURL o Postman.

## Testing
Importare la collection Postman fornita `postman_collection.json`  e l'environment fornito `postman_environment.json` per eseguire i test predefiniti su tutti gli endpoint. I token JWT sono firmati con chiave RS256. Inoltre, sono stati utilizzati dei test automatizzati tramite jest.
I test tramite jest possono essere eseguiti tramite il seguente comando:

```bash
$ docker compose exec app npm test
```
I risultati dei test sono mostrati nella seguente figura:

<p align="center">
  <img src="res/test_jest.png" alt="Risultato test jest">
</p>

Per effettuare le operazioni di POST di documenti o normative, utilizzare i file PDF presenti nella cartella `res/`, denominati rispettivamente `Documento_Test.pdf` e `Normativa_Test.pdf`.

## Note

### Software Utilizzati

* [Visual Studio Code](https://code.visualstudio.com/) - IDE
* [Docker](https://www.docker.com/) - Gestore di container
* [Postman](https://www.postman.com/) - API Testing Platform

### Tecnologie usate

- **Node.js** - Runtime JavaScript
- **TypeScript** - Linguaggio utilizzato per lo sviluppo
- **Express** - Framework web per API REST
- **Sequelize** - ORM per database relazionali
- **PostgreSQL** - Database relazionale
- **JWT (RS256) con jsonwebtoken** - Autenticazione e autorizzazione
- **bcryptjs** - Hashing sicuro delle password
- **dotenv** - Gestione delle variabili d'ambiente
- **multer** - Gestione upload multipart/form-data
- **MinIO (SDK minio)** - Object storage per file e documenti
- **pdf-parse** - Estrazione contenuto dai PDF
- **PDFKit** - Generazione report in formato PDF
- **pg / pg-hstore** - Driver PostgreSQL per Sequelize
- **express-async-errors** - Gestione errori asincroni in Express
- **ts-node-dev** - Ambiente di sviluppo con reload automatico
- **jest** - Sistema di testing automatizzato




## Autore
* Dario Tommasi ([Github](https://github.com/zDarius))
* Andrea Bargilli ([Github](https://github.com/Bargi20))

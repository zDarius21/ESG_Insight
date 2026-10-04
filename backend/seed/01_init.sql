-- Creazione del tipo ENUM per il ruolo. Le scelte sono 'user' e 'admin'.

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- Creazione del tipo ENUM per lo stato di un documento. Le scelte sono 'pending', se non ancora analizzato, e 'analyzed', se analizzato correttamente.

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending', 'analyzed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- Creazione della tabella users se non è stata creata in precedenza, impostando come ruolo predefinito 'user' e aggiungendo i timestamp di creazione e aggiornamento al momento in cui viene eseguita l'istruzione.

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  role        user_role     NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- Creazione della tabella regulations per le normative ESG, impostando un nome unico, una descrizione e la versione della normativa.

CREATE TABLE IF NOT EXISTS regulations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL UNIQUE,
  description   TEXT          NOT NULL,
  version       VARCHAR(255)  NOT NULL,
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- Creazione della tabella documents per i documenti caricati dagli utenti da analizzare, impostando un titolo, il riferimento all'idUtente, una descrizione e lo stato dell'analisi del documento. Lo stato predefinito è "pending" e verrà modificato una volta completata l'analisi in "analyzed".

CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  "userId"      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(255)  NOT NULL,
  description   TEXT          NOT NULL,
  status        document_status NOT NULL DEFAULT 'pending',
  "filePath"    VARCHAR(500),
  "reportPath"  VARCHAR(500),
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
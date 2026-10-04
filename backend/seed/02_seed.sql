-- Popolamento della tabella "users" con utenti di esempio, tra cui un admin e due users. Le password sono hashate utilizzando bcrypt. Se un utente con la stessa email esiste già, l'inserimento viene ignorato.

INSERT INTO public.users (email, password, role, "createdAt", "updatedAt") VALUES
('admin@example.com', '$2a$12$yJesm7TPQZQ08Kvb69FSr./nXReZpCgCujVEExSnI916ifV3jrE7y', 'admin', NOW(), NOW()), -- password: Admin+123
('dario@example.com',  '$2a$12$ErM69G4J16h6cA12Mr1kOuZvtPkZrufmH6LOtVhaLb6IU6nd36D8u', 'user',  NOW(), NOW()), -- password: Dario+123
('andrea@example.com', '$2a$12$GC7DWWoNovTD7.dq3vmjrefLPtwacpWtd33qPW7Bc3t9F9uhFmjvC', 'user',  NOW(), NOW())  -- password: Andrea+123
ON CONFLICT (email) DO NOTHING;

-- Popolamento della tabella "regulations" con le 10 normative ESG utilizzate nell'analisi dei documenti caricati dagli utenti.

INSERT INTO public.regulations (name, description, version, "createdAt", "updatedAt") VALUES
(
  'Direttiva CSRD',
  'La Corporate Sustainability Reporting Directive impone alle grandi imprese e alle PMI quotate di pubblicare informazioni dettagliate su impatti ambientali, sociali e di governance (ESG), seguendo gli standard ESRS. Obbliga alla rendicontazione di sostenibilità verificata da un revisore indipendente.',
  '2022/2464/UE',
  NOW(), NOW()
),
(
  'Regolamento EU Taxonomy',
  'Il Regolamento sulla Tassonomia UE stabilisce un sistema di classificazione delle attività economiche sostenibili dal punto di vista ambientale. Definisce sei obiettivi ambientali e criteri tecnici di vaglio per determinare se un''attività è allineata alla tassonomia.',
  '2020/852',
  NOW(), NOW()
),
(
  'ISO 14001',
  'Standard internazionale per i Sistemi di Gestione Ambientale (SGA). Fornisce un quadro per la pianificazione, attuazione, verifica e miglioramento continuo delle prestazioni ambientali di un''organizzazione, inclusa la gestione di impatti su aria, acqua, suolo e biodiversità.',
  '2015',
  NOW(), NOW()
),
(
  'ISO 9001',
  'Standard internazionale per i Sistemi di Gestione della Qualità (SGQ). Stabilisce i requisiti per garantire che prodotti e servizi soddisfino costantemente le aspettative dei clienti e le normative applicabili, promuovendo il miglioramento continuo dei processi organizzativi.',
  '2015',
  NOW(), NOW()
),
(
  'ISO 45001',
  'Standard internazionale per i Sistemi di Gestione della Salute e Sicurezza sul Lavoro (SSL). Fornisce un quadro per ridurre infortuni e malattie professionali, migliorare le condizioni di lavoro e promuovere luoghi di lavoro sicuri e sani a livello globale.',
  '2018',
  NOW(), NOW()
),
(
  'ISO 27001',
  'Standard internazionale per i Sistemi di Gestione della Sicurezza delle Informazioni (SGSI). Definisce i requisiti per proteggere la riservatezza, l''integrità e la disponibilità delle informazioni aziendali attraverso controlli di sicurezza e gestione del rischio.',
  '2022',
  NOW(), NOW()
),
(
  'GRI Standards',
  'I Global Reporting Initiative Standards sono il framework più diffuso a livello mondiale per la rendicontazione di sostenibilità. Forniscono principi e indicatori specifici per misurare e comunicare gli impatti economici, ambientali e sociali di un''organizzazione.',
  '2021',
  NOW(), NOW()
),
(
  'D.Lgs 254 (DNF)',
  'Il Decreto Legislativo 254/2016 recepisce la Direttiva 2014/95/UE e obbliga gli enti di interesse pubblico di grandi dimensioni a pubblicare la Dichiarazione Non Finanziaria (DNF). Copre tematiche ambientali, sociali, di personale, rispetto dei diritti umani e lotta alla corruzione.',
  '2016',
  NOW(), NOW()
),
(
  'ESRS E1 - Cambiamenti climatici',
  'European Sustainability Reporting Standard E1 relativo ai cambiamenti climatici. Richiede la rendicontazione di emissioni di gas serra (Scope 1, 2 e 3), obiettivi di riduzione, piano di transizione climatica e valutazione dei rischi fisici e di transizione legati al clima.',
  '2023',
  NOW(), NOW()
),
(
  'D.Lgs 231',
  'Il Decreto Legislativo 231/2001 disciplina la responsabilità amministrativa degli enti per reati commessi nel loro interesse o vantaggio da soggetti apicali o subordinati. Prevede l''adozione di Modelli Organizzativi di Gestione e Controllo (MOG) e la nomina di un Organismo di Vigilanza (OdV).',
  '2001',
  NOW(), NOW()
)
ON CONFLICT (name) DO NOTHING;

-- Popolamento della tabella "documents" con documenti caricati dagli utenti.

INSERT INTO public.documents ("userId", title, description, status, "createdAt", "updatedAt") VALUES
(
  2,
  'Bilancio di Sostenibilità 2023 - Gruppo Alfa',
  'Rendicontazione annuale ESG del Gruppo Alfa relativa all''esercizio 2023. Il documento include informazioni su emissioni di CO2, consumi energetici, gestione delle risorse idriche, politiche sociali e di governance. Redatto secondo i criteri GRI Standards 2021.',
  'analyzed',
  NOW(), NOW()
),
(
  2,
  'Dichiarazione Non Finanziaria 2023 - Beta S.p.A.',
  'DNF consolidata di Beta S.p.A. per l''anno 2023, predisposta in conformità al D.Lgs 254/2016. Tratta temi ambientali, sociali, di rispetto dei diritti umani, lotta alla corruzione e diversity & inclusion nel contesto del settore manifatturiero.',
  'analyzed',
  NOW(), NOW()
),
(
  3,
  'Report di Conformità ISO 14001 - Impianto Nord',
  'Documento di autovalutazione della conformità al sistema di gestione ambientale ISO 14001:2015 per l''impianto produttivo di Milano Nord. Include audit interni, non conformità rilevate e piano di azioni correttive per il biennio 2024-2025.',
  'pending',
  NOW(), NOW()
),
(
  3,
  'Politica di Gestione della Sicurezza Informatica',
  'Documento di policy aziendale per la sicurezza delle informazioni redatto in conformità allo standard ISO 27001:2022. Definisce ruoli, responsabilità, classificazione dei dati, gestione degli accessi, incident response e piano di continuità operativa.',
  'pending',
  NOW(), NOW()
),
(
  2,
  'Piano di Transizione Climatica 2024-2030',
  'Documento strategico per la riduzione delle emissioni di gas serra in linea con gli obiettivi ESRS E1 e il Regolamento EU Taxonomy. Include target di decarbonizzazione Scope 1, 2 e 3, investimenti in energie rinnovabili e roadmap di sostenibilità al 2030.',
  'analyzed',
  NOW(), NOW()
);
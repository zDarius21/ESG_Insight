import dotenv from 'dotenv';

/**
 * Caricamento delle variabili d'ambiente. Va importato per primo in index.ts perché controller,
 * middleware e singleton leggono process.env già al momento dell'import.
 * In locale viene usato backend/.env se presente, altrimenti il .env condiviso nella root del monorepo;
 * in Docker le variabili arrivano da docker-compose e i valori già presenti non vengono sovrascritti.
 */
dotenv.config({ path: ['.env', '../.env'], quiet: true });

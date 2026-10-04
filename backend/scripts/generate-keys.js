/**
 * Genera la coppia di chiavi RSA usata per firmare (privata) e verificare (pubblica) i token JWT in RS256.
 *
 * Uso: node scripts/generate-keys.js [cartella-di-destinazione] [--force]
 *
 * Senza argomenti le chiavi vengono create in backend/keys/. Se esistono già non vengono sovrascritte
 * (salvo --force), così lo script può essere eseguito a ogni avvio da docker compose.
 */
const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const force = args.includes('--force');
const outDir = path.resolve(args.find((arg) => arg !== '--force') ?? path.join(__dirname, '..', 'keys'));
const privatePath = path.join(outDir, 'private.pem');
const publicPath = path.join(outDir, 'public.pem');

if (!force && fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
  console.log(`Chiavi JWT già presenti in ${outDir}`);
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(privatePath, privateKey);
fs.writeFileSync(publicPath, publicKey);
console.log(`Chiavi JWT generate in ${outDir}`);

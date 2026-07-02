# Immagine base Node.js versione 20 su Alpine Linux 
FROM node:20-alpine

# Directory di lavoro all'interno del container dove verranno copiati i file dell'applicazione
WORKDIR /usr/src/app

# Copia i file di configurazione delle dipendenze e installa i pacchetti Node.js
COPY package*.json ./
RUN npm install && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

# Copia il file di configurazione TypeScript e i sorgenti dell'applicazione
COPY tsconfig.json ./
COPY typescript ./typescript

# Copia la configurazione di test (jest + ts-jest) e i file di test
COPY jest.config.js ./
COPY tests ./tests

# Compila il codice TypeScript in JavaScript nella cartella "dist"
RUN npm run build && chown -R appuser:appgroup /usr/src/app
USER appuser

# Porta su cui il container espone l'applicazione Node.js
EXPOSE 3000

# Comando di avvio dell'applicazione, eseguendo il file JavaScript compilato
CMD ["node", "dist/index.js"]

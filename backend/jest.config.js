/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // I file di test vivono nella cartella tests/ con suffisso .test.ts
  testMatch: ['**/tests/**/*.test.ts'],
  // Azzera automaticamente i mock tra un test e l'altro (come l'afterEach del riferimento)
  clearMocks: true,
  // tsconfig dedicato ai test: include sia il sorgente sia la cartella tests/
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json' }],
  },
};
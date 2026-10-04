import app, { initializeServices } from './app';

const APP_PORT = process.env.PORT || 3000;

initializeServices()
  .then(() => {
    app.listen(APP_PORT, () => {
      console.log(`Server running on http://localhost:${APP_PORT}`);
    });
  })
  .catch((err: Error) => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
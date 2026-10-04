import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

test('senza sessione mostra la schermata di accesso', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /accedi a esg insight/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
});

test('la scheda di registrazione chiede la conferma della password', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /registrati/i }));
  expect(await screen.findByLabelText(/conferma password/i)).toBeInTheDocument();
});

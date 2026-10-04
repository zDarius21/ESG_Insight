import { validate } from '../typescript/middleware/validationMiddleware';
import {
  idParamSchema,
  rechargeTokensSchema,
  createUserSchema,
  updateUserSchema,
} from '../typescript/validation/schemas';
import ResponseFactory from '../typescript/factory/responseFactory';
import { mockReq, mockRes, mockNext } from './helpers/express';

/**
 * Test del middleware di validazione Zod.
 * Ramo "ok" -> next() e (per i body con coercizione) valori convertiti in req.
 * Ramo "ko" -> ResponseFactory.sendValidationError, next() NON chiamato.
 */
describe('validate', () => {
  let sendValidationError: jest.SpyInstance;

  beforeEach(() => {
    sendValidationError = jest
      .spyOn(ResponseFactory, 'sendValidationError')
      .mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('params (idParamSchema)', () => {
    it('chiama next() con un id numerico valido', () => {
      const req = mockReq({ params: { id: '42' } });
      const res = mockRes();
      const next = mockNext();

      validate({ params: idParamSchema })(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(sendValidationError).not.toHaveBeenCalled();
    });

    it('risponde con errore di validazione per id non numerico', () => {
      const req = mockReq({ params: { id: 'abc' } });
      const res = mockRes();
      const next = mockNext();

      validate({ params: idParamSchema })(req, res, next);

      expect(sendValidationError).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('body (rechargeTokensSchema)', () => {
    it('converte tokens da stringa numerica a numero e chiama next()', () => {
      const req = mockReq({ body: { tokens: '10' } });
      const res = mockRes();
      const next = mockNext();

      validate({ body: rechargeTokensSchema })(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.body.tokens).toBe(10); 
    });

    it.each([
      ['zero', 0],
      ['negativo', -5],
      ['oltre il cap', 101],
    ])('risponde con errore di validazione per tokens %s (%i)', (_label, value) => {
      const req = mockReq({ body: { tokens: value } });
      const res = mockRes();
      const next = mockNext();

      validate({ body: rechargeTokensSchema })(req, res, next);

      expect(sendValidationError).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    it('risponde con errore di validazione per tokens non numerico', () => {
      const req = mockReq({ body: { tokens: 'abc' } });
      const res = mockRes();
      const next = mockNext();

      validate({ body: rechargeTokensSchema })(req, res, next);

      expect(sendValidationError).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('body (createUserSchema)', () => {
    it('chiama next() con email valida e password forte', () => {
      const req = mockReq({ body: { email: 'nuovo@test.it', password: 'Password1!' } });
      const res = mockRes();
      const next = mockNext();

      validate({ body: createUserSchema })(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(sendValidationError).not.toHaveBeenCalled();
    });

    it('risponde con errore di validazione per email non valida', () => {
      const req = mockReq({ body: { email: 'non-una-email', password: 'password1' } });
      const res = mockRes();
      const next = mockNext();

      validate({ body: createUserSchema })(req, res, next);

      expect(sendValidationError).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    it('risponde con errore di validazione per password troppo corta', () => {
      const req = mockReq({ body: { email: 'nuovo@test.it', password: '123' } });
      const res = mockRes();
      const next = mockNext();

      validate({ body: createUserSchema })(req, res, next);

      expect(sendValidationError).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    it('risponde con errore di validazione per password senza complessità (no maiuscola/speciale)', () => {
      const req = mockReq({ body: { email: 'nuovo@test.it', password: 'password123' } });
      const res = mockRes();
      const next = mockNext();

      validate({ body: createUserSchema })(req, res, next);

      expect(sendValidationError).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('body (updateUserSchema)', () => {
    it('risponde con errore di validazione per body vuoto (almeno un campo)', () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = mockNext();

      validate({ body: updateUserSchema })(req, res, next);

      expect(sendValidationError).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    it('chiama next() quando è presente almeno un campo valido', () => {
      const req = mockReq({ body: { role: 'admin' } });
      const res = mockRes();
      const next = mockNext();

      validate({ body: updateUserSchema })(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(sendValidationError).not.toHaveBeenCalled();
    });
  });
});

// authMiddleware legge la chiave pubblica da file all'import e usa jsonwebtoken:
// vanno mockati PRIMA di importare il middleware.
jest.mock('node:fs', () => ({ readFileSync: jest.fn(() => 'FAKE_PUBLIC_KEY') }));
jest.mock('jsonwebtoken');

import jwt from 'jsonwebtoken';
import { authenticate } from '../typescript/middleware/authMiddleware';
import ResponseFactory, { ErrorEnum } from '../typescript/factory/responseFactory';
import { Role } from '../typescript/enums/role';
import { mockReq, mockRes, mockNext } from './helpers/express';

/**
 * Test del middleware authenticate.
 * - Header assente/non Bearer -> TokenMissing
 * - jwt.verify ok            -> next() e req.user popolato
 * - jwt.verify lancia        -> TokenInvalid
 */
describe('authenticate', () => {
  let sendError: jest.SpyInstance;

  beforeEach(() => {
    sendError = jest.spyOn(ResponseFactory, 'sendError').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('risponde TokenMissing se manca l\'header Authorization', () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(sendError).toHaveBeenCalledWith(res, ErrorEnum.TokenMissing);
    expect(next).not.toHaveBeenCalled();
  });

  it('chiama next() e popola req.user con un token valido', () => {
    const payload = { id: 1, email: 'admin@test.it', role: Role.Admin };
    (jwt.verify as jest.Mock).mockReturnValue(payload);

    const req = mockReq({ headers: { authorization: 'Bearer valid.token' } });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(payload);
    expect(sendError).not.toHaveBeenCalled();
  });

  it('risponde TokenInvalid se jwt.verify lancia un errore', () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid');
    });

    const req = mockReq({ headers: { authorization: 'Bearer bad.token' } });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(sendError).toHaveBeenCalledWith(res, ErrorEnum.TokenInvalid);
    expect(next).not.toHaveBeenCalled();
  });

  it('risponde TokenMissing se l\'header non inizia con "Bearer "', () => {
    const req = mockReq({ headers: { authorization: 'Basic abc' } });
    const res = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(sendError).toHaveBeenCalledWith(res, ErrorEnum.TokenMissing);
    expect(next).not.toHaveBeenCalled();
  });
});
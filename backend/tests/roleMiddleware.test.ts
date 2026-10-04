import { requireAdmin } from '../typescript/middleware/roleMiddleware';
import ResponseFactory, { ErrorEnum } from '../typescript/factory/responseFactory';
import { Role } from '../typescript/enums/role';
import { mockReq, mockRes, mockNext } from './helpers/express';

/**
 * Test del middleware requireAdmin (Chain of Responsibility per l'autorizzazione).
 * Stile: si spia ResponseFactory.sendError per verificare quale errore viene emesso,
 * lasciando reali ErrorEnum e Role. Ramo "ok" -> next(); ramo "negato" -> sendError(Forbidden).
 */
describe('requireAdmin', () => {
  let sendError: jest.SpyInstance;

  beforeEach(() => {
    // Evita che venga eseguita la vera logica di risposta HTTP
    sendError = jest.spyOn(ResponseFactory, 'sendError').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('chiama next() quando il ruolo è admin', () => {
    const req = mockReq({ user: { id: 1, email: 'admin@test.it', role: Role.Admin } });
    const res = mockRes();
    const next = mockNext();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(sendError).not.toHaveBeenCalled();
  });

  it('risponde Forbidden quando il ruolo è user', () => {
    const req = mockReq({ user: { id: 2, email: 'user@test.it', role: Role.User } });
    const res = mockRes();
    const next = mockNext();

    requireAdmin(req, res, next);

    expect(sendError).toHaveBeenCalledWith(res, ErrorEnum.Forbidden);
    expect(next).not.toHaveBeenCalled();
  });

  it('risponde Forbidden quando manca req.user', () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    requireAdmin(req, res, next);

    expect(sendError).toHaveBeenCalledWith(res, ErrorEnum.Forbidden);
    expect(next).not.toHaveBeenCalled();
  });
});
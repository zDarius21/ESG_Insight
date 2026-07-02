import { Request, Response, NextFunction } from 'express';

/**
 * Helper per creare oggetti Express finti nei test dei middleware,
 * così da ridurre il boilerplate.
 */

/** Crea una Request finta; passare un override per impostare body/params/headers/user. */
export const mockReq = (data: Partial<Request> = {}): Request =>
  ({ body: {}, params: {}, query: {}, headers: {}, ...data } as unknown as Request);

/** Crea una Response finta con status() e json() spiati e concatenabili. */
export const mockRes = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

/** Crea una funzione next() spiata. */
export const mockNext = (): NextFunction => jest.fn();
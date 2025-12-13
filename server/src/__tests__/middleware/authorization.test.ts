import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Request, Response } from 'express';

// Mock the config to avoid env validation
jest.unstable_mockModule('../../config/index.js', () => ({
  config: {
    isProd: false,
    isDev: true,
    port: 4000,
    frontendUrl: 'http://localhost:5173',
  },
}));

// Dynamic import after mocking
const { authorizeSelfOrRole } = await import('../../middleware/authorization.js');

interface MockUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockRequest extends Request {
  user?: MockUser;
}

describe('authorizeSelfOrRole middleware', () => {
  const mockResponse = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
    res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
    return res;
  };

  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it('should allow user to modify their own resource', () => {
    const req = {
      params: { id: 'user-123' },
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as unknown as MockRequest;
    const res = mockResponse();

    authorizeSelfOrRole()(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user tries to modify another user resource', () => {
    const req = {
      params: { id: 'other-user-456' },
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as unknown as MockRequest;
    const res = mockResponse();

    authorizeSelfOrRole()(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Forbidden: You can only modify your own resources',
    });
  });

  it('should return 401 when user is not authenticated', () => {
    const req = {
      params: { id: 'user-123' },
      user: undefined,
    } as unknown as MockRequest;
    const res = mockResponse();

    authorizeSelfOrRole()(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unauthorized',
    });
  });

  it('should work with admin role parameter (placeholder for future RBAC)', () => {
    const req = {
      params: { id: 'other-user-456' },
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as unknown as MockRequest;
    const res = mockResponse();

    // Currently admin role check is a placeholder, so this should still return 403
    authorizeSelfOrRole('admin')(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

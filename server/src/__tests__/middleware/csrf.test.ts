import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Request, Response } from 'express';

// Test CSRF secret for signed tokens
const TEST_CSRF_SECRET = 'test-csrf-secret-for-unit-tests-minimum-32-chars';

// Mock the config to avoid env validation
jest.unstable_mockModule('../../config/index.js', () => ({
  config: {
    isProd: false,
    isDev: true,
    port: 4000,
    frontendUrl: 'http://localhost:5173',
    csrfSecret: TEST_CSRF_SECRET,
  },
}));

// Dynamic import after mocking
const { validateCsrf, generateCsrfToken, CSRF_COOKIE, CSRF_HEADER } =
  await import('../../middleware/csrf.js');

describe('CSRF middleware', () => {
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

  describe('validateCsrf', () => {
    it('should skip CSRF validation for GET requests', () => {
      const req = { method: 'GET', cookies: {}, headers: {} } as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF validation for HEAD requests', () => {
      const req = { method: 'HEAD', cookies: {}, headers: {} } as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip CSRF validation for OPTIONS requests', () => {
      const req = { method: 'OPTIONS', cookies: {}, headers: {} } as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when CSRF cookie is missing but header has valid signed token (cross-origin support)', () => {
      // In cross-origin scenarios, browsers may block third-party cookies.
      // We verify the signed token instead.
      const signedToken = generateCsrfToken();
      const req = {
        method: 'POST',
        cookies: {},
        headers: { [CSRF_HEADER]: signedToken },
      } as unknown as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 when CSRF header token is missing', () => {
      const req = {
        method: 'POST',
        cookies: { [CSRF_COOKIE]: 'some-token' },
        headers: {},
      } as unknown as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token missing',
      });
    });

    it('should return 403 when CSRF token mismatches', () => {
      const req = {
        method: 'POST',
        cookies: { [CSRF_COOKIE]: 'token-from-cookie' },
        headers: { [CSRF_HEADER]: 'different-token-here' },
      } as unknown as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token mismatch',
      });
    });

    it('should pass when CSRF token matches', () => {
      const token = generateCsrfToken();
      const req = {
        method: 'POST',
        cookies: { [CSRF_COOKIE]: token },
        headers: { [CSRF_HEADER]: token },
      } as unknown as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should work for PATCH requests', () => {
      const token = generateCsrfToken();
      const req = {
        method: 'PATCH',
        cookies: { [CSRF_COOKIE]: token },
        headers: { [CSRF_HEADER]: token },
      } as unknown as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should work for DELETE requests', () => {
      const token = generateCsrfToken();
      const req = {
        method: 'DELETE',
        cookies: { [CSRF_COOKIE]: token },
        headers: { [CSRF_HEADER]: token },
      } as unknown as Request;
      const res = mockResponse();

      validateCsrf(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('generateCsrfToken', () => {
    it('should generate signed token in timestamp.signature format', () => {
      const token = generateCsrfToken();

      // Format: timestamp.signature
      expect(token).toContain('.');
      const [timestamp, signature] = token.split('.');
      expect(timestamp).toBeDefined();
      expect(signature).toBeDefined();

      // Timestamp should be a valid number
      const timestampNum = parseInt(timestamp, 10);
      expect(timestampNum).toBeGreaterThan(0);
      expect(timestampNum).toBeLessThanOrEqual(Date.now());

      // Signature should be 64 char hex (SHA256)
      expect(signature).toHaveLength(64);
      expect(/^[a-f0-9]+$/i.test(signature)).toBe(true);
    });

    it('should generate unique tokens when called at different times', async () => {
      // Tokens use timestamp in milliseconds, so we need small delays
      const token1 = generateCsrfToken();
      await new Promise((resolve) => setTimeout(resolve, 2));
      const token2 = generateCsrfToken();
      await new Promise((resolve) => setTimeout(resolve, 2));
      const token3 = generateCsrfToken();

      // Tokens should be unique (different timestamps)
      expect(token1).not.toEqual(token2);
      expect(token2).not.toEqual(token3);
      expect(token1).not.toEqual(token3);
    });

    it('should generate tokens with valid HMAC signatures', () => {
      // Generate multiple tokens and verify they follow the expected pattern
      for (let i = 0; i < 10; i++) {
        const token = generateCsrfToken();
        const parts = token.split('.');
        expect(parts).toHaveLength(2);
        expect(parts[0]).toMatch(/^\d+$/); // timestamp is numeric
        expect(parts[1]).toMatch(/^[a-f0-9]{64}$/i); // signature is 64 hex chars
      }
    });
  });
});

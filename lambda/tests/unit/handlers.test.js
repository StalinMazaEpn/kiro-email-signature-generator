'use strict';

/**
 * Property tests for successful response structure across all handlers.
 * Validates Requirements 1.6, 2.4
 */

// Mock storageService and imageToolsClient for generateSignature tests
jest.mock('../../src/services/storageService', () => ({
  upload: jest.fn().mockResolvedValue('http://localhost:3005/storage/originals/test.png'),
  getOriginalKey: jest.fn().mockReturnValue('originals/12345-test.png'),
  getBannerKey: jest.fn().mockReturnValue('banners/12345-test-banner.png'),
  LOCAL_STORAGE_DIR: '/tmp/local-storage',
}));

jest.mock('../../src/services/imageToolsClient', () => ({
  createBanner: jest.fn().mockResolvedValue({ url: 'http://localhost:3005/storage/banners/test-banner.png', usedFallback: false }),
}));

jest.mock('../../src/providers/aiProvider', () => ({
  getAIProvider: jest.fn().mockReturnValue({
    callModel: jest.fn().mockResolvedValue(JSON.stringify({
      nombre: 'Carlos Ruiz',
      cargo: 'Ingeniero',
      email: 'carlos@test.com',
      telefono: '+593991111111',
      website: null,
      linkedin: null,
    })),
  }),
}));

const { handler: generateHandler } = require('../../src/handlers/generateSignature');
const { handler: previewHandler } = require('../../src/handlers/previewSignature');
const { handler: extractHandler } = require('../../src/handlers/extractFields');

describe('Property: Successful response structure', () => {
  function makeEvent(body) {
    return { body: JSON.stringify(body) };
  }

  const generateBody = {
    nombre: 'Test User',
    cargo: 'Developer',
    email: 'test@example.com',
    telefono: '+593990000000',
    templateId: 'corporativa',
    image: Buffer.from('fake-image-data').toString('base64'),
  };

  const previewBody = {
    nombre: 'Test User',
    cargo: 'Developer',
    email: 'test@example.com',
    telefono: '+593990000000',
    templateId: 'moderna-banner',
  };

  const extractBody = {
    text: 'Carlos Ruiz, Ingeniero, carlos@test.com, +593991111111',
  };

  describe('generateSignature response structure', () => {
    test('returns statusCode 200 with JSON content-type header', async () => {
      const result = await generateHandler(makeEvent(generateBody));

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    test('body contains success:true, html string, and bannerUrl', async () => {
      const result = await generateHandler(makeEvent(generateBody));
      const body = JSON.parse(result.body);

      expect(body.success).toBe(true);
      expect(typeof body.html).toBe('string');
      expect(body.html.length).toBeGreaterThan(0);
      expect(typeof body.bannerUrl).toBe('string');
      expect(body.bannerUrl).toContain('http');
    });
  });

  describe('previewSignature response structure', () => {
    test('returns statusCode 200 with JSON content-type header', async () => {
      const result = await previewHandler(makeEvent(previewBody));

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    test('body contains success:true and html string', async () => {
      const result = await previewHandler(makeEvent(previewBody));
      const body = JSON.parse(result.body);

      expect(body.success).toBe(true);
      expect(typeof body.html).toBe('string');
      expect(body.html.length).toBeGreaterThan(0);
    });
  });

  describe('extractFields response structure', () => {
    test('returns statusCode 200 with JSON content-type header', async () => {
      const result = await extractHandler(makeEvent(extractBody));

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    test('body contains success:true and fields object', async () => {
      const result = await extractHandler(makeEvent(extractBody));
      const body = JSON.parse(result.body);

      expect(body.success).toBe(true);
      expect(typeof body.fields).toBe('object');
      expect(body.fields).toHaveProperty('nombre');
      expect(body.fields).toHaveProperty('cargo');
      expect(body.fields).toHaveProperty('email');
      expect(body.fields).toHaveProperty('telefono');
    });
  });

  describe('Error responses follow consistent structure', () => {
    test('validation errors return 400 with success:false and error message', async () => {
      const badEvent = makeEvent({ invalid: true });

      const genResult = await generateHandler(badEvent);
      const preResult = await previewHandler(badEvent);
      const extResult = await extractHandler(badEvent);

      for (const result of [genResult, preResult, extResult]) {
        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(typeof body.error).toBe('string');
        expect(body.error.length).toBeGreaterThan(0);
      }
    });
  });
});

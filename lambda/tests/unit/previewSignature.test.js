'use strict';

const { handler, PLACEHOLDER_BANNER } = require('../../src/handlers/previewSignature');

describe('previewSignature handler', () => {
  const validBody = {
    nombre: 'María López',
    cargo: 'Diseñadora UX',
    email: 'maria@example.com',
    telefono: '+593991234567',
    templateId: 'corporativa',
  };

  function makeEvent(body) {
    return { body: JSON.stringify(body) };
  }

  describe('Property: Preview uses placeholder banner without image processing', () => {
    test('rendered HTML contains the placeholder banner URL, not a real image URL', async () => {
      const result = await handler(makeEvent(validBody));
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.html).toContain(PLACEHOLDER_BANNER);
    });

    test('does not require an image field in the request', async () => {
      // Preview body has no 'image' field
      const result = await handler(makeEvent(validBody));
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.success).toBe(true);
    });

    test('placeholder banner URL is used for all template types', async () => {
      const templates = ['corporativa', 'moderna-banner', 'minimalista'];

      for (const templateId of templates) {
        const event = makeEvent({ ...validBody, templateId });
        const result = await handler(event);
        const body = JSON.parse(result.body);

        expect(result.statusCode).toBe(200);
        expect(body.html).toContain(PLACEHOLDER_BANNER);
      }
    });

    test('response does not contain a bannerUrl field (no image processing happened)', async () => {
      const result = await handler(makeEvent(validBody));
      const body = JSON.parse(result.body);

      expect(body.bannerUrl).toBeUndefined();
    });
  });

  describe('Validation errors', () => {
    test('returns 400 when required fields are missing', async () => {
      const result = await handler(makeEvent({ nombre: 'Test' }));
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    test('returns 400 for invalid templateId', async () => {
      const event = makeEvent({ ...validBody, templateId: 'invalid' });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.success).toBe(false);
    });
  });
});

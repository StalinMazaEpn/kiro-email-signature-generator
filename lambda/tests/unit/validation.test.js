'use strict';

const {
  validateGenerateRequest,
  validatePreviewRequest,
  validateExtractRequest,
  REQUIRED_FIELDS,
  VALID_TEMPLATES,
} = require('../../src/utils/validation');

describe('validateGenerateRequest', () => {
  const validBody = {
    nombre: 'Carlos Méndez',
    cargo: 'Tech Lead',
    email: 'carlos@empresa.com',
    telefono: '+593991234567',
    templateId: 'corporativa',
    image: 'iVBORw0KGgoAAAANSUhEUg==', // base64 stub
  };

  test('accepts a valid request', () => {
    expect(validateGenerateRequest(validBody)).toEqual({ valid: true });
  });

  test('rejects null/undefined body', () => {
    expect(validateGenerateRequest(null).valid).toBe(false);
    expect(validateGenerateRequest(undefined).valid).toBe(false);
  });

  test('rejects non-object body', () => {
    expect(validateGenerateRequest('string').valid).toBe(false);
  });

  test.each(REQUIRED_FIELDS)('rejects missing field: %s', (field) => {
    const body = { ...validBody };
    delete body[field];
    const result = validateGenerateRequest(body);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(field);
  });

  test.each(REQUIRED_FIELDS)('rejects empty string field: %s', (field) => {
    const body = { ...validBody, [field]: '   ' };
    const result = validateGenerateRequest(body);
    expect(result.valid).toBe(false);
  });

  test('rejects invalid templateId', () => {
    const body = { ...validBody, templateId: 'invalid-template' };
    const result = validateGenerateRequest(body);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid templateId');
  });

  test.each(VALID_TEMPLATES)('accepts valid templateId: %s', (templateId) => {
    const body = { ...validBody, templateId };
    expect(validateGenerateRequest(body).valid).toBe(true);
  });

  test('rejects invalid email format', () => {
    const body = { ...validBody, email: 'not-an-email' };
    const result = validateGenerateRequest(body);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('email');
  });
});

describe('validatePreviewRequest', () => {
  const validBody = {
    nombre: 'Carlos Méndez',
    cargo: 'Tech Lead',
    email: 'carlos@empresa.com',
    templateId: 'moderna-banner',
  };

  test('accepts a valid preview request (no image required)', () => {
    expect(validatePreviewRequest(validBody)).toEqual({ valid: true });
  });

  test('does not require telefono', () => {
    const body = { ...validBody };
    expect(validatePreviewRequest(body).valid).toBe(true);
  });

  test('rejects missing nombre', () => {
    const body = { ...validBody };
    delete body.nombre;
    expect(validatePreviewRequest(body).valid).toBe(false);
  });

  test('rejects invalid templateId', () => {
    const body = { ...validBody, templateId: 'nonexistent' };
    expect(validatePreviewRequest(body).valid).toBe(false);
  });
});

describe('validateExtractRequest', () => {
  test('accepts valid text', () => {
    const body = { text: 'Carlos Méndez, carlos@empresa.com, Tech Lead' };
    expect(validateExtractRequest(body)).toEqual({ valid: true });
  });

  test('rejects missing text', () => {
    expect(validateExtractRequest({}).valid).toBe(false);
    expect(validateExtractRequest({ text: '' }).valid).toBe(false);
    expect(validateExtractRequest({ text: '   ' }).valid).toBe(false);
  });

  test('rejects text over 2000 chars', () => {
    const body = { text: 'a'.repeat(2001) };
    const result = validateExtractRequest(body);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2000');
  });

  test('accepts text at exactly 2000 chars', () => {
    const body = { text: 'a'.repeat(2000) };
    expect(validateExtractRequest(body).valid).toBe(true);
  });
});

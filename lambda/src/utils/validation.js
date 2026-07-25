'use strict';

const REQUIRED_FIELDS = ['nombre', 'cargo', 'email', 'telefono', 'templateId', 'image'];
const VALID_TEMPLATES = ['corporativa', 'moderna-banner', 'minimalista'];

/**
 * Validates a generate-signature request body.
 * @param {object} body - Parsed request body
 * @returns {{ valid: boolean, error?: string }}
 */
function validateGenerateRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (!VALID_TEMPLATES.includes(body.templateId)) {
    return { valid: false, error: `Invalid templateId: ${body.templateId}. Valid options: ${VALID_TEMPLATES.join(', ')}` };
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validates a preview-signature request body (no image required).
 * @param {object} body
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePreviewRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const previewRequired = ['nombre', 'cargo', 'email', 'templateId'];
  for (const field of previewRequired) {
    if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (!VALID_TEMPLATES.includes(body.templateId)) {
    return { valid: false, error: `Invalid templateId: ${body.templateId}. Valid options: ${VALID_TEMPLATES.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Validates an extract-fields request body.
 * @param {object} body
 * @returns {{ valid: boolean, error?: string }}
 */
function validateExtractRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
    return { valid: false, error: 'Missing required field: text' };
  }

  if (body.text.length > 2000) {
    return { valid: false, error: 'Text exceeds maximum length of 2000 characters' };
  }

  return { valid: true };
}

module.exports = {
  validateGenerateRequest,
  validatePreviewRequest,
  validateExtractRequest,
  REQUIRED_FIELDS,
  VALID_TEMPLATES,
};

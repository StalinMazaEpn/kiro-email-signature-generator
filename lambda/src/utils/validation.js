'use strict';

const { TEMPLATE_CATALOG } = require('../config/templates');

const REQUIRED_FIELDS = ['nombre', 'cargo', 'email', 'telefono', 'templateId', 'image'];
const VALID_TEMPLATES = TEMPLATE_CATALOG.map((t) => t.id);

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

  // Image size validation (base64 length * 0.75 ≈ original bytes)
  const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB

  if (body.image) {
    const imageSizeBytes = Math.ceil(body.image.length * 0.75);
    if (imageSizeBytes > MAX_IMAGE_BYTES) {
      return { valid: false, error: 'La foto de perfil es muy pesada (maximo 15MB). Usa una imagen mas liviana.' };
    }
  }

  if (body.backgroundImage) {
    const bgSizeBytes = Math.ceil(body.backgroundImage.length * 0.75);
    if (bgSizeBytes > MAX_IMAGE_BYTES) {
      return { valid: false, error: 'El fondo personalizado es muy pesado (maximo 15MB). Usa una imagen mas liviana.' };
    }
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

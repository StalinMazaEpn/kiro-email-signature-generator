'use strict';

const { validateGenerateRequest } = require('../utils/validation');
const { upload, getOriginalKey } = require('../services/storageService');
const { createBanner } = require('../services/imageToolsClient');
const { render } = require('../services/templateEngine');

/**
 * Lambda handler: Generate a full email signature.
 * Flow: validate → upload original image → create banner → render template → return HTML
 *
 * @param {object} event - API Gateway v2 event
 * @returns {object} API Gateway v2 response
 */
async function handler(event) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    const validation = validateGenerateRequest(body);
    if (!validation.valid) {
      return response(400, { success: false, error: validation.error });
    }

    const { nombre, cargo, email, telefono, website, linkedin, templateId, image } = body;

    // Decode base64 image
    const imageBuffer = Buffer.from(image, 'base64');
    const originalKey = getOriginalKey(nombre);

    // Upload original image
    const originalUrl = await upload(originalKey, imageBuffer, 'image/png');

    // Process banner via image-tools (or local mock)
    const bannerUrl = await createBanner(originalUrl, nombre, imageBuffer);

    // Render template with all fields
    const fields = { nombre, cargo, email, telefono, website, linkedin, bannerUrl };
    const html = render(templateId, fields);

    return response(200, { success: true, html, bannerUrl });
  } catch (err) {
    console.error('[generateSignature] Error:', err.message);
    return response(500, { success: false, error: err.message });
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

module.exports = { handler };

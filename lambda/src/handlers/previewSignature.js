'use strict';

const { validatePreviewRequest } = require('../utils/validation');
const { render } = require('../services/templateEngine');

const PLACEHOLDER_BANNER = 'https://via.placeholder.com/600x120/e2e8f0/64748b?text=Banner+Preview';

/**
 * Lambda handler: Preview an email signature without image processing.
 * Uses a placeholder banner URL instead of calling image-tools.
 *
 * @param {object} event - API Gateway v2 event
 * @returns {object} API Gateway v2 response
 */
async function handler(event) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    const validation = validatePreviewRequest(body);
    if (!validation.valid) {
      return response(400, { success: false, error: validation.error });
    }

    const { nombre, cargo, email, telefono, website, linkedin, templateId } = body;

    // Use placeholder banner — no image processing
    const fields = { nombre, cargo, email, telefono, website, linkedin, bannerUrl: PLACEHOLDER_BANNER };
    const html = render(templateId, fields);

    return response(200, { success: true, html });
  } catch (err) {
    console.error('[previewSignature] Error:', err.message);
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

module.exports = { handler, PLACEHOLDER_BANNER };

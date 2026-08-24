'use strict';

const { validatePreviewRequest } = require('../utils/validation');
const { render, resolvePageTitle, TemplateNotFoundError } = require('../services/templateEngine');

const PLACEHOLDER_BANNER = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120">' +
  '<rect width="100%" height="100%" fill="#e2e8f0"/>' +
  '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
  'font-family="sans-serif" font-size="20" fill="#64748b">Banner Preview</text>' +
  '</svg>'
).toString('base64');

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
    const pageTitle = resolvePageTitle(templateId, fields);

    return response(200, { success: true, html, pageTitle });
  } catch (err) {
    console.error('[previewSignature] Error:', err.message);
    if (err instanceof TemplateNotFoundError) {
      return response(404, { success: false, error: err.message });
    }
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

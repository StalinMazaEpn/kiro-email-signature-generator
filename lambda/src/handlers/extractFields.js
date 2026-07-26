'use strict';

const { validateExtractRequest } = require('../utils/validation');
const { getAIProvider } = require('../providers/aiProvider');

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de contacto de texto libre. Responde únicamente con JSON válido con los campos: nombre, cargo, email, telefono, website, linkedin. Si un campo no está presente, usa null.`;

/**
 * Lambda handler: Extract contact fields from free text using AI.
 *
 * @param {object} event - API Gateway v2 event
 * @returns {object} API Gateway v2 response
 */
async function handler(event) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    const validation = validateExtractRequest(body);
    if (!validation.valid) {
      return response(400, { success: false, error: validation.error });
    }

    const { text } = body;

    // Get AI provider and call model
    const provider = getAIProvider();
    const fullPrompt = `${SYSTEM_PROMPT}\n\nTexto del usuario:\n${text}`;
    const aiResponse = await provider.callModel(fullPrompt);

    // Parse JSON from AI response (handle markdown code blocks)
    let fields;
    try {
      const jsonStr = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      fields = JSON.parse(jsonStr);
    } catch (parseErr) {
      return response(500, {
        success: false,
        error: 'No se pudo interpretar la respuesta de la IA. Intenta con un texto más claro.',
      });
    }

    return response(200, { success: true, fields });
  } catch (err) {
    console.error('[extractFields] Error:', err.message);
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

module.exports = { handler, SYSTEM_PROMPT };

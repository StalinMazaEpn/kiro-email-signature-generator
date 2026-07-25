'use strict';

const { getConfig } = require('../utils/config');

/**
 * Azure OpenAI provider.
 * Calls the Azure OpenAI chat completions endpoint.
 *
 * Required env vars:
 * - AZURE_OPENAI_ENDPOINT
 * - AZURE_OPENAI_KEY
 * - AZURE_OPENAI_DEPLOYMENT
 *
 * @param {string} prompt - Full prompt to send
 * @returns {Promise<string>} Model response text
 */
async function callModel(prompt) {
  const config = getConfig();
  const { endpoint, key, deployment } = config.azure;

  if (!endpoint || !key) {
    throw new Error('Azure OpenAI credentials not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY.');
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': key,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Azure OpenAI error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

module.exports = { callModel };

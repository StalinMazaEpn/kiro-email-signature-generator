'use strict';

const { getConfig } = require('../utils/config');

/**
 * Azure OpenAI provider.
 *
 * Supports two Azure OpenAI endpoint formats:
 *   - legacy (classic resource): https://<resource>.openai.azure.com
 *   - openai-compatible (AI Services): https://<name>.services.ai.azure.com/openai/v1
 *
 * And two APIs, selected with AZURE_OPENAI_API_TYPE:
 *   - "chat"      -> Chat Completions (/chat/completions or /openai/deployments/...)
 *   - "responses" -> Responses API with streaming (/responses, SSE)
 *
 * Required env vars:
 * - AZURE_OPENAI_ENDPOINT
 * - AZURE_OPENAI_KEY
 * - AZURE_OPENAI_DEPLOYMENT
 *
 * Optional: AZURE_OPENAI_API_VERSION, AZURE_OPENAI_API_STYLE (auto|legacy|openai),
 * AZURE_OPENAI_API_TYPE (chat|responses).
 *
 * @param {string} prompt - Full prompt to send
 * @returns {Promise<string>} Model response text
 */
function isDebugEnabled() {
  return /^(true|1)$/i.test(process.env.AZURE_OPENAI_DEBUG || '');
}

/**
 * The classic dated api-version scheme (e.g. "2024-10-21") only applies to the
 * legacy per-resource endpoint (<resource>.openai.azure.com). The newer
 * OpenAI-compatible endpoint (.../openai/v1) uses its own versioning
 * ("preview" or a "-preview" suffixed value) and rejects legacy dated
 * versions with "API version not supported". Auto-correct that mismatch
 * instead of failing every request.
 */
function resolveApiVersion(apiVersion, isOpenAiCompat) {
  const isLegacyDatedVersion = /^\d{4}-\d{2}-\d{2}$/.test(apiVersion || '');
  if (isOpenAiCompat && isLegacyDatedVersion) {
    console.warn(
      `[azure] apiVersion "${apiVersion}" is a legacy dated version and is not valid on the ` +
      '/openai/v1 endpoint. Falling back to "preview". Set AZURE_OPENAI_API_VERSION=preview ' +
      '(or a "-preview" suffixed version) to silence this warning.'
    );
    return 'preview';
  }
  return apiVersion;
}

async function callModel(prompt) {
  const config = getConfig();
  const { endpoint, key, deployment, apiVersion, apiStyle, apiType } = config.azure;

  if (!endpoint || !key) {
    throw new Error('Azure OpenAI credentials not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY.');
  }
  if (!deployment) {
    throw new Error('Azure OpenAI deployment not configured. Set AZURE_OPENAI_DEPLOYMENT.');
  }

  // The "openai" (AI Services) format uses a base URL that ends with /openai/v1.
  const isOpenAiCompat =
    apiStyle === 'openai' ||
    (apiStyle === 'auto' && /\/openai\/v1\/?$/.test(endpoint));

  const resolvedApiVersion = resolveApiVersion(apiVersion, isOpenAiCompat);

  if (isDebugEnabled()) {
    console.log('[azure] config -> endpoint:', endpoint, '| deployment:', deployment, '| apiVersion:', resolvedApiVersion, '| apiStyle:', apiStyle, '| apiType:', apiType, '| openaiCompat:', isOpenAiCompat);
  }

  if (apiType === 'responses') {
    if (!isOpenAiCompat) {
      throw new Error(
        'Azure Responses API requires the new OpenAI-compatible endpoint (ending in /openai/v1). ' +
        'Set AZURE_OPENAI_ENDPOINT accordingly (e.g. https://<name>.services.ai.azure.com/openai/v1).'
      );
    }
    return callResponses(endpoint, deployment, key, resolvedApiVersion, prompt);
  }

  return callChatCompletions(endpoint, deployment, key, resolvedApiVersion, prompt, isOpenAiCompat);
}

/**
 * Chat Completions (legacy or openai-compatible endpoint).
 */
async function callChatCompletions(endpoint, deployment, key, apiVersion, prompt, isOpenAiCompat) {
  let url;
  let body;
  if (isOpenAiCompat) {
    url = `${endpoint}/chat/completions?api-version=${apiVersion}`;
    body = {
      model: deployment,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.1,
    };
  } else {
    url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    body = {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.1,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    console.error('[azure] Request failed (Chat Completions). apiVersion:', apiVersion, '| openaiCompat:', isOpenAiCompat);
    console.error('[azure]   URL   :', url);
    console.error('[azure]   status:', response.status);
    console.error('[azure]   body  :', errorBody);
    throw new Error(`Azure OpenAI error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error(`Azure OpenAI error: unexpected response shape: ${JSON.stringify(data)}`);
  }
  return data.choices[0].message.content;
}

/**
 * Responses API with streaming.
 * Consumes the SSE stream and accumulates `response.output_text.delta` events,
 * equivalent to `openai.responses.stream()`.
 */
async function callResponses(endpoint, deployment, key, apiVersion, prompt) {
  const url = `${endpoint}/responses?api-version=${apiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({
      model: deployment,
      input: prompt,
      stream: true,
      max_output_tokens: 1024,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    console.error('[azure] Request failed (Responses API). apiVersion:', apiVersion);
    console.error('[azure]   URL   :', url);
    console.error('[azure]   status:', response.status);
    console.error('[azure]   body  :', errorBody);
    throw new Error(`Azure OpenAI error (${response.status}): ${errorBody}`);
  }

  if (!response.body) {
    throw new Error('Azure OpenAI Responses API returned no stream body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      for (const line of rawEvent.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') return text;

        let eventObj;
        try {
          eventObj = JSON.parse(data);
        } catch {
          continue;
        }

        if (eventObj.type === 'response.output_text.delta' && eventObj.delta) {
          text += eventObj.delta;
        } else if (eventObj.type === 'response.completed' && eventObj.response && eventObj.response.output_text) {
          return eventObj.response.output_text;
        }
      }
    }
  }

  return text;
}

module.exports = { callModel };


'use strict';

// Ensure Azure provider is selected and a stable config
process.env.AI_PROVIDER = 'azure';

const originalFetch = global.fetch;
global.fetch = jest.fn();

const { callModel } = require('../../src/providers/azureOpenAIProvider');

function resetEnv() {
  process.env.AZURE_OPENAI_ENDPOINT = 'https://my-resource.openai.azure.com';
  process.env.AZURE_OPENAI_KEY = 'secret-key';
  process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-4o-mini';
  delete process.env.AZURE_OPENAI_API_STYLE;
  delete process.env.AZURE_OPENAI_API_VERSION;
  delete process.env.AZURE_OPENAI_API_TYPE;
}

function okJson(jsonBody) {
  return { ok: true, json: async () => jsonBody, text: async () => '', body: null };
}

beforeEach(() => {
  resetEnv();
  global.fetch.mockReset();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('azureOpenAIProvider — Chat Completions (legacy endpoint)', () => {
  test('uses /openai/deployments/:deploy/chat/completions and no model in body', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ choices: [{ message: { content: 'hola' } }] }));
    const result = await callModel('extract');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21');
    expect(JSON.parse(opts.body).model).toBeUndefined();
    expect(result).toBe('hola');
  });
});

describe('azureOpenAIProvider — Chat Completions (openai-compatible endpoint)', () => {
  test('uses /chat/completions and sends model in body when endpoint ends with /openai/v1', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://ai-sm-models.services.ai.azure.com/openai/v1';
    global.fetch.mockResolvedValueOnce(okJson({ choices: [{ message: { content: 'hola' } }] }));
    const result = await callModel('extract');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('https://ai-sm-models.services.ai.azure.com/openai/v1/chat/completions?api-version=');
    expect(JSON.parse(opts.body).model).toBe('gpt-4o-mini');
    expect(result).toBe('hola');
  });
});

describe('azureOpenAIProvider — Responses API (streaming)', () => {
  test('accumulates response.output_text.delta events and returns joined text', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://ai-sm-models.services.ai.azure.com/openai/v1';
    process.env.AZURE_OPENAI_API_TYPE = 'responses';

    const chunk =
      'data: {"type":"response.created"}\n\n' +
      'data: {"type":"response.output_text.delta","delta":"Hola"}\n\n' +
      'data: {"type":"response.output_text.delta","delta":" mundo"}\n\n' +
      'data: [DONE]\n\n';
    const bytes = Buffer.from(chunk, 'utf8');
    let reads = 0;
    const reader = {
      read: async () => (reads++ === 0 ? { done: false, value: bytes } : { done: true, value: undefined }),
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '',
      body: { getReader: () => reader },
    });

    const result = await callModel('solve');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/responses?api-version=');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.stream).toBe(true);
    expect(result).toBe('Hola mundo');
  });

  test('throws when responses requested on a legacy endpoint', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my-resource.openai.azure.com';
    process.env.AZURE_OPENAI_API_TYPE = 'responses';
    await expect(callModel('x')).rejects.toThrow(/Responses API requires/);
  });
});
'use strict';

describe('aiProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('getAIProvider returns azure provider when AI_PROVIDER=azure', () => {
    process.env.AI_PROVIDER = 'azure';
    const { getAIProvider } = require('../../src/providers/aiProvider');
    const provider = getAIProvider();
    expect(provider).toHaveProperty('callModel');
    expect(typeof provider.callModel).toBe('function');
  });

  test('getAIProvider returns bedrock provider when AI_PROVIDER=bedrock', () => {
    process.env.AI_PROVIDER = 'bedrock';
    const { getAIProvider } = require('../../src/providers/aiProvider');
    const provider = getAIProvider();
    expect(provider).toHaveProperty('callModel');
    expect(typeof provider.callModel).toBe('function');
  });

  test('getAIProvider throws on unknown provider', () => {
    process.env.AI_PROVIDER = 'openai';
    const { getAIProvider } = require('../../src/providers/aiProvider');
    expect(() => getAIProvider()).toThrow('Unknown AI_PROVIDER');
  });

  test('defaults to azure when AI_PROVIDER not set', () => {
    delete process.env.AI_PROVIDER;
    const { getAIProvider } = require('../../src/providers/aiProvider');
    const provider = getAIProvider();
    expect(provider).toHaveProperty('callModel');
  });
});

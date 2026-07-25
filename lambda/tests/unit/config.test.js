'use strict';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('getConfig returns defaults when no env vars set', () => {
    process.env = {};
    const { getConfig } = require('../../src/utils/config');
    const config = getConfig();

    expect(config.appMode).toBe('local');
    expect(config.bucketName).toBe('signature-generator-assets');
    expect(config.aiProvider).toBe('azure');
    expect(config.port).toBe(3000);
  });

  test('getConfig reads env vars correctly', () => {
    process.env.APP_MODE = 'aws';
    process.env.S3_BUCKET_NAME = 'my-bucket';
    process.env.AI_PROVIDER = 'bedrock';
    process.env.PORT = '4000';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my-resource.openai.azure.com';
    process.env.AZURE_OPENAI_KEY = 'secret-key';

    const { getConfig } = require('../../src/utils/config');
    const config = getConfig();

    expect(config.appMode).toBe('aws');
    expect(config.bucketName).toBe('my-bucket');
    expect(config.aiProvider).toBe('bedrock');
    expect(config.port).toBe(4000);
    expect(config.azure.endpoint).toBe('https://my-resource.openai.azure.com');
    expect(config.azure.key).toBe('secret-key');
  });

  test('isLocalMode returns true when APP_MODE=local', () => {
    process.env.APP_MODE = 'local';
    const { isLocalMode } = require('../../src/utils/config');
    expect(isLocalMode()).toBe(true);
  });

  test('isLocalMode returns false when APP_MODE=aws', () => {
    process.env.APP_MODE = 'aws';
    const { isLocalMode } = require('../../src/utils/config');
    expect(isLocalMode()).toBe(false);
  });
});

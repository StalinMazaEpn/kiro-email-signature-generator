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

    expect(config.storageProvider).toBe('local');
    expect(config.bucketName).toBe('signature-generator-assets');
    expect(config.aiProvider).toBe('azure');
    expect(config.azureStorage.accountName).toBe('');
    expect(config.azure.apiVersion).toBe('2024-10-21');
    expect(config.azure.apiStyle).toBe('auto');
    expect(config.azure.apiType).toBe('chat');
    expect(config.port).toBe(3005);
  });

  test('getConfig reads env vars correctly', () => {
    process.env.S3_BUCKET_NAME = 'my-bucket';
    process.env.AI_PROVIDER = 'bedrock';
    process.env.STORAGE_PROVIDER = 'azure';
    process.env.AZURE_ACCOUNT_NAME = 'myaccount';
    process.env.AZURE_ACCOUNT_KEY = 'mykey';
    process.env.AZURE_CONTAINER_NAME = 'mycontainer';
    process.env.PORT = '4000';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my-resource.openai.azure.com';
    process.env.AZURE_OPENAI_KEY = 'secret-key';
    process.env.AZURE_OPENAI_API_VERSION = '2025-03-01-preview';
    process.env.AZURE_OPENAI_API_STYLE = 'openai';
    process.env.AZURE_OPENAI_API_TYPE = 'responses';

    const { getConfig } = require('../../src/utils/config');
    const config = getConfig();

    expect(config.storageProvider).toBe('azure');
    expect(config.bucketName).toBe('my-bucket');
    expect(config.aiProvider).toBe('bedrock');
    expect(config.azureStorage.accountName).toBe('myaccount');
    expect(config.azureStorage.accountKey).toBe('mykey');
    expect(config.azureStorage.containerName).toBe('mycontainer');
    expect(config.port).toBe(4000);
    expect(config.azure.endpoint).toBe('https://my-resource.openai.azure.com');
    expect(config.azure.key).toBe('secret-key');
    expect(config.azure.apiVersion).toBe('2025-03-01-preview');
    expect(config.azure.apiStyle).toBe('openai');
    expect(config.azure.apiType).toBe('responses');
  });

  test('storageProvider defaults to local when unset', () => {
    delete process.env.STORAGE_PROVIDER;
    const { getConfig } = require('../../src/utils/config');
    expect(getConfig().storageProvider).toBe('local');
  });

  test('storageProvider respects STORAGE_PROVIDER=s3 regardless of other env vars', () => {
    process.env.STORAGE_PROVIDER = 's3';
    const { getConfig } = require('../../src/utils/config');
    expect(getConfig().storageProvider).toBe('s3');
  });
});

'use strict';

/**
 * Centralized configuration from environment variables.
 * APP_MODE=local enables local dev mode (mocks S3, skips real image-tools).
 */
function getConfig() {
  return {
    appMode: process.env.APP_MODE || 'local',
    bucketName: process.env.S3_BUCKET_NAME || 'signature-generator-assets',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    imageToolsUrl: process.env.IMAGE_TOOLS_URL || '',
    imageToolsApiKey: process.env.IMAGE_TOOLS_API_KEY || '',
    backgroundTemplateUrl: process.env.BACKGROUND_TEMPLATE_URL || '',
    aiProvider: process.env.AI_PROVIDER || 'azure',
    azure: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      key: process.env.AZURE_OPENAI_KEY || '',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
    },
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
      region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
    },
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
    port: parseInt(process.env.PORT, 10) || 3000,
  };
}

/**
 * Returns true when running in local development mode.
 */
function isLocalMode() {
  return getConfig().appMode === 'local';
}

module.exports = { getConfig, isLocalMode };

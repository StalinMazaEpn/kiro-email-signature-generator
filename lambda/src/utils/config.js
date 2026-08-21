'use strict';

/**
 * Centralized configuration from environment variables.
 * STORAGE_PROVIDER ("local" | "s3" | "azure") is the single source of truth
 * for where uploads go; it defaults to "local" (filesystem, no cloud needed).
 */
function getConfig() {
  return {
    storageProvider: process.env.STORAGE_PROVIDER || 'local',
    bucketName: process.env.S3_BUCKET_NAME || 'signature-generator-assets',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    imageToolsUrl: process.env.IMAGE_TOOLS_URL || '',
    imageToolsApiKey: process.env.IMAGE_TOOLS_API_KEY || '',
    backgroundTemplateUrl: process.env.BACKGROUND_TEMPLATE_URL || '',
    azureStorage: {
      accountName: process.env.AZURE_ACCOUNT_NAME || '',
      accountKey: process.env.AZURE_ACCOUNT_KEY || '',
      containerName: process.env.AZURE_CONTAINER_NAME || '',
    },
    aiProvider: process.env.AI_PROVIDER || 'azure',
    azure: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      key: process.env.AZURE_OPENAI_KEY || '',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
      apiStyle: process.env.AZURE_OPENAI_API_STYLE || 'auto', // auto | legacy | openai
      apiType: process.env.AZURE_OPENAI_API_TYPE || 'chat',   // chat | responses
    },
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
      region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
    },
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
    port: parseInt(process.env.PORT, 10) || 3005,
  };
}

module.exports = { getConfig };

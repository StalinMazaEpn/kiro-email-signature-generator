'use strict';

const { getConfig } = require('../utils/config');

/**
 * Factory that returns the configured AI provider.
 * @returns {{ callModel: (prompt: string) => Promise<string> }}
 */
function getAIProvider() {
  const config = getConfig();
  const provider = config.aiProvider;

  switch (provider) {
    case 'azure':
      return require('./azureOpenAIProvider');
    case 'bedrock':
      return require('./bedrockProvider');
    default:
      throw new Error(`Unknown AI_PROVIDER: "${provider}". Valid options: azure, bedrock`);
  }
}

module.exports = { getAIProvider };

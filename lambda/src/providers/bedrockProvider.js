'use strict';

const { getConfig } = require('../utils/config');

/**
 * AWS Bedrock provider (Claude models).
 * Uses the AWS SDK v3 InvokeModel command.
 *
 * Required env vars:
 * - BEDROCK_MODEL_ID (defaults to Claude 3 Haiku)
 * - BEDROCK_REGION (defaults to AWS_REGION)
 *
 * @param {string} prompt - Full prompt to send
 * @returns {Promise<string>} Model response text
 */
async function callModel(prompt) {
  const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
  const config = getConfig();

  const client = new BedrockRuntimeClient({ region: config.bedrock.region });

  const command = new InvokeModelCommand({
    modelId: config.bedrock.modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));

  if (!body.content || !body.content[0] || !body.content[0].text) {
    throw new Error('Unexpected Bedrock response format');
  }

  return body.content[0].text;
}

module.exports = { callModel };

'use strict';

const { isLocalMode, getConfig } = require('../utils/config');
const { upload, getBannerKey } = require('./storageService');

/**
 * Call the image-tools external API to process a photo into a banner.
 * In local mode: tries the real image-tools service if configured, otherwise
 * falls back to copying the original image as the "banner".
 *
 * @param {string} sourceImageUrl - Public URL of the uploaded original image
 * @param {string} nombre - User's name (for generating banner key)
 * @param {Buffer|null} originalImageBuffer - Original image buffer (used in local mode fallback)
 * @param {object} compositionParams - Image composition parameters (scalePercent, horizontalAlign, verticalAlign, paddingPercent, offsetX, offsetY)
 * @returns {Promise<string>} Public URL of the processed banner
 */
async function createBanner(sourceImageUrl, nombre, originalImageBuffer = null, compositionParams = {}) {
  if (isLocalMode()) {
    const config = getConfig();
    // If IMAGE_TOOLS_URL is configured, try the real service even in local mode
    if (config.imageToolsUrl && config.backgroundTemplateUrl) {
      try {
        return await createBannerRemote(sourceImageUrl, nombre, compositionParams);
      } catch (err) {
        console.warn('[imageToolsClient] Remote service failed, falling back to local copy:', err.message);
        return createBannerLocal(sourceImageUrl, nombre, originalImageBuffer);
      }
    }
    return createBannerLocal(sourceImageUrl, nombre, originalImageBuffer);
  }
  return createBannerRemote(sourceImageUrl, nombre, compositionParams);
}

/**
 * Local mock: copies the original as the "banner" for dev purposes.
 * This lets you test the full flow without needing the external image-tools service.
 */
async function createBannerLocal(sourceImageUrl, nombre, originalImageBuffer) {
  if (originalImageBuffer) {
    const bannerKey = getBannerKey(nombre);
    const bannerUrl = await upload(bannerKey, originalImageBuffer, 'image/png');
    return bannerUrl;
  }
  // If no buffer provided, just return the source URL as-is for preview
  return sourceImageUrl;
}

/**
 * Production: calls the real image-tools API.
 * POST to image-tools with imageUrl + backgroundUrl, get download_url back,
 * download the result, upload to S3.
 */
async function createBannerRemote(sourceImageUrl, nombre, compositionParams = {}) {
  const config = getConfig();

  if (!config.imageToolsUrl) {
    throw new Error('IMAGE_TOOLS_URL environment variable is not configured. Set APP_MODE=local to use mock mode.');
  }

  if (!config.backgroundTemplateUrl) {
    throw new Error('BACKGROUND_TEMPLATE_URL environment variable is not configured.');
  }
  console.log('createBannerRemote', sourceImageUrl, nombre)
  // Step 1: Call image-tools API
  const requestBody = {
    imageUrl: sourceImageUrl,
    backgroundUrl: config.backgroundTemplateUrl,
    outputFilename: `${nombre.replace(/[^a-zA-Z0-9_-]/g, '_')}-banner.png`,
    horizontalAlign: compositionParams.horizontalAlign || 'center',
    verticalAlign: compositionParams.verticalAlign || 'center',
    scalePercent: compositionParams.scalePercent || 94,
    paddingPercent: compositionParams.paddingPercent || 0,
    offsetX: compositionParams.offsetX || 0,
    offsetY: compositionParams.offsetY || 0,
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (config.imageToolsApiKey) {
    headers['X-API-KEY'] = config.imageToolsApiKey;
  }

  let response;
  try {
    response = await fetch(config.imageToolsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new Error(`Image-tools service unreachable at ${config.imageToolsUrl}: ${err.message}`);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Image processing failed (${response.status}): ${errorBody}`);
  }

  const result = await response.json();

  if (!result.download_url) {
    throw new Error('Image-tools response missing download_url field');
  }

  // Step 2: Download the processed image
  let downloadResponse;
  try {
    downloadResponse = await fetch(result.download_url);
  } catch (err) {
    throw new Error(`Failed to download processed banner: ${err.message}`);
  }

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download processed banner (${downloadResponse.status})`);
  }

  const bannerBuffer = Buffer.from(await downloadResponse.arrayBuffer());

  // Step 3: Upload banner to storage
  const bannerKey = getBannerKey(nombre);
  const bannerUrl = await upload(bannerKey, bannerBuffer, 'image/png');

  return bannerUrl;
}

module.exports = { createBanner };

'use strict';

const { getConfig } = require('../utils/config');
const { loadTemplateConfig } = require('./templateEngine');
const { uploadBanner } = require('./templateStorage');

/** Full pill/circle rounding, per image-tools' cornerRadiusPercent contract (0-50, 50 = fully rounded). */
const FULL_ROUND_CORNER_RADIUS_PERCENT = 50;

/**
 * Call the image-tools external API to process a photo into a banner.
 * In local mode: tries the real image-tools service if configured, otherwise
 * falls back to copying the original image as the "banner".
 *
 * @param {string} sourceImageUrl - Public URL of the uploaded original image
 * @param {string} nombre - User's name (for generating banner key)
 * @param {Buffer|null} originalImageBuffer - Original image buffer (used in local mode fallback)
 * @param {object} compositionParams - Image composition parameters (scalePercent, horizontalAlign, verticalAlign, paddingPercent, offsetX, offsetY)
 * @param {string|null} customBackgroundUrl - Optional custom background image URL (overrides BACKGROUND_TEMPLATE_URL)
 * @param {string} templateId - Selected template id (decides the banner's storage destination, see templateStorage.js, and whether it's rounded via config.json's banner.round)
 * @param {object} fields - Signature fields (nombre, cargo, email, ...), used for the banner's storage destination/filename
 * @returns {Promise<string>} Public URL of the processed banner
 */
async function createBanner(sourceImageUrl, nombre, originalImageBuffer = null, compositionParams = {}, customBackgroundUrl = null, templateId, fields) {
  const config = getConfig();
  // banner.round in the template's config.json (see templateStorage.js docs)
  // opts into fully rounded corners (pill/circle) — only image-tools (the
  // remote path) can actually apply it; the local fallback just copies the
  // original photo, so it has nothing to round.
  const templateConfig = templateId ? loadTemplateConfig(templateId) : null;
  const round = !!templateConfig?.banner?.round;

  // A remote image-tools service (whether local or in the cloud) can only ever
  // fetch a URL it can reach: an HTTPS, publicly resolvable address. A
  // "http://localhost:PORT/..." URL from our own dev storage is neither, so
  // skip the doomed network round-trip and go straight to the local fallback
  // instead of surfacing a confusing "Bad Request" from the remote API.
  if (!isPubliclyFetchable(sourceImageUrl)) {
    const reason = 'IMAGE_TOOLS_URL configurado pero la imagen de origen no es una URL HTTPS pública';
    console.warn(
      `[imageToolsClient] Se omite la llamada a image-tools: ${reason}.\n` +
      `  Imagen de origen : ${sourceImageUrl}\n` +
      '  Causa            : image-tools solo procesa imágenes en URLs HTTPS accesibles ' +
      'desde fuera (S3, Azure Blob Storage, etc). No puede alcanzar tu servidor local ' +
      '(localhost/IP privada), ni acepta HTTP.\n' +
      '  Esto NO es un bug: es una restricción del servicio externo image-tools.\n' +
      '  Recomendación    : para probar el procesamiento real de imágenes en desarrollo, ' +
      'configura STORAGE_PROVIDER=s3 (AWS) o STORAGE_PROVIDER=azure en tu .env, en vez de ' +
      '"local", para que las imágenes se suban a un storage público con HTTPS real. ' +
      'Alternativamente, expón tu servidor local con un túnel HTTPS (ej. ngrok) y usa esa ' +
      'URL pública como base de storage.\n' +
      '  Se usará el fallback local (foto original sin banner procesado) para continuar la prueba.'
    );
    const url = await createBannerLocal(sourceImageUrl, nombre, originalImageBuffer, templateId, fields);
    return { url, usedFallback: true, fallbackReason: reason };
  }

  // Try remote image-tools if URL is configured
  if (config.imageToolsUrl && (config.backgroundTemplateUrl || customBackgroundUrl)) {
    try {
      const url = await createBannerRemote(sourceImageUrl, nombre, compositionParams, customBackgroundUrl, templateId, fields, round);
      return { url, usedFallback: false };
    } catch (err) {
      console.warn(
        `[imageToolsClient] La llamada a image-tools falló, se usará el fallback local.\n` +
        `  Detalle: ${err.message}\n` +
        '  Si el error menciona URL HTTPS/pública, es una restricción del servicio externo ' +
        'image-tools (no procesa imágenes servidas por HTTP o desde localhost/IP privada), ' +
        'no un bug de esta app. Usa STORAGE_PROVIDER=s3 o azure para tener storage HTTPS ' +
        'público, o un túnel HTTPS (ngrok) hacia tu servidor local.'
      );
      // Fallback: use original image as banner (works in both local and aws modes)
      const url = await createBannerLocal(sourceImageUrl, nombre, originalImageBuffer, templateId, fields);
      return { url, usedFallback: true, fallbackReason: err.message };
    }
  }

  // No image-tools configured: use fallback
  const url = await createBannerLocal(sourceImageUrl, nombre, originalImageBuffer, templateId, fields);
  return { url, usedFallback: true, fallbackReason: 'IMAGE_TOOLS_URL not configured' };
}

/**
 * Checks whether a URL is HTTPS and points to something other than localhost/
 * a loopback/private address — i.e. something an external service could
 * actually fetch. Best-effort: it can't verify real internet reachability,
 * but it filters out the URLs that are certain to fail.
 */
function isPubliclyFetchable(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
  if (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(hostname)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return false;
  return true;
}

/**
 * Masks an API key for logging, keeping only the first/last few characters.
 */
function maskKey(key) {
  if (!key || key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

const DEFAULT_FETCH_TIMEOUT_MS = 20000;

/**
 * fetch() has no timeout by default — if the remote server accepts the
 * connection but never responds (or a proxy in between drops the response
 * silently), the request hangs forever instead of failing. Wrap it with an
 * AbortController so a stuck request fails fast with a clear error instead
 * of blocking the whole request indefinitely.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Local mock: copies the original as the "banner" for dev purposes.
 * This lets you test the full flow without needing the external image-tools service.
 */
async function createBannerLocal(sourceImageUrl, nombre, originalImageBuffer, templateId, fields) {
  if (originalImageBuffer) {
    const { url } = await uploadBanner(templateId, fields, originalImageBuffer, 'image/png');
    return url;
  }
  // If no buffer provided, just return the source URL as-is for preview
  return sourceImageUrl;
}

/**
 * Production: calls the real image-tools API.
 * POST to image-tools with imageUrl + backgroundUrl, get download_url back,
 * download the result, upload to S3.
 */
async function createBannerRemote(sourceImageUrl, nombre, compositionParams = {}, customBackgroundUrl = null, templateId, fields, round = false) {
  const config = getConfig();

  if (!config.imageToolsUrl) {
    throw new Error('IMAGE_TOOLS_URL environment variable is not configured. Leave it unset to use the local fallback (original photo as banner).');
  }

  if (!config.backgroundTemplateUrl && !customBackgroundUrl) {
    throw new Error('No background configured. Set BACKGROUND_TEMPLATE_URL or provide a custom background image.');
  }

  // Step 1: Call image-tools API
  const requestBody = {
    imageUrl: sourceImageUrl,
    backgroundUrl: customBackgroundUrl || config.backgroundTemplateUrl,
    outputFilename: `${nombre.replace(/[^a-zA-Z0-9_-]/g, '_')}-banner.png`,
    horizontalAlign: compositionParams.horizontalAlign || 'center',
    verticalAlign: compositionParams.verticalAlign || 'center',
    scalePercent: compositionParams.scalePercent || 94,
    paddingPercent: compositionParams.paddingPercent || 0,
    offsetX: compositionParams.offsetX || 0,
    offsetY: compositionParams.offsetY || 0,
    cornerRadiusPercent: round ? FULL_ROUND_CORNER_RADIUS_PERCENT : 0,
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (config.imageToolsApiKey) {
    headers['X-API-KEY'] = config.imageToolsApiKey;
  }

  console.log('[imageToolsClient] Request -> POST', config.imageToolsUrl);
  console.log('[imageToolsClient]   X-API-KEY sent:', !!config.imageToolsApiKey, config.imageToolsApiKey ? `(${maskKey(config.imageToolsApiKey)})` : '');
  console.log('[imageToolsClient]   body:', JSON.stringify(requestBody));

  let response;
  try {
    response = await fetchWithTimeout(config.imageToolsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error('[imageToolsClient] Request failed (network error or timeout):', err.message);
    throw new Error(`Image-tools service unreachable at ${config.imageToolsUrl}: ${err.message}`);
  }

  const responseBodyText = await response.text().catch(() => '');
  console.log('[imageToolsClient] Response <-', response.status, responseBodyText);

  if (!response.ok) {
    throw new Error(`Image processing failed (${response.status}): ${responseBodyText || 'Unknown error'}`);
  }

  const result = JSON.parse(responseBodyText);

  if (!result.download_url) {
    throw new Error('Image-tools response missing download_url field');
  }

  // Step 2: Download the processed image.
  // Send the same X-API-KEY as the initial request: some image-tools
  // deployments gate the temporary download URL behind the same auth,
  // returning 404 (not 401) for an unauthenticated request to avoid leaking
  // whether the file exists.
  const downloadHeaders = {};
  if (config.imageToolsApiKey) {
    downloadHeaders['X-API-KEY'] = config.imageToolsApiKey;
  }

  // Retry with backoff: some image-tools deployments respond with the
  // download_url slightly before the temp file has finished being written
  // to disk, so an immediate download can 404 even though the exact same
  // URL works a moment later (e.g. when tested manually in a browser).
  const DOWNLOAD_RETRY_DELAYS_MS = [0, 300, 700, 1500];
  let downloadResponse;
  let lastDownloadErrorBody = '';

  for (let attempt = 0; attempt < DOWNLOAD_RETRY_DELAYS_MS.length; attempt++) {
    if (DOWNLOAD_RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_RETRY_DELAYS_MS[attempt]));
    }

    const attemptStart = Date.now();
    console.log(`[imageToolsClient] Downloading (intento ${attempt + 1}/${DOWNLOAD_RETRY_DELAYS_MS.length}) ->`, result.download_url);

    try {
      downloadResponse = await fetchWithTimeout(result.download_url, { headers: downloadHeaders });
    } catch (err) {
      console.error('[imageToolsClient] Download failed (network error or timeout):', err.message);
      throw new Error(`Failed to download processed banner: ${err.message}`);
    }

    console.log(`[imageToolsClient] Download response <- ${downloadResponse.status} (${Date.now() - attemptStart}ms), content-type: ${downloadResponse.headers.get('content-type')}`);

    if (downloadResponse.ok) break;

    lastDownloadErrorBody = await downloadResponse.clone().text().catch(() => '');
    console.warn(`[imageToolsClient]   intento ${attempt + 1} falló con ${downloadResponse.status}: ${lastDownloadErrorBody || '(sin body)'}`);
  }

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download processed banner (${downloadResponse.status}) after ${DOWNLOAD_RETRY_DELAYS_MS.length} intentos: ${lastDownloadErrorBody || 'Unknown error'}`);
  }

  console.log('[imageToolsClient] Descarga OK, leyendo buffer...');
  const bannerBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  console.log(`[imageToolsClient] Buffer leído (${bannerBuffer.length} bytes), subiendo a storage (${config.storageProvider})...`);

  // Step 3: Upload banner to storage
  const { url: bannerUrl } = await uploadBanner(templateId, fields, bannerBuffer, 'image/png');
  console.log('[imageToolsClient] Upload de banner completo ->', bannerUrl);

  return bannerUrl;
}

module.exports = { createBanner };

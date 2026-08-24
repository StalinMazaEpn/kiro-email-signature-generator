'use strict';

const { loadTemplateConfig } = require('./templateEngine');
const { upload, uploadFtp, uploadSftp, listFtp, listSftp, getBannerKey, sanitizeForFilename } = require('./storageService');

/**
 * Thrown when a template's config.json enables a custom banner storage
 * destination (banner.storage.enabled !== false) but the setup is
 * incomplete — missing credentials or required fields. Deliberately not
 * caught anywhere with a silent fallback: generating a signature whose
 * banner points at a broken/default URL because of a misconfigured FTP is
 * worse than failing the request outright. Set `enabled: false` in
 * config.json to opt out of the custom destination on purpose.
 */
class TemplateStorageConfigError extends Error {
  constructor(templateId, message) {
    super(`Custom banner storage for template "${templateId}" is misconfigured: ${message}`);
    this.name = 'TemplateStorageConfigError';
    this.templateId = templateId;
  }
}

const EXTENSION_BY_CONTENT_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Turns "María López" into "maria.lopez": lowercase, accents/diacritics
 * stripped (via Unicode NFD decomposition, so "í"→"i", "ó"→"o", etc. instead
 * of being dropped outright), one word per space, joined with dots. Used by
 * the {nombreDot} filenamePattern placeholder for the common
 * "firstname.lastname" naming convention.
 * @param {string} nombre
 * @returns {string}
 */
const COMBINING_DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

function toDottedName(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_REGEX, '') // strip combining diacritical marks left by NFD
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .join('.');
}

/**
 * Extracts the local part of an email (before the "@") for use as a
 * filename, e.g. "maria.lopez@empresa.com" → "maria.lopez". Unlike
 * sanitizeForFilename (used by the plain {email} placeholder), this keeps
 * dots — they're the whole point when the local part already reads as
 * "firstname.lastname" — and only strips characters that would be unsafe in
 * a filename/URL. Used by the {emailUser} filenamePattern placeholder.
 * @param {string} email
 * @returns {string}
 */
function sanitizeEmailUser(email) {
  const localPart = String(email || '').split('@')[0];
  return localPart.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
}

/**
 * Resolves a filenamePattern like "{nombre}-{timestamp}.{ext}" against the
 * signature's fields, sanitizing each substituted value the same way
 * getBannerKey does.
 * @param {string} pattern
 * @param {object} fields - { nombre, cargo, email, ... }
 * @param {string} ext
 * @returns {string}
 */
function resolveBannerFilename(pattern, fields, ext) {
  const values = {
    nombre: sanitizeForFilename(fields.nombre),
    nombreDot: toDottedName(fields.nombre),
    cargo: sanitizeForFilename(fields.cargo),
    email: sanitizeForFilename(fields.email),
    emailUser: sanitizeEmailUser(fields.email),
    timestamp: String(Date.now()),
    ext,
  };
  return pattern.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in values)) {
      throw new Error(`Unknown filenamePattern placeholder "{${key}}"`);
    }
    return values[key];
  });
}

/**
 * Uploads a processed banner, honoring a per-template custom storage
 * destination declared in that template's config.json (banner.storage).
 * Falls back to the app's default global storage (storageService.upload +
 * getBannerKey) only when the template has no config.json, no
 * banner.storage block, or banner.storage.enabled === false — those are the
 * only two ways this ever uses the default. Any other failure (missing
 * credentials, upload error) throws TemplateStorageConfigError / the
 * underlying error instead of silently falling back.
 *
 * @param {string} templateId
 * @param {object} fields - { nombre, cargo, email, ... }
 * @param {Buffer} buffer
 * @param {string} contentType
 * @returns {Promise<{url: string}>}
 */
async function uploadBanner(templateId, fields, buffer, contentType) {
  const config = loadTemplateConfig(templateId);
  const storage = config?.banner?.storage;

  if (!storage || storage.enabled === false) {
    const url = await upload(getBannerKey(fields.nombre), buffer, contentType);
    return { url };
  }

  const { type, conn, publicBaseUrl } = resolveStorageConnection(templateId, storage);

  const ext = EXTENSION_BY_CONTENT_TYPE[contentType] || 'png';
  const filename = resolveBannerFilename(config.banner.filenamePattern || '{nombre}-{timestamp}.{ext}', fields, ext);

  if (type === 'ftp') {
    await uploadFtp(conn, filename, buffer);
  } else {
    await uploadSftp(conn, filename, buffer);
  }

  const url = `${publicBaseUrl.replace(/\/$/, '')}/${filename}`;
  return { url };
}

/**
 * Resolves a template's `banner.storage` config into a connection object
 * plus credentials read from the environment, applying the same validation
 * uploadBanner does. Shared by uploadBanner and listTemplateFiles so the
 * config/credential resolution rules only live in one place.
 * @param {string} templateId
 * @param {object} storage - config.banner.storage block
 * @returns {{type: 'ftp'|'sftp', conn: object, publicBaseUrl: string}}
 */
function resolveStorageConnection(templateId, storage) {
  const { type, host, remotePath, publicBaseUrl, port, secure } = storage;

  if (type !== 'ftp' && type !== 'sftp') {
    throw new TemplateStorageConfigError(templateId, `unsupported storage.type "${type}" (expected "ftp" or "sftp")`);
  }
  for (const field of ['host', 'remotePath', 'publicBaseUrl']) {
    if (!storage[field]) {
      throw new TemplateStorageConfigError(templateId, `missing required config field "banner.storage.${field}"`);
    }
  }

  const envPrefix = `FTP_${templateId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const user = process.env[`${envPrefix}_USER`];
  const password = process.env[`${envPrefix}_PASSWORD`];
  if (!user || !password) {
    throw new TemplateStorageConfigError(
      templateId,
      `missing environment credentials ${envPrefix}_USER / ${envPrefix}_PASSWORD`
    );
  }

  return { type, conn: { host, port, secure, remotePath, user, password }, publicBaseUrl };
}

/**
 * Lists the files in a template's custom banner storage destination
 * (read-only — never uploads/deletes). Used by the admin panel's file
 * browser. Returns null when the template has no custom storage configured
 * (nothing to browse beyond the app's default storage).
 * @param {string} templateId
 * @returns {Promise<{type: string, remotePath: string, publicBaseUrl: string, files: Array} | null>}
 */
async function listTemplateFiles(templateId) {
  const config = loadTemplateConfig(templateId);
  const storage = config?.banner?.storage;

  if (!storage || storage.enabled === false) {
    return null;
  }

  const { type, conn, publicBaseUrl } = resolveStorageConnection(templateId, storage);
  const files = type === 'ftp' ? await listFtp(conn) : await listSftp(conn);

  return { type, remotePath: conn.remotePath, publicBaseUrl, files };
}

module.exports = {
  uploadBanner,
  listTemplateFiles,
  resolveBannerFilename,
  TemplateStorageConfigError,
};

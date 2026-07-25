'use strict';

const path = require('path');
const fs = require('fs');
const { isLocalMode, getConfig } = require('../utils/config');

// Local storage directory for dev mode
const LOCAL_STORAGE_DIR = path.join(__dirname, '../../local-storage');

/**
 * Ensures local storage directories exist in dev mode.
 */
function ensureLocalDirs() {
  const dirs = [
    LOCAL_STORAGE_DIR,
    path.join(LOCAL_STORAGE_DIR, 'originals'),
    path.join(LOCAL_STORAGE_DIR, 'banners'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Upload a file to storage.
 * In local mode: writes to lambda/local-storage/{key}
 * In AWS mode: uploads to S3 bucket
 *
 * @param {string} key - Object key (e.g. "originals/timestamp-name.png")
 * @param {Buffer} body - File contents
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL of the uploaded file
 */
async function upload(key, body, contentType) {
  if (isLocalMode()) {
    return uploadLocal(key, body);
  }
  return uploadS3(key, body, contentType);
}

/**
 * Local file system storage for development.
 */
function uploadLocal(key, body) {
  ensureLocalDirs();
  const filepath = path.join(LOCAL_STORAGE_DIR, key);
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, body);

  const config = getConfig();
  // Return a URL that the local dev server can serve
  return `http://localhost:${config.port}/storage/${key}`;
}

/**
 * AWS S3 storage for production.
 */
async function uploadS3(key, body, contentType) {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const config = getConfig();

  const s3 = new S3Client({ region: config.awsRegion });
  await s3.send(new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return `https://${config.bucketName}.s3.amazonaws.com/${key}`;
}

/**
 * Generate a storage key for an original image.
 * @param {string} nombre - User's name
 * @param {string} extension - File extension (png, jpg, etc.)
 * @returns {string}
 */
function getOriginalKey(nombre, extension = 'png') {
  const sanitized = nombre.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return `originals/${Date.now()}-${sanitized}.${extension}`;
}

/**
 * Generate a storage key for a processed banner.
 * @param {string} nombre - User's name
 * @returns {string}
 */
function getBannerKey(nombre) {
  const sanitized = nombre.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return `banners/${Date.now()}-${sanitized}-banner.png`;
}

module.exports = {
  upload,
  getOriginalKey,
  getBannerKey,
  LOCAL_STORAGE_DIR,
};

'use strict';

const path = require('path');
const fs = require('fs');
const { getConfig } = require('../utils/config');

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
  const config = getConfig();
  switch (config.storageProvider) {
    case 'azure':
      return uploadAzure(key, body, contentType);
    case 's3':
      return uploadS3(key, body, contentType);
    default:
      return uploadLocal(key, body);
  }
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
 * Azure Blob Storage upload.
 * Uploads to an Azure Storage container and returns the public blob URL.
 * @param {string} key - Blob name (e.g. "originals/timestamp-name.png")
 * @param {Buffer} body - File contents
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL of the uploaded blob
 */
async function uploadAzure(key, body, contentType) {
  const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
  const config = getConfig();
  const { accountName, accountKey, containerName } = config.azureStorage;

  if (!accountName || !accountKey || !containerName) {
    throw new Error('Azure Storage not fully configured. Set AZURE_ACCOUNT_NAME, AZURE_ACCOUNT_KEY and AZURE_CONTAINER_NAME.');
  }

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const client = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlockBlobClient(key);

  // The Azure SDK has no default timeout — a stuck connection (bad
  // credentials, firewall, DNS) would otherwise hang the upload forever.
  const UPLOAD_TIMEOUT_MS = 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  console.log(`[storageService] Azure upload -> container "${containerName}", key "${key}" (${body.length} bytes)`);
  const start = Date.now();

  try {
    await blobClient.upload(body, body.length, {
      blobHTTPHeaders: { blobContentType: contentType },
      abortSignal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Azure upload timed out after ${UPLOAD_TIMEOUT_MS}ms (key: ${key})`);
    }
    console.error('[storageService] Azure upload failed:', err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  console.log(`[storageService] Azure upload done in ${Date.now() - start}ms`);

  return `https://${accountName}.blob.core.windows.net/${containerName}/${key}`;
}


/**
 * Sanitizes a string for safe use inside a filename/URL path segment:
 * strips anything but alphanumerics/underscore/hyphen and lowercases it.
 * Shared by getOriginalKey/getBannerKey and templateStorage's custom
 * filename patterns so both use the same, predictable output.
 * @param {string} value
 * @returns {string}
 */
function sanitizeForFilename(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

/**
 * Generate a storage key for an original image.
 * @param {string} nombre - User's name
 * @param {string} extension - File extension (png, jpg, etc.)
 * @returns {string}
 */
function getOriginalKey(nombre, extension = 'png') {
  return `originals/${Date.now()}-${sanitizeForFilename(nombre)}.${extension}`;
}

/**
 * Generate a storage key for a processed banner.
 * @param {string} nombre - User's name
 * @returns {string}
 */
function getBannerKey(nombre) {
  return `banners/${Date.now()}-${sanitizeForFilename(nombre)}-banner.png`;
}

/**
 * Upload a file to an FTP (or explicit FTPS, via `secure`) server.
 * Used for per-template custom banner destinations — see templateStorage.js.
 * @param {{host: string, port?: number, secure?: boolean, remotePath: string, user: string, password: string}} conn
 * @param {string} filename
 * @param {Buffer} body
 */
async function uploadFtp(conn, filename, body) {
  const { Client } = require('basic-ftp');
  const { Readable } = require('stream');
  const client = new Client(20000); // 20s timeout, matches other backends
  try {
    await client.access({
      host: conn.host,
      port: conn.port || 21,
      secure: !!conn.secure,
      user: conn.user,
      password: conn.password,
    });
    await client.ensureDir(conn.remotePath);
    await client.uploadFrom(Readable.from(body), filename);
  } finally {
    client.close();
  }
}

/**
 * Upload a file to an SFTP server.
 * Used for per-template custom banner destinations — see templateStorage.js.
 * @param {{host: string, port?: number, remotePath: string, user: string, password: string}} conn
 * @param {string} filename
 * @param {Buffer} body
 */
async function uploadSftp(conn, filename, body) {
  const SftpClient = require('ssh2-sftp-client');
  const client = new SftpClient();
  try {
    await client.connect({
      host: conn.host,
      port: conn.port || 22,
      username: conn.user,
      password: conn.password,
      readyTimeout: 20000,
    });
    const remoteFilePath = `${conn.remotePath.replace(/\/$/, '')}/${filename}`;
    await client.put(body, remoteFilePath);
  } finally {
    await client.end();
  }
}

/**
 * List the contents of a directory on an FTP (or FTPS) server. Read-only —
 * used by the admin panel's file browser, see templateStorage.js.
 * @param {{host: string, port?: number, secure?: boolean, remotePath: string, user: string, password: string}} conn
 * @returns {Promise<Array<{name: string, size: number, isDirectory: boolean, modifiedAt: string|null}>>}
 */
async function listFtp(conn) {
  const { Client } = require('basic-ftp');
  const client = new Client(20000);
  try {
    await client.access({
      host: conn.host,
      port: conn.port || 21,
      secure: !!conn.secure,
      user: conn.user,
      password: conn.password,
    });
    const entries = await client.list(conn.remotePath);
    return entries.map((entry) => ({
      name: entry.name,
      size: entry.size,
      isDirectory: entry.isDirectory,
      modifiedAt: entry.rawModifiedAt || entry.modifiedAt || null,
    }));
  } finally {
    client.close();
  }
}

/**
 * List the contents of a directory on an SFTP server. Read-only — used by
 * the admin panel's file browser, see templateStorage.js.
 * @param {{host: string, port?: number, remotePath: string, user: string, password: string}} conn
 * @returns {Promise<Array<{name: string, size: number, isDirectory: boolean, modifiedAt: string|null}>>}
 */
async function listSftp(conn) {
  const SftpClient = require('ssh2-sftp-client');
  const client = new SftpClient();
  try {
    await client.connect({
      host: conn.host,
      port: conn.port || 22,
      username: conn.user,
      password: conn.password,
      readyTimeout: 20000,
    });
    const entries = await client.list(conn.remotePath);
    return entries.map((entry) => ({
      name: entry.name,
      size: entry.size,
      isDirectory: entry.type === 'd',
      modifiedAt: entry.modifyTime ? new Date(entry.modifyTime).toISOString() : null,
    }));
  } finally {
    await client.end();
  }
}

module.exports = {
  upload,
  uploadAzure,
  uploadFtp,
  uploadSftp,
  listFtp,
  listSftp,
  getOriginalKey,
  getBannerKey,
  sanitizeForFilename,
  LOCAL_STORAGE_DIR,
};

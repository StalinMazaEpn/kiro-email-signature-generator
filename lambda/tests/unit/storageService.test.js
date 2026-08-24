'use strict';

const path = require('path');
const fs = require('fs');

process.env.PORT = '3999';

const {
  upload,
  getOriginalKey,
  getBannerKey,
  uploadFtp,
  uploadSftp,
  sanitizeForFilename,
  LOCAL_STORAGE_DIR,
} = require('../../src/services/storageService');

// Mock basic-ftp (uploadFtp uses a lazy require)
const mockFtpAccess = jest.fn().mockResolvedValue(undefined);
const mockFtpEnsureDir = jest.fn().mockResolvedValue(undefined);
const mockFtpUploadFrom = jest.fn().mockResolvedValue(undefined);
const mockFtpClose = jest.fn();
jest.mock('basic-ftp', () => ({
  Client: jest.fn().mockImplementation(() => ({
    access: mockFtpAccess,
    ensureDir: mockFtpEnsureDir,
    uploadFrom: mockFtpUploadFrom,
    close: mockFtpClose,
  })),
}));

// Mock ssh2-sftp-client (uploadSftp uses a lazy require)
const mockSftpConnect = jest.fn().mockResolvedValue(undefined);
const mockSftpPut = jest.fn().mockResolvedValue(undefined);
const mockSftpEnd = jest.fn().mockResolvedValue(undefined);
jest.mock('ssh2-sftp-client', () => jest.fn().mockImplementation(() => ({
  connect: mockSftpConnect,
  put: mockSftpPut,
  end: mockSftpEnd,
})));

// Mock Azure Storage SDK (uploadAzure uses a lazy require)
const mockBlobUpload = jest.fn().mockResolvedValue({ requestId: 'mock-upload' });
const mockBlobClient = { upload: mockBlobUpload };
const mockGetBlockBlobClient = jest.fn().mockReturnValue(mockBlobClient);
const mockGetContainerClient = jest.fn().mockReturnValue({ getBlockBlobClient: mockGetBlockBlobClient });

jest.mock('@azure/storage-blob', () => ({
  StorageSharedKeyCredential: jest.fn().mockImplementation((accountName, accountKey) => ({ accountName, accountKey })),
  BlobServiceClient: jest.fn().mockImplementation(() => ({ getContainerClient: mockGetContainerClient })),
}));


describe('storageService (local mode)', () => {
  afterAll(() => {
    // Clean up test files
    const testDir = LOCAL_STORAGE_DIR;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('upload', () => {
    test('writes file to local-storage and returns local URL', async () => {
      const buffer = Buffer.from('fake image data');
      const key = 'originals/test-file.png';

      const url = await upload(key, buffer, 'image/png');

      expect(url).toBe('http://localhost:3999/storage/originals/test-file.png');
      const filepath = path.join(LOCAL_STORAGE_DIR, key);
      expect(fs.existsSync(filepath)).toBe(true);
      expect(fs.readFileSync(filepath).toString()).toBe('fake image data');
    });

    test('creates nested directories as needed', async () => {
      const buffer = Buffer.from('another file');
      const key = 'banners/nested/deep/file.png';

      const url = await upload(key, buffer, 'image/png');

      expect(url).toContain('banners/nested/deep/file.png');
      const filepath = path.join(LOCAL_STORAGE_DIR, key);
      expect(fs.existsSync(filepath)).toBe(true);
    });
  });

  describe('getOriginalKey', () => {
    test('generates key with originals/ prefix', () => {
      const key = getOriginalKey('Carlos Méndez');
      expect(key).toMatch(/^originals\/\d+-carlos_m_ndez\.png$/);
    });

    test('sanitizes special characters', () => {
      const key = getOriginalKey('María José López');
      expect(key).toMatch(/^originals\/\d+-mar_a_jos__l_pez\.png$/);
    });

    test('accepts custom extension', () => {
      const key = getOriginalKey('Test User', 'jpg');
      expect(key).toMatch(/\.jpg$/);
    });
  });

  describe('getBannerKey', () => {
    test('generates key with banners/ prefix and -banner suffix', () => {
      const key = getBannerKey('Carlos Méndez');
      expect(key).toMatch(/^banners\/\d+-carlos_m_ndez-banner\.png$/);
    });
describe('storageService (azure mode)', () => {
  beforeEach(() => {
    process.env.STORAGE_PROVIDER = 'azure';
    process.env.AZURE_ACCOUNT_NAME = 'myaccount';
    process.env.AZURE_ACCOUNT_KEY = 'mykey';
    process.env.AZURE_CONTAINER_NAME = 'mycontainer';
  });

  test('uploads to Azure Blob Storage and returns public URL', async () => {
    const buffer = Buffer.from('azure data');
    const key = 'originals/azure-test.png';

    const url = await upload(key, buffer, 'image/png');

    expect(require('@azure/storage-blob').BlobServiceClient).toHaveBeenCalled();
    expect(mockGetBlockBlobClient).toHaveBeenCalledWith(key);
    expect(mockBlobUpload).toHaveBeenCalled();
    expect(url).toBe('https://myaccount.blob.core.windows.net/mycontainer/originals/azure-test.png');
  });

  test('throws when azure config is incomplete', async () => {
    process.env.AZURE_ACCOUNT_NAME = '';
    process.env.AZURE_ACCOUNT_KEY = '';
    process.env.AZURE_CONTAINER_NAME = '';

    await expect(upload('originals/x.png', Buffer.from('x'), 'image/png')).rejects.toThrow(/AZURE_ACCOUNT/);
  });
});

  });
});

describe('sanitizeForFilename', () => {
  test('strips special characters and lowercases', () => {
    expect(sanitizeForFilename('María José López')).toBe('mar_a_jos__l_pez');
  });

  test('handles empty/undefined input', () => {
    expect(sanitizeForFilename(undefined)).toBe('');
    expect(sanitizeForFilename('')).toBe('');
  });
});

describe('uploadFtp', () => {
  afterEach(() => jest.clearAllMocks());

  test('connects with the given host/credentials and uploads the buffer', async () => {
    const conn = { host: 'ftp.clientex.com', port: 21, secure: false, remotePath: '/banners', user: 'u', password: 'p' };
    await uploadFtp(conn, 'file.png', Buffer.from('data'));

    expect(mockFtpAccess).toHaveBeenCalledWith(expect.objectContaining({
      host: 'ftp.clientex.com',
      port: 21,
      secure: false,
      user: 'u',
      password: 'p',
    }));
    expect(mockFtpEnsureDir).toHaveBeenCalledWith('/banners');
    expect(mockFtpUploadFrom).toHaveBeenCalledWith(expect.anything(), 'file.png');
    expect(mockFtpClose).toHaveBeenCalled();
  });

  test('closes the client even when the upload fails', async () => {
    mockFtpUploadFrom.mockRejectedValueOnce(new Error('boom'));
    const conn = { host: 'ftp.clientex.com', remotePath: '/banners', user: 'u', password: 'p' };

    await expect(uploadFtp(conn, 'file.png', Buffer.from('data'))).rejects.toThrow('boom');
    expect(mockFtpClose).toHaveBeenCalled();
  });
});

describe('uploadSftp', () => {
  afterEach(() => jest.clearAllMocks());

  test('connects with the given host/credentials and uploads the buffer', async () => {
    const conn = { host: 'sftp.clientex.com', port: 22, remotePath: '/banners', user: 'u', password: 'p' };
    await uploadSftp(conn, 'file.png', Buffer.from('data'));

    expect(mockSftpConnect).toHaveBeenCalledWith(expect.objectContaining({
      host: 'sftp.clientex.com',
      port: 22,
      username: 'u',
      password: 'p',
    }));
    expect(mockSftpPut).toHaveBeenCalledWith(expect.any(Buffer), '/banners/file.png');
    expect(mockSftpEnd).toHaveBeenCalled();
  });

  test('ends the connection even when the upload fails', async () => {
    mockSftpPut.mockRejectedValueOnce(new Error('boom'));
    const conn = { host: 'sftp.clientex.com', remotePath: '/banners', user: 'u', password: 'p' };

    await expect(uploadSftp(conn, 'file.png', Buffer.from('data'))).rejects.toThrow('boom');
    expect(mockSftpEnd).toHaveBeenCalled();
  });
});

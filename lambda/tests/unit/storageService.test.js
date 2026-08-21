'use strict';

const path = require('path');
const fs = require('fs');

process.env.PORT = '3999';

const { upload, getOriginalKey, getBannerKey, LOCAL_STORAGE_DIR } = require('../../src/services/storageService');

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

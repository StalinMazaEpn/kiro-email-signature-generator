'use strict';

const path = require('path');
const fs = require('fs');

// Force local mode for tests
process.env.APP_MODE = 'local';
process.env.PORT = '3999';

const { upload, getOriginalKey, getBannerKey, LOCAL_STORAGE_DIR } = require('../../src/services/storageService');

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
  });
});

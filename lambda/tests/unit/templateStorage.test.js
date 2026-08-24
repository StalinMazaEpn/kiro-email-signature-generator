'use strict';

const mockLoadTemplateConfig = jest.fn();
jest.mock('../../src/services/templateEngine', () => ({
  loadTemplateConfig: (...args) => mockLoadTemplateConfig(...args),
}));

const mockUpload = jest.fn().mockResolvedValue('http://localhost:3005/storage/banners/default.png');
const mockUploadFtp = jest.fn().mockResolvedValue(undefined);
const mockUploadSftp = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/services/storageService', () => {
  const actual = jest.requireActual('../../src/services/storageService');
  return {
    ...actual,
    upload: (...args) => mockUpload(...args),
    uploadFtp: (...args) => mockUploadFtp(...args),
    uploadSftp: (...args) => mockUploadSftp(...args),
  };
});

const { uploadBanner, resolveBannerFilename, TemplateStorageConfigError } = require('../../src/services/templateStorage');

const fields = { nombre: 'Carlos Méndez', cargo: 'Tech Lead', email: 'carlos@empresa.com' };
const validFtpConfig = {
  banner: {
    storage: {
      type: 'ftp',
      host: 'ftp.clientex.com',
      remotePath: '/banners',
      publicBaseUrl: 'https://clientex.com/banners',
    },
    filenamePattern: '{nombre}-{timestamp}.{ext}',
  },
};

describe('resolveBannerFilename', () => {
  test('substitutes placeholders and sanitizes special characters', () => {
    const name = resolveBannerFilename('{nombre}-{cargo}.{ext}', fields, 'png');
    expect(name).toBe('carlos_m_ndez-tech_lead.png');
  });

  test('throws on an unknown placeholder', () => {
    expect(() => resolveBannerFilename('{unknown}.{ext}', fields, 'png')).toThrow('Unknown filenamePattern placeholder');
  });

  test('{nombreDot} turns "Stalin Maza" into "stalin.maza"', () => {
    const name = resolveBannerFilename('{nombreDot}.{ext}', { nombre: 'Stalin Maza' }, 'png');
    expect(name).toBe('stalin.maza.png');
  });

  test('{nombreDot} strips accents instead of dropping the accented letter', () => {
    const name = resolveBannerFilename('{nombreDot}.{ext}', { nombre: 'María López' }, 'png');
    expect(name).toBe('maria.lopez.png');
  });

  test('{emailUser} keeps the dots from the local part of the email', () => {
    const name = resolveBannerFilename('{emailUser}@handytec.ai.{ext}', { email: 'maria.lopez@empresa.com' }, 'png');
    expect(name).toBe('maria.lopez@handytec.ai.png');
  });

  test('{emailUser} strips unsafe characters from the local part', () => {
    const name = resolveBannerFilename('{emailUser}.{ext}', { email: 'Maria+Test.Lopez@empresa.com' }, 'png');
    expect(name).toBe('mariatest.lopez.png');
  });
});

describe('uploadBanner', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('delegates to default storage when the template has no config.json', async () => {
    mockLoadTemplateConfig.mockReturnValue(null);

    const { url } = await uploadBanner('corporativa', fields, Buffer.from('x'), 'image/png');

    expect(mockUpload).toHaveBeenCalled();
    expect(mockUploadFtp).not.toHaveBeenCalled();
    expect(url).toBe('http://localhost:3005/storage/banners/default.png');
  });

  test('delegates to default storage when storage.enabled is false', async () => {
    mockLoadTemplateConfig.mockReturnValue({
      banner: { storage: { ...validFtpConfig.banner.storage, enabled: false } },
    });

    await uploadBanner('cliente-x', fields, Buffer.from('x'), 'image/png');

    expect(mockUpload).toHaveBeenCalled();
    expect(mockUploadFtp).not.toHaveBeenCalled();
  });

  test('throws TemplateStorageConfigError when FTP credentials are missing', async () => {
    mockLoadTemplateConfig.mockReturnValue(validFtpConfig);
    delete process.env.FTP_CLIENTE_X_USER;
    delete process.env.FTP_CLIENTE_X_PASSWORD;

    await expect(uploadBanner('cliente-x', fields, Buffer.from('x'), 'image/png'))
      .rejects.toThrow(TemplateStorageConfigError);
    expect(mockUploadFtp).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test('throws TemplateStorageConfigError when a required config field is missing', async () => {
    mockLoadTemplateConfig.mockReturnValue({
      banner: { storage: { type: 'ftp', host: 'ftp.clientex.com' } }, // missing remotePath/publicBaseUrl
    });
    process.env.FTP_CLIENTE_X_USER = 'u';
    process.env.FTP_CLIENTE_X_PASSWORD = 'p';

    await expect(uploadBanner('cliente-x', fields, Buffer.from('x'), 'image/png'))
      .rejects.toThrow(TemplateStorageConfigError);
  });

  test('uploads via FTP and builds the URL from publicBaseUrl when fully configured', async () => {
    mockLoadTemplateConfig.mockReturnValue(validFtpConfig);
    process.env.FTP_CLIENTE_X_USER = 'u';
    process.env.FTP_CLIENTE_X_PASSWORD = 'p';

    const { url } = await uploadBanner('cliente-x', fields, Buffer.from('x'), 'image/png');

    expect(mockUploadFtp).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'ftp.clientex.com', remotePath: '/banners', user: 'u', password: 'p' }),
      expect.stringMatching(/^carlos_m_ndez-\d+\.png$/),
      expect.any(Buffer)
    );
    expect(url).toMatch(/^https:\/\/clientex\.com\/banners\/carlos_m_ndez-\d+\.png$/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test('propagates the error when the FTP upload itself fails (no silent fallback)', async () => {
    mockLoadTemplateConfig.mockReturnValue(validFtpConfig);
    process.env.FTP_CLIENTE_X_USER = 'u';
    process.env.FTP_CLIENTE_X_PASSWORD = 'p';
    mockUploadFtp.mockRejectedValueOnce(new Error('connection refused'));

    await expect(uploadBanner('cliente-x', fields, Buffer.from('x'), 'image/png'))
      .rejects.toThrow('connection refused');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test('uploads via SFTP when type is "sftp"', async () => {
    mockLoadTemplateConfig.mockReturnValue({
      banner: { storage: { ...validFtpConfig.banner.storage, type: 'sftp' } },
    });
    process.env.FTP_CLIENTE_X_USER = 'u';
    process.env.FTP_CLIENTE_X_PASSWORD = 'p';

    await uploadBanner('cliente-x', fields, Buffer.from('x'), 'image/png');

    expect(mockUploadSftp).toHaveBeenCalled();
    expect(mockUploadFtp).not.toHaveBeenCalled();
  });
});

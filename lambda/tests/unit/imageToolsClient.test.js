'use strict';

process.env.STORAGE_PROVIDER = 'local';
process.env.PORT = '3999';
process.env.IMAGE_TOOLS_URL = 'https://image-tools.example.com/process';
process.env.BACKGROUND_TEMPLATE_URL = 'https://assets.example.com/bg.png';

const mockLoadTemplateConfig = jest.fn().mockReturnValue(null);
jest.mock('../../src/services/templateEngine', () => ({
  loadTemplateConfig: (...args) => mockLoadTemplateConfig(...args),
}));

const mockUploadBanner = jest.fn().mockResolvedValue({ url: 'https://storage.example.com/banners/test-banner.png' });
jest.mock('../../src/services/templateStorage', () => ({
  uploadBanner: (...args) => mockUploadBanner(...args),
}));

const originalFetch = global.fetch;
global.fetch = jest.fn();

const { createBanner } = require('../../src/services/imageToolsClient');

const SOURCE_URL = 'https://storage.example.com/originals/test.png';
const fields = { nombre: 'Carlos Méndez', cargo: 'Tech Lead', email: 'carlos@empresa.com' };

function okJsonThenBinary(downloadUrl) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    text: async () => JSON.stringify({ download_url: downloadUrl }),
  });
  global.fetch.mockResolvedValueOnce({
    ok: true,
    arrayBuffer: async () => Buffer.from('fake banner bytes').buffer,
    headers: { get: () => 'image/png' },
  });
}

describe('imageToolsClient — createBanner cornerRadiusPercent mapping', () => {
  beforeEach(() => {
    global.fetch.mockReset();
    mockLoadTemplateConfig.mockReset().mockReturnValue(null);
    mockUploadBanner.mockClear();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('sends cornerRadiusPercent: 0 when the template has no config.json', async () => {
    okJsonThenBinary('https://image-tools.example.com/download/1');

    await createBanner(SOURCE_URL, 'Carlos Méndez', Buffer.from('x'), {}, null, 'corporativa', fields);

    const [, requestOpts] = global.fetch.mock.calls[0];
    expect(JSON.parse(requestOpts.body).cornerRadiusPercent).toBe(0);
  });

  test('sends cornerRadiusPercent: 0 when banner.round is false', async () => {
    mockLoadTemplateConfig.mockReturnValue({ banner: { round: false } });
    okJsonThenBinary('https://image-tools.example.com/download/2');

    await createBanner(SOURCE_URL, 'Carlos Méndez', Buffer.from('x'), {}, null, 'signature-company', fields);

    const [, requestOpts] = global.fetch.mock.calls[0];
    expect(JSON.parse(requestOpts.body).cornerRadiusPercent).toBe(0);
  });

  test('sends cornerRadiusPercent: 50 when banner.round is true', async () => {
    mockLoadTemplateConfig.mockReturnValue({ banner: { round: true } });
    okJsonThenBinary('https://image-tools.example.com/download/3');

    await createBanner(SOURCE_URL, 'Carlos Méndez', Buffer.from('x'), {}, null, 'signature-company', fields);

    const [, requestOpts] = global.fetch.mock.calls[0];
    expect(JSON.parse(requestOpts.body).cornerRadiusPercent).toBe(50);
    expect(mockUploadBanner).toHaveBeenCalledWith('signature-company', fields, expect.any(Buffer), 'image/png');
  });
});

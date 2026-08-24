'use strict';

const fs = require('fs');
const {
  render,
  loadTemplate,
  loadTemplateConfig,
  resolvePageTitle,
  getTemplateList,
  getTemplateVariables,
  TEMPLATES,
  TemplateNotFoundError,
} = require('../../src/services/templateEngine');

// The original 3 templates share a common field contract (nombre, cargo,
// email, telefono, website, linkedin, bannerUrl) that render() fills in.
// signature-business/signature were imported as-is from existing
// HTML signatures and use their own field names (firstname,
// lastname, position, phone, imageBannerUrl, ...) — they're exercised only
// with load/render-doesn't-throw smoke checks, not the shared-contract ones.
const STANDARD_TEMPLATES = ['corporativa', 'moderna-banner', 'minimalista'];
const LEGACY_TEMPLATES = ['signature-business', 'signature-company'];

describe('templateEngine', () => {
  const sampleFields = {
    nombre: 'Carlos Méndez',
    cargo: 'Tech Lead',
    email: 'carlos@empresa.com',
    telefono: '+593991234567',
    website: 'https://miempresa.com',
    linkedin: 'https://linkedin.com/in/carlos-mendez',
    bannerUrl: 'https://example.com/banner.png',
  };

  describe('loadTemplate', () => {
    test.each(Object.keys(TEMPLATES))('loads template: %s', (templateId) => {
      const template = loadTemplate(templateId);
      expect(template).toBeTruthy();
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(100);
    });

    test('throws on unknown templateId', () => {
      expect(() => loadTemplate('nonexistent')).toThrow('Unknown template');
    });

    test('throws TemplateNotFoundError when the catalog entry has no physical file (e.g. a private template)', () => {
      const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      try {
        expect(() => loadTemplate('corporativa')).toThrow(TemplateNotFoundError);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('render', () => {
    test.each(STANDARD_TEMPLATES)('renders %s with all fields', (templateId) => {
      const html = render(templateId, sampleFields);
      expect(html).toContain('Carlos Méndez');
      expect(html).toContain('Tech Lead');
      expect(html).toContain('carlos@empresa.com');
      expect(html).toContain('https://example.com/banner.png');
    });

    test.each(Object.keys(TEMPLATES))('renders %s without throwing', (templateId) => {
      expect(() => render(templateId, sampleFields)).not.toThrow();
    });

    test('renders without optional fields (website, linkedin)', () => {
      const fields = { ...sampleFields, website: null, linkedin: null };
      const html = render('corporativa', fields);
      expect(html).toContain('Carlos Méndez');
      expect(html).not.toContain('linkedin.com');
      expect(html).not.toContain('miempresa.com');
    });

    test('throws on invalid templateId', () => {
      expect(() => render('invalid', sampleFields)).toThrow();
    });

    describe('legacy company templates (signature-business, signature-company)', () => {
      test.each(LEGACY_TEMPLATES)('splits nombre into firstname/lastname for %s', (templateId) => {
        const html = render(templateId, sampleFields);
        expect(html).toContain('Carlos');
        expect(html).toContain('Méndez');
      });

      test.each(LEGACY_TEMPLATES)('treats a single-word nombre as isSingleName for %s', (templateId) => {
        const html = render(templateId, { ...sampleFields, nombre: 'Madonna' });
        expect(html).toContain('Madonna');
      });

      test.each(LEGACY_TEMPLATES)('strips non-digits from telefono for the tel: link in %s', (templateId) => {
        const html = render(templateId, { ...sampleFields, telefono: '+593 99 123 4567' });
        expect(html).toContain('tel:+593991234567');
        expect(html).toContain('+593 99 123 4567');
      });

      test.each(LEGACY_TEMPLATES)('appends a URL fragment to bannerUrl for imageBannerUrl in %s', (templateId) => {
        const html = render(templateId, sampleFields);
        expect(html).toContain('https://example.com/banner.png#/carlos@empresa.com');
      });

      test.each(LEGACY_TEMPLATES)('includes email and cargo in %s', (templateId) => {
        const html = render(templateId, sampleFields);
        expect(html).toContain('carlos@empresa.com');
        expect(html).toContain('Tech Lead');
      });
    });

    test('all standard templates use table-based layout (no div flex/grid)', () => {
      for (const templateId of STANDARD_TEMPLATES) {
        const html = render(templateId, sampleFields);
        expect(html).toContain('<table');
        expect(html).not.toMatch(/<div[^>]*style=["'][^"']*display\s*:\s*(flex|grid)/i);
      }
    });

    test('all standard templates have inline styles only (no <style> or <script> blocks)', () => {
      for (const templateId of STANDARD_TEMPLATES) {
        const html = render(templateId, sampleFields);
        expect(html).not.toMatch(/<style[\s>]/i);
        expect(html).not.toMatch(/<script[\s>]/i);
      }
    });

    test('all standard templates have images with width and height attributes', () => {
      for (const templateId of STANDARD_TEMPLATES) {
        const html = render(templateId, sampleFields);
        const imgTags = html.match(/<img[^>]*>/gi) || [];
        for (const img of imgTags) {
          expect(img).toMatch(/width=/i);
          expect(img).toMatch(/height=/i);
        }
      }
    });
  });

  describe('getTemplateList', () => {
    test('returns one entry per catalog template with id, name, description', () => {
      const list = getTemplateList();
      expect(list).toHaveLength(Object.keys(TEMPLATES).length);
      for (const t of list) {
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('description');
        expect(TEMPLATES).toHaveProperty(t.id);
      }
    });

    test('each template declares its own non-empty requiredFields', () => {
      const list = getTemplateList();
      for (const t of list) {
        expect(Array.isArray(t.requiredFields)).toBe(true);
        expect(t.requiredFields.length).toBeGreaterThan(0);
      }
    });

    test('excludes catalog entries whose physical file is missing (e.g. a private template not present locally)', () => {
      const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      try {
        expect(getTemplateList()).toHaveLength(0);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('getTemplateVariables', () => {
    test('all standard templates include required variables', () => {
      const requiredVars = ['nombre', 'cargo', 'email', 'bannerUrl'];
      for (const templateId of STANDARD_TEMPLATES) {
        const vars = getTemplateVariables(templateId);
        for (const v of requiredVars) {
          expect(vars).toContain(v);
        }
      }
    });

    test('throws on unknown template', () => {
      expect(() => getTemplateVariables('nonexistent')).toThrow();
    });
  });

  describe('loadTemplateConfig', () => {
    test('returns null when the template has no config.json', () => {
      expect(loadTemplateConfig('corporativa')).toBeNull();
    });

    test('throws on unknown templateId', () => {
      expect(() => loadTemplateConfig('nonexistent')).toThrow('Unknown template');
    });

    test('parses a valid config.json', () => {
      const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ banner: { filenamePattern: '{nombre}.{ext}' } }));
      try {
        expect(loadTemplateConfig('corporativa')).toEqual({ banner: { filenamePattern: '{nombre}.{ext}' } });
      } finally {
        spy.mockRestore();
        readSpy.mockRestore();
      }
    });

    test('throws a clear error on invalid JSON', () => {
      const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('{ not valid json');
      try {
        expect(() => loadTemplateConfig('corporativa')).toThrow('Invalid config.json');
      } finally {
        spy.mockRestore();
        readSpy.mockRestore();
      }
    });
  });

  describe('resolvePageTitle', () => {
    test('returns the default title when the template has no config.json', () => {
      expect(resolvePageTitle('corporativa', sampleFields)).toBe('Firma de Email');
    });

    test('substitutes placeholders from a configured titlePattern', () => {
      const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ head: { titlePattern: 'Firma de {nombre} - {cargo}' } }));
      try {
        expect(resolvePageTitle('corporativa', sampleFields)).toBe('Firma de Carlos Méndez - Tech Lead');
      } finally {
        spy.mockRestore();
        readSpy.mockRestore();
      }
    });

    test('HTML-escapes substituted values', () => {
      const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ head: { titlePattern: 'Firma de {nombre}' } }));
      try {
        expect(resolvePageTitle('corporativa', { ...sampleFields, nombre: '<script>alert(1)</script>' }))
          .toBe('Firma de &lt;script&gt;alert(1)&lt;/script&gt;');
      } finally {
        spy.mockRestore();
        readSpy.mockRestore();
      }
    });

    test('throws on an unknown titlePattern placeholder', () => {
      const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ head: { titlePattern: '{unknown}' } }));
      try {
        expect(() => resolvePageTitle('corporativa', sampleFields)).toThrow('Unknown titlePattern placeholder');
      } finally {
        spy.mockRestore();
        readSpy.mockRestore();
      }
    });
  });
});

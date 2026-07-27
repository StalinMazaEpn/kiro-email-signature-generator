'use strict';

const {
  render,
  loadTemplate,
  getTemplateList,
  getTemplateVariables,
  TEMPLATES,
} = require('../../src/services/templateEngine');

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
  });

  describe('render', () => {
    test.each(Object.keys(TEMPLATES))('renders %s with all fields', (templateId) => {
      const html = render(templateId, sampleFields);
      expect(html).toContain('Carlos Méndez');
      expect(html).toContain('Tech Lead');
      expect(html).toContain('carlos@empresa.com');
      expect(html).toContain('https://example.com/banner.png');
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

    test('all templates use table-based layout (no div flex/grid)', () => {
      for (const templateId of Object.keys(TEMPLATES)) {
        const html = render(templateId, sampleFields);
        expect(html).toContain('<table');
        expect(html).not.toMatch(/<div[^>]*style=["'][^"']*display\s*:\s*(flex|grid)/i);
      }
    });

    test('all templates have inline styles only (no <style> or <script> blocks)', () => {
      for (const templateId of Object.keys(TEMPLATES)) {
        const html = render(templateId, sampleFields);
        expect(html).not.toMatch(/<style[\s>]/i);
        expect(html).not.toMatch(/<script[\s>]/i);
      }
    });

    test('all images have width and height attributes', () => {
      for (const templateId of Object.keys(TEMPLATES)) {
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
    test('returns 3 templates with id, name, description', () => {
      const list = getTemplateList();
      expect(list).toHaveLength(3);
      for (const t of list) {
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('description');
        expect(TEMPLATES).toHaveProperty(t.id);
      }
    });
  });

  describe('getTemplateVariables', () => {
    test('all templates include required variables', () => {
      const requiredVars = ['nombre', 'cargo', 'email', 'bannerUrl'];
      for (const templateId of Object.keys(TEMPLATES)) {
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
});

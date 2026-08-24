'use strict';

const Mustache = require('mustache');
const fs = require('fs');
const path = require('path');
const { TEMPLATE_CATALOG } = require('../config/templates');

const TEMPLATES = Object.fromEntries(TEMPLATE_CATALOG.map((t) => [t.id, t.file]));

const TEMPLATES_DIR = path.join(__dirname, '../../templates');

/**
 * Thrown when a catalog entry's templateId is valid but its .mustache file
 * isn't present on disk in this environment (e.g. a private template that
 * exists in TEMPLATE_CATALOG but wasn't checked into this repo/deployment).
 */
class TemplateNotFoundError extends Error {
  constructor(templateId, filename) {
    super(`Template file not found for "${templateId}" (${filename}). It may be a private template not available in this environment.`);
    this.name = 'TemplateNotFoundError';
    this.templateId = templateId;
  }
}

/**
 * Load raw template string by ID.
 * @param {string} templateId
 * @returns {string} Raw Mustache template
 */
function loadTemplate(templateId) {
  const filename = TEMPLATES[templateId];
  if (!filename) {
    throw new Error(`Unknown template: ${templateId}. Valid options: ${Object.keys(TEMPLATES).join(', ')}`);
  }
  const filepath = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new TemplateNotFoundError(templateId, filename);
  }
  return fs.readFileSync(filepath, 'utf8');
}

/**
 * Load a template's optional config.json (sits next to its .mustache file,
 * e.g. lambda/templates/corporativa/config.json). Used for per-template
 * overrides such as a custom banner storage destination — see
 * templateStorage.js. Returns null when the template has no config.json
 * (the common case), since it's an opt-in override, not a requirement.
 * @param {string} templateId
 * @returns {object|null}
 */
function loadTemplateConfig(templateId) {
  const filename = TEMPLATES[templateId];
  if (!filename) {
    throw new Error(`Unknown template: ${templateId}. Valid options: ${Object.keys(TEMPLATES).join(', ')}`);
  }
  const configPath = path.join(TEMPLATES_DIR, path.dirname(filename), 'config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid config.json for template "${templateId}" (${configPath}): ${err.message}`);
  }
}

/**
 * Templates whose .mustache was imported as-is from an external source and
 * uses its own field schema (firstname/lastname/position/phone/imageBannerUrl/...)
 * instead of the app's standard one (nombre/cargo/telefono/bannerUrl/...).
 * Detected from the catalog so adding another such template only means
 * listing 'firstname' in its requiredFields — no code change needed here.
 */
const LEGACY_SCHEMA_TEMPLATE_IDS = new Set(
  TEMPLATE_CATALOG.filter((t) => t.requiredFields.includes('firstname')).map((t) => t.id)
);

/**
 * Builds the Mustache data object for the app's standard field schema
 * (corporativa, moderna-banner, minimalista).
 */
function buildStandardData(fields) {
  // Extract LinkedIn username from URL (e.g., "https://linkedin.com/in/marialopez" → "marialopez")
  let linkedinUsername = null;
  if (fields.linkedin) {
    const match = fields.linkedin.match(/linkedin\.com\/in\/([^/?#]+)/);
    linkedinUsername = match ? match[1] : 'LinkedIn';
  }

  return {
    nombre: fields.nombre || '',
    cargo: fields.cargo || '',
    email: fields.email || '',
    telefono: fields.telefono || '',
    website: fields.website || null,
    linkedin: fields.linkedin || null,
    linkedinUsername: linkedinUsername,
    bannerUrl: fields.bannerUrl || '',
  };
}

/**
 * Builds the Mustache data object for the imported templates
 * (signature-business, signature), derived from the same input
 * fields the standard templates use (nombre, cargo, email, telefono,
 * bannerUrl) so no extra form fields are needed:
 *  - nombre splits into firstname/lastname (isSingleName when there's no
 *    surname, controlling the {{#isSingleName}} title/meta sections).
 *  - cargo maps to both position (shown, CSS-uppercased) and
 *    positionOriginal (used verbatim in <meta name="description">).
 *  - telefono maps to phone (shown) and phonelink (digits/+ only, for
 *    href="tel:...").
 *  - bannerUrl feeds imageBannerUrl: the template hardcodes
 *    `{{{imageBannerUrl}}}/{{{email}}}{{{imageBannerUrlExtension}}}`, so a
 *    literal "/<email>" always lands between imageBannerUrl and the
 *    extension. Appending "#" makes that a URL fragment, which browsers
 *    strip before resolving the resource — for both http(s) URLs (never
 *    sent to the server) and data: URIs (stripped before base64 decoding) —
 *    so the image still loads correctly without touching the template.
 */
function buildLegacyData(fields) {
  const nombre = (fields.nombre || '').trim();
  const nameParts = nombre.split(/\s+/).filter(Boolean);
  const firstname = nameParts[0] || '';
  const lastname = nameParts.slice(1).join(' ');

  const cargo = fields.cargo || '';
  const telefono = fields.telefono || '';
  const bannerUrl = fields.bannerUrl || '';

  return {
    firstname,
    lastname,
    isSingleName: nameParts.length <= 1,
    position: cargo,
    positionOriginal: cargo,
    email: fields.email || '',
    phone: telefono,
    phonelink: telefono.replace(/[^\d+]/g, ''),
    imageBannerUrl: bannerUrl ? `${bannerUrl}#` : '',
    imageBannerUrlExtension: '',
  };
}

const DEFAULT_PAGE_TITLE = 'Firma de Email';

/**
 * Escapes the characters that would break out of an HTML <title> if a field
 * (e.g. nombre) contained them — resolvePageTitle's result is consumed
 * as-is by the frontend (wrapSignatureHtml), not through Mustache's
 * auto-escaping, so it needs to sanitize for HTML itself.
 */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Resolves the <title> to use when a template's rendered HTML is wrapped
 * into a full downloadable document (see frontend's wrapSignatureHtml).
 * Templates opt into a custom, placeholder-driven title via their
 * config.json (`head.titlePattern`, e.g. "Firma de {nombre}"); without one,
 * every template keeps the app's original hardcoded title.
 * @param {string} templateId
 * @param {object} fields - { nombre, cargo, email, ... }
 * @returns {string}
 */
function resolvePageTitle(templateId, fields) {
  const config = loadTemplateConfig(templateId);
  const pattern = config?.head?.titlePattern;
  if (!pattern) return DEFAULT_PAGE_TITLE;

  return pattern.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in fields)) {
      throw new Error(`Unknown titlePattern placeholder "{${key}}"`);
    }
    return escapeHtml(fields[key]);
  });
}

/**
 * Render a template with the given fields.
 * @param {string} templateId
 * @param {object} fields - { nombre, cargo, email, telefono, website?, linkedin?, bannerUrl }
 * @returns {string} Compiled HTML
 */
function render(templateId, fields) {
  const template = loadTemplate(templateId);
  // Mustache treats falsy values as "section not shown", so ensure nulls are handled
  const data = LEGACY_SCHEMA_TEMPLATE_IDS.has(templateId)
    ? buildLegacyData(fields)
    : buildStandardData(fields);
  return Mustache.render(template, data);
}

/**
 * Get list of available templates with metadata.
 * @returns {Array<{id: string, name: string, description: string}>}
 */
function getTemplateList() {
  return TEMPLATE_CATALOG
    .filter((t) => fs.existsSync(path.join(TEMPLATES_DIR, t.file)))
    .map(({ id, name, description, requiredFields }) => ({ id, name, description, requiredFields }));
}

/**
 * Get the variables used in a specific template.
 * @param {string} templateId
 * @returns {string[]} List of variable names
 */
function getTemplateVariables(templateId) {
  const template = loadTemplate(templateId);
  const parsed = Mustache.parse(template);
  const vars = new Set();

  function extractVars(tokens) {
    for (const token of tokens) {
      if (token[0] === 'name' || token[0] === '&' || token[0] === '#' || token[0] === '^') {
        vars.add(token[1]);
      }
      if (token[4]) {
        extractVars(token[4]);
      }
    }
  }

  extractVars(parsed);
  return Array.from(vars);
}

module.exports = {
  render,
  loadTemplate,
  loadTemplateConfig,
  resolvePageTitle,
  getTemplateList,
  getTemplateVariables,
  TEMPLATES,
  TemplateNotFoundError,
};

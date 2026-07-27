'use strict';

const Mustache = require('mustache');
const fs = require('fs');
const path = require('path');

const TEMPLATES = {
  corporativa: 'corporativa.mustache',
  'moderna-banner': 'moderna-banner.mustache',
  minimalista: 'minimalista.mustache',
};

const TEMPLATES_DIR = path.join(__dirname, '../../../templates');

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
  return fs.readFileSync(filepath, 'utf8');
}

/**
 * Render a template with the given fields.
 * @param {string} templateId - One of: corporativa, moderna-banner, minimalista
 * @param {object} fields - { nombre, cargo, email, telefono, website?, linkedin?, bannerUrl }
 * @returns {string} Compiled HTML
 */
function render(templateId, fields) {
  const template = loadTemplate(templateId);
  // Mustache treats falsy values as "section not shown", so ensure nulls are handled

  // Extract LinkedIn username from URL (e.g., "https://linkedin.com/in/marialopez" → "marialopez")
  let linkedinUsername = null;
  if (fields.linkedin) {
    const match = fields.linkedin.match(/linkedin\.com\/in\/([^/?#]+)/);
    linkedinUsername = match ? match[1] : 'LinkedIn';
  }

  const data = {
    nombre: fields.nombre || '',
    cargo: fields.cargo || '',
    email: fields.email || '',
    telefono: fields.telefono || '',
    website: fields.website || null,
    linkedin: fields.linkedin || null,
    linkedinUsername: linkedinUsername,
    bannerUrl: fields.bannerUrl || '',
  };
  return Mustache.render(template, data);
}

/**
 * Get list of available templates with metadata.
 * @returns {Array<{id: string, name: string, description: string}>}
 */
function getTemplateList() {
  return [
    { id: 'corporativa', name: 'Corporativa', description: 'Layout de 2 columnas: imagen izquierda, datos derecha. Paleta neutra gris/azul.' },
    { id: 'moderna-banner', name: 'Moderna con Banner', description: 'Layout de 2 columnas: foto con degradado izquierda, datos derecha con iconos sociales.' },
    { id: 'minimalista', name: 'Minimalista', description: 'Una fila compacta: avatar circular + nombre, cargo y contacto inline.' },
  ];
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
  getTemplateList,
  getTemplateVariables,
  TEMPLATES,
};

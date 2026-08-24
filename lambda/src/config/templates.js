'use strict';

/**
 * Single source of truth for available signature templates.
 * Add or remove a template by editing this array + its .mustache file in
 * lambda/templates/ — templateEngine.js and validation.js both derive from
 * this list, so nothing else needs to change.
 *
 * `requiredFields` lists the Mustache variables each template actually needs
 * to render meaningfully (i.e. not wrapped in an optional {{#section}}) —
 * not every template uses the same field set, so this lets a caller know
 * what data to collect/send before picking a template.
 */
const TEMPLATE_CATALOG = [
  {
    id: 'corporativa',
    file: 'corporativa/template.mustache',
    name: 'Corporativa',
    description: 'Layout de 2 columnas: imagen izquierda, datos derecha. Paleta neutra gris/azul.',
    requiredFields: ['nombre', 'cargo', 'email', 'telefono', 'bannerUrl'],
  },
  {
    id: 'moderna-banner',
    file: 'moderna-banner/template.mustache',
    name: 'Moderna con Banner',
    description: 'Layout de 2 columnas: foto con degradado izquierda, datos derecha con iconos sociales.',
    requiredFields: ['nombre', 'cargo', 'email', 'telefono', 'bannerUrl'],
  },
  {
    id: 'minimalista',
    file: 'minimalista/template.mustache',
    name: 'Minimalista',
    description: 'Una fila compacta: avatar circular + nombre, cargo y contacto inline.',
    requiredFields: ['nombre', 'cargo', 'email', 'telefono', 'bannerUrl'],
  },
  {
    id: 'signature-business',
    file: 'private/signature-business/template.mustache',
    name: 'Business',
    description: 'Foto cuadrada 162x162 a la izquierda, información del branding, datos con acento verde y iconos de LinkedIn/X.',
    requiredFields: [
      'firstname', 'lastname', 'position', 'positionOriginal', 'isSingleName',
      'email', 'phone', 'phonelink', 'imageBannerUrl', 'imageBannerUrlExtension',
    ],
  },
  {
    id: 'signature-company',
    file: 'private/signature-company/template.mustache',
    name: 'Company',
    description: 'Foto grande 240x184 con fondo degradado y esquinas redondeadas, datos a la derecha e iconos de LinkedIn/X.',
    requiredFields: [
      'firstname', 'lastname', 'position', 'positionOriginal', 'isSingleName',
      'email', 'phone', 'phonelink', 'imageBannerUrl', 'imageBannerUrlExtension',
    ],
  },
];

module.exports = { TEMPLATE_CATALOG };

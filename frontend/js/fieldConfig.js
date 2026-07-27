'use strict';

/**
 * Centralized field configuration for the Email Signature Generator.
 *
 * This is the SINGLE SOURCE OF TRUTH for field definitions.
 * Changing required/optional fields here propagates to:
 * - Form validation
 * - AI extraction feedback (missing fields warnings)
 * - Pre-fill logic
 *
 * No other code needs to be modified when changing field requirements.
 */
const FieldConfig = {
  fields: [
    {
      id: 'nombre',
      label: 'Nombre',
      required: true,
      type: 'text',
      hint: "incluye tu nombre completo, ej: 'Juan Pérez'",
    },
    {
      id: 'cargo',
      label: 'Cargo',
      required: true,
      type: 'text',
      hint: "incluye tu cargo o puesto, ej: 'Gerente de Ventas'",
    },
    {
      id: 'email',
      label: 'Email',
      required: true,
      type: 'email',
      hint: "incluye tu correo, ej: 'mi correo es usuario@empresa.com'",
    },
    {
      id: 'telefono',
      label: 'Teléfono',
      required: true,
      type: 'tel',
      hint: "incluye tu teléfono, ej: '+593991234567'",
    },
    {
      id: 'website',
      label: 'Website',
      required: false,
      type: 'url',
      hint: "incluye tu sitio web, ej: 'https://miempresa.com'",
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      required: false,
      type: 'url',
      hint: "incluye tu perfil de LinkedIn, ej: 'https://linkedin.com/in/mi-perfil'",
    },
  ],

  /**
   * Get only required fields.
   * @returns {Array} Required field definitions
   */
  getRequired() {
    return this.fields.filter(f => f.required);
  },

  /**
   * Get only optional fields.
   * @returns {Array} Optional field definitions
   */
  getOptional() {
    return this.fields.filter(f => !f.required);
  },

  /**
   * Check extracted fields against required fields.
   * Returns list of missing required fields with hints.
   * @param {object} extractedFields - Fields returned by AI
   * @returns {Array<{id: string, label: string, hint: string}>} Missing required fields
   */
  getMissingRequired(extractedFields) {
    return this.getRequired().filter(f => {
      const value = extractedFields[f.id];
      return !value || (typeof value === 'string' && value.trim() === '');
    });
  },

  /**
   * Image dimensions required by each template.
   * Used by the cropper to enforce correct aspect ratios.
   */
  templateImageConfig: {
    'corporativa': { width: 130, height: 160, aspectRatio: 130/160, label: 'Portrait (130×160px)' },
    'moderna-banner': { width: 180, height: 210, aspectRatio: 180/210, label: 'Portrait (180×210px)' },
    'minimalista': { width: 56, height: 56, aspectRatio: 1, label: 'Cuadrado (56×56px)' },
  },

  /**
   * Get the image config for the currently selected template.
   * @param {string} templateId
   * @returns {{ width: number, height: number, aspectRatio: number, label: string }}
   */
  getTemplateImageConfig(templateId) {
    return this.templateImageConfig[templateId] || this.templateImageConfig['corporativa'];
  },
};

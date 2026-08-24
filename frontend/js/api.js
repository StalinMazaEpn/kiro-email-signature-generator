'use strict';

/**
 * API client module for communicating with the backend.
 * Automatically resolves base URL based on current host.
 */
const API = (() => {
  // In production, set window.API_BASE_URL via config.js (generated at deploy time).
  // In local dev, the dev-server serves both frontend and API on the same origin.
  const BASE_URL = window.API_BASE_URL || window.location.origin;

  /**
   * Generate a full email signature (with image processing).
   * @param {object} data - { nombre, cargo, email, telefono, website?, linkedin?, templateId, image (base64) }
   * @returns {Promise<{ success: boolean, html?: string, bannerUrl?: string, error?: string }>}
   */
  async function generateSignature(data) {
    const response = await fetch(`${BASE_URL}/generate-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  /**
   * Preview an email signature (placeholder banner, no image processing).
   * @param {object} data - { nombre, cargo, email, telefono, website?, linkedin?, templateId }
   * @returns {Promise<{ success: boolean, html?: string, error?: string }>}
   */
  async function previewSignature(data) {
    const response = await fetch(`${BASE_URL}/preview-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  /**
   * Extract contact fields from free text using AI.
   * @param {string} text - Free text containing contact information
   * @returns {Promise<{ success: boolean, fields?: object, error?: string }>}
   */
  async function extractFields(text) {
    const response = await fetch(`${BASE_URL}/extract-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return response.json();
  }

  /**
   * Get available templates list.
   * @returns {Promise<{ success: boolean, templates?: Array }>}
   */
  async function getTemplates() {
    const response = await fetch(`${BASE_URL}/templates`);
    return response.json();
  }

  /**
   * Get templates that have a custom FTP/SFTP banner storage destination
   * configured (admin panel file browser).
   * @returns {Promise<{ success: boolean, templates?: Array }>}
   */
  async function getStorageTemplates() {
    const response = await fetch(`${BASE_URL}/admin/storage-templates`);
    return response.json();
  }

  /**
   * Read-only listing of the files in a template's custom banner storage
   * destination (admin panel file browser).
   * @param {string} templateId
   * @returns {Promise<{ success: boolean, type?: string, remotePath?: string, publicBaseUrl?: string, files?: Array, error?: string }>}
   */
  async function getStorageTemplateFiles(templateId) {
    const response = await fetch(`${BASE_URL}/admin/storage-templates/${encodeURIComponent(templateId)}/files`);
    return response.json();
  }

  return { generateSignature, previewSignature, extractFields, getTemplates, getStorageTemplates, getStorageTemplateFiles };
})();

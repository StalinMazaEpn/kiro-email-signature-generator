'use strict';

/**
 * Preview rendering module.
 * Renders HTML into iframes with auto-height adjustment.
 */
const Preview = (() => {
  /**
   * Render HTML content into the preview iframe.
   * @param {string} html - The signature HTML to render
   */
  function showPreview(html) {
    const container = document.getElementById('preview-container');
    const placeholder = document.getElementById('preview-placeholder');
    const iframe = document.getElementById('preview-iframe');
    const badge = document.getElementById('preview-badge');

    placeholder.classList.add('hidden');
    iframe.classList.remove('hidden');
    badge.classList.remove('hidden');

    renderInIframe(iframe, html);
  }

  /**
   * Render HTML content into the output iframe (final generated signature).
   * @param {string} html - The signature HTML to render
   */
  function showOutput(html) {
    const section = document.getElementById('output-section');
    const iframe = document.getElementById('output-iframe');
    const htmlPre = document.getElementById('output-html');

    section.classList.remove('hidden');
    htmlPre.textContent = html;

    renderInIframe(iframe, html);
  }

  /**
   * Render HTML into an iframe with auto-resizing.
   * @param {HTMLIFrameElement} iframe
   * @param {string} html
   */
  function renderInIframe(iframe, html) {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { margin: 0; padding: 8px; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `);
    doc.close();

    // Auto-resize iframe to content height
    setTimeout(() => {
      const height = doc.body.scrollHeight + 20;
      iframe.style.height = `${Math.max(height, 200)}px`;
    }, 100);
  }

  /**
   * Clear the preview area back to placeholder state.
   */
  function clearPreview() {
    const placeholder = document.getElementById('preview-placeholder');
    const iframe = document.getElementById('preview-iframe');
    const badge = document.getElementById('preview-badge');

    placeholder.classList.remove('hidden');
    iframe.classList.add('hidden');
    badge.classList.add('hidden');
  }

  /**
   * Hide the output section.
   */
  function clearOutput() {
    document.getElementById('output-section').classList.add('hidden');
  }

  return { showPreview, showOutput, clearPreview, clearOutput, renderInIframe };
})();

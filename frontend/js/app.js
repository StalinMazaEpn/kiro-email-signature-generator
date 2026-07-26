'use strict';

/**
 * Main application logic.
 * Handles form submission, AI extraction, preview, copy-to-clipboard, download, and open in window.
 */
(function () {
  // DOM references
  const form = document.getElementById('signature-form');
  const btnPreview = document.getElementById('btn-preview');
  const btnGenerate = document.getElementById('btn-generate');
  const btnExtract = document.getElementById('btn-extract');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownload = document.getElementById('btn-download');
  const btnOpenWindow = document.getElementById('btn-open-window');
  const aiText = document.getElementById('ai-text');
  const aiStatus = document.getElementById('ai-status');
  const formStatus = document.getElementById('form-status');
  const imageInput = document.getElementById('image');

  // Store generated HTML for clipboard/download/open
  let generatedHtml = '';

  // --- Composition Mode ---
  const compositionRadios = document.querySelectorAll('input[name="compositionMode"]');
  const advancedParamsDiv = document.getElementById('advanced-params');

  compositionRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'advanced') {
        advancedParamsDiv.classList.remove('hidden');
      } else {
        advancedParamsDiv.classList.add('hidden');
      }
    });
  });

  /**
   * Returns image composition parameters based on the selected mode.
   * @returns {object}
   */
  function getCompositionParams() {
    const mode = document.querySelector('input[name="compositionMode"]:checked').value;
    switch (mode) {
      case 'centered':
        return { scalePercent: 100, horizontalAlign: 'center', verticalAlign: 'center', paddingPercent: 0 };
      case 'bottom':
        return { scalePercent: 80, horizontalAlign: 'center', verticalAlign: 'bottom', paddingPercent: 0 };
      case 'advanced':
        return {
          scalePercent: parseInt(document.getElementById('scalePercent').value, 10),
          paddingPercent: parseInt(document.getElementById('paddingPercent').value, 10),
          horizontalAlign: document.getElementById('horizontalAlign').value,
          verticalAlign: document.getElementById('verticalAlign').value,
          offsetX: parseInt(document.getElementById('offsetX').value, 10) || 0,
          offsetY: parseInt(document.getElementById('offsetY').value, 10) || 0,
        };
      default:
        return { scalePercent: 100, horizontalAlign: 'center', verticalAlign: 'center', paddingPercent: 0 };
    }
  }

  // --- AI Extraction ---
  btnExtract.addEventListener('click', handleExtract);

  async function handleExtract() {
    const text = aiText.value.trim();
    if (!text) {
      showStatus(aiStatus, 'Ingresa texto para extraer campos.', 'error');
      return;
    }

    setLoading(btnExtract, true, 'Extrayendo...');
    showStatus(aiStatus, 'Enviando texto a la IA...', 'loading');

    try {
      const result = await API.extractFields(text);

      if (!result.success) {
        showStatus(aiStatus, result.error || 'Error al extraer campos.', 'error');
        return;
      }

      // Clear form before pre-filling so stale data is removed
      clearForm();

      // Pre-fill form with extracted fields
      prefillForm(result.fields);

      // Check for missing required fields
      const missing = FieldConfig.getMissingRequired(result.fields);
      if (missing.length > 0) {
        const missingList = missing.map(f => `<strong>${f.label}</strong>`).join(', ');
        const suggestions = missing.map(f => `• ${f.label}: ${f.hint}`).join('<br>');
        showStatusHtml(aiStatus,
          `<span class="block mb-1">Campos extraidos, pero faltan datos obligatorios: ${missingList}</span>` +
          `<span class="block text-xs text-gray-600 mt-1">Sugerencia — en tu texto ${suggestions}</span>`,
          'warning'
        );
      } else {
        showStatus(aiStatus, 'Todos los campos obligatorios extraidos correctamente.', 'success');
      }
    } catch (err) {
      showStatus(aiStatus, `Error de conexion: ${err.message}`, 'error');
    } finally {
      setLoading(btnExtract, false, 'Extraer campos con IA');
    }
  }

  /**
   * Clear all form fields (except template and image).
   */
  function clearForm() {
    FieldConfig.fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (el) el.value = '';
    });
  }

  /**
   * Pre-fill form fields from extracted data.
   * @param {object} fields - { nombre, cargo, email, telefono, website, linkedin }
   */
  function prefillForm(fields) {
    FieldConfig.fields.forEach(f => {
      const value = fields[f.id];
      if (value) {
        const el = document.getElementById(f.id);
        if (el) el.value = value;
      }
    });
  }

  // --- Preview ---
  btnPreview.addEventListener('click', handlePreview);

  async function handlePreview() {
    const data = getFormData();

    if (!data.nombre || !data.cargo || !data.email) {
      showStatus(formStatus, 'Completa al menos nombre, cargo y email para la vista previa.', 'error');
      return;
    }

    setLoading(btnPreview, true, 'Cargando...');
    hideStatus(formStatus);

    try {
      const result = await API.previewSignature(data);

      if (!result.success) {
        showStatus(formStatus, result.error || 'Error al generar vista previa.', 'error');
        return;
      }

      let html = result.html;

      // If user has selected an image, replace placeholder with data URL for immediate preview
      if (imageInput.files && imageInput.files[0]) {
        const dataUrl = await fileToDataUrl(imageInput.files[0]);
        if (dataUrl) {
          html = html.replace(/https:\/\/via\.placeholder\.com[^"']*/g, dataUrl);
        }
      }

      Preview.showPreview(html);
    } catch (err) {
      showStatus(formStatus, `Error de conexion: ${err.message}`, 'error');
    } finally {
      setLoading(btnPreview, false, 'Vista previa');
    }
  }

  // --- Generate Signature ---
  form.addEventListener('submit', handleGenerate);

  async function handleGenerate(e) {
    e.preventDefault();

    const data = getFormData();

    // Get image as base64
    const imageBase64 = await fileToBase64(imageInput.files[0]);
    if (!imageBase64) {
      showStatus(formStatus, 'Selecciona una imagen de perfil.', 'error');
      return;
    }

    data.image = imageBase64;
    data.compositionParams = getCompositionParams();

    setLoading(btnGenerate, true, 'Generando...');
    hideStatus(formStatus);

    try {
      const result = await API.generateSignature(data);

      if (!result.success) {
        showStatus(formStatus, result.error || 'Error al generar la firma.', 'error');
        return;
      }

      generatedHtml = result.html;
      Preview.showOutput(result.html);
      showStatus(formStatus, 'Firma generada exitosamente.', 'success');
    } catch (err) {
      showStatus(formStatus, `Error de conexion: ${err.message}`, 'error');
    } finally {
      setLoading(btnGenerate, false, 'Generar firma');
    }
  }

  // --- Copy to Clipboard ---
  btnCopy.addEventListener('click', handleCopy);

  async function handleCopy() {
    if (!generatedHtml) return;

    try {
      await navigator.clipboard.writeText(generatedHtml);
      flashButton(btnCopy, 'Copiado!', 'bg-green-600', 'bg-green-800');
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = generatedHtml;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      flashButton(btnCopy, 'Copiado!', 'bg-green-600', 'bg-green-800');
    }
  }

  // --- Download HTML ---
  btnDownload.addEventListener('click', handleDownload);

  function handleDownload() {
    if (!generatedHtml) return;

    const fullHtml = wrapSignatureHtml(generatedHtml);
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'firma-email.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    flashButton(btnDownload, 'Descargado!', 'bg-indigo-600', 'bg-indigo-800');
  }

  // --- Open in New Window ---
  btnOpenWindow.addEventListener('click', handleOpenWindow);

  function handleOpenWindow() {
    if (!generatedHtml) return;

    const fullHtml = wrapSignatureHtml(generatedHtml);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(fullHtml);
      newWindow.document.close();
    } else {
      showStatus(formStatus, 'El navegador bloqueo la ventana emergente. Permite pop-ups para este sitio.', 'error');
    }
  }

  // --- Helpers ---

  /**
   * Wrap signature HTML fragment in a full HTML document for download/open.
   */
  function wrapSignatureHtml(html) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Firma de Email</title>
  <style>body { margin: 20px; font-family: Arial, sans-serif; }</style>
</head>
<body>
${html}
</body>
</html>`;
  }

  /**
   * Get form field values as an object.
   */
  function getFormData() {
    return {
      nombre: document.getElementById('nombre').value.trim(),
      cargo: document.getElementById('cargo').value.trim(),
      email: document.getElementById('email').value.trim(),
      telefono: document.getElementById('telefono').value.trim(),
      website: document.getElementById('website').value.trim() || undefined,
      linkedin: document.getElementById('linkedin').value.trim() || undefined,
      templateId: document.getElementById('templateId').value,
    };
  }

  /**
   * Convert a File to base64 string (without the data:... prefix).
   * @param {File} file
   * @returns {Promise<string|null>}
   */
  function fileToBase64(file) {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert a File to a full data URL (with the data:image/...;base64, prefix).
   * @param {File} file
   * @returns {Promise<string|null>}
   */
  function fileToDataUrl(file) {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Show a plain text status message.
   */
  function showStatus(el, message, type) {
    el.textContent = message;
    el.className = `mt-2 text-sm status-${type}`;
    el.classList.remove('hidden');
  }

  /**
   * Show a status message with HTML content.
   */
  function showStatusHtml(el, html, type) {
    el.innerHTML = html;
    el.className = `mt-2 text-sm status-${type}`;
    el.classList.remove('hidden');
  }

  /**
   * Hide a status element.
   */
  function hideStatus(el) {
    el.classList.add('hidden');
  }

  /**
   * Toggle loading state on a button.
   */
  function setLoading(btn, loading, text) {
    btn.disabled = loading;
    if (loading) {
      btn.innerHTML = `<span class="spinner mr-2"></span>${text}`;
    } else {
      btn.textContent = text;
    }
  }

  /**
   * Flash a button text temporarily.
   */
  function flashButton(btn, tempText, originalClass, flashClass) {
    const originalText = btn.textContent;
    btn.textContent = tempText;
    btn.classList.replace(originalClass, flashClass);
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.replace(flashClass, originalClass);
    }, 2000);
  }
})();

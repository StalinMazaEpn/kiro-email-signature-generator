'use strict';

/**
 * Main application logic.
 * Handles form submission, AI extraction, preview, and copy-to-clipboard.
 */
(function () {
  // DOM references
  const form = document.getElementById('signature-form');
  const btnPreview = document.getElementById('btn-preview');
  const btnGenerate = document.getElementById('btn-generate');
  const btnExtract = document.getElementById('btn-extract');
  const btnCopy = document.getElementById('btn-copy');
  const aiText = document.getElementById('ai-text');
  const aiStatus = document.getElementById('ai-status');
  const formStatus = document.getElementById('form-status');
  const imageInput = document.getElementById('image');

  // Store generated HTML for clipboard
  let generatedHtml = '';

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

      // Pre-fill form with extracted fields
      prefillForm(result.fields);
      showStatus(aiStatus, 'Campos extraidos correctamente.', 'success');
    } catch (err) {
      showStatus(aiStatus, `Error de conexion: ${err.message}`, 'error');
    } finally {
      setLoading(btnExtract, false, 'Extraer campos con IA');
    }
  }

  /**
   * Pre-fill form fields from extracted data.
   * @param {object} fields - { nombre, cargo, email, telefono, website, linkedin }
   */
  function prefillForm(fields) {
    if (fields.nombre) document.getElementById('nombre').value = fields.nombre;
    if (fields.cargo) document.getElementById('cargo').value = fields.cargo;
    if (fields.email) document.getElementById('email').value = fields.email;
    if (fields.telefono) document.getElementById('telefono').value = fields.telefono;
    if (fields.website) document.getElementById('website').value = fields.website;
    if (fields.linkedin) document.getElementById('linkedin').value = fields.linkedin;
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
          // Replace the placeholder banner URL with the actual image data URL
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
      const originalText = btnCopy.textContent;
      btnCopy.textContent = 'Copiado!';
      btnCopy.classList.replace('bg-green-600', 'bg-green-800');
      setTimeout(() => {
        btnCopy.textContent = originalText;
        btnCopy.classList.replace('bg-green-800', 'bg-green-600');
      }, 2000);
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
      btnCopy.textContent = 'Copiado!';
      setTimeout(() => { btnCopy.textContent = 'Copiar HTML'; }, 2000);
    }
  }

  // --- Helpers ---

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
        // Strip the data:image/...;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert a File to a full data URL (with the data:image/...;base64, prefix).
   * Used for preview rendering so images display immediately in the browser.
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
   * Show a status message.
   */
  function showStatus(el, message, type) {
    el.textContent = message;
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
})();

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

  // Image validation constants
  const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
  const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  // Store generated HTML for clipboard/download/open
  let generatedHtml = '';

  // Cached cropped images to avoid re-cropping on every generate
  let cachedProfileCrop = null;
  let cachedBgCrop = null;
  let cachedBgTemplateId = null; // track which template the bg was cropped for

  // --- Composition Mode ---
  const compositionRadios = document.querySelectorAll('input[name="compositionMode"]');
  const advancedParamsDiv = document.getElementById('advanced-params');
  const compositionCards = document.querySelectorAll('.composition-card');

  function updateCompositionVisual() {
    compositionCards.forEach(card => card.classList.remove('active'));
    const checked = document.querySelector('input[name="compositionMode"]:checked');
    if (checked) {
      const card = checked.closest('label').querySelector('.composition-card');
      if (card) card.classList.add('active');
    }
  }

  compositionRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateCompositionVisual();
      if (radio.value === 'advanced') {
        advancedParamsDiv.classList.remove('hidden');
      } else {
        advancedParamsDiv.classList.add('hidden');
      }
    });
  });

  // Set initial active state
  updateCompositionVisual();

  /**
   * Returns image composition parameters based on the selected mode.
   * Always includes target output dimensions for the selected template.
   * @returns {object}
   */
  function getCompositionParams() {
    const mode = document.querySelector('input[name="compositionMode"]:checked').value;
    const templateId = document.getElementById('templateId').value;
    const templateConfig = FieldConfig.getTemplateImageConfig(templateId);

    let params;
    switch (mode) {
      case 'centered':
        params = { scalePercent: 100, horizontalAlign: 'center', verticalAlign: 'center', paddingPercent: 0 };
        break;
      case 'bottom':
        params = { scalePercent: 80, horizontalAlign: 'center', verticalAlign: 'bottom', paddingPercent: 0 };
        break;
      case 'advanced':
        params = {
          scalePercent: parseInt(document.getElementById('scalePercent').value, 10),
          paddingPercent: parseInt(document.getElementById('paddingPercent').value, 10),
          horizontalAlign: document.getElementById('horizontalAlign').value,
          verticalAlign: document.getElementById('verticalAlign').value,
          offsetX: parseInt(document.getElementById('offsetX').value, 10) || 0,
          offsetY: parseInt(document.getElementById('offsetY').value, 10) || 0,
        };
        break;
      default:
        params = { scalePercent: 100, horizontalAlign: 'center', verticalAlign: 'center', paddingPercent: 0 };
    }

    // Always include target output dimensions for the selected template
    params.outputWidth = templateConfig.width * 2; // 2x for retina
    params.outputHeight = templateConfig.height * 2;

    return params;
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

    // Validate profile image
    const profileFile = imageInput.files[0];
    if (!profileFile) {
      showStatus(formStatus, 'Selecciona una imagen de perfil.', 'error');
      return;
    }
    const profileError = validateImageFile(profileFile, 'La foto de perfil');
    if (profileError) {
      showStatus(formStatus, profileError, 'error');
      return;
    }

    // Use cached cropped image if available, otherwise use raw file
    if (cachedProfileCrop) {
      data.image = cachedProfileCrop;
    } else {
      data.image = await fileToBase64(profileFile);
    }
    data.compositionParams = getCompositionParams();

    // Check for optional custom background image
    const bgInput = document.getElementById('backgroundImage');
    if (bgInput && bgInput.files && bgInput.files[0]) {
      const bgFile = bgInput.files[0];
      const bgError = validateImageFile(bgFile, 'El fondo personalizado');
      if (bgError) {
        showStatus(formStatus, bgError, 'error');
        return;
      }
      
      // Use cached crop if available, otherwise send raw image
      // (image-tools will use outputWidth/outputHeight from compositionParams)
      if (cachedBgCrop) {
        data.backgroundImage = cachedBgCrop;
      } else {
        data.backgroundImage = await fileToBase64(bgFile);
      }
    }

    setLoading(btnGenerate, true, 'Generando...');
    hideStatus(formStatus);

    try {
      const result = await API.generateSignature(data);

      if (!result.success) {
        showStatus(formStatus, result.error || 'Error al generar la firma.', 'error');
        return;
      }

      generatedHtml = result.html;

      // Show which template was used
      const templateSelect = document.getElementById('templateId');
      const templateName = templateSelect.options[templateSelect.selectedIndex].text;
      const templateBadge = document.getElementById('output-template-badge');
      if (templateBadge) {
        templateBadge.textContent = `Plantilla: ${templateName}`;
      }

      Preview.showOutput(result.html);
      if (result.usedFallback) {
        showStatusHtml(formStatus, 
          '<span class="block">⚠️ El servicio de procesamiento de imagen no está disponible.</span>' +
          '<span class="block text-xs mt-1">Se usó la foto original sin aplicar el fondo. Verifica que el servicio image-tools esté activo.</span>',
          'warning'
        );
      } else {
        showStatus(formStatus, 'Firma generada exitosamente.', 'success');
      }
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
      flashButton(btnCopy, 'Copiado!', 'bg-cerulean', 'bg-cerulean');
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
      flashButton(btnCopy, 'Copiado!', 'bg-cerulean', 'bg-cerulean');
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

    flashButton(btnDownload, 'Descargado!', 'btn-outlined-cerulean', 'btn-outlined-cerulean');
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
   * Validate an image file for allowed type and max size (15MB).
   * @param {File} file
   * @param {string} label - Human-readable label for error messages
   * @returns {string|null} Error message or null if valid
   */
  function validateImageFile(file, label) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return `${label}: el formato "${file.type || 'desconocido'}" no es compatible. Solo se aceptan imágenes PNG, JPG o WebP.`;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      return `${label} pesa ${sizeMB}MB y el máximo es 15MB. Reduce el tamaño de la imagen antes de subirla.`;
    }
    return null;
  }

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
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }

  // --- Dropzone Logic ---
  function initDropzone(dropzoneId, inputId, previewId) {
    const dropzone = document.getElementById(dropzoneId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target === input || e.target.closest('.btn-crop')) return;
      input.click();
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        input.files = files;
        input.dispatchEvent(new Event('change'));
      }
    });

    input.addEventListener('change', () => {
      // Clear cached crop when new file is selected
      if (inputId === 'image') cachedProfileCrop = null;
      if (inputId === 'backgroundImage') { cachedBgCrop = null; cachedBgTemplateId = null; }

      if (input.files && input.files[0]) {
        const file = input.files[0];
        dropzone.classList.add('has-file');
        if (preview) {
          const reader = new FileReader();
          reader.onload = (e) => {
            preview.innerHTML = `
            <img src="${e.target.result}" class="max-h-20 rounded-lg mx-auto mt-2" alt="Preview">
            <p class="text-xs text-gray-500 mt-1">${file.name}</p>
            <button type="button" class="btn-crop mt-2 text-xs px-3 py-1 rounded-lg font-medium" style="background-color: var(--tea-green); color: var(--jet-black);">✂️ Recortar</button>
          `;
            preview.classList.remove('hidden');

            // Attach crop button handler
            const cropBtn = preview.querySelector('.btn-crop');
            cropBtn.addEventListener('click', async (evt) => {
              evt.stopPropagation();
              const dataUrl = e.target.result;
              if (inputId === 'image') {
                const cropped = await CropperHandler.openFree(dataUrl);
                if (cropped) {
                  cachedProfileCrop = cropped;
                  cropBtn.textContent = '✅ Recortada';
                  cropBtn.disabled = true;
                }
              } else if (inputId === 'backgroundImage') {
                const templateId = document.getElementById('templateId').value;
                const cropped = await CropperHandler.open(dataUrl, templateId);
                if (cropped) {
                  cachedBgCrop = cropped;
                  cachedBgTemplateId = templateId;
                  cropBtn.textContent = '✅ Recortado';
                  cropBtn.disabled = true;
                }
              }
            });
          };
          reader.readAsDataURL(file);
        }
      } else {
        dropzone.classList.remove('has-file');
        if (preview) { preview.classList.add('hidden'); preview.innerHTML = ''; }
      }
    });
  }

  initDropzone('dropzone-image', 'image', 'dropzone-image-preview');
  initDropzone('dropzone-background', 'backgroundImage', 'dropzone-bg-preview');

  // --- Demo Data ---
  const btnDemoData = document.getElementById('btn-demo-data');
  if (btnDemoData) {
    btnDemoData.addEventListener('click', () => {
      document.getElementById('nombre').value = 'María López';
      document.getElementById('cargo').value = 'Product Manager';
      document.getElementById('email').value = 'maria.lopez@empresa.com';
      document.getElementById('telefono').value = '+593 99 123 4567';
      document.getElementById('website').value = 'https://empresa.com';
      document.getElementById('linkedin').value = 'https://linkedin.com/in/marialopez';
      showStatus(formStatus, 'Datos de ejemplo cargados. Puedes editarlos antes de generar.', 'success');
    });
  }

  // --- Rich Copy for Outlook (copies as text/html to clipboard) ---
  const btnCopyRich = document.getElementById('btn-copy-rich');
  if (btnCopyRich) {
    btnCopyRich.addEventListener('click', async () => {
      if (!generatedHtml) return;
      try {
        const blob = new Blob([generatedHtml], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
        flashButton(btnCopyRich, '¡Copiado!', 'bg-cerulean', 'bg-jet');
      } catch (err) {
        // Fallback: copy as plain HTML text
        await navigator.clipboard.writeText(generatedHtml);
        flashButton(btnCopyRich, '¡Copiado como texto!', 'bg-cerulean', 'bg-jet');
      }
    });
  }

  const btnCopyGmail = document.getElementById('btn-copy-gmail');
  if (btnCopyGmail) {
    btnCopyGmail.addEventListener('click', async () => {
      if (!generatedHtml) return;
      try {
        const blob = new Blob([generatedHtml], { type: 'text/html' });
        const textBlob = new Blob([generatedHtml], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })]);
        flashButton(btnCopyGmail, '¡Copiado!', 'bg-cerulean', 'bg-jet');
      } catch (err) {
        await navigator.clipboard.writeText(generatedHtml);
        flashButton(btnCopyGmail, '¡Copiado como texto!', 'bg-cerulean', 'bg-jet');
      }
    });
  }
})();

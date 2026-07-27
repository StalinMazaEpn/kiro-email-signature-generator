'use strict';

/**
 * Cropper.js integration for background image cropping.
 * Opens a modal when user uploads a background, letting them crop to
 * the aspect ratio required by the selected template.
 */
const CropperHandler = (() => {
  let cropper = null;
  let resolvePromise = null;

  const modal = document.getElementById('cropper-modal');
  const cropperImage = document.getElementById('cropper-image');
  const btnConfirm = document.getElementById('cropper-confirm');
  const btnCancel = document.getElementById('cropper-cancel');
  const btnCancelFooter = document.getElementById('cropper-cancel-btn');
  const backdrop = document.getElementById('cropper-backdrop');
  const dimensionsLabel = document.getElementById('cropper-dimensions');
  const hintLabel = document.getElementById('cropper-hint');

  /**
   * Open the cropper modal with an image and aspect ratio.
   * @param {string} imageDataUrl - Data URL of the image to crop
   * @param {string} templateId - Current template ID for aspect ratio
   * @returns {Promise<string|null>} Resolves with cropped base64 (no prefix) or null if cancelled
   */
  function open(imageDataUrl, templateId) {
    const config = FieldConfig.getTemplateImageConfig(templateId);
    
    dimensionsLabel.textContent = `Dimensiones recomendadas: ${config.label}`;
    hintLabel.textContent = `Recorta la imagen al formato ${config.label} para la plantilla seleccionada.`;

    cropperImage.src = imageDataUrl;
    modal.classList.remove('hidden');

    return new Promise((resolve) => {
      resolvePromise = resolve;

      // Wait for image to load before initializing Cropper
      cropperImage.onload = () => {
        if (cropper) {
          cropper.destroy();
        }
        cropper = new Cropper(cropperImage, {
          aspectRatio: config.aspectRatio,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.9,
          responsive: true,
          restore: false,
          guides: true,
          center: true,
          highlight: true,
          background: true,
        });
      };
    });
  }

  /**
   * Close the modal and clean up.
   */
  function close(result) {
    modal.classList.add('hidden');
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    cropperImage.src = '';
    if (resolvePromise) {
      resolvePromise(result);
      resolvePromise = null;
    }
  }

  // Confirm crop
  btnConfirm.addEventListener('click', () => {
    if (!cropper) return close(null);

    const templateId = document.getElementById('templateId').value;
    const config = FieldConfig.getTemplateImageConfig(templateId);

    const canvas = cropper.getCroppedCanvas({
      width: config.width * 2, // 2x for retina
      height: config.height * 2,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });

    const croppedDataUrl = canvas.toDataURL('image/png');
    const base64 = croppedDataUrl.split(',')[1];
    close(base64);
  });

  // Cancel
  [btnCancel, btnCancelFooter, backdrop].forEach(el => {
    el.addEventListener('click', () => close(null));
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      close(null);
    }
  });

  return { open, close };
})();

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
   * Open the cropper in free mode (no aspect ratio constraint).
   * Used for profile photo cropping.
   * @param {string} imageDataUrl - Data URL of the image
   * @returns {Promise<string|null>} Cropped base64 or null if cancelled
   */
  function openFree(imageDataUrl) {
    dimensionsLabel.textContent = 'Recorte libre — ajusta como prefieras';
    hintLabel.textContent = 'Recorta tu foto de perfil. Se enviará tal como la dejes.';

    cropperImage.src = imageDataUrl;
    modal.classList.remove('hidden');

    return new Promise((resolve) => {
      resolvePromise = resolve;
      cropperImage.onload = () => {
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropperImage, {
          aspectRatio: NaN, // free crop
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

    // For free crop (profile photo), use natural dimensions capped at 600px
    let canvasOpts;
    if (hintLabel.textContent.includes('foto de perfil')) {
      // Free crop: use cropped area at max 600px wide
      canvasOpts = {
        maxWidth: 600,
        maxHeight: 600,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      };
    } else {
      // Template crop: use exact template dimensions
      canvasOpts = {
        width: config.width * 2,
        height: config.height * 2,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      };
    }

    const canvas = cropper.getCroppedCanvas(canvasOpts);
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

  return { open, openFree, close };
})();

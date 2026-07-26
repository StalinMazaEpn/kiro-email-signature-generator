'use strict';

/**
 * Template Validator for email signatures.
 * Implements 8 validation rules:
 * - 4 ERROR rules (template will break)
 * - 4 WARNING rules (may cause issues in some clients)
 */
const Validator = (() => {
  const REQUIRED_VARS = ['nombre', 'cargo', 'email', 'bannerUrl'];

  /**
   * Validate a Mustache template string.
   * @param {string} template - Raw Mustache template HTML
   * @returns {{ errors: Array<{rule: string, message: string}>, warnings: Array<{rule: string, message: string}> }}
   */
  function validate(template) {
    const errors = [];
    const warnings = [];

    // --- ERROR RULES ---

    // E1: Required variables must be present
    const missingVars = checkRequiredVars(template);
    if (missingVars.length > 0) {
      errors.push({
        rule: 'E1: Variables requeridas',
        message: `Faltan variables obligatorias: ${missingVars.join(', ')}`,
      });
    }

    // E2: No <style> blocks allowed (inline only for email)
    if (hasStyleBlocks(template)) {
      errors.push({
        rule: 'E2: Bloques <style>',
        message: 'No se permiten bloques <style>. Usa estilos inline.',
      });
    }

    // E3: No <script> tags allowed
    if (hasScriptTags(template)) {
      errors.push({
        rule: 'E3: Tags <script>',
        message: 'No se permiten tags <script> en firmas de email.',
      });
    }

    // E4: No div with flex/grid (use tables instead)
    if (hasDivFlexGrid(template)) {
      errors.push({
        rule: 'E4: Div con flex/grid',
        message: 'No uses <div> con display:flex o display:grid. Usa <table> para layout.',
      });
    }

    // --- WARNING RULES ---

    // W1: Images should have width/height attributes
    const imgsWithoutDimensions = checkImgDimensions(template);
    if (imgsWithoutDimensions > 0) {
      warnings.push({
        rule: 'W1: Dimensiones de imagen',
        message: `${imgsWithoutDimensions} imagen(es) sin atributos width/height. Algunos clientes no las renderizaran correctamente.`,
      });
    }

    // W2: Max width should be <= 600px
    if (exceedsMaxWidth(template)) {
      warnings.push({
        rule: 'W2: Ancho maximo',
        message: 'El ancho supera 600px. Algunos clientes de email recortan contenido mas ancho.',
      });
    }

    // W3: Outlook-incompatible CSS properties
    const outlookIssues = checkOutlookCSS(template);
    if (outlookIssues.length > 0) {
      warnings.push({
        rule: 'W3: CSS incompatible con Outlook',
        message: `Propiedades CSS no soportadas en Outlook: ${outlookIssues.join(', ')}`,
      });
    }

    // W4: External fonts (not supported in most email clients)
    if (hasExternalFonts(template)) {
      warnings.push({
        rule: 'W4: Fuentes externas',
        message: 'Se detectaron fuentes externas (@import o <link> a fonts). La mayoria de clientes de email las ignoran.',
      });
    }

    return { errors, warnings };
  }

  // --- Rule implementations ---

  function checkRequiredVars(template) {
    const missing = [];
    for (const varName of REQUIRED_VARS) {
      // Check for {{var}}, {{{var}}}, or {{#var}} patterns
      const regex = new RegExp(`\\{\\{[#/^&]?\\{?${varName}\\}?\\}\\}`);
      if (!regex.test(template)) {
        missing.push(varName);
      }
    }
    return missing;
  }

  function hasStyleBlocks(template) {
    return /<style[\s>]/i.test(template);
  }

  function hasScriptTags(template) {
    return /<script[\s>]/i.test(template);
  }

  function hasDivFlexGrid(template) {
    // Look for <div ...style="...display:flex..." or display:grid
    const divRegex = /<div[^>]*style="[^"]*display\s*:\s*(flex|grid)[^"]*"/i;
    return divRegex.test(template);
  }

  function checkImgDimensions(template) {
    const imgTags = template.match(/<img[^>]*>/gi) || [];
    let count = 0;
    for (const img of imgTags) {
      const hasWidth = /width\s*=/i.test(img);
      const hasHeight = /height\s*=/i.test(img);
      if (!hasWidth || !hasHeight) {
        count++;
      }
    }
    return count;
  }

  function exceedsMaxWidth(template) {
    // Check for width values > 600 in inline styles or attributes
    const widthMatches = template.match(/width\s*[:=]\s*["']?(\d+)/gi) || [];
    for (const match of widthMatches) {
      const num = parseInt(match.match(/(\d+)/)[1], 10);
      if (num > 600) return true;
    }
    return false;
  }

  function checkOutlookCSS(template) {
    const problematic = [];
    const outlookUnsupported = [
      { prop: 'border-radius', label: 'border-radius' },
      { prop: 'box-shadow', label: 'box-shadow' },
      { prop: 'text-shadow', label: 'text-shadow' },
      { prop: 'opacity', label: 'opacity' },
      { prop: 'transform', label: 'transform' },
      { prop: 'animation', label: 'animation' },
    ];

    for (const { prop, label } of outlookUnsupported) {
      const regex = new RegExp(prop + '\\s*:', 'i');
      if (regex.test(template)) {
        problematic.push(label);
      }
    }
    return problematic;
  }

  function hasExternalFonts(template) {
    return /@import\s+url/i.test(template) ||
      /<link[^>]*fonts\.(googleapis|google)\.com/i.test(template) ||
      /<link[^>]*rel=["']?stylesheet["']?[^>]*href=["'][^"']*font/i.test(template);
  }

  return { validate, REQUIRED_VARS };
})();

'use strict';

/**
 * Local development server that mimics API Gateway + Lambda.
 * Serves the same endpoints locally so you can test without deploying to AWS.
 *
 * Usage: npm run dev (from root or from /lambda)
 * Storage/AI providers are controlled entirely by STORAGE_PROVIDER and
 * AI_PROVIDER in .env (both default to filesystem/local-friendly values).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const { getConfig } = require('./src/utils/config');
const { validateGenerateRequest, validatePreviewRequest, validateExtractRequest } = require('./src/utils/validation');
const { render, resolvePageTitle, getTemplateList, getTemplateVariables, loadTemplateConfig } = require('./src/services/templateEngine');
const { upload, getOriginalKey, LOCAL_STORAGE_DIR } = require('./src/services/storageService');
const { createBanner } = require('./src/services/imageToolsClient');
const { TemplateStorageConfigError, listTemplateFiles } = require('./src/services/templateStorage');

const app = express();
const config = getConfig();

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Serve local-storage files (replaces S3 public URLs in dev)
app.use('/storage', express.static(LOCAL_STORAGE_DIR));

// config.js is generated at deploy time and gitignored. Locally, serve it
// generated on the fly from .env so ADMIN_PASSWORD_HASH reaches the admin
// login form (window.ADMIN_CONFIG) the same way it does in production,
// unless the user placed a real static file to override it.
app.get('/config.js', (req, res) => {
  const configPath = path.join(__dirname, '../frontend/config.js');
  if (fs.existsSync(configPath)) {
    return res.type('application/javascript').sendFile(configPath);
  }
  const lines = ['// Auto-generated locally by dev-server.js from .env'];
  if (config.adminPasswordHash) {
    lines.push(`window.ADMIN_CONFIG = { passwordHash: ${JSON.stringify(config.adminPasswordHash)} };`);
  }
  res.type('application/javascript').send(lines.join('\n') + '\n');
});

// Serve frontend files
app.use('/', express.static(path.join(__dirname, '../frontend')));

// --- API ENDPOINTS ---

/**
 * POST /generate-signature
 * Full flow: upload image → process banner → render template
 */
app.post('/generate-signature', async (req, res) => {
  console.log('[generate-signature] Request recibida');
  try {
    const validation = validateGenerateRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const { nombre, cargo, email, telefono, website, linkedin, templateId, image, compositionParams, backgroundImage } = req.body;

    // Decode base64 image
    const imageBuffer = Buffer.from(image, 'base64');
    const originalKey = getOriginalKey(nombre);

    // Upload original
    const originalUrl = await upload(originalKey, imageBuffer, 'image/png');

    // Handle custom background if provided
    let customBackgroundUrl = null;
    if (backgroundImage) {
      const bgBuffer = Buffer.from(backgroundImage, 'base64');
      const bgKey = `backgrounds/${Date.now()}-${nombre.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}-bg.png`;
      customBackgroundUrl = await upload(bgKey, bgBuffer, 'image/png');
    }

    // Process banner (in local mode, uses the original as fallback)
    const bannerFields = { nombre, cargo, email, telefono, website, linkedin };
    const bannerResult = await createBanner(originalUrl, nombre, imageBuffer, compositionParams || {}, customBackgroundUrl, templateId, bannerFields);
    const bannerUrl = bannerResult.url;

    // Render template
    const fields = { nombre, cargo, email, telefono, website, linkedin, bannerUrl };
    const html = render(templateId, fields);
    const pageTitle = resolvePageTitle(templateId, fields);

    console.log('[generate-signature] Enviando respuesta 200 al cliente (usedFallback:', bannerResult.usedFallback || false, ')');
    res.json({
      success: true,
      html,
      pageTitle,
      bannerUrl,
      usedFallback: bannerResult.usedFallback || false,
      fallbackReason: bannerResult.fallbackReason || null
    });
    console.log('[generate-signature] Respuesta enviada');
  } catch (err) {
    console.error('[generate-signature] Error:', err.message);
    const statusCode = err instanceof TemplateStorageConfigError ? 400 : 500;
    res.status(statusCode).json({ success: false, error: err.message });
  }
});

/**
 * POST /preview-signature
 * Quick preview: render template without image processing
 */
app.post('/preview-signature', async (req, res) => {
  try {
    const validation = validatePreviewRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const { nombre, cargo, email, telefono, website, linkedin, templateId } = req.body;

    const placeholderBanner = 'data:image/svg+xml;base64,' + Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120">' +
      '<rect width="100%" height="100%" fill="#e2e8f0"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
      'font-family="sans-serif" font-size="20" fill="#64748b">Banner Preview</text>' +
      '</svg>'
    ).toString('base64');
    const fields = { nombre, cargo, email, telefono, website, linkedin, bannerUrl: placeholderBanner };
    const html = render(templateId, fields);
    const pageTitle = resolvePageTitle(templateId, fields);

    res.json({ success: true, html, pageTitle });
  } catch (err) {
    console.error('[preview-signature] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /extract-fields
 * AI-assisted field extraction from free text.
 * NOTE: This endpoint requires real AI credentials (Azure OpenAI or Bedrock).
 * In dev mode without credentials, returns a mock response.
 */
app.post('/extract-fields', async (req, res) => {
  try {
    const validation = validateExtractRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const { text } = req.body;

    // Check if AI credentials are available
    const hasAICredentials = config.aiProvider === 'azure'
      ? (config.azure.endpoint && config.azure.key)
      : true; // Bedrock uses IAM roles

    if (!hasAICredentials) {
      // Return a helpful mock response for development without AI
      console.warn('[extract-fields] No AI credentials configured. Returning mock extraction.');
      return res.json({
        success: true,
        fields: extractFieldsMock(text),
        _mock: true,
        _message: 'AI credentials not configured. Using basic regex extraction.',
      });
    }

    // Use real AI provider
    const { getAIProvider } = require('./src/providers/aiProvider');
    const provider = getAIProvider();

    const systemPrompt = `Eres un asistente que extrae datos de contacto de texto libre. Responde únicamente con JSON válido con los campos: nombre, cargo, email, telefono, website, linkedin. Si un campo no está presente, usa null.`;
    const fullPrompt = `${systemPrompt}\n\nTexto del usuario:\n${text}`;

    const response = await provider.callModel(fullPrompt);

    // Parse JSON from AI response
    let fields;
    try {
      // Handle cases where AI wraps response in markdown code blocks
      const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      fields = JSON.parse(jsonStr);
    } catch (parseErr) {
      return res.status(500).json({
        success: false,
        error: 'No se pudo interpretar la respuesta de la IA. Intenta con un texto más claro.',
      });
    }

    res.json({ success: true, fields });
  } catch (err) {
    console.error('[extract-fields] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /templates
 * Returns available template list with metadata
 */
app.get('/templates', (req, res) => {
  const templates = getTemplateList();
  res.json({ success: true, templates });
});

/**
 * GET /templates/:id/variables
 * Returns variables used in a specific template
 */
app.get('/templates/:id/variables', (req, res) => {
  try {
    const vars = getTemplateVariables(req.params.id);
    res.json({ success: true, variables: vars });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

/**
 * GET /admin/storage-templates
 * Lists templates that have a custom banner.storage (FTP/SFTP) destination
 * configured, for the admin panel's read-only file browser.
 */
app.get('/admin/storage-templates', (req, res) => {
  const templates = getTemplateList()
    .map(({ id, name }) => ({ id, name, storage: loadTemplateConfig(id)?.banner?.storage || null }))
    .filter((t) => t.storage && t.storage.enabled !== false)
    .map(({ id, name, storage }) => ({
      id,
      name,
      type: storage.type,
      host: storage.host,
      remotePath: storage.remotePath,
    }));
  res.json({ success: true, templates });
});

/**
 * GET /admin/storage-templates/:id/files
 * Read-only listing of the files present in a template's custom banner
 * storage destination (FTP/SFTP). Never uploads or deletes anything.
 */
app.get('/admin/storage-templates/:id/files', async (req, res) => {
  try {
    const result = await listTemplateFiles(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: `Template "${req.params.id}" has no custom storage configured.` });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[admin/storage-templates/:id/files] Error:', err.message);
    if (err instanceof TemplateStorageConfigError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    storageProvider: config.storageProvider,
    aiProvider: config.aiProvider,
    hasAICredentials: config.aiProvider === 'azure'
      ? !!(config.azure.endpoint && config.azure.key)
      : true,
  });
});

// --- MOCK HELPERS ---

/**
 * Basic regex-based field extraction for dev mode without AI.
 * Not as smart as the AI, but good enough for testing the flow.
 */
function extractFieldsMock(text) {
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/\+?\d[\d\s\-().]{7,}/);
  const urlMatch = text.match(/https?:\/\/[^\s,]+/);
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s,]+/);

  // Try to extract name (first "word-like" segment that isn't email/phone/url)
  const parts = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  let nombre = null;
  let cargo = null;

  for (const part of parts) {
    if (part.includes('@') || part.match(/^\+?\d/) || part.includes('://')) continue;
    if (!nombre) {
      nombre = part;
    } else if (!cargo) {
      cargo = part;
    }
  }

  return {
    nombre,
    cargo,
    email: emailMatch ? emailMatch[0] : null,
    telefono: phoneMatch ? phoneMatch[0].trim() : null,
    website: urlMatch && !urlMatch[0].includes('linkedin') ? urlMatch[0] : null,
    linkedin: linkedinMatch ? linkedinMatch[0] : null,
  };
}

// --- START SERVER ---

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n🚀 Email Signature Generator - Dev Server`);
  console.log(`   Storage:      ${config.storageProvider}`);
  console.log(`   AI Provider:  ${config.aiProvider}`);
  console.log(`   Port:         ${PORT}`);
  console.log(`\n   Frontend:     http://localhost:${PORT}/`);
  console.log(`   API Base:     http://localhost:${PORT}/`);
  console.log(`   Health:       http://localhost:${PORT}/health`);
  console.log(`   Storage URL:  http://localhost:${PORT}/storage/`);
  console.log(`\n   Endpoints:`);
  console.log(`   POST /generate-signature`);
  console.log(`   POST /preview-signature`);
  console.log(`   POST /extract-fields`);
  console.log(`   GET  /templates`);
  console.log(`   GET  /templates/:id/variables`);
  console.log(`\n   Press Ctrl+C to stop.\n`);
});

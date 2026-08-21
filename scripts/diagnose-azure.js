'use strict';

/**
 * Diagnóstico de la conexión a Azure OpenAI.
 * Lee el `.env`, muestra el endpoint/deployment/estilo detectado,
 * y prueba una lista de `api-version` (proponibles por argumento o un set por
 * defecto) tanto para Chat Completions como para Responses API, mostrando
 * cuál responde OK y cuál da "API version not supported".
 *
 * Uso:
 *   node scripts/diagnose-azure.js
 *   node scripts/diagnose-azure.js 2025-03-01-preview 2025-08-01-preview
 *   node scripts/diagnose-azure.js --responses
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getConfig } = require('../lambda/src/utils/config');

const config = getConfig();
const { endpoint, key, deployment, apiVersion, apiStyle, apiType } = config.azure;

const isOpenAiCompat =
  apiStyle === 'openai' || (apiStyle === 'auto' && /\/openai\/v1\/?$/.test(endpoint));

const requestedRes = apiType === 'responses' || process.argv.includes('--responses');

function maskKey(k) {
  if (!k) return '(vacía)';
  return k.length > 8 ? `${k.slice(0, 3)}...${k.slice(-4)}` : '(demasiado corta)';
}

console.log('\n=== Diagnóstico Azure OpenAI ===');
console.log('APIVersion configurada :', apiVersion || '(vacía)');
console.log('Endpoint (base)        :', endpoint || '(vacía)');
console.log('API key                :', maskKey(key));
console.log('Deployment             :', deployment || '(vacía)');
console.log('apiStyle               :', apiStyle);
console.log('apiType                :', apiType);
console.log('Formato detectado      :', isOpenAiCompat ? 'openai-compatible (/openai/v1)' : 'legacy (por recurso)');
console.log('Probar Responses API   :', requestedRes);
console.log('');

if (!endpoint || !key) {
  console.error('  ERROR: faltan AZURE_OPENAI_ENDPOINT y/o AZURE_OPENAI_KEY en .env');
  process.exit(1);
}

const CANDIDATES = process.argv.slice(2).filter(a => !a.startsWith('--'));
const versions = CANDIDATES.length
  ? CANDIDATES
  : ['2024-02-01', '2024-10-21', '2025-01-01-preview', '2025-03-01-preview',
     '2025-06-01-preview', '2025-07-01-preview', '2025-08-01-preview', '2025-09-01-preview'];

async function probe(version) {
  const headers = { 'Content-Type': 'application/json', 'api-key': key };
  if (requestedRes) {
    const url = `${endpoint}/responses?api-version=${version}`;
    const body = { model: deployment, input: 'Hola', stream: true, max_output_tokens: 16 };
    return { url, response: await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }) };
  }
  const url = isOpenAiCompat
    ? `${endpoint}/chat/completions?api-version=${version}`
    : `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
  const body = isOpenAiCompat
    ? { model: deployment, messages: [{ role: 'user', content: 'Hola' }], max_tokens: 16 }
    : { messages: [{ role: 'user', content: 'Hola' }], max_tokens: 16 };
  return { url, response: await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }) };
}

(async () => {
  for (const v of versions) {
    try {
      const { url, response } = await probe(v);
      const text = await response.text().catch(() => '');
      const summary = text.replace(/\s+/g, ' ').slice(0, 150);
      const tag = response.status === 200 ? 'OK ' : 'ERR';
      console.log(`${tag} api-version=${v.padEnd(22)} [${response.status}] ${summary}`);
      if (response.status === 200) {
        console.log(`     → URL exitosa: ${url}`);
      }
    } catch (e) {
      console.log(`ERR api-version=${v.padEnd(22)} [exception] ${e.message}`);
    }
  }
  console.log('\nLa(s) versión(es) con OK es la(s) que tu recurso acepta. Luego fija el valor ganador en:\n  AZURE_OPENAI_API_VERSION=<version>\n');
})();
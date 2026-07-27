#!/usr/bin/env node
'use strict';

/**
 * Utility script to generate SHA-256 hash from a plain text password.
 * Use this to generate the ADMIN_PASSWORD_HASH value for your .env file.
 *
 * Usage:
 *   node scripts/generate-hash.js <password>
 *
 * Example:
 *   node scripts/generate-hash.js miPasswordSeguro123
 *   → a1b2c3d4...
 *
 * Then set ADMIN_PASSWORD_HASH=<hash> in your .env file.
 */

const crypto = require('crypto');

const password = process.argv[2];

if (!password) {
  console.error('');
  console.error('  Uso: node scripts/generate-hash.js <password>');
  console.error('');
  console.error('  Ejemplo:');
  console.error('    node scripts/generate-hash.js miPasswordSeguro123');
  console.error('');
  console.error('  Luego coloca el hash resultante en tu .env:');
  console.error('    ADMIN_PASSWORD_HASH=<hash>');
  console.error('');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(password).digest('hex');

console.log('');
console.log('  Password:  ', password);
console.log('  SHA-256:   ', hash);
console.log('');
console.log('  Agrega esto a tu .env:');
console.log(`  ADMIN_PASSWORD_HASH=${hash}`);
console.log('');

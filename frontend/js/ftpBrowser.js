'use strict';

/**
 * Read-only rendering helpers for the admin panel's FTP/SFTP file browser.
 * Fetching is done via API.getStorageTemplates / API.getStorageTemplateFiles
 * (frontend/js/api.js); this module only formats what comes back.
 */
const FtpBrowser = (() => {
  /**
   * Format a byte count as a human-readable size (e.g. "312 KB").
   * @param {number} bytes
   * @returns {string}
   */
  function formatSize(bytes) {
    if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes < 0) {
      return '-';
    }
    if (bytes === 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
  }

  /**
   * Format an ISO/date-like value for display, or "-" if unknown.
   * @param {string|null} value
   * @returns {string}
   */
  function formatDate(value) {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
  }

  /**
   * Escape text for safe use inside innerHTML.
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  /**
   * Build the <option> list for the template <select>.
   * @param {Array<{id: string, name: string, type: string, host: string, remotePath: string}>} templates
   * @returns {string}
   */
  function renderTemplateOptions(templates) {
    if (!templates.length) {
      return '<option value="">No hay plantillas con almacenamiento FTP/SFTP configurado</option>';
    }
    return templates
      .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (${escapeHtml(t.type.toUpperCase())})</option>`)
      .join('');
  }

  /**
   * Sort files by a column, directories always grouped first within the
   * chosen direction (so sorting stays stable/predictable either way).
   * @param {Array<{name: string, size: number, isDirectory: boolean, modifiedAt: string|null}>} files
   * @param {'name'|'size'|'modifiedAt'} sortKey
   * @param {'asc'|'desc'} sortDir
   * @returns {Array}
   */
  function sortFiles(files, sortKey, sortDir) {
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...files].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      let cmp;
      if (sortKey === 'size') {
        cmp = (a.size || 0) - (b.size || 0);
      } else if (sortKey === 'modifiedAt') {
        cmp = new Date(a.modifiedAt || 0).getTime() - new Date(b.modifiedAt || 0).getTime();
      } else {
        cmp = a.name.localeCompare(b.name);
      }
      return cmp * dir;
    });
  }

  /**
   * Build the file listing table body sorted by the given column/direction.
   * Read-only — no actions on any row.
   * @param {Array<{name: string, size: number, isDirectory: boolean, modifiedAt: string|null}>} files
   * @param {'name'|'size'|'modifiedAt'} sortKey
   * @param {'asc'|'desc'} sortDir
   * @returns {string}
   */
  function renderFileList(files, sortKey = 'name', sortDir = 'asc') {
    if (!files.length) {
      return '<tr><td colspan="3" class="text-sm text-gray-500 text-center py-6">Carpeta vacia.</td></tr>';
    }
    const sorted = sortFiles(files, sortKey, sortDir);
    return sorted
      .map((f) => `
        <tr class="border-b" style="border-color: rgba(158,193,163,0.2);">
          <td class="py-2 pr-3 text-sm" style="color: var(--jet-black);">
            <span aria-hidden="true">${f.isDirectory ? '📁' : '🖼️'}</span>
            <span class="ml-1">${escapeHtml(f.name)}</span>
          </td>
          <td class="py-2 pr-3 text-sm text-gray-500">${f.isDirectory ? '-' : formatSize(f.size)}</td>
          <td class="py-2 text-sm text-gray-500">${formatDate(f.modifiedAt)}</td>
        </tr>`)
      .join('');
  }

  /**
   * Update the sort-arrow indicators (▲/▼) on the header buttons: only the
   * active sortKey shows an arrow, pointing in the active direction.
   * @param {HTMLElement} theadEl - element containing the .ftp-sort-btn buttons
   * @param {'name'|'size'|'modifiedAt'} sortKey
   * @param {'asc'|'desc'} sortDir
   */
  function updateSortIndicators(theadEl, sortKey, sortDir) {
    theadEl.querySelectorAll('.ftp-sort-btn').forEach((btn) => {
      const arrow = btn.querySelector('.ftp-sort-arrow');
      if (!arrow) {
        return;
      }
      arrow.textContent = btn.dataset.sortKey === sortKey ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';
    });
  }

  return { formatSize, formatDate, renderTemplateOptions, renderFileList, updateSortIndicators };
})();

/*
 * Yandex Maps Photo Uploader
 * Copyright (C) 2026 Павел Елагин
 *
 * Licensed under the GNU General Public License v3.0.
 * See the LICENSE file for details.
 */
(() => {
  'use strict';

  const UPLOAD_URL = 'https://core-pht-proxy.maps.yandex.ru/v1/photos/my/upload';

  function inferMimeType(filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.heic')) return 'image/heic';
    if (lower.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
  }

  function parseResponseText(text) {
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  function buildError(status, responseBody) {
    const details = typeof responseBody === 'string'
      ? responseBody.slice(0, 300)
      : responseBody
        ? JSON.stringify(responseBody)
        : '';

    return new Error(`HTTP ${status}${details ? `: ${details}` : ''}`);
  }

  function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const filename = file.name || `photo-${Date.now()}.jpg`;
      const mtimeSeconds = Math.floor((file.lastModified || Date.now()) / 1000);
      const url = new URL(UPLOAD_URL);
      url.searchParams.set('filename', filename);
      url.searchParams.set('format', 'json');
      url.searchParams.set('mtime', String(mtimeSeconds));

      const request = new XMLHttpRequest();
      request.open('PUT', url.toString(), true);
      request.withCredentials = true;
      request.setRequestHeader('Content-Type', file.type || inferMimeType(filename));

      request.upload.addEventListener('progress', event => {
        if (!event.lengthComputable || typeof onProgress !== 'function') return;
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      });

      request.addEventListener('load', () => {
        const responseBody = parseResponseText(request.responseText);

        if (request.status < 200 || request.status >= 300) {
          reject(buildError(request.status, responseBody));
          return;
        }

        if (!responseBody || typeof responseBody !== 'object' || !responseBody.id) {
          reject(new Error('Яндекс вернул неожиданный ответ без идентификатора фотографии'));
          return;
        }

        if (typeof onProgress === 'function') onProgress(100);
        resolve(responseBody);
      });

      request.addEventListener('error', () => {
        reject(new Error('Сетевая ошибка при загрузке файла'));
      });

      request.addEventListener('timeout', () => {
        reject(new Error('Истекло время ожидания загрузки файла'));
      });

      request.send(file);
    });
  }

  globalThis.YMPH = globalThis.YMPH || {};
  globalThis.YMPH.uploader = { uploadFile };
})();

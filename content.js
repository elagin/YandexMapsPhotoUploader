/*
 * Yandex Maps Photo Uploader
 * Copyright (C) 2026 Павел Елагин
 *
 * Licensed under the GNU General Public License v3.0.
 * See the LICENSE file for details.
 */
(() => {
  'use strict';

  const ROOT_ID = 'ymph-root';
  const INPUT_ID = 'ymph-file-input';
  const UPLOAD_URL = 'https://core-pht-proxy.maps.yandex.ru/v1/photos/my/upload';
  const ACCEPT = 'image/jpeg,image/png,.heic,.heif';

  let root = null;
  let button = null;
  let status = null;
  let input = null;
  let myPhotosButton = null;
  let isUploading = false;

  function ensureUi() {
    if (!document.body) {
      return;
    }

    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      root = existing;
      button = root.querySelector('.ymph-button');
      status = root.querySelector('.ymph-status');
      input = root.querySelector(`#${INPUT_ID}`);
      myPhotosButton = root.querySelector('.ymph-myphotos');
      return;
    }

    root = document.createElement('div');
    root.id = ROOT_ID;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'ymph-button';
    button.textContent = 'Добавить фото';

    myPhotosButton = document.createElement('button');
    myPhotosButton.type='button';
    myPhotosButton.className='ymph-button ymph-myphotos';
    myPhotosButton.textContent='Мои фотографии';
    myPhotosButton.addEventListener('click',()=>location.assign(`${location.origin}/maps/profile/ugc/photos?l=pht&photos_tab=account`));

    status = document.createElement('div');
    status.className = 'ymph-status';
    status.textContent = 'Готово к загрузке';

    input = document.createElement('input');
    input.id = INPUT_ID;
    input.type = 'file';
    input.accept = ACCEPT;
    input.multiple = true;
    input.hidden = true;

    button.addEventListener('click', onButtonClick);
    input.addEventListener('change', onFilesSelected);

    root.append(button, myPhotosButton, status, input);
    document.body.appendChild(root);
  }

  function onButtonClick() {
    if (isUploading || !input) {
      return;
    }

    input.value = '';
    input.click();
  }

  async function onFilesSelected() {
    const files = Array.from(input?.files || []);
    if (files.length === 0) {
      return;
    }

    setBusy(true);
    let uploaded = 0;
    const errors = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setStatus(`Загрузка ${index + 1} из ${files.length}: ${file.name}`);

      try {
        const result = await uploadFile(file);
        uploaded += 1;
        console.info('[Yandex Maps Photo Uploader] Загружено:', {
          file: file.name,
          photoId: result.id,
          status: result.status
        });
      } catch (error) {
        console.error('[Yandex Maps Photo Uploader] Ошибка загрузки:', file.name, error);
        errors.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    setBusy(false);

    if (errors.length === 0) {
      setStatus(`Загружено: ${uploaded}. Фото отправлены на обработку Яндекса.`);
    } else {
      setStatus(`Загружено: ${uploaded}, ошибок: ${errors.length}`);
      window.alert(`Не удалось загрузить некоторые файлы:\n\n${errors.join('\n')}`);
    }
  }

  async function uploadFile(file) {
    const filename = file.name || `photo-${Date.now()}.jpg`;
    const mtimeSeconds = Math.floor((file.lastModified || Date.now()) / 1000);

    const url = new URL(UPLOAD_URL);
    url.searchParams.set('filename', filename);
    url.searchParams.set('format', 'json');
    url.searchParams.set('mtime', String(mtimeSeconds));

    const response = await fetch(url.toString(), {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': file.type || inferMimeType(filename)
      },
      body: file
    });

    const responseText = await response.text();
    let responseBody = null;

    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }

    if (!response.ok) {
      const details = typeof responseBody === 'string'
        ? responseBody.slice(0, 300)
        : JSON.stringify(responseBody);
      throw new Error(`HTTP ${response.status}${details ? `: ${details}` : ''}`);
    }

    if (!responseBody || typeof responseBody !== 'object' || !responseBody.id) {
      throw new Error('Яндекс вернул неожиданный ответ без идентификатора фотографии');
    }

    return responseBody;
  }

  function inferMimeType(filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.heic')) return 'image/heic';
    if (lower.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
  }

  function setBusy(busy) {
    isUploading = busy;
    ensureUi();
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Загрузка…' : 'Добавить фото';
  }

  function setStatus(text) {
    ensureUi();
    if (status) status.textContent = text;
  }

  ensureUi();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(ROOT_ID)) {
      ensureUi();
      setBusy(isUploading);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener('pageshow', ensureUi);
  window.addEventListener('popstate', ensureUi);

  console.info('[Yandex Maps Photo Helper] content script запущен:', location.href);
})();

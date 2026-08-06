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
  const PANEL_CLASS = 'ymph-panel';
  const INPUT_ID = 'ymph-file-input';
  const UPLOAD_URL = 'https://core-pht-proxy.maps.yandex.ru/v1/photos/my/upload';
  const ACCEPT = 'image/jpeg,image/png,.heic,.heif';
  const COLLAPSED_KEY = 'ymph-collapsed';

  let root = null;
  let panel = null;
  let button = null;
  let status = null;
  let input = null;
  let myPhotosButton = null;
  let collapseButton = null;
  let collapseIcon = null;
  let isUploading = false;

  function ensureUi() {
    if (!document.body) {
      return;
    }

    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      root = existing;
      panel = root.querySelector(`.${PANEL_CLASS}`);
      button = root.querySelector('.ymph-button:not(.ymph-myphotos)');
      status = root.querySelector('.ymph-status');
      input = root.querySelector(`#${INPUT_ID}`);
      myPhotosButton = root.querySelector('.ymph-myphotos');
      collapseButton = root.querySelector('.ymph-collapse');
      collapseIcon = root.querySelector('.ymph-collapse-icon');
      return;
    }

    root = document.createElement('div');
    root.id = ROOT_ID;

    panel = document.createElement('div');
    panel.className = PANEL_CLASS;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'ymph-button';
    button.textContent = 'Добавить фото';

    myPhotosButton = document.createElement('button');
    myPhotosButton.type = 'button';
    myPhotosButton.className = 'ymph-button ymph-myphotos';
    myPhotosButton.textContent = 'Мои фотографии';
    myPhotosButton.addEventListener('click', () => {
      const targetUrl = `${location.origin}/maps/profile/ugc/photos?l=pht&photos_tab=account`;
      location.assign(targetUrl);
    });

    status = document.createElement('div');
    status.className = 'ymph-status';
    status.textContent = 'Готово к загрузке';

    input = document.createElement('input');
    input.id = INPUT_ID;
    input.type = 'file';
    input.accept = ACCEPT;
    input.multiple = true;
    input.hidden = true;

    collapseButton = document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'ymph-collapse';
    collapseButton.setAttribute('aria-label', 'Свернуть панель');
    collapseButton.title = 'Свернуть панель';

    collapseIcon = document.createElement('img');
    collapseIcon.className = 'ymph-collapse-icon';
    collapseIcon.alt = '';
    collapseIcon.src = chrome.runtime.getURL('icons/icon32.png');
    collapseIcon.addEventListener('load', () => {
      collapseButton.classList.remove('ymph-collapse-icon-failed');
    });
    collapseIcon.addEventListener('error', () => {
      collapseButton.classList.add('ymph-collapse-icon-failed');
      collapseIcon.remove();
      collapseIcon = null;
    });

    collapseButton.appendChild(collapseIcon);
    collapseButton.addEventListener('click', onCollapseButtonClick);
    button.addEventListener('click', onButtonClick);
    input.addEventListener('change', onFilesSelected);

    panel.append(button, myPhotosButton, status, input);
    root.append(panel, collapseButton);
    document.body.appendChild(root);

    applyCollapsedState(readCollapsedState());
  }

  function readCollapsedState() {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function saveCollapsedState(collapsed) {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // Сохранение состояния не критично для работы панели.
    }
  }

  function onCollapseButtonClick() {
    ensureUi();
    if (!root) {
      return;
    }

    const nextCollapsed = !root.classList.contains('ymph-collapsed');
    applyCollapsedState(nextCollapsed);
    saveCollapsedState(nextCollapsed);
  }

  function applyCollapsedState(collapsed) {
    if (!root || !collapseButton) {
      return;
    }

    root.classList.toggle('ymph-collapsed', collapsed);
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.setAttribute(
      'aria-label',
      collapsed ? 'Развернуть панель' : 'Свернуть панель'
    );
    collapseButton.title = collapsed ? 'Развернуть панель' : 'Свернуть панель';
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
        await uploadFile(file);
        uploaded += 1;
      } catch (error) {
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
    if (!button) {
      return;
    }

    button.disabled = busy;
    button.textContent = busy ? 'Загрузка…' : 'Добавить фото';
  }

  function setStatus(text) {
    ensureUi();
    if (status) {
      status.textContent = text;
    }
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
})();

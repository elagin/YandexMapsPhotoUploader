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
  const ACCEPT = 'image/jpeg,image/png,.heic,.heif';
  const COLLAPSED_KEY = 'ymph-collapsed';
  const STATUS_LABELS = Object.freeze({
    waiting: 'Ожидание',
    uploading: 'Загрузка',
    completed: 'Загружен',
    failed: 'Ошибка'
  });

  let root = null;
  let panel = null;
  let button = null;
  let status = null;
  let input = null;
  let myPhotosButton = null;
  let collapseButton = null;
  let collapseIcon = null;
  let queueList = null;

  const queue = new YMPH.UploadQueue({
    uploadFile: YMPH.uploader.uploadFile,
    onItemChange: renderQueueItem,
    onQueueChange: updateQueueSummary
  });

  function ensureUi() {
    if (!document.body) return;

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
      queueList = root.querySelector('.ymph-queue');
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
    button.addEventListener('click', onButtonClick);

    myPhotosButton = document.createElement('button');
    myPhotosButton.type = 'button';
    myPhotosButton.className = 'ymph-button ymph-myphotos';
    myPhotosButton.textContent = 'Мои фотографии';
    myPhotosButton.addEventListener('click', () => {
      location.assign(`${location.origin}/maps/profile/ugc/photos?l=pht&photos_tab=account`);
    });

    status = document.createElement('div');
    status.className = 'ymph-status';
    status.textContent = 'Готово к загрузке';

    queueList = document.createElement('div');
    queueList.className = 'ymph-queue';
    queueList.hidden = true;

    input = document.createElement('input');
    input.id = INPUT_ID;
    input.type = 'file';
    input.accept = ACCEPT;
    input.multiple = true;
    input.hidden = true;
    input.addEventListener('change', onFilesSelected);

    collapseButton = document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'ymph-collapse';
    collapseButton.setAttribute('aria-label', 'Свернуть панель');
    collapseButton.title = 'Свернуть панель';
    collapseButton.addEventListener('click', onCollapseButtonClick);

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
    panel.append(button, myPhotosButton, status, queueList, input);
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
      // Состояние панели применяется только для текущей страницы.
    }
  }

  function onCollapseButtonClick() {
    ensureUi();
    if (!root) return;

    const nextCollapsed = !root.classList.contains('ymph-collapsed');
    applyCollapsedState(nextCollapsed);
    saveCollapsedState(nextCollapsed);
  }

  function applyCollapsedState(collapsed) {
    if (!root || !collapseButton) return;

    root.classList.toggle('ymph-collapsed', collapsed);
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.setAttribute('aria-label', collapsed ? 'Развернуть панель' : 'Свернуть панель');
    collapseButton.title = collapsed ? 'Развернуть панель' : 'Свернуть панель';
  }

  function onButtonClick() {
    if (queue.running || !input) return;
    input.value = '';
    input.click();
  }

  async function onFilesSelected() {
    const files = Array.from(input?.files || []);
    if (files.length === 0) return;

    ensureUi();
    queue.addFiles(files);
    renderQueue();
    await queue.start();
  }

  function renderQueue() {
    if (!queueList) return;

    queueList.replaceChildren();
    queueList.hidden = queue.items.length === 0;

    for (const item of queue.items) {
      queueList.appendChild(createQueueItem(item));
    }
  }

  function createQueueItem(item) {
    const element = document.createElement('div');
    element.className = `ymph-queue-item ymph-status-${item.status}`;
    element.dataset.queueId = item.id;

    const header = document.createElement('div');
    header.className = 'ymph-queue-item-header';

    const name = document.createElement('span');
    name.className = 'ymph-queue-file-name';
    name.textContent = item.file.name;
    name.title = item.file.name;

    const state = document.createElement('span');
    state.className = 'ymph-queue-state';
    state.textContent = formatItemState(item);

    const track = document.createElement('div');
    track.className = 'ymph-progress-track';

    const bar = document.createElement('div');
    bar.className = 'ymph-progress-bar';
    bar.style.width = `${item.progress}%`;

    track.appendChild(bar);
    header.append(name, state);
    element.append(header, track);

    if (item.error) {
      const error = document.createElement('div');
      error.className = 'ymph-queue-error';
      error.textContent = item.error;
      element.appendChild(error);
    }

    return element;
  }

  function renderQueueItem(item) {
    ensureUi();
    if (!queueList) return;

    const current = Array.from(queueList.children)
      .find(element => element.dataset.queueId === item.id);
    const replacement = createQueueItem(item);

    if (current) current.replaceWith(replacement);
    else queueList.appendChild(replacement);
  }

  function formatItemState(item) {
    if (item.status === 'uploading') return `${item.progress}%`;
    return STATUS_LABELS[item.status] || item.status;
  }

  function updateQueueSummary(summary, running) {
    ensureUi();
    if (!button || !status) return;

    button.disabled = running;
    button.textContent = running ? 'Загрузка…' : 'Добавить фото';

    if (summary.total === 0) {
      status.textContent = 'Готово к загрузке';
      return;
    }

    if (running) {
      const processed = summary.completed + summary.failed;
      status.textContent = `Обработано ${processed} из ${summary.total}`;
      return;
    }

    status.textContent = summary.failed === 0
      ? `Загружено: ${summary.completed}. Фото отправлены на обработку Яндекса.`
      : `Загружено: ${summary.completed}, с ошибкой: ${summary.failed}`;
  }

  ensureUi();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(ROOT_ID)) {
      ensureUi();
      renderQueue();
      updateQueueSummary(queue.getSummary(), queue.running);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener('pageshow', ensureUi);
  window.addEventListener('popstate', ensureUi);
})();

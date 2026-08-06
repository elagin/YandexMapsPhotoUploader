/*
 * Yandex Maps Photo Uploader
 * Copyright (C) 2026 Павел Елагин
 *
 * Licensed under the GNU General Public License v3.0.
 * See the LICENSE file for details.
 */
(() => {
  'use strict';

  const STATUS = Object.freeze({
    WAITING: 'waiting',
    UPLOADING: 'uploading',
    COMPLETED: 'completed',
    FAILED: 'failed'
  });

  class UploadQueue {
    constructor({ uploadFile, onItemChange, onQueueChange }) {
      this.uploadFile = uploadFile;
      this.onItemChange = onItemChange;
      this.onQueueChange = onQueueChange;
      this.items = [];
      this.running = false;
    }

    addFiles(files) {
      const createdAt = Date.now();
      this.items = files.map((file, index) => ({
        id: `${createdAt}-${index}`,
        file,
        status: STATUS.WAITING,
        progress: 0,
        error: null
      }));
      this.emitQueueChange();
      return this.items;
    }

    async start() {
      if (this.running || this.items.length === 0) return;

      this.running = true;
      this.emitQueueChange();

      for (const item of this.items) {
        item.status = STATUS.UPLOADING;
        item.progress = 0;
        item.error = null;
        this.emitItemChange(item);

        try {
          await this.uploadFile(item.file, progress => {
            item.progress = progress;
            this.emitItemChange(item);
          });
          item.status = STATUS.COMPLETED;
          item.progress = 100;
        } catch (error) {
          item.status = STATUS.FAILED;
          item.error = error instanceof Error ? error.message : String(error);
        }

        this.emitItemChange(item);
        this.emitQueueChange();
      }

      this.running = false;
      this.emitQueueChange();
    }

    getSummary() {
      return this.items.reduce((summary, item) => {
        summary.total += 1;
        summary[item.status] += 1;
        return summary;
      }, {
        total: 0,
        waiting: 0,
        uploading: 0,
        completed: 0,
        failed: 0
      });
    }

    emitItemChange(item) {
      if (typeof this.onItemChange === 'function') this.onItemChange(item);
    }

    emitQueueChange() {
      if (typeof this.onQueueChange === 'function') {
        this.onQueueChange(this.getSummary(), this.running);
      }
    }
  }

  globalThis.YMPH = globalThis.YMPH || {};
  globalThis.YMPH.UploadQueue = UploadQueue;
  globalThis.YMPH.UploadStatus = STATUS;
})();

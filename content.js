(() => {
  "use strict";

  const ROOT_ID = "ymph-root";
  const STATUS_ID = "ymph-status";
  const BUTTON_ID = "ymph-select-files";
  const PICKER_ID = "ymph-own-file-picker";
  const WAIT_TIMEOUT_MS = 10000;

  function setStatus(message, type = "info") {
    const status = document.getElementById(STATUS_ID);
    if (!status) {
      return;
    }

    status.textContent = message;
    status.dataset.type = type;
  }

  function findAddPhotoButton() {
    const buttons = [...document.querySelectorAll('button[type="button"], button:not([type])')];

    return buttons.find((button) => {
      if (!(button instanceof HTMLButtonElement)) {
        return false;
      }

      const text = (button.textContent || "").replace(/\s+/g, " ").trim();
      const hasExpectedText = text === "Добавить фото местности";
      const hasExpectedIcon = Boolean(
        button.querySelector(".ugc-contribution-photos-view__icon")
      );

      return hasExpectedText || (text.includes("Добавить фото местности") && hasExpectedIcon);
    }) || null;
  }

  function findYandexFileInput() {
    const inputs = [...document.querySelectorAll('input[type="file"]')];

    return inputs.find((input) => {
      if (!(input instanceof HTMLInputElement)) {
        return false;
      }

      if (input.id === PICKER_ID || input.closest(`#${ROOT_ID}`)) {
        return false;
      }

      const application = input.closest('[role="application"]');
      if (!application) {
        return false;
      }

      const dropzone = application.querySelector(".add-media-view__dropzone");
      if (!dropzone) {
        return false;
      }

      const accept = (input.accept || "").toLowerCase();
      return (
        accept.includes("image/jpeg") ||
        accept.includes("image/png") ||
        accept.includes(".heic") ||
        accept.includes(".heif") ||
        accept.includes("image/*")
      );
    }) || null;
  }

  function waitForYandexFileInput(timeoutMs = WAIT_TIMEOUT_MS) {
    const existingInput = findYandexFileInput();
    if (existingInput) {
      return Promise.resolve(existingInput);
    }

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const observer = new MutationObserver(() => {
        const input = findYandexFileInput();
        if (input) {
          observer.disconnect();
          clearInterval(timer);
          resolve(input);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      const timer = window.setInterval(() => {
        if (Date.now() - startedAt >= timeoutMs) {
          observer.disconnect();
          clearInterval(timer);
          reject(new Error("Диалог загрузки Яндекса не появился."));
        }
      }, 250);
    });
  }

  function createFileList(files) {
    const transfer = new DataTransfer();
    for (const file of files) {
      transfer.items.add(file);
    }
    return transfer.files;
  }

  function assignFilesToYandexInput(input, files) {
    input.files = createFileList(files);

    input.dispatchEvent(new Event("input", {
      bubbles: true,
      composed: true
    }));

    input.dispatchEvent(new Event("change", {
      bubbles: true,
      composed: true
    }));
  }

  async function sendSelectedFiles(files) {
    if (!files.length) {
      setStatus("Файлы не выбраны.");
      return;
    }

    const addPhotoButton = findAddPhotoButton();
    if (!addPhotoButton) {
      setStatus(
        "На странице не найдена штатная кнопка «Добавить фото местности».",
        "error"
      );
      return;
    }

    try {
      setStatus(`Выбрано файлов: ${files.length}. Открываю диалог Яндекса…`);

      addPhotoButton.click();
      const yandexInput = await waitForYandexFileInput();

      assignFilesToYandexInput(yandexInput, files);
      setStatus(`Передано в Яндекс: ${files.length} файл(ов).`, "success");
    } catch (error) {
      console.error("[Yandex Maps Photo Helper]", error);
      setStatus(error instanceof Error ? error.message : "Не удалось передать файлы.", "error");
    }
  }

  function createPanel() {
    if (document.getElementById(ROOT_ID)) {
      return;
    }

    const root = document.createElement("section");
    root.id = ROOT_ID;
    root.setAttribute("aria-label", "Помощник загрузки фотографий");

    const title = document.createElement("div");
    title.className = "ymp-title";
    title.textContent = "Загрузка фото";

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Добавить фото";

    const picker = document.createElement("input");
    picker.id = PICKER_ID;
    picker.type = "file";
    picker.accept = "image/jpeg,image/png,.heic,.heif";
    picker.multiple = true;
    picker.hidden = true;

    picker.addEventListener("change", () => {
      const files = picker.files ? [...picker.files] : [];
      picker.value = "";
      void sendSelectedFiles(files);
    });

    button.addEventListener("click", () => {
      setStatus("Выберите фотографии для загрузки.");
      picker.click();
    });

    const status = document.createElement("div");
    status.id = STATUS_ID;
    status.className = "ymp-status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "Нажмите кнопку и выберите фотографии.";

    root.append(title, button, picker, status);
    document.documentElement.appendChild(root);
  }

  createPanel();
})();

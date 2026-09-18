(function () {
  "use strict";

  const els = {
    fileInput: document.getElementById("file-input"),
    dropZone: document.getElementById("drop-zone"),
    fileCard: document.getElementById("file-card"),
    fileName: document.getElementById("file-name"),
    fileMeta: document.getElementById("file-meta"),
    removeFile: document.getElementById("remove-file"),
    text: document.getElementById("watermark-text"),
    charCount: document.getElementById("char-count"),
    opacity: document.getElementById("opacity"),
    opacityValue: document.getElementById("opacity-value"),
    fontSize: document.getElementById("font-size"),
    fontSizeValue: document.getElementById("font-size-value"),
    rotation: document.getElementById("rotation"),
    rotationValue: document.getElementById("rotation-value"),
    spacing: document.getElementById("spacing"),
    spacingValue: document.getElementById("spacing-value"),
    spacingField: document.getElementById("spacing-field"),
    modeButtons: Array.from(document.querySelectorAll(".mode-option")),
    modeLabel: document.getElementById("mode-label"),
    preview: document.getElementById("watermark-preview"),
    error: document.getElementById("error-message"),
    process: document.getElementById("process-button"),
    processLabel: document.querySelector(".button-label"),
    processLoading: document.querySelector(".button-loading"),
    success: document.getElementById("success-panel"),
    outputMeta: document.getElementById("output-meta"),
    download: document.getElementById("download-button")
  };

  const state = { file: null, mode: "tile", outputUrl: null, outputName: null };

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
    return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
  }

  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = false;
  }

  function clearError() {
    els.error.hidden = true;
    els.error.textContent = "";
  }

  function revokeOutput() {
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    state.outputUrl = null;
    state.outputName = null;
    els.success.hidden = true;
  }

  async function looksLikePdf(file) {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return false;
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...header) === "%PDF-";
  }

  async function setFile(file) {
    clearError();
    revokeOutput();
    if (!(await looksLikePdf(file))) {
      state.file = null;
      els.fileInput.value = "";
      showError("请选择有效的 PDF 文件。其他格式不会被处理。");
      updateFileUi();
      return;
    }
    state.file = file;
    updateFileUi();
  }

  function updateFileUi() {
    const hasFile = Boolean(state.file);
    els.dropZone.hidden = hasFile;
    els.fileCard.hidden = !hasFile;
    els.process.disabled = !hasFile || !els.text.value.trim();
    if (hasFile) {
      els.fileName.textContent = state.file.name;
      els.fileMeta.textContent = `${formatBytes(state.file.size)} · 本地文件`;
    }
  }

  function clearFile() {
    state.file = null;
    els.fileInput.value = "";
    revokeOutput();
    clearError();
    updateFileUi();
  }

  function setRangeProgress(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    input.style.setProperty("--range-progress", `${((value - min) / (max - min)) * 100}%`);
  }

  function signedDegrees(value) {
    const number = Number(value);
    return `${number < 0 ? "−" : number > 0 ? "+" : ""}${Math.abs(number)}°`;
  }

  function updatePreview() {
    const text = els.text.value.trim() || "水印文字";
    const opacity = Number(els.opacity.value) / 100;
    const angle = Number(els.rotation.value);
    const size = Number(els.fontSize.value);
    els.charCount.textContent = `${els.text.value.length} / 80`;
    els.opacityValue.textContent = `${els.opacity.value}%`;
    els.fontSizeValue.textContent = `${els.fontSize.value} pt`;
    els.rotationValue.textContent = signedDegrees(angle);
    els.spacingValue.textContent = `${els.spacing.value} pt`;
    els.modeLabel.textContent = state.mode === "tile" ? "重复平铺" : "单个居中";
    els.spacingField.style.opacity = state.mode === "tile" ? "1" : ".42";
    els.spacing.disabled = state.mode !== "tile";
    els.preview.className = `watermark-layer ${state.mode}-mode`;
    els.preview.style.setProperty("--angle", `${angle}deg`);
    els.preview.style.setProperty("--preview-size", `${Math.max(9, size * 0.29)}px`);
    els.preview.innerHTML = "";

    if (state.mode === "single") {
      const item = document.createElement("span");
      item.className = "watermark-item";
      item.textContent = text;
      item.style.opacity = String(opacity);
      els.preview.appendChild(item);
    } else {
      const positions = [
        [20, 18], [68, 12], [42, 38], [88, 43], [8, 59],
        [61, 66], [30, 83], [82, 88]
      ];
      positions.forEach(([left, top]) => {
        const item = document.createElement("span");
        item.className = "watermark-item";
        item.textContent = text;
        item.style.left = `${left}%`;
        item.style.top = `${top}%`;
        item.style.opacity = String(opacity);
        els.preview.appendChild(item);
      });
    }
    els.process.disabled = !state.file || !els.text.value.trim();
    [els.opacity, els.fontSize, els.rotation, els.spacing].forEach(setRangeProgress);
  }

  function makeWatermarkPng(text, fontSize, angle) {
    const scale = 2;
    const padding = Math.max(10, fontSize * 0.34);
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    const fontFamily = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';
    measureContext.font = `650 ${fontSize * scale}px ${fontFamily}`;
    const textWidth = Math.ceil(measureContext.measureText(text).width / scale);
    const baseWidth = textWidth + padding * 2;
    const baseHeight = fontSize * 1.35 + padding * 2;
    const radians = Math.abs(angle) * Math.PI / 180;
    const rotatedWidth = Math.ceil(Math.abs(baseWidth * Math.cos(radians)) + Math.abs(baseHeight * Math.sin(radians)));
    const rotatedHeight = Math.ceil(Math.abs(baseWidth * Math.sin(radians)) + Math.abs(baseHeight * Math.cos(radians)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(rotatedWidth * scale));
    canvas.height = Math.max(1, Math.ceil(rotatedHeight * scale));
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.translate(rotatedWidth / 2, rotatedHeight / 2);
    context.rotate(angle * Math.PI / 180);
    context.font = `650 ${fontSize}px ${fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#4669c9";
    context.fillText(text, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), width: rotatedWidth, height: rotatedHeight };
  }

  function dataUrlToUint8Array(dataUrl) {
    const binary = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function addWatermark() {
    clearError();
    revokeOutput();
    if (!state.file) return showError("请先选择一个 PDF 文件。");
    const text = els.text.value.trim();
    if (!text) return showError("请输入水印文字。");
    if (!window.PDFLib) return showError("处理组件未能加载，请检查网络后刷新页面再试。");

    els.process.disabled = true;
    els.processLabel.hidden = true;
    els.processLoading.hidden = false;

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const source = await state.file.arrayBuffer();
      const pdf = await window.PDFLib.PDFDocument.load(source, { updateMetadata: false });
      const pages = pdf.getPages();
      if (!pages.length) throw new Error("EMPTY_PDF");

      const fontSize = Number(els.fontSize.value);
      const opacity = Number(els.opacity.value) / 100;
      const angle = Number(els.rotation.value);
      const spacing = Number(els.spacing.value);
      const watermark = makeWatermarkPng(text, fontSize, angle);
      const image = await pdf.embedPng(dataUrlToUint8Array(watermark.dataUrl));

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        if (state.mode === "single") {
          const maxWidth = width * 0.82;
          const ratio = Math.min(1, maxWidth / watermark.width);
          const drawWidth = watermark.width * ratio;
          const drawHeight = watermark.height * ratio;
          page.drawImage(image, {
            x: (width - drawWidth) / 2,
            y: (height - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight,
            opacity
          });
          return;
        }

        const tileRatio = Math.min(1, (width * 0.48) / watermark.width);
        const tileWidth = watermark.width * tileRatio;
        const tileHeight = watermark.height * tileRatio;
        const stepX = Math.max(tileWidth + spacing * 0.55, 100);
        const stepY = Math.max(tileHeight + spacing * 0.48, 80);
        let row = 0;
        for (let y = -tileHeight; y < height + tileHeight; y += stepY) {
          const offset = row % 2 ? stepX / 2 : 0;
          for (let x = -stepX + offset; x < width + stepX; x += stepX) {
            page.drawImage(image, { x, y, width: tileWidth, height: tileHeight, opacity });
          }
          row += 1;
        }
      });

      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      state.outputUrl = URL.createObjectURL(blob);
      const base = state.file.name.replace(/\.pdf$/i, "");
      state.outputName = `${base}_已加水印.pdf`;
      els.outputMeta.textContent = `${pages.length} 页 · ${formatBytes(blob.size)}`;
      els.success.hidden = false;
      els.success.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      console.error(error);
      const message = String(error && error.message ? error.message : error);
      if (/password|encrypted/i.test(message)) showError("这个 PDF 受密码保护，暂时无法处理。请先解除密码后再试。");
      else if (/Invalid PDF|No PDF header|EMPTY_PDF/i.test(message)) showError("PDF 文件似乎已损坏或内容为空，请换一个文件重试。");
      else showError("处理失败。请确认文件可以正常打开，或换一个较小的 PDF 重试。");
    } finally {
      els.processLabel.hidden = false;
      els.processLoading.hidden = true;
      els.process.disabled = !state.file || !els.text.value.trim();
    }
  }

  function downloadOutput() {
    if (!state.outputUrl) return;
    const anchor = document.createElement("a");
    anchor.href = state.outputUrl;
    anchor.download = state.outputName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  els.fileInput.addEventListener("change", () => setFile(els.fileInput.files[0]));
  els.removeFile.addEventListener("click", clearFile);
  els.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); els.fileInput.click(); }
  });
  ["dragenter", "dragover"].forEach((type) => els.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((type) => els.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("is-dragging");
  }));
  els.dropZone.addEventListener("drop", (event) => setFile(event.dataTransfer.files[0]));
  els.text.addEventListener("input", () => { revokeOutput(); clearError(); updatePreview(); });
  [els.opacity, els.fontSize, els.rotation, els.spacing].forEach((input) => input.addEventListener("input", () => {
    revokeOutput();
    updatePreview();
  }));
  els.modeButtons.forEach((button) => button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    els.modeButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-checked", String(active));
    });
    revokeOutput();
    updatePreview();
  }));
  els.process.addEventListener("click", addWatermark);
  els.download.addEventListener("click", downloadOutput);
  window.addEventListener("beforeunload", revokeOutput);

  updateFileUi();
  updatePreview();
}());

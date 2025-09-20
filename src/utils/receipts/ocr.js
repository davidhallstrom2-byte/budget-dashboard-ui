// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\utils\receipts\ocr.js
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

GlobalWorkerOptions.workerPort = new PdfWorker();

export async function canvasFromImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function pdfFileToCanvases(file, { scale = 2, onProgress, signal } = {}) {
  const ab = await file.arrayBuffer();
  const pdf = await getDocument({ data: ab }).promise;
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    if (signal?.canceled) break;
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width | 0;
    canvas.height = viewport.height | 0;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(canvas);
    onProgress && onProgress(p / pdf.numPages);
  }
  return out;
}

export function preprocessCanvas(srcCanvas, opts = {}) {
  const {
    scale = 1,
    threshold = "otsu",
    manualThreshold = 160,
    grayscale = true,
    denoise = true,
    rotate = 0,
  } = opts;

  const s = Math.max(1, Number(scale) || 1);
  const rad = (Number(rotate) || 0) * (Math.PI / 180);
  const w0 = srcCanvas.width;
  const h0 = srcCanvas.height;
  const w = Math.round(w0 * s);
  const h = Math.round(h0 * s);

  const base = document.createElement("canvas");
  base.width = w;
  base.height = h;
  const bctx = base.getContext("2d");
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(srcCanvas, 0, 0, w, h);

  let canvas = base;
  if (rad !== 0) {
    const rot = document.createElement("canvas");
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    rot.width = Math.round(w * cos + h * sin);
    rot.height = Math.round(w * sin + h * cos);
    const rctx = rot.getContext("2d");
    rctx.translate(rot.width / 2, rot.height / 2);
    rctx.rotate(rad);
    rctx.drawImage(base, -w / 2, -h / 2);
    canvas = rot;
  }

  if (!grayscale && threshold === "none" && !denoise) return canvas;

  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  if (grayscale) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const y = (r * 299 + g * 587 + b * 114) / 1000;
      data[i] = data[i + 1] = data[i + 2] = y;
    }
  }

  if (denoise) {
    const W = canvas.width, H = canvas.height;
    const copy = new Uint8ClampedArray(data);
    const idx = (x, y) => (y * W + x) * 4;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) sum += copy[idx(x + dx, y + dy)];
        }
        const v = sum / 9;
        const i = idx(x, y);
        data[i] = data[i + 1] = data[i + 2] = v;
      }
    }
  }

  if (threshold !== "none") {
    let th = manualThreshold;
    if (threshold === "otsu") th = otsuThreshold(img);
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] >= th ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

function otsuThreshold(imageData) {
  const data = imageData.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
  const total = imageData.width * imageData.height;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, max = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; threshold = t; }
  }
  return threshold;
}

import { encodeProductCanvas } from "@/lib/product-image";

// U²-Net small, published by the upstream rembg project and mirrored at a
// pinned revision. Only the model is downloaded; shop photos stay on-device.
const MODEL_URL = "https://huggingface.co/edgetools/u2netp/resolve/25dee37ab19c5b6ad64ba6578eba63f1ae07720c/u2netp.onnx";
const MODEL_SHA256 = "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8";
const MODEL_BYTES = 4_574_861;
const MODEL_CACHE = "uzuri-product-background-model-v1";
const MODEL_SIZE = 320;
const WASM_PATH = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";
type Runtime = typeof import("onnxruntime-web/wasm");
type Session = Awaited<ReturnType<Runtime["InferenceSession"]["create"]>>;
let sessionPromise: Promise<{ ort: Runtime; session: Session }> | null = null;
let inferenceQueue: Promise<void> = Promise.resolve();

async function validModel(bytes: ArrayBuffer): Promise<boolean> {
  if (bytes.byteLength !== MODEL_BYTES || !globalThis.crypto?.subtle) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("") === MODEL_SHA256;
}

async function modelBytes(): Promise<Uint8Array> {
  let cache: Cache | null = null;
  try {
    if ("caches" in globalThis) cache = await caches.open(MODEL_CACHE);
    const saved = await cache?.match(MODEL_URL);
    if (saved) {
      const bytes = await saved.arrayBuffer();
      if (await validModel(bytes)) return new Uint8Array(bytes);
    }
  } catch {
    // Private browsing and storage restrictions may disable Cache Storage.
  }
  const response = await fetch(MODEL_URL, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("Model download failed");
  const length = Number(response.headers.get("content-length"));
  if (length && length !== MODEL_BYTES) throw new Error("Unexpected model size");
  const bytes = await response.arrayBuffer();
  if (!await validModel(bytes)) throw new Error("Model integrity check failed");
  try {
    await cache?.put(MODEL_URL, new Response(bytes.slice(0), { headers: { "Content-Type": "application/octet-stream" } }));
  } catch {
    // Background removal can still work if the model cannot be cached.
  }
  return new Uint8Array(bytes);
}

async function getSession(): Promise<{ ort: Runtime; session: Session }> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const [ort, model] = await Promise.all([import("onnxruntime-web/wasm"), modelBytes()]);
      ort.env.wasm.wasmPaths = WASM_PATH;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = true;
      ort.env.wasm.initTimeout = 60_000;
      const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
      return { ort, session };
    })().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

function loadPreparedImage(file: File): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image could not be opened")); };
    image.src = url;
  });
}

/** Remove the detected background locally and put the product on white. */
export async function removeProductBackground(file: File, cancelled: () => boolean): Promise<File> {
  const { image, url } = await loadPreparedImage(file);
  try {
    const inputCanvas = document.createElement("canvas");
    inputCanvas.width = MODEL_SIZE;
    inputCanvas.height = MODEL_SIZE;
    const input = inputCanvas.getContext("2d", { willReadFrequently: true });
    if (!input) throw new Error("Canvas is unavailable");
    input.drawImage(image, 0, 0, MODEL_SIZE, MODEL_SIZE);
    const pixels = input.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
    const count = MODEL_SIZE * MODEL_SIZE;
    let maxPixel = 0;
    for (let i = 0; i < count; i += 1) maxPixel = Math.max(maxPixel, pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]);
    const data = new Float32Array(3 * count);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    for (let channel = 0; channel < 3; channel += 1) {
      for (let i = 0; i < count; i += 1) data[channel * count + i] = (pixels[i * 4 + channel] / (maxPixel || 255) - mean[channel]) / std[channel];
    }
    const { ort, session } = await getSession();
    if (cancelled()) throw new Error("Cancelled");
    // Avoid running multiple models concurrently on memory-constrained phones.
    const task = inferenceQueue.then(async () => {
      if (cancelled()) throw new Error("Cancelled");
      return session.run({ [session.inputNames[0]]: new ort.Tensor("float32", data, [1, 3, MODEL_SIZE, MODEL_SIZE]) });
    });
    inferenceQueue = task.then(() => undefined, () => undefined);
    const outputs = await task;
    if (cancelled()) throw new Error("Cancelled");
    const mask = outputs[session.outputNames[0]]?.data;
    if (!(mask instanceof Float32Array) || mask.length !== count) throw new Error("Unexpected model output");
    let min = Infinity; let max = -Infinity;
    for (const value of mask) { min = Math.min(min, value); max = Math.max(max, value); }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 0.00001) throw new Error("No subject detected");

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = MODEL_SIZE; maskCanvas.height = MODEL_SIZE;
    const maskContext = maskCanvas.getContext("2d");
    if (!maskContext) throw new Error("Canvas is unavailable");
    const maskImage = maskContext.createImageData(MODEL_SIZE, MODEL_SIZE);
    let foreground = 0;
    for (let i = 0; i < count; i += 1) {
      const alpha = Math.round(Math.max(0, Math.min(1, (mask[i] - min) / (max - min))) * 255);
      if (alpha >= 128) foreground += 1;
      maskImage.data[i * 4] = 255; maskImage.data[i * 4 + 1] = 255; maskImage.data[i * 4 + 2] = 255; maskImage.data[i * 4 + 3] = alpha;
    }
    if (foreground < count * 0.005) throw new Error("No subject detected");
    maskContext.putImageData(maskImage, 0, 0);
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = image.naturalWidth; outputCanvas.height = image.naturalHeight;
    const output = outputCanvas.getContext("2d");
    if (!output) throw new Error("Canvas is unavailable");
    output.drawImage(image, 0, 0);
    output.globalCompositeOperation = "destination-in";
    output.imageSmoothingEnabled = true; output.imageSmoothingQuality = "high";
    output.drawImage(maskCanvas, 0, 0, outputCanvas.width, outputCanvas.height);
    output.globalCompositeOperation = "destination-over";
    output.fillStyle = "#fff"; output.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    return await encodeProductCanvas(outputCanvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

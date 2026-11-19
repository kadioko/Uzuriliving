// Product photos are processed in the browser; the original never leaves the device.
export const MAX_PRODUCT_IMAGE_INPUT_BYTES = 15 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_OUTPUT_BYTES = 1024 * 1024;
const TARGET_OUTPUT_BYTES = 300 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_SIDE = 12_000;
const OUTPUT_SIZES = [1024, 800, 640];
const JPEG_QUALITIES = [0.82, 0.70, 0.58];

export type ProductImageErrorCode = "type" | "size" | "dimensions" | "decode" | "processing";

export class ProductImageError extends Error {
  constructor(public readonly code: ProductImageErrorCode) {
    super(code);
    this.name = "ProductImageError";
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ProductImageError("decode"));
    image.src = url;
  });
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/jpeg") reject(new ProductImageError("processing"));
      else resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function renderProductSquare(source: CanvasImageSource, width: number, height: number): Promise<File> {
  let smallest: Blob | null = null;
  for (const size of OUTPUT_SIZES) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new ProductImageError("processing");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const scale = Math.min(size / width, size / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    context.drawImage(source, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);

    for (const quality of JPEG_QUALITIES) {
      const blob = await encodeJpeg(canvas, quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= TARGET_OUTPUT_BYTES) return new File([blob], "product.jpg", { type: "image/jpeg" });
    }
  }
  if (!smallest || smallest.size > MAX_PRODUCT_IMAGE_OUTPUT_BYTES) throw new ProductImageError("processing");
  return new File([smallest], "product.jpg", { type: "image/jpeg" });
}

export function encodeProductCanvas(canvas: HTMLCanvasElement): Promise<File> {
  return renderProductSquare(canvas, canvas.width, canvas.height);
}

/** Flatten transparency and letterbox the whole image onto a white square. */
export async function prepareProductImage(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ProductImageError("type");
  if (!file.size || file.size > MAX_PRODUCT_IMAGE_INPUT_BYTES) throw new ProductImageError("size");

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) {
      throw new ProductImageError("dimensions");
    }
    return await renderProductSquare(image, width, height);
  } catch (error) {
    if (error instanceof ProductImageError) throw error;
    throw new ProductImageError("processing");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

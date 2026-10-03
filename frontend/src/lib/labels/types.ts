export type LabelField = "name" | "price" | "barcode" | "sku" | "unit" | "custom";
export type LabelPriceMode = "RETAIL" | "WHOLESALE";
export type LabelTextPosition = "TOP" | "ABOVE_BARCODE" | "BELOW_BARCODE";
export type LabelTextSize = "SMALL" | "MEDIUM" | "LARGE";
export type BarcodeType = "EAN13" | "UPC" | "CODE128" | "INTERNAL";
export type PrinterProtocol = "BROWSER" | "ZPL" | "TSPL" | "EPL" | "ESCPOS";
export type PrinterConnection = "BROWSER" | "DOWNLOAD" | "BRIDGE" | "ANDROID" | "USB" | "NETWORK" | "BLUETOOTH";

export interface LabelTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  fields: LabelField[];
  priceMode: LabelPriceMode;
  customText: string;
  customTextPosition?: LabelTextPosition;
  customTextSize?: LabelTextSize;
}

export interface LabelProduct {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit?: string | null;
  barcodeType?: BarcodeType | string | null;
  sellingPrice: number;
  wholesalePrice?: number | null;
}

export interface PrinterProfile {
  id: string;
  name: string;
  protocol: PrinterProtocol;
  connection: PrinterConnection;
  model?: string | null;
  config?: Record<string, unknown>;
  isDefault?: boolean;
}

export const DEFAULT_LABEL_TEMPLATE: LabelTemplate = {
  id: "product-40x30",
  name: "Product 40 × 30 mm",
  widthMm: 40,
  heightMm: 30,
  fields: ["name", "price", "barcode"],
  priceMode: "RETAIL",
  customText: "",
  customTextPosition: "ABOVE_BARCODE",
  customTextSize: "SMALL",
};

export const LABEL_FIELD_OPTIONS: Array<{ value: LabelField; label: string; sw: string }> = [
  { value: "name", label: "Product name", sw: "Jina la bidhaa" },
  { value: "price", label: "Price", sw: "Bei" },
  { value: "barcode", label: "Barcode", sw: "Barcode" },
  { value: "sku", label: "SKU", sw: "SKU" },
  { value: "unit", label: "Unit", sw: "Kipimo" },
  { value: "custom", label: "Custom text", sw: "Maandishi maalum" },
];

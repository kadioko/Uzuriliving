"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Package, Plus, X } from "lucide-react";
import type { Lang } from "@/lib/i18n";

type Props = {
  src?: string | null;
  name: string;
  lang: Lang;
  heightClass: string;
};

export default function CatalogProductImage({ src, name, lang, heightClass }: Props) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => { setFailed(false); }, [src]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);

  function close() {
    if (dialogRef.current?.open) dialogRef.current.close();
    else setOpen(false);
  }

  const viewLabel = lang === "sw" ? `Fungua picha kamili ya ${name}` : `View full image of ${name}`;
  const closeLabel = lang === "sw" ? "Funga picha" : "Close image";
  return (
    <>
      <div className={`mb-3 flex ${heightClass} items-center justify-center overflow-hidden rounded-lg bg-white`}>
        {src && !failed ? (
          <button type="button" onClick={() => { setZoom(1); setOpen(true); }} aria-label={viewLabel} aria-haspopup="dialog" className="group relative h-full w-full rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain" />
            <span aria-hidden="true" className="absolute bottom-2 right-2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow-sm ring-1 ring-gray-200 group-hover:text-brand-700"><Maximize2 className="h-4 w-4" /></span>
          </button>
        ) : <Package className="h-10 w-10 text-gray-300" aria-hidden="true" />}
      </div>
      {open && src && !failed && (
        <dialog
          ref={dialogRef}
          aria-label={lang === "sw" ? `Picha ya ${name}` : `Image of ${name}`}
          onClose={() => { setOpen(false); setZoom(1); }}
          onClick={(event) => { if (event.target === event.currentTarget) close(); }}
          className="m-auto w-[min(94vw,48rem)] max-w-none rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-black/70"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={name}>{name}</h2>
            <button type="button" aria-label={closeLabel} onClick={close} autoFocus className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-600"><X className="h-5 w-5" /></button>
          </div>
          <div className="h-[min(65vh,36rem)] overflow-auto bg-white">
            <div className="flex items-center justify-center" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
              <img src={src} alt={name} className="h-full w-full object-contain" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 border-t border-gray-100 px-4 py-3">
            <button type="button" aria-label={lang === "sw" ? "Punguza picha" : "Zoom out"} disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.5))} className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
            <span aria-live="polite" className="w-12 text-center text-xs font-semibold text-gray-600">{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label={lang === "sw" ? "Kuza picha" : "Zoom in"} disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.5))} className="rounded-lg border border-gray-200 p-2 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </div>
        </dialog>
      )}
    </>
  );
}

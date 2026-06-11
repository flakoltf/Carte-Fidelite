"use client";

import { useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Download, Check } from "lucide-react";

// Affiche le QR + le lien d'enrôlement public d'un marchand, avec copie et export PNG.
export default function EnrollmentQR({ url, fileName = "qr-enrolement" }: { url: string; fileName?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const downloadPng = () => {
    const svg = wrapRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${fileName}.png`;
      a.click();
      // Signal pour la checklist de démarrage (QR téléchargé = prêt à afficher).
      try {
        window.localStorage.setItem("halo_poster_done", "1");
      } catch {
        /* stockage local indisponible */
      }
    };
    img.src = svg64;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponible */
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={wrapRef} className="bg-white p-3 rounded-xl border border-line-warm">
        <QRCode value={url} size={140} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-surface border border-line-warm hover:bg-calcaire text-galet-ink transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-halo" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copié" : "Copier le lien"}
        </button>
        <button
          onClick={downloadPng}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-surface border border-line-warm hover:bg-calcaire text-galet-ink transition-colors"
        >
          <Download className="w-4 h-4" />
          QR PNG
        </button>
      </div>
      <div className="text-[11px] text-galet break-all text-center max-w-[220px]">{url}</div>
    </div>
  );
}

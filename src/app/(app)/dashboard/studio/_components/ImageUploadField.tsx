'use client';

// Uploader générique du studio : glisser-déposer → recadrage au ratio cible →
// redimensionnement serveur aux formats exacts Apple / Google. Les dimensions
// cibles sont affichées clairement pour chaque type d'image.

import { useCallback, useRef, useState, type DragEvent } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, X, Check, Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import type { LogoAssets } from '@/lib/cardDesign/types';

export type UploadKind = 'logo' | 'strip' | 'stamp_filled' | 'stamp_empty';

export type UploadResult = {
  assets?: LogoAssets;
  path?: string;
};

const KIND_META: Record<UploadKind, { aspect: number; note: string; cropHint: string }> = {
  logo: {
    aspect: 1,
    note: 'Formats générés : Apple logo 160×50 → 480×150, icône 29×29 → 87×87, Google 660×660.',
    cropHint: 'Recadrage carré — votre logo sera centré sur fond transparent.',
  },
  strip: {
    aspect: 375 / 123,
    note: 'Formats générés : strip Apple 375×123 → 1125×369, hero Google 1032×336.',
    cropHint: 'Recadrage bannière (≈ 3:1) — la zone visible remplit toute la largeur de la carte.',
  },
  stamp_filled: {
    aspect: 1,
    note: 'Format généré : 240×240, fond transparent — état « tamponné ».',
    cropHint: 'Recadrage carré — visuel affiché dans chaque alvéole tamponnée.',
  },
  stamp_empty: {
    aspect: 1,
    note: 'Format généré : 240×240, fond transparent — état « non tamponné ».',
    cropHint: 'Recadrage carré — visuel affiché dans les alvéoles restantes.',
  },
};

function defaultCropForImage(img: HTMLImageElement, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, img.naturalWidth, img.naturalHeight),
    img.naturalWidth,
    img.naturalHeight
  );
}

async function extractBlob(img: HTMLImageElement, crop: PixelCrop): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  ctx.drawImage(
    img,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}

type UploadState = 'idle' | 'cropping' | 'uploading' | 'done' | 'error';

export default function ImageUploadField({
  kind,
  currentUrl,
  onUploaded,
}: {
  kind: UploadKind;
  /** URL signée de l'asset déjà en place (affiche l'état « en place »). */
  currentUrl?: string;
  onUploaded: (result: UploadResult, previewUrl: string) => void;
}) {
  const meta = KIND_META[kind];
  const [state, setState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [dragOver, setDragOver] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format non supporté (PNG, JPG ou WebP).');
      setState('error');
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImgSrc(typeof reader.result === 'string' ? reader.result : '');
      setState('cropping');
    });
    reader.readAsDataURL(file);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const initial = defaultCropForImage(img, meta.aspect);
    setCrop(initial);
    setCompletedCrop(convertToPixelCrop(initial, img.width, img.height));
  };

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }, []);

  const handleUpload = async () => {
    if (!imgRef.current || !completedCrop) return;
    const blob = await extractBlob(imgRef.current, completedCrop);
    if (!blob) {
      setErrorMsg('Erreur lors du recadrage.');
      setState('error');
      return;
    }
    setState('uploading');
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', blob, `${kind}.png`);
      formData.append('kind', kind);
      const res = await fetch('/api/merchant/card-design/assets', { method: 'POST', body: formData });
      const json = (await res.json().catch(() => ({}))) as UploadResult & { error?: string };
      if (!res.ok) {
        setErrorMsg(json.error ?? "Erreur lors de l'envoi.");
        setState('error');
        return;
      }
      onUploaded(json, URL.createObjectURL(blob));
      setState('done');
    } catch {
      setErrorMsg('Erreur de connexion.');
      setState('error');
    }
  };

  const reset = () => {
    setState('idle');
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (state === 'cropping') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-galet-ink">{meta.cropHint}</p>
        <div className="rounded-xl overflow-hidden border border-line-warm bg-[#16171A] flex items-center justify-center">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={meta.aspect}
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={imgSrc} alt="Image à recadrer" onLoad={onImageLoad} style={{ maxHeight: 260, display: 'block' }} />
          </ReactCrop>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!completedCrop?.width}
            className="flex items-center gap-2 bg-halo text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-halo-600 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" aria-hidden />
            Valider &amp; envoyer
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 bg-surface border border-line-warm text-galet-ink text-sm px-3 py-2 rounded-xl hover:bg-calcaire transition-colors"
          >
            <X className="w-4 h-4" aria-hidden />
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div className="flex items-center gap-3 border border-line-warm rounded-2xl px-4 py-3 text-sm text-galet-ink">
        <Loader2 className="w-4 h-4 animate-spin text-halo" aria-hidden />
        Envoi et redimensionnement en cours…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(state === 'done' || currentUrl) && (
        <div className="flex items-center gap-3 border border-halo/30 bg-halo/5 rounded-2xl px-4 py-2.5 text-sm text-halo">
          {currentUrl && state !== 'done' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" className="h-8 max-w-[96px] object-contain rounded bg-white/70 border border-black/5" />
          ) : (
            <Check className="w-4 h-4 shrink-0" aria-hidden />
          )}
          <span>{state === 'done' ? 'Image envoyée — visible dans l’aperçu.' : 'Image en place.'}</span>
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-2xl px-5 py-5 cursor-pointer transition-all text-center ${
          dragOver ? 'border-halo bg-halo/5' : 'border-halo/30 hover:border-halo hover:bg-halo/5'
        }`}
      >
        {state === 'done' || currentUrl ? (
          <RefreshCcw className="w-5 h-5 text-halo/60" aria-hidden />
        ) : (
          <Upload className="w-6 h-6 text-halo/60" aria-hidden />
        )}
        <p className="text-sm font-medium text-galet-ink">
          {state === 'done' || currentUrl ? 'Remplacer — glisser une image ou ' : 'Glisser une image ou '}
          <span className="text-halo underline underline-offset-2">parcourir</span>
        </p>
        <p className="text-[11px] text-galet-ink max-w-xs">{meta.note}</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
        }}
      />
      {state === 'error' && errorMsg && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-600 rounded-xl px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
          {errorMsg}
        </div>
      )}
    </div>
  );
}

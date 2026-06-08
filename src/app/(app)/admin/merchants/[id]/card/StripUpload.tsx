'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, X, Check, Loader2, AlertCircle } from 'lucide-react';
import type { LogoAssets } from '@/lib/cardDesign/types';

// Ratio de la bannière : aligné sur le strip Apple (375 × 123 ≈ 3.05:1).
const STRIP_ASPECT = 375 / 123;

function defaultCropForImage(img: HTMLImageElement): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, STRIP_ASPECT, img.naturalWidth, img.naturalHeight),
    img.naturalWidth,
    img.naturalHeight,
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
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0, canvas.width, canvas.height,
  );
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}

interface StripUploadProps {
  merchantId: string;
  onUploaded: (assets: LogoAssets, previewUrl: string) => void;
}

type UploadState = 'idle' | 'cropping' | 'uploading' | 'done' | 'error';

export default function StripUpload({ merchantId, onUploaded }: StripUploadProps) {
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
      setErrorMsg('Format non supporté (PNG, JPG, WebP requis).');
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

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const initial = defaultCropForImage(img);
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
      formData.append('file', blob, 'strip.png');
      formData.append('kind', 'strip');
      const res = await fetch(`/api/admin/merchants/${merchantId}/card-design/logo`, {
        method: 'POST',
        body: formData,
      });
      const json = (await res.json().catch(() => ({}))) as { assets?: LogoAssets; error?: string };
      if (!res.ok) {
        setErrorMsg(json.error ?? "Erreur lors de l'envoi.");
        setState('error');
        return;
      }
      if (json.assets) onUploaded(json.assets, URL.createObjectURL(blob));
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

  if (state === 'idle' || state === 'error') {
    return (
      <div className="space-y-2">
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl px-6 py-6 cursor-pointer transition-all text-center ${
            dragOver ? 'border-halo bg-halo/5' : 'border-halo/30 hover:border-halo hover:bg-halo/5'
          }`}
        >
          <Upload className="w-7 h-7 text-halo/60" />
          <p className="text-sm font-medium text-galet-ink">
            Glisser une bannière ou{' '}
            <span className="text-halo underline underline-offset-2">parcourir</span>
          </p>
          <p className="text-xs text-galet">Image horizontale · recadrée au format bannière (≈ 3:1)</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={onFileChange}
        />
        {state === 'error' && errorMsg && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-600 rounded-xl px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  if (state === 'cropping') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-galet-ink">Recadrer la bannière</p>
        <div className="rounded-xl overflow-hidden border border-line-warm bg-[#16171A] flex items-center justify-center">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={STRIP_ASPECT}
            keepSelection
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Bannière à recadrer"
              onLoad={onImageLoad}
              style={{ maxHeight: '240px', display: 'block' }}
            />
          </ReactCrop>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!completedCrop?.width}
            className="flex items-center gap-2 bg-halo text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-halo-600 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            Valider &amp; envoyer
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 bg-surface border border-line-warm text-galet-ink text-sm px-3 py-2 rounded-xl hover:bg-calcaire transition-colors"
          >
            <X className="w-4 h-4" />
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div className="flex items-center gap-3 border border-line-warm rounded-2xl px-4 py-3 text-sm text-galet-ink">
        <Loader2 className="w-4 h-4 animate-spin text-halo" />
        Envoi en cours…
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border border-halo/30 bg-halo/5 rounded-2xl px-4 py-3 text-sm text-halo">
      <Check className="w-4 h-4 shrink-0" />
      Bannière uploadée avec succès.
      <button
        type="button"
        onClick={reset}
        className="ml-auto text-xs text-galet-ink hover:text-halo underline underline-offset-2"
      >
        Remplacer
      </button>
    </div>
  );
}

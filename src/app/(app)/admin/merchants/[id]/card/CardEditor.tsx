'use client';

import { useMemo, useState } from 'react';
import { Loader2, Save, CheckCircle2, AlertCircle, AlertTriangle, Smartphone } from 'lucide-react';
import type { CardDesign, LogoAssets } from '@/lib/cardDesign/types';
import { validateDesign } from '@/lib/cardDesign/validation';
import FieldList from './FieldList';
import ColorField from './ColorField';
import BarcodeField from './BarcodeField';
import LogoUpload from './LogoUpload';
import StripUpload from './StripUpload';
import ApplePassPreview from './ApplePassPreview';
import GooglePassPreview from './GooglePassPreview';

interface CardEditorProps {
  merchantId: string;
  initialDesign: CardDesign;
  // URLs signées d'assets déjà enregistrés (sinon les chemins Storage ne s'affichent pas en <img>).
  initialLogoPreview?: string;
  initialStripPreview?: string;
}

// Fusionne deux jeux d'assets sans écraser les sous-clés (logo vs strip).
function mergeAssets(prev: LogoAssets | undefined, incoming: LogoAssets): LogoAssets {
  return {
    apple: { ...prev?.apple, ...incoming.apple },
    google: { ...prev?.google, ...incoming.google },
  };
}

type SaveResult = {
  kind: 'ok' | 'partial' | 'error';
  messages: string[];
};

const sectionCls = 'bg-surface border border-line-warm rounded-3xl p-6 shadow-sm';

export default function CardEditor({ merchantId, initialDesign, initialLogoPreview, initialStripPreview }: CardEditorProps) {
  const [design, setDesign] = useState<CardDesign>(initialDesign);
  const [logoPreview, setLogoPreview] = useState<string | undefined>(initialLogoPreview);
  const [stripPreview, setStripPreview] = useState<string | undefined>(initialStripPreview);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  // Validation live (mêmes règles que le serveur).
  const validation = useMemo(() => validateDesign(design), [design]);
  const canSave = validation.errors.length === 0 && !saving;

  // Les aperçus lisent logo.assets comme src <img>. On y injecte les URLs affichables
  // (locales après upload, signées au chargement) sans toucher au design persisté.
  const previewDesign = useMemo<CardDesign>(() => {
    const assets: LogoAssets = {
      apple: {
        ...(logoPreview ? { x1: logoPreview } : {}),
        ...(stripPreview ? { strip1: stripPreview } : {}),
      },
      google: {
        ...(logoPreview ? { logo: logoPreview } : {}),
        ...(stripPreview ? { hero: stripPreview } : {}),
      },
    };
    return { ...design, logo: { ...design.logo, assets } };
  }, [design, logoPreview, stripPreview]);

  const handleLogoUploaded = (assets: LogoAssets, previewUrl: string) => {
    setDesign((d) => ({ ...d, logo: { ...d.logo, assets: mergeAssets(d.logo?.assets, assets) } }));
    setLogoPreview(previewUrl);
    setResult(null);
  };

  const handleStripUploaded = (assets: LogoAssets, previewUrl: string) => {
    setDesign((d) => ({ ...d, logo: { ...d.logo, assets: mergeAssets(d.logo?.assets, assets) } }));
    setStripPreview(previewUrl);
    setResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/merchants/${merchantId}/card-design`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        errors?: string[];
        warnings?: string[];
        error?: string;
      };

      if (res.status === 422 && Array.isArray(json.errors)) {
        setResult({ kind: 'error', messages: json.errors });
      } else if (res.status === 207) {
        setResult({
          kind: 'partial',
          messages: [
            'Carte enregistrée. La synchronisation Google Wallet a échoué — réessayez plus tard.',
            ...(json.warnings ?? []),
          ],
        });
      } else if (res.ok) {
        setResult({
          kind: 'ok',
          messages: ['Carte enregistrée et synchronisée avec Google Wallet.', ...(json.warnings ?? [])],
        });
      } else {
        setResult({ kind: 'error', messages: [json.error ?? "Erreur lors de l'enregistrement."] });
      }
    } catch {
      setResult({ kind: 'error', messages: ['Erreur de connexion.'] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(320px,380px)] items-start">
      {/* ── Colonne édition ─────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Identité */}
        <section className={sectionCls}>
          <h2 className="font-bold text-onyx mb-1">Identité</h2>
          <p className="text-xs text-galet-ink mb-5">
            Le nom du programme apparaît en tête de carte sur Apple et Google Wallet.
          </p>

          <label className="block text-xs font-medium text-galet-ink mb-1.5">Nom du programme</label>
          <input
            value={design.programName}
            onChange={(e) => setDesign((d) => ({ ...d, programName: e.target.value }))}
            placeholder="Carte de fidélité"
            maxLength={60}
            className="w-full bg-calcaire border border-line-warm rounded-2xl py-3 px-4 text-onyx focus:border-halo outline-none transition-colors placeholder:text-galet"
          />

          <div className="mt-6">
            <p className="text-xs font-medium text-galet-ink mb-2">Logo</p>
            <LogoUpload merchantId={merchantId} onUploaded={handleLogoUploaded} />
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium text-galet-ink mb-2">Bannière (strip / hero)</p>
            <StripUpload merchantId={merchantId} onUploaded={handleStripUploaded} />
          </div>
        </section>

        {/* Couleurs */}
        <section className={sectionCls}>
          <h2 className="font-bold text-onyx mb-1">Couleurs</h2>
          <p className="text-xs text-galet-ink mb-5">
            Fond, texte et libellés. Un contraste &lt; 4.5:1 déclenche un avertissement (WCAG AA).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField
              label="Fond"
              value={design.colors.background}
              onChange={(v) => setDesign((d) => ({ ...d, colors: { ...d.colors, background: v } }))}
            />
            <ColorField
              label="Texte"
              value={design.colors.foreground}
              onChange={(v) => setDesign((d) => ({ ...d, colors: { ...d.colors, foreground: v } }))}
            />
            <ColorField
              label="Libellés"
              value={design.colors.label}
              onChange={(v) => setDesign((d) => ({ ...d, colors: { ...d.colors, label: v } }))}
            />
          </div>
        </section>

        {/* Champs */}
        <section className={sectionCls}>
          <h2 className="font-bold text-onyx mb-1">Champs</h2>
          <p className="text-xs text-galet-ink mb-5">
            Glisser pour réordonner. Jetons disponibles : <code className="text-onyx">{'{points}'}</code>,{' '}
            <code className="text-onyx">{'{nom}'}</code>, <code className="text-onyx">{'{palier}'}</code>,{' '}
            <code className="text-onyx">{'{visites}'}</code>, <code className="text-onyx">{'{derniere_visite}'}</code>,{' '}
            <code className="text-onyx">{'{progression}'}</code>, <code className="text-onyx">{'{statut}'}</code>.
          </p>
          <FieldList
            fields={design.fields}
            onChange={(fields) => setDesign((d) => ({ ...d, fields }))}
          />
        </section>

        {/* Code-barres */}
        <section className={sectionCls}>
          <h2 className="font-bold text-onyx mb-1">Code-barres</h2>
          <p className="text-xs text-galet-ink mb-5">QR scanné en caisse pour identifier la carte.</p>
          <BarcodeField
            value={design.barcode}
            onChange={(barcode) => setDesign((d) => ({ ...d, barcode }))}
          />
        </section>
      </div>

      {/* ── Colonne aperçu (sticky) ─────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 space-y-5">
        <div className={sectionCls}>
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-4 h-4 text-halo" />
            <h2 className="font-bold text-onyx">Aperçu</h2>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-galet mb-2">Apple Wallet</p>
              <ApplePassPreview design={previewDesign} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-galet mb-2">Google Wallet</p>
              <GooglePassPreview design={previewDesign} />
            </div>
          </div>
        </div>

        {/* Validation live */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="space-y-2">
            {validation.errors.map((msg, i) => (
              <div
                key={`e${i}`}
                className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-700 rounded-xl px-3 py-2 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{msg}</span>
              </div>
            ))}
            {validation.warnings.map((msg, i) => (
              <div
                key={`w${i}`}
                className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-xl px-3 py-2 text-sm"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* Résultat de sauvegarde */}
        {result && (
          <div
            className={`space-y-1.5 rounded-xl px-3 py-2.5 text-sm border ${
              result.kind === 'ok'
                ? 'bg-halo/5 border-halo/30 text-halo'
                : result.kind === 'partial'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                  : 'bg-red-500/10 border-red-500/30 text-red-700'
            }`}
          >
            {result.messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-2">
                {i === 0 &&
                  (result.kind === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : result.kind === 'partial' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  ))}
                <span className={i === 0 ? '' : 'ml-6'}>{msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bouton enregistrer */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center justify-center gap-2 w-full bg-halo text-white font-medium px-4 py-3 rounded-2xl hover:bg-halo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Enregistrement…' : 'Enregistrer la carte'}
        </button>
        {validation.errors.length > 0 && (
          <p className="text-xs text-galet text-center">Corrigez les erreurs ci-dessus pour enregistrer.</p>
        )}
      </div>
    </div>
  );
}

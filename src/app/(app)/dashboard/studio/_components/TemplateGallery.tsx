'use client';

// Galerie de templates de départ — jamais de page blanche. Les templates du
// métier du marchand remontent en premier ; appliquer un template préserve
// les images déjà uploadées et le nom de programme personnalisé.

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { templatesFor, applyTemplate, type CardTemplate } from '@/lib/cardDesign/templates';
import type { CardDesign } from '@/lib/cardDesign/types';

function TemplateThumb({ tpl }: { tpl: CardTemplate }) {
  const { colors } = tpl.design;
  const primary = tpl.design.fields.find((f) => f.zone === 'primary');
  return (
    <div
      className="rounded-xl p-3 h-[88px] flex flex-col justify-between"
      style={{ background: colors.background, color: colors.foreground }}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold truncate">{tpl.design.programName}</span>
        {tpl.design.stamps && <span className="text-[12px]">{tpl.design.stamps.icon}</span>}
      </div>
      <div>
        <div className="text-[7px] uppercase tracking-wider" style={{ color: colors.label }}>
          {primary?.label ?? 'Points'}
        </div>
        <div className="text-[16px] font-light leading-none">7{tpl.design.stamps ? ` / ${tpl.design.stamps.goal}` : ''}</div>
      </div>
    </div>
  );
}

export default function TemplateGallery({
  businessType,
  design,
  onApply,
}: {
  businessType: string | null;
  design: CardDesign;
  onApply: (design: CardDesign) => void;
}) {
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  const templates = templatesFor(businessType);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {templates.map((tpl, i) => (
          <button
            key={tpl.key}
            type="button"
            onClick={() => {
              onApply(applyTemplate(design, tpl));
              setAppliedKey(tpl.key);
            }}
            className={`text-left rounded-2xl border p-2 transition-all hover:shadow-md ${
              appliedKey === tpl.key ? 'border-halo ring-1 ring-halo/40' : 'border-line-warm hover:border-halo/50'
            }`}
          >
            <TemplateThumb tpl={tpl} />
            <div className="mt-2 px-1">
              <p className="flex items-center gap-1 text-xs font-semibold text-onyx">
                {appliedKey === tpl.key ? (
                  <Check className="w-3.5 h-3.5 text-halo" aria-hidden />
                ) : i === 0 && businessType ? (
                  <Sparkles className="w-3.5 h-3.5 text-halo" aria-hidden />
                ) : null}
                {tpl.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-galet-ink">{tpl.description}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-galet-ink">
        Appliquer un modèle remplace couleurs, champs et tampons — vos images et votre nom de
        programme sont conservés. Rien n&apos;est publié tant que vous ne le décidez pas.
      </p>
    </div>
  );
}

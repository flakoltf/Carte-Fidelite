import type { StampsConfig } from '@/lib/cardDesign/types';

// Grille de tampons du studio — rend l'état tamponné / non-tamponné avec les
// visuels du marchand (emoji de la bibliothèque ou images uploadées).

const SHAPE_RADIUS: Record<StampsConfig['shape'], string> = {
  circle: '9999px',
  rounded: '22%',
  square: '4px',
};

export default function StampGrid({
  stamps,
  count,
  cellSize = 34,
  onBackground,
  filledUrl,
  emptyUrl,
}: {
  stamps: StampsConfig;
  /** Nombre de tampons « obtenus » à afficher (échantillon). */
  count: number;
  cellSize?: number;
  /** Couleur de fond derrière la grille (pilote le style des alvéoles vides). */
  onBackground: string;
  filledUrl?: string;
  emptyUrl?: string;
}) {
  const goal = Math.max(1, Math.min(30, Math.round(stamps.goal)));
  const filled = Math.max(0, Math.min(goal, count));
  const radius = SHAPE_RADIUS[stamps.shape] ?? SHAPE_RADIUS.circle;
  const cols = goal <= 6 ? goal : goal <= 12 ? Math.ceil(goal / 2) : Math.ceil(goal / 3);

  return (
    <div
      role="img"
      aria-label={`${filled} tampons sur ${goal}`}
      className="grid justify-center gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
    >
      {Array.from({ length: goal }, (_, i) => {
        const isFilled = i < filled;
        return (
          <span
            key={i}
            className="flex items-center justify-center select-none"
            style={{
              width: cellSize,
              height: cellSize,
              borderRadius: radius,
              fontSize: cellSize * 0.55,
              lineHeight: 1,
              background: isFilled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.14)',
              border: isFilled ? '1px solid rgba(0,0,0,0.08)' : '1.5px dashed rgba(255,255,255,0.45)',
              boxShadow: isFilled ? '0 1px 3px rgba(0,0,0,0.18)' : 'none',
            }}
          >
            {isFilled ? (
              filledUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={filledUrl} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
              ) : (
                stamps.icon
              )
            ) : emptyUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emptyUrl} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain', opacity: 0.55 }} />
            ) : (
              <span style={{ color: onBackground, opacity: 0.001 }}>·</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

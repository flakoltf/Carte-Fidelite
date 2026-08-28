'use client';

// Section Champs : libellés personnalisés, choix de zone (limites Apple
// affichées), réordonnancement par glisser-déposer, jetons dynamiques.

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import type { CardField, CardZone } from '@/lib/cardDesign/types';
import { APPLE_ZONE_LIMITS } from '@/lib/cardDesign/types';

const ZONES: CardZone[] = ['header', 'primary', 'secondary', 'auxiliary', 'back'];

const ZONE_LABELS: Record<CardZone, string> = {
  header: 'En-tête',
  primary: 'Principal',
  secondary: 'Secondaire',
  auxiliary: 'Auxiliaire',
  back: 'Verso',
};

const ZONE_STYLE: Record<CardZone, string> = {
  header: 'bg-halo text-white',
  primary: 'bg-halo-600 text-white',
  secondary: 'bg-[#46484C] text-white',
  auxiliary: 'bg-galet text-white',
  back: 'bg-calcaire text-onyx border border-line-warm',
};

const TOKENS: { token: string; hint: string }[] = [
  { token: '{points}', hint: 'tampons / points du client' },
  { token: '{nom}', hint: 'nom du client' },
  { token: '{palier}', hint: 'palier de fidélité' },
  { token: '{visites}', hint: 'Nombre total de passages' },
  { token: '{derniere_visite}', hint: 'Date du dernier passage (jj.mm.aaaa)' },
  { token: '{progression}', hint: 'Progression vers le prochain palier (ex. 3/8 points)' },
  { token: '{statut}', hint: 'Statut du client (ex. Or) — cartes à points avec statuts configurés' },
];

function SortableRow({
  field,
  onUpdate,
  onDelete,
}: {
  field: CardField;
  onUpdate: (updated: CardField) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  const inputCls =
    'flex-1 min-w-0 bg-calcaire border border-line-warm rounded-lg px-2 py-1.5 text-sm text-onyx focus:border-halo outline-none transition-colors placeholder:text-galet-ink';

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-surface border border-line-warm rounded-xl px-2 py-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 text-galet-ink hover:text-galet-ink cursor-grab active:cursor-grabbing p-1 touch-none"
        aria-label="Réordonner"
      >
        <GripVertical className="w-4 h-4" aria-hidden />
      </button>
      <select
        value={field.zone}
        onChange={(e) => onUpdate({ ...field, zone: e.target.value as CardZone })}
        className={`shrink-0 text-[10px] font-semibold rounded px-1.5 py-1 border-none outline-none cursor-pointer uppercase tracking-wide ${ZONE_STYLE[field.zone]}`}
        aria-label="Zone du champ"
      >
        {ZONES.map((z) => (
          <option key={z} value={z} className="bg-surface text-onyx normal-case">
            {ZONE_LABELS[z]}
          </option>
        ))}
      </select>
      <input
        value={field.label}
        onChange={(e) => onUpdate({ ...field, label: e.target.value })}
        placeholder="Libellé"
        className={inputCls}
        aria-label="Libellé du champ"
      />
      <input
        value={field.value}
        onChange={(e) => onUpdate({ ...field, value: e.target.value })}
        placeholder="{points}"
        className={inputCls}
        aria-label="Valeur du champ"
      />
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 p-1.5 text-galet-ink hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        aria-label="Supprimer le champ"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}

function reindex(fields: CardField[]): CardField[] {
  return fields.map((f, i) => ({ ...f, order: i }));
}

export default function FieldsSection({
  fields,
  onChange,
}: {
  fields: CardField[];
  onChange: (fields: CardField[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    onChange(reindex(arrayMove(fields, oldIndex, newIndex)));
  };

  // Compteurs par zone — affiche la limite Apple quand on s'en approche.
  const counts = fields.reduce<Partial<Record<CardZone, number>>>((acc, f) => {
    acc[f.zone] = (acc[f.zone] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Jetons */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-galet-ink">
        <span>Jetons :</span>
        {TOKENS.map(({ token, hint }) => (
          <code key={token} title={hint} className="rounded bg-calcaire border border-line-warm px-1.5 py-0.5 text-onyx">
            {token}
          </code>
        ))}
        <span className="text-galet-ink">— remplacés par les données du client sur sa carte.</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map((field) => (
              <SortableRow
                key={field.id}
                field={field}
                onUpdate={(updated) => onChange(reindex(fields.map((f) => (f.id === field.id ? updated : f))))}
                onDelete={() => onChange(reindex(fields.filter((f) => f.id !== field.id)))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() =>
          onChange([
            ...fields,
            { id: crypto.randomUUID(), zone: 'secondary', label: '', value: '', order: fields.length },
          ])
        }
        className="flex items-center gap-2 w-full border border-dashed border-halo/40 rounded-xl px-3 py-2.5 text-sm text-galet-ink hover:text-halo hover:border-halo hover:bg-halo/5 transition-all"
      >
        <Plus className="w-4 h-4" aria-hidden />
        Ajouter un champ
      </button>

      {/* Limites Apple par zone */}
      <p className="text-[11px] text-galet-ink">
        Limites Apple Wallet :{' '}
        {ZONES.filter((z) => z !== 'back').map((z, i) => (
          <span key={z}>
            {i > 0 && ' · '}
            <span className={(counts[z] ?? 0) > APPLE_ZONE_LIMITS[z] ? 'text-amber-700 font-medium' : ''}>
              {ZONE_LABELS[z].toLowerCase()} {counts[z] ?? 0}/{APPLE_ZONE_LIMITS[z]}
            </span>
          </span>
        ))}
        {' '}— le surplus bascule automatiquement au verso.
      </p>
    </div>
  );
}

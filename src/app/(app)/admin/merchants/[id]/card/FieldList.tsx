'use client';

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

// ─── Zone metadata ────────────────────────────────────────────────────────────

const ZONES: CardZone[] = ['header', 'primary', 'secondary', 'auxiliary', 'back'];

const ZONE_STYLE: Record<CardZone, string> = {
  header: 'bg-halo text-white',
  primary: 'bg-halo-600 text-white',
  secondary: 'bg-[#46484C] text-white',
  auxiliary: 'bg-galet text-white',
  back: 'bg-calcaire text-onyx border border-line-warm',
};

// ─── Sortable row ─────────────────────────────────────────────────────────────

interface SortableRowProps {
  field: CardField;
  onUpdate: (updated: CardField) => void;
  onDelete: () => void;
}

function SortableRow({ field, onUpdate, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  const inputCls =
    'flex-1 min-w-0 bg-calcaire border border-line-warm rounded-lg px-2 py-1.5 text-sm text-onyx focus:border-halo outline-none transition-colors placeholder:text-galet';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-surface border border-line-warm rounded-xl px-2 py-2"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 text-galet hover:text-galet-ink cursor-grab active:cursor-grabbing p-1 touch-none"
        aria-label="Réordonner"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Zone badge / selector */}
      <select
        value={field.zone}
        onChange={(e) => onUpdate({ ...field, zone: e.target.value as CardZone })}
        className={`shrink-0 text-[10px] font-semibold rounded px-1.5 py-1 border-none outline-none cursor-pointer uppercase tracking-wide ${ZONE_STYLE[field.zone]}`}
        aria-label="Zone"
      >
        {ZONES.map((z) => (
          <option key={z} value={z} className="bg-surface text-onyx normal-case">
            {z.toUpperCase()}
          </option>
        ))}
      </select>

      {/* Label input */}
      <input
        value={field.label}
        onChange={(e) => onUpdate({ ...field, label: e.target.value })}
        placeholder="Libellé"
        className={inputCls}
        aria-label="Libellé du champ"
      />

      {/* Value input */}
      <input
        value={field.value}
        onChange={(e) => onUpdate({ ...field, value: e.target.value })}
        placeholder="{points}"
        className={inputCls}
        aria-label="Valeur du champ"
      />

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 p-1.5 text-galet hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        aria-label="Supprimer le champ"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── FieldList ────────────────────────────────────────────────────────────────

interface FieldListProps {
  fields: CardField[];
  onChange: (fields: CardField[]) => void;
}

function reindex(fields: CardField[]): CardField[] {
  return fields.map((f, i) => ({ ...f, order: i }));
}

export default function FieldList({ fields, onChange }: FieldListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    onChange(reindex(arrayMove(fields, oldIndex, newIndex)));
  };

  const handleUpdate = (id: string, updated: CardField) => {
    onChange(reindex(fields.map((f) => (f.id === id ? updated : f))));
  };

  const handleDelete = (id: string) => {
    onChange(reindex(fields.filter((f) => f.id !== id)));
  };

  const handleAdd = () => {
    const next: CardField = {
      id: crypto.randomUUID(),
      zone: 'secondary',
      label: '',
      value: '',
      order: fields.length,
    };
    onChange([...fields, next]);
  };

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          {fields.map((field) => (
            <SortableRow
              key={field.id}
              field={field}
              onUpdate={(updated) => handleUpdate(field.id, updated)}
              onDelete={() => handleDelete(field.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add button */}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-2 w-full border border-dashed border-halo/40 rounded-xl px-3 py-2.5 text-sm text-galet-ink hover:text-halo hover:border-halo hover:bg-halo/5 transition-all"
      >
        <Plus className="w-4 h-4" />
        <span>＋ Ajouter un champ</span>
      </button>
    </div>
  );
}

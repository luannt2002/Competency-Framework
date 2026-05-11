'use client';

/**
 * Order Steps exercise — drag to reorder using @dnd-kit.
 */

import { useEffect, useState } from 'react';
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
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = { id: string; text: string };
type Payload = { steps: Step[] };

type Props = {
  payload: unknown;
  answer: unknown;
  onChange: (a: unknown) => void;
};

export function OrderStepsExercise({ payload, answer, onChange }: Props) {
  const p = payload as Payload | null;
  const initial = (answer as string[]) ?? p?.steps.map((s) => s.id) ?? [];
  const [ids, setIds] = useState<string[]>(initial);

  // Push initial order up on mount
  useEffect(() => {
    onChange(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(ids, oldIdx, newIdx);
    setIds(next);
    onChange(next);
  }

  if (!p) return null;
  const byId = new Map(p.steps.map((s) => [s.id, s]));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {ids.map((id, idx) => {
            const step = byId.get(id);
            if (!step) return null;
            return <SortableItem key={id} id={id} index={idx} text={step.text} />;
          })}
        </ul>
      </SortableContext>
      <p className="mt-3 text-xs text-muted-foreground">Drag to reorder ↕</p>
    </DndContext>
  );
}

function SortableItem({ id, index, text }: { id: string; index: number; text: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card p-3 transition-shadow',
        isDragging ? 'border-primary shadow-xl shadow-cyan-500/20 opacity-95' : 'border-border',
      )}
    >
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-secondary font-mono text-xs font-semibold text-muted-foreground">
        {index + 1}
      </span>
      <span className="flex-1 text-sm">{text}</span>
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
    </li>
  );
}

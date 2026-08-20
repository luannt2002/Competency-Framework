'use client';

/**
 * ExerciseTypeManager — where a tenant invents a new kind of exercise.
 *
 * The left column lists the kinds usable in this workspace (global built-ins
 * are read-only, the tenant's own can be retired). The right column is the
 * create form: slug, label, grading mode, the engine that will grade it, and a
 * field list describing the payload an author fills in.
 *
 * Ticking "đáp án" on a field is the whole point: it is the tenant-facing way
 * to say "this holds the answer", and the server derives `secret_fields` from
 * it so the value is stripped before any learner sees the payload.
 *
 * Every option shown here comes from props (server-resolved from the grader
 * registry + DB) — this file holds no business data.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Lock, Plus, Trash2, Wand2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createExerciseType, retireExerciseType } from '@/actions/exercise-types';
import { FIELD_TYPES, type FieldType } from '@/lib/exercises/field-spec';

export type ExerciseTypeCard = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  gradingMode: string;
  engine: string;
  secretFields: string[];
  isBuiltin: boolean;
  isActive: boolean;
};

export type EngineChoice = { engine: string; mode: string };

type DraftField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  secret: boolean;
};

const GRADING_MODES: ReadonlyArray<{ value: 'auto' | 'manual' | 'hybrid'; text: string }> = [
  { value: 'auto', text: 'Tự động chấm' },
  { value: 'manual', text: 'Luôn chấm tay' },
  { value: 'hybrid', text: 'Kết hợp' },
];

function emptyField(): DraftField {
  return { key: '', label: '', type: 'string', required: false, secret: false };
}

export function ExerciseTypeManager({
  workspaceSlug,
  types,
  engines,
  canEdit,
}: {
  workspaceSlug: string;
  types: ExerciseTypeCard[];
  engines: EngineChoice[];
  canEdit: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]">
      <section aria-label="Dạng bài hiện có" className="space-y-3">
        {types.map((t) => (
          <TypeRow key={t.id} workspaceSlug={workspaceSlug} type={t} canEdit={canEdit} />
        ))}
      </section>

      {canEdit && (
        <CreateTypeForm workspaceSlug={workspaceSlug} engines={engines} />
      )}
    </div>
  );
}

function TypeRow({
  workspaceSlug,
  type,
  canEdit,
}: {
  workspaceSlug: string;
  type: ExerciseTypeCard;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const retire = () => {
    if (pending) return;
    startTransition(async () => {
      try {
        const res = await retireExerciseType({ workspaceSlug, id: type.id });
        toast.success(res.deleted ? 'Đã xoá dạng bài' : 'Đã ngưng dùng dạng bài');
        router.refresh();
      } catch (e) {
        toast.error('Không thực hiện được', { description: String(e) });
      }
    });
  };

  return (
    <article className="surface flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">{type.label}</h3>
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{type.slug}</code>
          {type.isBuiltin && (
            <Badge variant="secondary">
              <Lock className="size-3" aria-hidden />
              Có sẵn
            </Badge>
          )}
          {!type.isActive && <Badge variant="warning">Ngưng dùng</Badge>}
        </div>
        {type.description && (
          <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          engine <code>{type.engine}</code> · chấm {type.gradingMode}
          {type.secretFields.length > 0 && (
            <> · giấu {type.secretFields.length} trường đáp án</>
          )}
        </p>
      </div>

      {canEdit && !type.isBuiltin && (
        <Button variant="ghost" size="sm" onClick={retire} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          Ngưng dùng
        </Button>
      )}
    </article>
  );
}

function CreateTypeForm({
  workspaceSlug,
  engines,
}: {
  workspaceSlug: string;
  engines: EngineChoice[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'auto' | 'manual' | 'hybrid'>('manual');
  const [engine, setEngine] = useState(engines[0]?.engine ?? '');
  const [fields, setFields] = useState<DraftField[]>([emptyField()]);

  const reset = () => {
    setSlug('');
    setLabel('');
    setDescription('');
    setMode('manual');
    setEngine(engines[0]?.engine ?? '');
    setFields([emptyField()]);
  };

  const setField = (index: number, patch: Partial<DraftField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const submit = () => {
    if (pending || !slug.trim() || !label.trim() || !engine) return;
    startTransition(async () => {
      try {
        const usable = fields.filter((f) => f.key.trim() !== '' && f.label.trim() !== '');
        await createExerciseType({
          workspaceSlug,
          slug: slug.trim(),
          label: label.trim(),
          description: description.trim() || undefined,
          gradingMode: mode,
          engine,
          payloadSchema: {
            fields: usable.map((f) => ({
              key: f.key.trim(),
              label: f.label.trim(),
              type: f.type,
              required: f.required,
              secret: f.secret,
            })),
          },
        });
        toast.success('Đã tạo dạng bài mới');
        reset();
        router.refresh();
      } catch (e) {
        toast.error('Tạo thất bại', { description: String(e) });
      }
    });
  };

  return (
    <aside className="surface h-fit space-y-4 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Wand2 className="size-4 text-primary" aria-hidden />
        Tạo dạng bài mới
      </h2>
      <p className="text-xs text-muted-foreground">
        Không cần sửa code hay chạy migration — dạng bài là dữ liệu của workspace này.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="et-slug" className="text-xs font-medium">
          Slug (lower_snake_case)
        </label>
        <Input
          id="et-slug"
          value={slug}
          placeholder="phan_tich_su_co"
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="et-label" className="text-xs font-medium">
          Tên hiển thị
        </label>
        <Input
          id="et-label"
          value={label}
          placeholder="Phân tích sự cố"
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="et-desc" className="text-xs font-medium">
          Mô tả
        </label>
        <Textarea
          id="et-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="et-mode" className="text-xs font-medium">
            Chế độ chấm
          </label>
          <select
            id="et-mode"
            className="h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'auto' | 'manual' | 'hybrid')}
          >
            {GRADING_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.text}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="et-engine" className="text-xs font-medium">
            Engine nền
          </label>
          <select
            id="et-engine"
            className="h-10 w-full rounded-xl border border-border bg-secondary/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
          >
            {engines.map((opt) => (
              <option key={opt.engine} value={opt.engine}>
                {opt.engine} ({opt.mode})
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Trường của đề bài</legend>
        {fields.map((f, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-2">
            <div className="flex gap-2">
              <Input
                aria-label={`Khoá trường ${i + 1}`}
                className="h-9"
                value={f.key}
                placeholder="key"
                onChange={(e) => setField(i, { key: e.target.value })}
              />
              <Input
                aria-label={`Nhãn trường ${i + 1}`}
                className="h-9"
                value={f.label}
                placeholder="Nhãn"
                onChange={(e) => setField(i, { label: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Xoá trường ${i + 1}`}
                onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label={`Kiểu trường ${i + 1}`}
                className="h-9 rounded-lg border border-border bg-secondary/40 px-2 text-xs"
                value={f.type}
                onChange={(e) => setField(i, { type: e.target.value as FieldType })}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => setField(i, { required: e.target.checked })}
                />
                bắt buộc
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={f.secret}
                  onChange={(e) => setField(i, { secret: e.target.checked })}
                />
                đáp án (không gửi cho học viên)
              </label>
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFields((prev) => [...prev, emptyField()])}
        >
          <Plus className="size-3" aria-hidden />
          Thêm trường
        </Button>
      </fieldset>

      <Button className="w-full" onClick={submit} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Wand2 className="size-4" aria-hidden />
        )}
        Tạo dạng bài
      </Button>
    </aside>
  );
}

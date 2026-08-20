'use client';

/**
 * Answer widgets — one per interaction shape, plus the dispatcher.
 *
 * These components are deliberately dumb. They receive a `RunnerSpec` (built
 * by `@/lib/exercises/runner`, which is pure and tested) and an `AnswerDraft`,
 * and they emit a new draft. They do not know what a grader is, what "correct"
 * means, or which kind they are rendering — swapping the dispatch table below
 * is the only code change a genuinely new interaction shape needs.
 *
 * The dispatcher keys off `spec.input`, and the spec keys off the ENGINE. That
 * indirection is what lets a workspace invent `sre_postmortem` on the `rubric`
 * engine and get a working screen with no deploy; and if it invents a kind on
 * an engine with no widget, `spec.input` lands on `fields` and the schema
 * renderer at the bottom of this file takes over.
 *
 * Styling: semantic tokens only (`bg-secondary`, `border-border`, `text-primary`,
 * `ring-ring`). Selection is `primary`, because selecting is an interaction —
 * it is NOT a verdict, and must not borrow emerald/destructive from one.
 */
import { ArrowDown, ArrowUp, Check, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  countWords,
  moveInOrder,
  type AnswerDraft,
  type ChoiceOption,
  type RunnerSpec,
} from '@/lib/exercises/runner';
import type { FieldDescriptor } from '@/lib/exercises/field-spec';

type InputProps = {
  /** DOM-id prefix — must be unique per exercise on the page. */
  idBase: string;
  spec: RunnerSpec;
  draft: AnswerDraft;
  disabled: boolean;
  onChange: (next: AnswerDraft) => void;
};

/* ============================ dispatcher ============================ */

export function AnswerInput(props: InputProps) {
  const { spec, draft } = props;
  // A draft is always built from its own spec; a mismatch means the parent
  // swapped exercises mid-render. Render nothing rather than crash on a union
  // narrowing that cannot hold.
  if (spec.input !== draft.input) return null;

  switch (spec.input) {
    case 'single':
      return <ChoiceSingle {...props} options={spec.options} />;
    case 'multi':
      return <ChoiceMulti {...props} options={spec.options} />;
    case 'order':
      return <OrderSteps {...props} steps={spec.steps} />;
    case 'blanks':
      return <FillBlanks {...props} template={spec.template} blanks={spec.blanks} />;
    case 'text':
      return <TextAnswer {...props} spec={spec} />;
    case 'number':
      return <NumberAnswer {...props} spec={spec} />;
    case 'fields':
      return <SchemaFields {...props} fields={spec.fields} />;
  }
}

/* ============================ choice — pick one ============================ */

function ChoiceSingle({
  idBase,
  draft,
  disabled,
  onChange,
  options,
}: InputProps & { options: ChoiceOption[] }) {
  if (draft.input !== 'single') return null;
  const name = `${idBase}-choice`;
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">Chọn một đáp án</legend>
      {options.map((opt) => {
        const id = `${name}-${opt.id}`;
        const selected = draft.value === opt.id;
        return (
          <label
            key={opt.id}
            htmlFor={id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors',
              'focus-within:ring-2 focus-within:ring-ring',
              selected
                ? 'border-primary/50 bg-primary/10'
                : 'border-border bg-secondary/30 hover:bg-secondary/60',
              disabled && 'cursor-not-allowed opacity-70',
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              className="sr-only"
              checked={selected}
              disabled={disabled}
              onChange={() => onChange({ input: 'single', value: opt.id })}
            />
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
              )}
            >
              {selected && <Check className="size-3" />}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{opt.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

/* ============================ choice — pick many ============================ */

function ChoiceMulti({
  idBase,
  draft,
  disabled,
  onChange,
  options,
}: InputProps & { options: ChoiceOption[] }) {
  if (draft.input !== 'multi') return null;
  const selected = new Set(draft.values);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Sorted by the authored option order, not click order: the grader
    // compares as a set, and a stable order keeps the stored answer diffable.
    onChange({
      input: 'multi',
      values: options.filter((o) => next.has(o.id)).map((o) => o.id),
    });
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-1 text-xs text-muted-foreground">
        Chọn tất cả phương án đúng — thiếu hoặc thừa đều bị tính sai.
      </legend>
      {options.map((opt) => {
        const id = `${idBase}-multi-${opt.id}`;
        const on = selected.has(opt.id);
        return (
          <label
            key={opt.id}
            htmlFor={id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors',
              'focus-within:ring-2 focus-within:ring-ring',
              on
                ? 'border-primary/50 bg-primary/10'
                : 'border-border bg-secondary/30 hover:bg-secondary/60',
              disabled && 'cursor-not-allowed opacity-70',
            )}
          >
            <input
              id={id}
              type="checkbox"
              className="sr-only"
              checked={on}
              disabled={disabled}
              onChange={() => toggle(opt.id)}
            />
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
              )}
            >
              {on && <Check className="size-3" />}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{opt.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

/* ============================ ordering ============================ */

/**
 * Reordering by explicit up/down buttons rather than drag.
 *
 * Drag-and-drop is the obvious choice and the wrong one here: it is unusable
 * from a keyboard, awkward on touch, and this list is never longer than a
 * handful of steps. Buttons are operable by every input device and announce
 * position changes for free.
 */
function OrderSteps({
  idBase,
  draft,
  disabled,
  onChange,
  steps,
}: InputProps & { steps: ChoiceOption[] }) {
  if (draft.input !== 'order') return null;
  const byId = new Map(steps.map((s) => [s.id, s]));
  const move = (from: number, to: number) =>
    onChange({ input: 'order', ids: moveInOrder(draft.ids, from, to) });

  return (
    <ol className="space-y-2" aria-label="Sắp xếp các bước theo đúng thứ tự">
      {draft.ids.map((id, index) => {
        const step = byId.get(id);
        if (!step) return null;
        return (
          <li
            key={id}
            className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-3"
          >
            <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">
              {step.text}
            </span>
            <span className="flex shrink-0 flex-col gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={`Đưa "${step.text}" lên trên`}
                id={`${idBase}-up-${id}`}
              >
                <ArrowUp className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={disabled || index === draft.ids.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={`Đưa "${step.text}" xuống dưới`}
                id={`${idBase}-down-${id}`}
              >
                <ArrowDown className="size-3" />
              </Button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ============================ fill in the blanks ============================ */

/**
 * The template is split on `___` and inputs are woven into the sentence, so
 * the learner reads the blank in context instead of matching numbered boxes to
 * a paragraph above. Extra blanks (template with fewer `___` than declared
 * slots) are appended as labelled inputs rather than silently dropped.
 */
function FillBlanks({
  idBase,
  draft,
  disabled,
  onChange,
  template,
  blanks,
}: InputProps & { template: string; blanks: Array<{ id: string; matchKind: string }> }) {
  if (draft.input !== 'blanks') return null;
  const segments = template.split('___');
  const set = (id: string, value: string) =>
    onChange({ input: 'blanks', values: { ...draft.values, [id]: value } });

  const inline = blanks.slice(0, Math.max(0, segments.length - 1));
  const leftovers = blanks.slice(inline.length);

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2 text-sm leading-8">
        {segments.map((seg, i) => {
          const blank = inline[i];
          return (
            <span key={`seg-${i}`} className="contents">
              <span className="whitespace-pre-wrap">{seg}</span>
              {blank && (
                <Input
                  id={`${idBase}-blank-${blank.id}`}
                  aria-label={`Chỗ trống ${i + 1}`}
                  className="inline-block h-8 w-40 align-baseline"
                  value={draft.values[blank.id] ?? ''}
                  disabled={disabled}
                  onChange={(e) => set(blank.id, e.target.value)}
                />
              )}
            </span>
          );
        })}
      </p>
      {leftovers.map((blank, i) => (
        <div key={blank.id} className="flex items-center gap-2">
          <label
            htmlFor={`${idBase}-blank-${blank.id}`}
            className="text-xs text-muted-foreground"
          >
            Chỗ trống {inline.length + i + 1}
          </label>
          <Input
            id={`${idBase}-blank-${blank.id}`}
            className="h-8 w-40"
            value={draft.values[blank.id] ?? ''}
            disabled={disabled}
            onChange={(e) => set(blank.id, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

/* ============================ free text ============================ */

/**
 * One box for four engines: `type_answer` (single line), `short_answer`,
 * `essay` and `rubric` (multiline).
 *
 * The word counter is advisory. `minWords`/`maxWords` are notes the essay
 * grader passes to a human — they never auto-fail, so the counter turns
 * `text-muted-foreground` -> `text-amber-*`, never destructive.
 */
function TextAnswer({
  idBase,
  draft,
  disabled,
  onChange,
  spec,
}: InputProps & { spec: Extract<RunnerSpec, { input: 'text' }> }) {
  if (draft.input !== 'text') return null;
  const words = countWords(draft.value);
  const chars = draft.value.length;
  const belowMin = spec.minWords !== null && words > 0 && words < spec.minWords;
  const aboveMax = spec.maxWords !== null && words > spec.maxWords;
  const id = `${idBase}-text`;

  return (
    <div className="space-y-2">
      {spec.multiline ? (
        <Textarea
          id={id}
          rows={8}
          className="min-h-[10rem]"
          value={draft.value}
          disabled={disabled}
          maxLength={spec.maxChars ?? undefined}
          placeholder="Viết câu trả lời của bạn…"
          aria-label="Câu trả lời"
          onChange={(e) => onChange({ input: 'text', value: e.target.value })}
        />
      ) : (
        <Input
          id={id}
          value={draft.value}
          disabled={disabled}
          maxLength={spec.maxChars ?? undefined}
          placeholder="Gõ đáp án…"
          aria-label="Đáp án"
          autoComplete="off"
          onChange={(e) => onChange({ input: 'text', value: e.target.value })}
        />
      )}

      {spec.multiline && (
        <p
          className={cn(
            'text-xs tabular-nums',
            belowMin || aboveMax ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
          )}
          aria-live="polite"
        >
          {words} từ
          {spec.minWords !== null && ` · gợi ý tối thiểu ${spec.minWords}`}
          {spec.maxWords !== null && ` · gợi ý tối đa ${spec.maxWords}`}
          {spec.maxChars !== null && ` · ${chars}/${spec.maxChars} ký tự`}
        </p>
      )}
    </div>
  );
}

/* ============================ number ============================ */

function NumberAnswer({
  idBase,
  draft,
  disabled,
  onChange,
  spec,
}: InputProps & { spec: Extract<RunnerSpec, { input: 'number' }> }) {
  if (draft.input !== 'number') return null;
  const id = `${idBase}-number`;
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        // `text` + inputMode, not `type="number"`: the grader accepts "12,5"
        // and a number input silently discards a comma on some locales.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className="w-44"
        aria-label="Đáp án dạng số"
        placeholder={spec.decimals !== null ? `vd. ${(0).toFixed(spec.decimals)}` : 'vd. 12'}
        value={draft.value}
        disabled={disabled}
        onChange={(e) => onChange({ input: 'number', value: e.target.value })}
      />
      {spec.unit && <span className="text-sm text-muted-foreground">{spec.unit}</span>}
    </div>
  );
}

/* ============================ schema-driven (tenant kinds) ============================ */

/**
 * The generic renderer — the payoff of the open exercise system.
 *
 * A workspace defines a kind with an `answer_schema` field spec and gets a
 * real form: typed inputs, required markers, help text. No code ships for it.
 * Reached whenever the resolved engine has no widget of its own.
 */
function SchemaFields({
  idBase,
  draft,
  disabled,
  onChange,
  fields,
}: InputProps & { fields: FieldDescriptor[] }) {
  if (draft.input !== 'fields') return null;
  const set = (key: string, value: string) =>
    onChange({ input: 'fields', values: { ...draft.values, [key]: value } });

  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const id = `${idBase}-field-${f.key}`;
        const value = draft.values[f.key] ?? '';
        return (
          <div key={f.key} className="space-y-1.5">
            <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
              {f.label}
              {f.required && (
                <span className="text-destructive" aria-label="bắt buộc">
                  *
                </span>
              )}
            </label>
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            <SchemaField
              id={id}
              field={f}
              value={value}
              disabled={disabled}
              onChange={(v) => set(f.key, v)}
            />
          </div>
        );
      })}
    </div>
  );
}

function SchemaField({
  id,
  field,
  value,
  disabled,
  onChange,
}: {
  id: string;
  field: FieldDescriptor;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  switch (field.type) {
    case 'boolean':
      return (
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 rounded-xl border border-border bg-secondary/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">—</option>
          <option value="true">Có</option>
          <option value="false">Không</option>
        </select>
      );
    case 'number':
      return (
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="w-44"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'string_list':
    case 'option_list':
      return (
        <Textarea
          id={id}
          rows={4}
          value={value}
          disabled={disabled}
          placeholder="Mỗi dòng một mục"
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'text':
    case 'markdown':
    case 'json':
      return (
        <Textarea
          id={id}
          rows={field.type === 'json' ? 6 : 5}
          className={cn(field.type === 'json' && 'font-mono text-xs')}
          value={value}
          disabled={disabled}
          placeholder={field.type === 'json' ? '{ }' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

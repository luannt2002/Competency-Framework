'use client';
/**
 * BadgeManager — F16 creator custom badge CRUD (client).
 *
 * List + inline create/edit form on /w/[slug]/badges (EDITOR+).
 * - Icon picker: the 12 BADGE_ICONS keys from badge-wall.tsx.
 * - Rule form: fields per evaluator kind (shared pure validator
 *   `validateRuleForm` gives inline errors; the server action re-validates).
 * - Deactivate = soft (earned rows kept). Delete is refused server-side when
 *   anyone earned the badge — the UI hides it in that case and shows the
 *   deactivate affordance instead.
 */
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  CalendarCheck,
  Cloud,
  Crown,
  Flame,
  Footprints,
  Grid3x3,
  Medal,
  Sparkles,
  Star,
  Trophy,
  Zap,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createBadge,
  updateBadge,
  setBadgeActive,
  deleteBadge,
} from '@/actions/badges';
import {
  RULE_KIND_CATALOGUE,
  BADGE_ICON_KEYS,
  EMPTY_RULE_FORM,
  validateRuleForm,
  describeRule,
  type RuleFormValues,
  type BadgeIconKey,
} from '@/lib/badges/rule-form';

const ICONS: Record<BadgeIconKey, typeof Award> = {
  Award,
  CalendarCheck,
  Cloud,
  Crown,
  Flame,
  Footprints,
  Grid3x3,
  Medal,
  Sparkles,
  Star,
  Trophy,
  Zap,
};

export type BadgeRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  rule: unknown;
  isActive: boolean;
  earnedCount: number;
};

type EditState = {
  badgeId: string | null; // null = creating
  name: string;
  description: string;
  icon: BadgeIconKey;
  ruleForm: RuleFormValues;
};

function newForm(): EditState {
  return {
    badgeId: null,
    name: '',
    description: '',
    icon: 'Award',
    ruleForm: { ...EMPTY_RULE_FORM },
  };
}

export function BadgeManager({
  workspaceSlug,
  badges,
}: {
  workspaceSlug: string;
  badges: BadgeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EditState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const spec = useMemo(
    () =>
      form
        ? RULE_KIND_CATALOGUE.find((c) => c.kind === form.ruleForm.kind)!
        : null,
    [form],
  );

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ACTION_FAILED');
      }
    });
  }

  function submit() {
    if (!form) return;
    const v = validateRuleForm(form.ruleForm);
    if (!form.name.trim()) {
      setFieldErrors({ name: 'Tên không được để trống' });
      return;
    }
    if (!v.ok) {
      setFieldErrors(v.errors);
      return;
    }
    setFieldErrors({});
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      icon: form.icon,
      ruleForm: form.ruleForm,
    };
    run(async () => {
      if (form.badgeId) await updateBadge(workspaceSlug, form.badgeId, payload);
      else await createBadge(workspaceSlug, payload);
      setForm(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Thiết kế huy hiệu của workspace — luật mở khoá, biểu tượng, tên gọi.
          Huy hiệu đã có người nhận chỉ được tắt (giữ lại lịch sử), không xoá.
        </p>
        {!form && (
          <Button onClick={() => setForm(newForm())} disabled={pending}>
            <Plus className="size-4" /> Tạo huy hiệu
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
          {error}
        </p>
      )}

      {/* Create / edit form */}
      {form && spec && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {form.badgeId ? 'Sửa huy hiệu' : 'Huy hiệu mới'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setFieldErrors({});
              }}
              className="rounded-md p-1.5 hover:bg-secondary/70 text-muted-foreground"
              aria-label="Đóng form"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-muted-foreground">Tên</span>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: DevOps Starter"
                maxLength={80}
              />
              {fieldErrors.name && (
                <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</span>
              )}
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-muted-foreground">Mô tả (tuỳ chọn)</span>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={500}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Biểu tượng</span>
            <div className="flex flex-wrap gap-2">
              {BADGE_ICON_KEYS.map((key) => {
                const Icon = ICONS[key];
                const selected = form.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, icon: key })}
                    title={key}
                    aria-pressed={selected}
                    className={`inline-flex items-center justify-center size-10 rounded-xl border transition-colors ${
                      selected
                        ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'border-border bg-secondary/40 hover:bg-secondary/80 text-muted-foreground'
                    }`}
                  >
                    <Icon className="size-5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-muted-foreground">Luật mở khoá</span>
              <select
                value={form.ruleForm.kind}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ruleForm: { ...EMPTY_RULE_FORM, kind: e.target.value as RuleFormValues['kind'] },
                  })
                }
                className="w-full h-9 rounded-md border border-border bg-card px-2 text-sm"
              >
                {RULE_KIND_CATALOGUE.map((c) => (
                  <option key={c.kind} value={c.kind}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">{spec.hint}</span>
            </label>

            {spec.fields === 'number' && (
              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-muted-foreground">Số lượng (≥ 1)</span>
                <Input
                  inputMode="numeric"
                  value={form.ruleForm.value}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ruleForm: { ...form.ruleForm, value: e.target.value },
                    })
                  }
                  placeholder="10"
                />
                {fieldErrors.value && (
                  <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.value}</span>
                )}
              </label>
            )}

            {spec.fields === 'level_code' && (
              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-muted-foreground">Level code</span>
                <Input
                  value={form.ruleForm.value}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ruleForm: { ...form.ruleForm, value: e.target.value },
                    })
                  }
                  placeholder="L"
                />
                {fieldErrors.value && (
                  <span className="text-xs text-red-600 dark:text-red-400">{fieldErrors.value}</span>
                )}
              </label>
            )}

            {spec.fields === 'category_level' && (
              <>
                <label className="space-y-1.5 block">
                  <span className="text-xs font-medium text-muted-foreground">Category slug</span>
                  <Input
                    value={form.ruleForm.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ruleForm: { ...form.ruleForm, category: e.target.value },
                      })
                    }
                    placeholder="devops"
                  />
                  {fieldErrors.category && (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {fieldErrors.category}
                    </span>
                  )}
                </label>
                <label className="space-y-1.5 block">
                  <span className="text-xs font-medium text-muted-foreground">Level code tối thiểu</span>
                  <Input
                    value={form.ruleForm.level}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ruleForm: { ...form.ruleForm, level: e.target.value },
                      })
                    }
                    placeholder="M"
                  />
                  {fieldErrors.level && (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {fieldErrors.level}
                    </span>
                  )}
                </label>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => {
                setForm(null);
                setFieldErrors({});
              }}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button onClick={submit} disabled={pending}>
              {form.badgeId ? 'Lưu thay đổi' : 'Tạo huy hiệu'}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {badges.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có huy hiệu nào. Tạo huy hiệu đầu tiên để motivates learners.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {badges.map((b) => {
            const Icon = (b.icon && BADGE_ICON_KEYS.includes(b.icon as BadgeIconKey)
              ? ICONS[b.icon as BadgeIconKey]
              : Award) as typeof Award;
            return (
              <li
                key={b.id}
                className={`rounded-2xl border bg-card p-4 flex gap-3 ${
                  b.isActive ? 'border-border' : 'border-border/50 opacity-60'
                }`}
              >
                <div
                  className={`size-11 shrink-0 rounded-xl flex items-center justify-center ${
                    b.isActive ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{b.name}</span>
                    {!b.isActive && (
                      <span className="text-[10px] uppercase tracking-wide rounded-md bg-secondary px-1.5 py-0.5 text-muted-foreground">
                        Đã tắt
                      </span>
                    )}
                    {b.earnedCount > 0 && (
                      <span className="text-[10px] rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5">
                        {b.earnedCount} người đã nhận
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {b.description ?? '—'}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {describeRule(b.rule)}
                  </p>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          badgeId: b.id,
                          name: b.name,
                          description: b.description ?? '',
                          icon: (b.icon && BADGE_ICON_KEYS.includes(b.icon as BadgeIconKey)
                            ? b.icon
                            : 'Award') as BadgeIconKey,
                          ruleForm: {
                            ...EMPTY_RULE_FORM,
                            kind: ruleKindOf(b.rule),
                            value: ruleValueOf(b.rule),
                            category: ruleCategoryOf(b.rule),
                            level: ruleLevelOf(b.rule),
                          },
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-secondary/70 text-muted-foreground"
                    >
                      <Pencil className="size-3.5" /> Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => run(() => setBadgeActive(workspaceSlug, b.id, !b.isActive))}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-secondary/70 text-muted-foreground"
                    >
                      <Power className="size-3.5" /> {b.isActive ? 'Tắt' : 'Bật lại'}
                    </button>
                    {b.earnedCount === 0 && (
                      <button
                        type="button"
                        onClick={() => run(() => deleteBadge(workspaceSlug, b.id))}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-red-500/10 text-red-600 dark:text-red-400"
                        title="Chỉ xoá được khi chưa có ai nhận"
                      >
                        <Trash2 className="size-3.5" /> Xoá
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- rule → form-field extractors (defensive against unknown shapes) -------
function ruleKindOf(rule: unknown): RuleFormValues['kind'] {
  const k = (rule as { kind?: string } | null)?.kind;
  const all = RULE_KIND_CATALOGUE.map((c) => c.kind) as string[];
  return all.includes(k!) ? (k as RuleFormValues['kind']) : 'lesson_completed';
}
function ruleValueOf(rule: unknown): string {
  const v = (rule as { value?: unknown } | null)?.value;
  return v === undefined || v === null ? '' : String(v);
}
function ruleCategoryOf(rule: unknown): string {
  return String((rule as { category?: unknown } | null)?.category ?? '');
}
function ruleLevelOf(rule: unknown): string {
  return String((rule as { level?: unknown } | null)?.level ?? '');
}

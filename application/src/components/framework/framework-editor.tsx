'use client';

/**
 * Framework Editor — CRUD UI for categories, skills, levels.
 * Optimistic updates via re-render after server action (revalidatePath).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LevelBadge } from '@/components/skills/level-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  upsertCategory,
  deleteCategory,
  upsertSkill,
  deleteSkill,
  updateLevel,
} from '@/actions/framework';
import type { SkillCategory, Skill, CompetencyLevel } from '@/types';

type Tab = 'categories' | 'skills' | 'levels';

type Props = {
  workspaceSlug: string;
  categories: SkillCategory[];
  skills: Skill[];
  levels: CompetencyLevel[];
};

export function FrameworkEditor({ workspaceSlug, categories, skills, levels }: Props) {
  const [tab, setTab] = useState<Tab>('categories');
  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(
          [
            ['categories', `Categories (${categories.length})`],
            ['skills', `Skills (${skills.length})`],
            ['levels', `Levels (${levels.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'categories' && (
        <CategoriesTab workspaceSlug={workspaceSlug} categories={categories} />
      )}
      {tab === 'skills' && (
        <SkillsTab workspaceSlug={workspaceSlug} categories={categories} skills={skills} />
      )}
      {tab === 'levels' && <LevelsTab workspaceSlug={workspaceSlug} levels={levels} />}
    </div>
  );
}

/* =========================== Categories =========================== */

function CategoriesTab({
  workspaceSlug,
  categories,
}: {
  workspaceSlug: string;
  categories: SkillCategory[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SkillCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const onDelete = (cat: SkillCategory) => {
    if (!window.confirm(`Delete "${cat.name}"? This also removes all its skills.`)) return;
    startTransition(async () => {
      try {
        await deleteCategory(workspaceSlug, cat.id);
        toast.success(`Deleted ${cat.name}`);
        router.refresh();
      } catch (e) {
        toast.error('Delete failed', { description: String(e) });
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New category
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((c) => (
          <div
            key={c.id}
            className="surface p-4 flex items-center gap-3"
          >
            <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: c.color ?? '#94A3B8' }} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground truncate">{c.description ?? '—'}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
              <Pencil className="size-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(c)} disabled={pending}>
              <Trash2 className="size-3 text-destructive" />
            </Button>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="surface p-8 text-center text-sm text-muted-foreground">
            No categories yet. Click "New category" to add one.
          </div>
        )}
      </div>

      <CategoryDialog
        open={creating || editing !== null}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
        workspaceSlug={workspaceSlug}
        editing={editing}
      />
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  workspaceSlug,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  editing: SkillCategory | null;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#22D3EE');
  const [pending, startTransition] = useTransition();

  // Reset when opens with new "editing" target
  useState(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setColor(editing.color ?? '#22D3EE');
    } else {
      setName('');
      setDescription('');
      setColor('#22D3EE');
    }
  });

  const save = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await upsertCategory({
          workspaceSlug,
          id: editing?.id,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        });
        toast.success(editing ? 'Category updated' : 'Category created');
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Save failed', { description: String(e) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>Group related skills together.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AWS, Terraform, Kubernetes"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this category covers..."
              rows={2}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-9 rounded-lg border border-border cursor-pointer"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !name.trim()}>
            <Save className="size-4" />
            {editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================== Skills =========================== */

function SkillsTab({
  workspaceSlug,
  categories,
  skills,
}: {
  workspaceSlug: string;
  categories: SkillCategory[];
  skills: Skill[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Skill | null>(null);
  const [creatingInCat, setCreatingInCat] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byCat = new Map<string, Skill[]>();
  for (const s of skills) {
    if (!byCat.has(s.categoryId)) byCat.set(s.categoryId, []);
    byCat.get(s.categoryId)!.push(s);
  }

  const onDelete = (s: Skill) => {
    if (!window.confirm(`Delete "${s.name}"? Progress for this skill will be removed.`)) return;
    startTransition(async () => {
      try {
        await deleteSkill(workspaceSlug, s.id);
        toast.success(`Deleted ${s.name}`);
        router.refresh();
      } catch (e) {
        toast.error('Delete failed', { description: String(e) });
      }
    });
  };

  return (
    <div className="space-y-4">
      {categories.map((c) => (
        <section key={c.id} className="surface overflow-hidden">
          <header className="p-3 border-b border-border bg-secondary/20 flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: c.color ?? '#94A3B8' }} />
            <h3 className="font-medium text-sm">{c.name}</h3>
            <span className="text-xs text-muted-foreground">({byCat.get(c.id)?.length ?? 0})</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => setCreatingInCat(c.id)}
            >
              <Plus className="size-3" />
              Add skill
            </Button>
          </header>
          <ul className="divide-y divide-border">
            {(byCat.get(c.id) ?? []).map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-secondary/20">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{s.name}</div>
                  {s.tags && s.tags.length > 0 && (
                    <div className="mt-0.5 flex gap-1">
                      {s.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                  <Pencil className="size-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(s)} disabled={pending}>
                  <Trash2 className="size-3 text-destructive" />
                </Button>
              </li>
            ))}
            {(byCat.get(c.id)?.length ?? 0) === 0 && (
              <li className="p-3 text-xs text-muted-foreground italic">No skills yet</li>
            )}
          </ul>
        </section>
      ))}

      <SkillDialog
        open={editing !== null || creatingInCat !== null}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreatingInCat(null);
          }
        }}
        workspaceSlug={workspaceSlug}
        categories={categories}
        editing={editing}
        defaultCategoryId={creatingInCat}
      />
    </div>
  );
}

function SkillDialog({
  open,
  onOpenChange,
  workspaceSlug,
  categories,
  editing,
  defaultCategoryId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceSlug: string;
  categories: SkillCategory[];
  editing: Skill | null;
  defaultCategoryId: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [pending, startTransition] = useTransition();

  useState(() => {
    if (editing) {
      setName(editing.name);
      setCategoryId(editing.categoryId);
      setDescription(editing.description ?? '');
      setTags((editing.tags ?? []).join(', '));
    } else {
      setName('');
      setCategoryId(defaultCategoryId ?? categories[0]?.id ?? '');
      setDescription('');
      setTags('');
    }
  });

  const save = () => {
    if (!name.trim() || !categoryId) return;
    startTransition(async () => {
      try {
        await upsertSkill({
          workspaceSlug,
          id: editing?.id,
          categoryId,
          name: name.trim(),
          description: description.trim() || undefined,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        });
        toast.success(editing ? 'Skill updated' : 'Skill created');
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Save failed', { description: String(e) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit skill' : 'New skill'}</DialogTitle>
          <DialogDescription>
            Atomic competency someone can be assessed on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., IAM Deep, VPC Networking"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-secondary/40 px-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="..."
              rows={2}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">
              Tags <span className="text-muted-foreground">(comma-separated)</span>
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="security, aws, iam"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !name.trim() || !categoryId}>
            <Save className="size-4" />
            {editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================== Levels =========================== */

function LevelsTab({
  workspaceSlug,
  levels,
}: {
  workspaceSlug: string;
  levels: CompetencyLevel[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CompetencyLevel | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Level codes (XS/S/M/L) are fixed; you can rename labels + edit descriptions.
      </p>
      {levels.map((l) => (
        <div key={l.id} className="surface p-4 flex items-start gap-3">
          <LevelBadge code={l.code} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{l.label}</div>
            {l.description && (
              <p className="text-xs text-muted-foreground mt-1">{l.description}</p>
            )}
            {l.examples && (
              <p className="text-xs text-muted-foreground/80 mt-1 italic">e.g., {l.examples}</p>
            )}
          </div>
          <span className="text-xs font-mono text-muted-foreground">{l.numericValue}</span>
          <Button variant="ghost" size="sm" onClick={() => setEditing(l)}>
            <Pencil className="size-3" />
          </Button>
        </div>
      ))}

      {editing && (
        <LevelDialog
          level={editing}
          open
          onOpenChange={(v) => {
            if (!v) setEditing(null);
            router.refresh();
          }}
          workspaceSlug={workspaceSlug}
        />
      )}
    </div>
  );
}

function LevelDialog({
  level,
  workspaceSlug,
  open,
  onOpenChange,
}: {
  level: CompetencyLevel;
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(level.label);
  const [description, setDescription] = useState(level.description ?? '');
  const [examples, setExamples] = useState(level.examples ?? '');
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!label.trim()) return;
    startTransition(async () => {
      try {
        await updateLevel({
          workspaceSlug,
          id: level.id,
          label: label.trim(),
          description: description.trim() || undefined,
          examples: examples.trim() || undefined,
        });
        toast.success('Level updated');
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Save failed', { description: String(e) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit level — {level.code}</DialogTitle>
          <DialogDescription>Rename + update rubric for this level.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5">Label *</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Examples</label>
            <Textarea value={examples} onChange={(e) => setExamples(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !label.trim()}>
            <Save className="size-4" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

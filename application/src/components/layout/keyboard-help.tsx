'use client';

/**
 * Global keyboard-shortcut help overlay.
 *
 * Listens for `?` (Shift+/) globally and opens a dialog documenting the
 * available shortcuts. Ignores the key when the user is typing inside an
 * input/textarea or contenteditable surface so it never hijacks composition.
 *
 * Mounted once from the (app) layout so the help dialog is reachable from
 * every authenticated page. Individual page-level handlers (J/K/D/N/E) are
 * documented here even when not yet wired — see "Tip" footer.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Shortcut = {
  keys: string[];
  description: string;
  pending?: boolean;
};

const NAVIGATION: Shortcut[] = [
  { keys: ['Cmd', 'K'], description: 'Mở tìm kiếm nhanh' },
  { keys: ['Esc'], description: 'Đóng dialog hoặc overlay' },
  { keys: ['?'], description: 'Mở bảng phím tắt này' },
];

const TREE: Shortcut[] = [
  { keys: ['J'], description: 'Sibling kế tiếp (trang node detail)', pending: true },
  { keys: ['K'], description: 'Sibling trước đó (trang node detail)', pending: true },
];

const ACTIONS: Shortcut[] = [
  { keys: ['D'], description: 'Đánh dấu xong / bỏ done', pending: true },
  { keys: ['N'], description: 'Thêm note nhanh', pending: true },
  { keys: ['E'], description: 'Sửa node', pending: true },
];

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-md border border-border bg-secondary/60 text-foreground text-xs font-mono font-semibold shadow-sm">
      {children}
    </kbd>
  );
}

function ShortcutRow({ s }: { s: Shortcut }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-1.5">
        {s.keys.map((k, i) => (
          <span key={k + i} className="flex items-center gap-1">
            <Kbd>{k}</Kbd>
            {i < s.keys.length - 1 && (
              <span className="text-muted-foreground text-xs">+</span>
            )}
          </span>
        ))}
      </div>
      <div className="text-sm text-foreground flex items-center gap-2 text-right">
        <span>{s.description}</span>
        {s.pending && (
          <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground rounded-full bg-secondary/60 px-1.5 py-0.5">
            soon
          </span>
        )}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Shortcut[] }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {title}
      </h3>
      <div className="divide-y divide-border/40">
        {items.map((s) => (
          <ShortcutRow key={s.keys.join('+') + s.description} s={s} />
        ))}
      </div>
    </div>
  );
}

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      if (isEditableTarget(e.target)) return;
      // Allow plain `?` (which is Shift+/ on US layout) without other modifiers.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hasPending =
    NAVIGATION.some((s) => s.pending) ||
    TREE.some((s) => s.pending) ||
    ACTIONS.some((s) => s.pending);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Phím tắt</DialogTitle>
          <DialogDescription>
            Nhấn <Kbd>?</Kbd> ở bất kỳ trang nào để mở bảng này.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Navigation" items={NAVIGATION} />
          <Section title="Tree" items={TREE} />
          <Section title="Actions" items={ACTIONS} />
        </div>

        {hasPending && (
          <p className="text-xs text-muted-foreground italic">
            (Tip: shortcuts coming soon)
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

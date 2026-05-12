/**
 * StatChip — reusable compact stat card (icon + value + label + sub).
 * Used by the dashboard and share pages.
 */
import type { LucideIcon } from 'lucide-react';

export function StatChip({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-cyan-500',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  /** Tailwind text-* class for the icon. */
  color?: string;
}) {
  return (
    <div className="surface p-3 flex items-center gap-3">
      <Icon className={`size-5 ${color}`} />
      <div className="min-w-0">
        <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
      </div>
    </div>
  );
}

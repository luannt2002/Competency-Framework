'use client';

/**
 * Duolingo-style curved path of weeks.
 *
 * Layout: snake curve. Nodes positioned in alternating left/right offset along Y.
 * The SVG path is computed analytically from node coords with smooth cubic-bezier.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WeekNodeData = {
  id: string;
  weekIndex: number;
  title: string;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'mastered';
  href: string;
};

type Props = {
  weeks: WeekNodeData[];
  /** width of viewBox; height is computed */
  width?: number;
};

const NODE_R = 30;       // node radius
const VERT_GAP = 110;    // vertical spacing
const AMPLITUDE = 80;    // horizontal swing from center

export function CoursePath({ weeks, width = 360 }: Props) {
  const cx = width / 2;
  const height = VERT_GAP * weeks.length + NODE_R * 2 + 40;

  // Snake positions: alternating left/right via sine curve
  const positions = weeks.map((_, i) => {
    const angle = (i / Math.max(1, weeks.length - 1)) * Math.PI * 2;
    const offset = Math.sin(i * 0.9) * AMPLITUDE; // pseudo-snake
    return {
      x: cx + offset,
      y: 40 + i * VERT_GAP,
    };
  });

  // Build SVG path with cubic-bezier between consecutive nodes
  const d = positions.length
    ? positions.reduce((acc, p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        const prev = positions[i - 1]!;
        const midY = (prev.y + p.y) / 2;
        return `${acc} C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
      }, '')
    : '';

  return (
    <div className="relative mx-auto" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 pointer-events-none"
      >
        <defs>
          <linearGradient id="pathGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <path
          d={d}
          stroke="url(#pathGrad)"
          strokeWidth={4}
          fill="none"
          strokeDasharray="6 6"
          strokeLinecap="round"
        />
      </svg>

      {weeks.map((w, i) => {
        const p = positions[i];
        if (!p) return null;
        return <WeekNode key={w.id} data={w} x={p.x} y={p.y} />;
      })}
    </div>
  );
}

function WeekNode({ data, x, y }: { data: WeekNodeData; x: number; y: number }) {
  const locked = data.status === 'locked';
  const completed = data.status === 'completed';
  const mastered = data.status === 'mastered';
  const inProgress = data.status === 'in_progress';

  const baseClass = cn(
    'absolute flex items-center justify-center rounded-full border-2 transition-all',
    'shadow-lg',
    locked
      ? 'bg-secondary/60 border-border text-muted-foreground cursor-not-allowed'
      : completed || mastered
        ? 'bg-gradient-to-br from-emerald-400 to-cyan-500 border-emerald-300 text-white shadow-emerald-500/40'
        : inProgress
          ? 'bg-gradient-to-br from-cyan-400 to-violet-500 border-cyan-300 text-white shadow-cyan-500/50'
          : 'bg-card border-border hover:border-primary hover:shadow-cyan-500/30 text-foreground',
  );

  const size = NODE_R * 2;

  const content = (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
      }}
      transition={{ delay: data.weekIndex * 0.03, type: 'spring', stiffness: 200, damping: 18 }}
      whileHover={!locked ? { scale: 1.08 } : undefined}
      whileTap={!locked ? { scale: 0.95 } : undefined}
      className={baseClass}
      style={{
        width: size,
        height: size,
        left: x - NODE_R,
        top: y - NODE_R,
      }}
    >
      {/* Idle pulse for in-progress */}
      {inProgress && !locked && (
        <span className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-40" />
      )}

      {locked ? (
        <Lock className="size-4" />
      ) : mastered ? (
        <Sparkles className="size-5" />
      ) : completed ? (
        <CheckCircle2 className="size-5" />
      ) : (
        <span className="font-mono font-bold text-sm">{data.weekIndex}</span>
      )}

      {/* Mastered gold ring */}
      {mastered && (
        <span className="absolute -inset-1.5 rounded-full border-2 border-amber-300 opacity-80" />
      )}
    </motion.div>
  );

  // Label below node
  const label = (
    <div
      className="absolute text-center pointer-events-none"
      style={{
        left: x - 70,
        top: y + NODE_R + 4,
        width: 140,
      }}
    >
      <div
        className={cn(
          'text-[10px] font-mono uppercase tracking-wider',
          locked ? 'text-muted-foreground/50' : 'text-muted-foreground',
        )}
      >
        Week {data.weekIndex}
      </div>
      <div
        className={cn(
          'text-xs font-medium mt-0.5 line-clamp-1',
          locked ? 'text-muted-foreground/50' : 'text-foreground',
        )}
        title={data.title}
      >
        {data.title}
      </div>
    </div>
  );

  if (locked) {
    return (
      <>
        {content}
        {label}
      </>
    );
  }
  return (
    <>
      <Link href={data.href} className="absolute z-10" style={{ left: x - NODE_R, top: y - NODE_R }}>
        {content}
      </Link>
      {label}
    </>
  );
}

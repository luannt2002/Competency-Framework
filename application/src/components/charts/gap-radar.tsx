'use client';

/**
 * GapRadar — V8 "current vs required" radar for a target role.
 *
 * Two overlaid datasets:
 *  - `required` — what the role asks for (red dashed perimeter)
 *  - `current`  — what the user has today (cyan/violet gradient fill)
 *
 * Categories where `current < required` are highlighted by leaving the red
 * required perimeter visible above the cyan area — the visual "gap".
 */

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

export type GapRadarDatum = {
  category: string;
  /** 0..100 (mapped from competency_levels.numericValue) */
  current: number;
  /** 0..100 */
  required: number;
};

export function GapRadar({ data }: { data: GapRadarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
        />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(value: number, name) => [
            `${Math.round(value)}`,
            name === 'required' ? 'Required' : 'Current',
          ]}
        />
        <Legend
          iconSize={10}
          wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
        />
        {/* Required ring — red dashed perimeter highlights the gap. */}
        <Radar
          name="required"
          dataKey="required"
          stroke="#F87171"
          fill="#F87171"
          fillOpacity={0.08}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          isAnimationActive
        />
        {/* Current — gradient fill. */}
        <Radar
          name="current"
          dataKey="current"
          stroke="#22D3EE"
          fill="url(#gapRadarGrad)"
          fillOpacity={0.55}
          strokeWidth={1.5}
          isAnimationActive
        />
        <defs>
          <linearGradient id="gapRadarGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.3} />
          </linearGradient>
        </defs>
      </RadarChart>
    </ResponsiveContainer>
  );
}

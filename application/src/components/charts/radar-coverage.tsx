'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

export type RadarDatum = {
  category: string;
  current: number; // 0..100
  target: number; // typically 100
};

export function RadarCoverage({ data }: { data: RadarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
        />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Target"
          dataKey="target"
          stroke="hsl(var(--muted-foreground))"
          fill="transparent"
          strokeDasharray="3 3"
          strokeOpacity={0.4}
        />
        <Radar
          name="Current"
          dataKey="current"
          stroke="#22D3EE"
          fill="url(#radarGrad)"
          fillOpacity={0.5}
          isAnimationActive
        />
        <defs>
          <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.3} />
          </linearGradient>
        </defs>
      </RadarChart>
    </ResponsiveContainer>
  );
}

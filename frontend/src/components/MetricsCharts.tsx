"use client";

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

interface MetricsChartsProps {
  data: any[];
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0E1522',
  border: '1px solid rgba(100,116,139,0.3)',
  borderRadius: 3,
  padding: '8px 12px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
};

const TICK_STYLE = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  fill: 'rgba(148,163,184,0.5)',
};

// Generates simple demo seed data if empty
function getSeedData() {
  const seed: any[] = [];
  for (let i = 0; i < 30; i++) {
    seed.push({
      time: i * 2,
      avgSpeed: 72 + Math.sin(i * 0.4) * 8,
      density: 48 + Math.cos(i * 0.3) * 10,
      flow: 0,
      cvcc_active: 0,
    });
  }
  return seed;
}

export default function MetricsCharts({ data }: MetricsChartsProps) {
  const chartData = data.length > 0 ? data : getSeedData();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Speed Chart */}
      <div style={{ flex: 1, minHeight: 90 }}>
        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.15em', color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>
          AVG SPEED · KM/H
        </div>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(100,116,139,0.1)" />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={v => typeof v === 'number' ? v.toFixed(0) : ''}
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[0, 120]} tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={v => `t=${typeof v === 'number' ? v.toFixed(1) : v}s`}
              formatter={(v: any) => [`${Number(v).toFixed(1)} km/h`, 'Speed']}
              itemStyle={{ color: '#64FFDA', fontFamily: 'JetBrains Mono,monospace', fontSize: 10 }}
            />
            <ReferenceLine y={90} stroke="rgba(16,185,129,0.4)" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="avgSpeed"
              stroke="#64FFDA"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Density Chart */}
      <div style={{ flex: 1, minHeight: 90 }}>
        <div style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.15em', color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>
          DENSITY · VEH/KM
        </div>
        <ResponsiveContainer width="100%" height="80%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(100,116,139,0.1)" />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={v => typeof v === 'number' ? v.toFixed(0) : ''}
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[0, 120]} tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={v => `t=${typeof v === 'number' ? v.toFixed(1) : v}s`}
              formatter={(v: any) => [`${Number(v).toFixed(1)} veh/km`, 'Density']}
              itemStyle={{ color: '#F59E0B', fontFamily: 'JetBrains Mono,monospace', fontSize: 10 }}
            />
            <ReferenceLine y={60} stroke="rgba(239,68,68,0.4)" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="density"
              stroke="#F59E0B"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

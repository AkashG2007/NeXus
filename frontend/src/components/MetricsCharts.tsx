"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

export default function MetricsCharts({ data }: { data: any[] }) {
  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-gray-500">No telemetry data...</div>;
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex-1 min-h-[150px]">
        <h4 className="text-sm text-gray-400 mb-2 font-semibold tracking-wide">Average Highway Speed (km/h)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(tick) => typeof tick === 'number' ? tick.toFixed(1) : String(tick ?? '')} stroke="#9ca3af" />
            <YAxis domain={[0, 120]} stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelFormatter={(val) => `Time: ${typeof val === 'number' ? val.toFixed(1) : String(val ?? '')}s`}
            />
            <ReferenceLine y={108} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Target', fill: '#22c55e', position: 'insideTopLeft' }} />
            <Line type="monotone" dataKey="avgSpeed" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-1 min-h-[150px]">
        <h4 className="text-sm text-gray-400 mb-2 font-semibold tracking-wide">Maximum Segment Density (veh/km)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(tick) => typeof tick === 'number' ? tick.toFixed(1) : String(tick ?? '')} stroke="#9ca3af" />
            <YAxis domain={[0, 100]} stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelFormatter={(val) => `Time: ${typeof val === 'number' ? val.toFixed(1) : String(val ?? '')}s`}
            />
            <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Jam Threshold', fill: '#ef4444', position: 'insideTopLeft' }} />
            <Line type="monotone" dataKey="density" stroke="#f472b6" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

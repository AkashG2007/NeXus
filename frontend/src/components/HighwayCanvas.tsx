"use client";

import React, { useEffect, useRef } from 'react';

interface Vehicle {
  id: string;
  type: string;
  lane: number;
  position: number;
  velocity: number;
  acceleration: number;
  braking: boolean;
  color: string;
}

export default function HighwayCanvas({ vehicles }: { vehicles: Vehicle[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.78;
    const corridorLength = 1500.0;
    const roadWidth = 32;

    // 1. Draw Asphalt Road Ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = roadWidth + 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = roadWidth;
    ctx.stroke();

    // 2. Draw Dashed Road Center Line
    ctx.beginPath();
    ctx.setLineDash([8, 8]);
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // 3. Draw Zone Dividers & Labels (Zone A: 0-500m, Zone B: 500-1000m, Zone C: 1000-1500m)
    const zones = [
      { name: 'Zone A (Residential)', start: 0, end: 500, color: 'rgba(34, 197, 94, 0.12)' },
      { name: 'Zone B (Freeway)', start: 500, end: 1000, color: 'rgba(59, 130, 246, 0.12)' },
      { name: 'Zone C (Industrial)', start: 1000, end: 1500, color: 'rgba(234, 179, 8, 0.12)' },
    ];

    zones.forEach(zone => {
      const startAngle = (zone.start / corridorLength) * Math.PI * 2 - Math.PI / 2;
      const endAngle = (zone.end / corridorLength) * Math.PI * 2 - Math.PI / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 22, startAngle, endAngle);
      ctx.arc(centerX, centerY, radius - 22, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = zone.color;
      ctx.fill();
    });

    // 4. Draw Vehicles
    const colorMap: Record<string, string> = {
      gray: '#94a3b8',
      red: '#ef4444',
      blue: '#3b82f6',
      green: '#22c55e',
    };

    vehicles.forEach(v => {
      // Angle: 0 position is at top (-PI/2)
      const angle = (v.position / corridorLength) * Math.PI * 2 - Math.PI / 2;
      const laneOffset = v.lane === 1 ? 6 : -6;
      const r = radius + laneOffset;

      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2); // Align heading with tangent

      // Vehicle glow/shadow
      if (v.braking) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
      } else if (v.color === 'blue') {
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 6;
      }

      // Vehicle body
      let fill = colorMap[v.color] || '#94a3b8';
      if (v.braking) fill = '#f87171';

      ctx.fillStyle = fill;
      const carWidth = 7;
      const carLength = 14;

      // Rounded rect
      ctx.beginPath();
      ctx.roundRect(-carWidth / 2, -carLength / 2, carWidth, carLength, 2);
      ctx.fill();

      // Headlights / Brake lights
      if (v.braking) {
        // Red taillights
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-carWidth / 2 + 0.5, carLength / 2 - 2, 2, 2);
        ctx.fillRect(carWidth / 2 - 2.5, carLength / 2 - 2, 2, 2);
      } else {
        // White headlights
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-carWidth / 2 + 0.5, -carLength / 2, 2, 2);
        ctx.fillRect(carWidth / 2 - 2.5, -carLength / 2, 2, 2);
      }

      ctx.restore();
    });
  }, [vehicles]);

  return (
    <div ref={containerRef} id="canvas-container" className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}


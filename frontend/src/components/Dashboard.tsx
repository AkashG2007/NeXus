"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSimulation } from '../hooks/useSimulation';
import MetricsCharts from './MetricsCharts';

const CityMap = dynamic(() => import('./CityMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', background: '#05070A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(100,255,218,0.5)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, letterSpacing: '0.2em' }}>
        INITIALIZING LEAFLET ENGINE...
      </div>
    </div>
  ),
});

// ─── City presets ────────────────────────────────────────────────────────────
const CITIES = {
  bengaluru: { name: 'Bengaluru (Silk Board / ORR)', short: 'BLR · ORR', lat: 12.9172, lng: 77.6229, zoom: 15.5, pitch: 55, bearing: -20 },
  chennai:   { name: 'Chennai (OMR IT Corridor)',    short: 'MAA · OMR', lat: 12.9734, lng: 80.2284, zoom: 15.2, pitch: 52, bearing:  15 },
  mumbai:    { name: 'Mumbai (Western Exp Hwy)',     short: 'BOM · WEH', lat: 19.1136, lng: 72.8550, zoom: 15.4, pitch: 58, bearing: -30 },
  delhi:     { name: 'Delhi NCR (NH-48 / Cyber City)', short: 'DEL · NCR', lat: 28.4950, lng: 77.0888, zoom: 15.0, pitch: 50, bearing:   0 },
} as const;

type CityKey = keyof typeof CITIES;

const TABS = ['MAP', 'ECO-ZONES', 'FLEET TELEMETRY', 'ACTIVE DISRUPTIONS', 'AQI SENSORS'] as const;
type Tab = typeof TABS[number];

// ─── Icons (inline SVG to avoid extra deps) ──────────────────────────────────
const Icon = {
  Play:    () => <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>,
  Pause:   () => <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>,
  Reset:   () => <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/></svg>,
  Warn:    () => <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>,
  Shield:  () => <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4z"/></svg>,
  Cut:     () => <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/></svg>,
  Zap:     () => <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>,
  Signal:  () => <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>,
};

// ─── Confirmation Modal ───────────────────────────────────────────────────────
interface ConfirmModalProps {
  action: 'jam' | 'cutin' | null;
  cityShort: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ action, cityShort, onConfirm, onCancel }: ConfirmModalProps) {
  if (!action) return null;
  const isJam = action === 'jam';
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ color: '#EF4444', fontSize: 11, fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            ⚠ OPERATIONAL WARNING
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#CBD5E1', marginBottom: 20, lineHeight: 1.6 }}>
          This action will simulate a <strong style={{ color: '#EF4444' }}>{isJam ? 'PHANTOM JAM disruption' : 'ROGUE CUT-IN event'}</strong> in the live traffic corridor.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <div className="kpi-label" style={{ marginBottom: 4 }}>TARGET</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#64FFDA' }}>{cityShort}</div>
          </div>
          <div>
            <div className="kpi-label" style={{ marginBottom: 4 }}>SEVERITY</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#EF4444' }}>HIGH</div>
          </div>
          <div>
            <div className="kpi-label" style={{ marginBottom: 4 }}>EVENT TYPE</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#F59E0B' }}>{isJam ? 'SHOCKWAVE CHAIN' : 'FORCED MERGE'}</div>
          </div>
          <div>
            <div className="kpi-label" style={{ marginBottom: 4 }}>AFFECTED</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#F59E0B' }}>EST. 20-40 VEH</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-tactical neutral" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel}>CANCEL</button>
          <button className="btn-tactical danger" style={{ flex: 1, justifyContent: 'center' }} onClick={onConfirm}>CONFIRM</button>
        </div>
      </div>
    </div>
  );
}

// ─── Fleet Table ──────────────────────────────────────────────────────────────
function FleetTable({ vehicles }: { vehicles: any[] }) {
  const [search, setSearch] = useState('');
  const filtered = vehicles.filter(v => v.id?.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <input
        type="text"
        placeholder="Search vehicle ID..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(100,116,139,0.2)',
          color: '#CBD5E1', padding: '6px 10px', borderRadius: 3, marginBottom: 10,
          fontFamily: 'JetBrains Mono,monospace', fontSize: 11, outline: 'none',
        }}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['ID', 'TYPE', 'SPEED', 'STATUS'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 9, fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(148,163,184,0.5)', borderBottom: '1px solid rgba(100,116,139,0.15)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={v.id || i} style={{ borderBottom: '1px solid rgba(100,116,139,0.08)' }}>
                <td style={{ padding: '5px 8px', fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#64FFDA' }}>{v.id}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: v.type === 'cav' ? '#64FFDA' : '#94A3B8' }}>{(v.type || '').toUpperCase()}</td>
                <td style={{ padding: '5px 8px', fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#CBD5E1' }}>{((v.velocity || 0) * 3.6).toFixed(0)} km/h</td>
                <td style={{ padding: '5px 8px' }}>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, padding: '2px 6px', borderRadius: 2, background: v.braking ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)', color: v.braking ? '#EF4444' : '#10B981', letterSpacing: '0.1em' }}>
                    {v.braking ? 'BRAKE' : 'FLOW'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Incidents Panel ──────────────────────────────────────────────────────────
function IncidentPanel({ shockwaveActive, cityShort }: { shockwaveActive: boolean; cityShort: string }) {
  const incidents = shockwaveActive ? [
    { id: 'INC-2041', type: 'PHANTOM JAM', location: cityShort, severity: 'HIGH', time: new Date().toTimeString().slice(0, 8), vehicles: Math.floor(Math.random() * 20) + 20, status: 'ACTIVE' },
  ] : [];
  return (
    <div>
      {incidents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(148,163,184,0.3)', fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>
          NO ACTIVE INCIDENTS
        </div>
      ) : (
        incidents.map(inc => (
          <div key={inc.id} className="incident-card critical" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#64FFDA' }}>{inc.id}</span>
              <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, letterSpacing: '0.15em', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#EF4444', padding: '2px 8px', borderRadius: 2 }}>ACTIVE</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'TYPE', value: inc.type },
                { label: 'LOCATION', value: inc.location },
                { label: 'SEVERITY', value: inc.severity },
                { label: 'TIME', value: inc.time },
                { label: 'FLEET', value: `${inc.vehicles} VEH` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="kpi-label" style={{ marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#CBD5E1' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── AQI Panel ────────────────────────────────────────────────────────────────
function AQIPanel({ aqi }: { aqi: number }) {
  const sensors = [
    { id: 'S-BLR-01', location: 'Silk Board', aqi: aqi + 5, pm25: (aqi * 0.6).toFixed(1), status: aqi > 100 ? 'POOR' : 'MODERATE' },
    { id: 'S-BLR-02', location: 'Madivala', aqi: aqi - 10, pm25: ((aqi - 10) * 0.6).toFixed(1), status: 'GOOD' },
    { id: 'S-BLR-03', location: 'Koramangala', aqi: aqi + 15, pm25: ((aqi + 15) * 0.6).toFixed(1), status: aqi > 80 ? 'POOR' : 'MODERATE' },
    { id: 'S-BLR-04', location: 'HSR Layout', aqi: Math.max(30, aqi - 20), pm25: (Math.max(30, aqi - 20) * 0.6).toFixed(1), status: 'GOOD' },
  ];
  const getStatusColor = (s: string) => s === 'POOR' ? '#EF4444' : s === 'MODERATE' ? '#F59E0B' : '#10B981';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sensors.map(s => (
        <div key={s.id} className="panel" style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#64FFDA' }}>{s.id}</span>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, color: getStatusColor(s.status) }}>{s.status}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><div className="kpi-label" style={{ marginBottom: 2 }}>AQI</div><div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, color: getStatusColor(s.status) }}>{s.aqi.toFixed(0)}</div></div>
            <div><div className="kpi-label" style={{ marginBottom: 2 }}>PM2.5</div><div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, color: '#CBD5E1' }}>{s.pm25}</div></div>
            <div><div className="kpi-label" style={{ marginBottom: 2 }}>LOCATION</div><div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#94A3B8' }}>{s.location}</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Eco Zone Panel ───────────────────────────────────────────────────────────
function EcoZonePanel({ vehicles, totalCo2 }: { vehicles: any[]; totalCo2: number }) {
  const zones = [
    { id: 'EZ-01', name: 'Silk Board Junction', co2: (totalCo2 * 0.35 / 1200).toFixed(1), flow: 'OPTIMAL', aqi: 52, vehicles: Math.floor(vehicles.length * 0.3) },
    { id: 'EZ-02', name: 'Koramangala Stretch', co2: (totalCo2 * 0.25 / 1200).toFixed(1), flow: 'MODERATE', aqi: 78, vehicles: Math.floor(vehicles.length * 0.25) },
    { id: 'EZ-03', name: 'HSR-Madivala', co2: (totalCo2 * 0.4 / 1200).toFixed(1), flow: 'OPTIMAL', aqi: 41, vehicles: Math.floor(vehicles.length * 0.45) },
  ];
  const getFlowColor = (f: string) => f === 'OPTIMAL' ? '#10B981' : '#F59E0B';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {zones.map(z => (
        <div key={z.id} className="panel" style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: 'rgba(100,255,218,0.5)', display: 'block', marginBottom: 2 }}>{z.id}</span>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#CBD5E1' }}>{z.name}</span>
            </div>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, color: getFlowColor(z.flow), alignSelf: 'flex-start' }}>{z.flow}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div><div className="kpi-label" style={{ marginBottom: 2 }}>CO₂ SAVED</div><div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#10B981' }}>{z.co2} kg</div></div>
            <div><div className="kpi-label" style={{ marginBottom: 2 }}>AQI</div><div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#CBD5E1' }}>{z.aqi}</div></div>
            <div><div className="kpi-label" style={{ marginBottom: 2 }}>VEHICLES</div><div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#64FFDA' }}>{z.vehicles}</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeCityKey, setActiveCityKey] = useState<CityKey>('bengaluru');
  const [activeTab, setActiveTab] = useState<Tab>('MAP');
  const [isIsometric, setIsIsometric] = useState(true);
  const [confirmAction, setConfirmAction] = useState<'jam' | 'cutin' | null>(null);
  const [cavPenetration, setCavPenetration] = useState(5);
  const [speedLimit, setSpeedLimitValue] = useState(80);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);

  const city = CITIES[activeCityKey];

  const {
    isConnected, isFallbackMode, state: sim, logs,
    updateSettings, triggerJam, injectCutIn, setSpeedLimit,
  } = useSimulation(city);

  // Build metrics history for charts
  useEffect(() => {
    if (!sim.metrics) return;
    setMetricsHistory(prev => {
      const entry = {
        time: Number(sim.time.toFixed(1)),
        avgSpeed: Number(((sim.metrics.v_mean[0] || 0) * 3.6).toFixed(1)),
        density: Number((sim.metrics.density[0] || 0).toFixed(1)),
        flow: Number((sim.metrics.flow || 0).toFixed(0)),
        cvcc_active: sim.cvcc_enabled ? 1 : 0,
      };
      return [...prev, entry].slice(-120);
    });
  }, [sim.time]);

  const shockwaveActive = sim.metrics?.shockwave_detected ?? false;
  const cvccEnabled = sim.cvcc_enabled;
  const avgSpeedKmh = ((sim.metrics?.v_mean[0] || 0) * 3.6);
  const totalVehicles = sim.vehicles?.length || 0;
  const cavVehicles = sim.vehicles?.filter((v: any) => v.type === 'cav').length || 0;
  const co2Saved = ((sim.metrics?.total_co2 || 0) / 1200).toFixed(1);
  const aqi = sim.metrics?.aqi || 45;
  const ecoScore = shockwaveActive ? 32 : cvccEnabled ? 94 : 68;

  const handleCavChange = useCallback((val: number) => {
    setCavPenetration(val);
    updateSettings(cvccEnabled, val);
  }, [cvccEnabled, updateSettings]);

  const handleSpeedChange = useCallback((val: number) => {
    setSpeedLimitValue(val);
    setSpeedLimit(val);
  }, [setSpeedLimit]);

  const handleConfirmAction = useCallback(() => {
    if (confirmAction === 'jam') triggerJam();
    if (confirmAction === 'cutin') injectCutIn();
    setConfirmAction(null);
  }, [confirmAction, triggerJam, injectCutIn]);

  // Connection status
  const uplinkLabel = isConnected ? 'LIVE' : isFallbackMode ? 'SIMULATOR' : 'OFFLINE';
  const uplinkColor = isConnected ? '#10B981' : isFallbackMode ? '#F59E0B' : '#EF4444';
  const uplinkDotClass = isConnected ? 'live' : isFallbackMode ? 'sim' : 'offline';

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#05070A',
      color: '#CBD5E1',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── CONFIRM MODAL ──────────────────────────────── */}
      <ConfirmModal
        action={confirmAction}
        cityShort={city.short}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />

      {/* ── TOP NAV ────────────────────────────────────── */}
      <header style={{
        height: 48,
        flexShrink: 0,
        background: 'rgba(11,17,27,0.96)',
        borderBottom: '1px solid rgba(100,255,218,0.07)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 20,
        zIndex: 50,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: 'rgba(100,255,218,0.08)', border: '1px solid rgba(100,255,218,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 12, height: 12, background: '#64FFDA', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '0.25em', color: '#64FFDA', lineHeight: 1 }}>TRINETRA OS</div>
            <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 8, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.2em' }}>TACTICAL DIGITAL TWIN</div>
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 28, background: 'rgba(100,116,139,0.2)', flexShrink: 0 }} />

        {/* Tabs */}
        <nav style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', outline: 'none' }}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* Status indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {/* Shockwave alert */}
          {shockwaveActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '3px 10px', borderRadius: 3 }}>
              <span className="status-dot shockwave-alert" style={{ background: '#EF4444', boxShadow: '0 0 8px #EF4444' }} />
              <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#EF4444' }}>SHOCKWAVE DETECTED</span>
            </div>
          )}

          {/* City selector */}
          <select
            value={activeCityKey}
            onChange={e => setActiveCityKey(e.target.value as CityKey)}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(100,116,139,0.2)',
              color: '#94A3B8', padding: '4px 8px', borderRadius: 3,
              fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.1em', outline: 'none', cursor: 'pointer',
            }}
          >
            {Object.entries(CITIES).map(([k, c]) => (
              <option key={k} value={k} style={{ background: '#0B111B' }}>{c.name}</option>
            ))}
          </select>

          {/* Uplink status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`status-dot ${uplinkDotClass}`} />
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: uplinkColor, letterSpacing: '0.1em' }}>UPLINK: {uplinkLabel}</span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ── MAP (fullscreen behind panels) ── */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {(activeTab === 'MAP' || activeTab === 'ECO-ZONES' || activeTab === 'AQI SENSORS') && (
            <CityMap
              zones={sim.zones || []}
              vehicles={sim.vehicles || []}
              cityCoords={city}
              isIsometric={isIsometric}
              activeTab={activeTab}
              onToggleView={() => setIsIsometric(p => !p)}
            />
          )}
          {(activeTab === 'FLEET TELEMETRY' || activeTab === 'ACTIVE DISRUPTIONS') && (
            <div style={{ width: '100%', height: '100%', background: '#05070A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: 'rgba(100,255,218,0.06)', fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 64, letterSpacing: '0.3em', textTransform: 'uppercase', userSelect: 'none' }}>
                TRINETRA OS
              </div>
            </div>
          )}
        </div>

        {/* ── LEFT PANEL ── */}
        <div style={{
          position: 'relative', zIndex: 10,
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '10px 0 10px 10px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>

          {/* District Inspector */}
          <div className="panel" style={{ padding: '12px 14px', backdropFilter: 'blur(20px)', background: 'rgba(11,17,27,0.88)' }}>
            <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>■</span> DISTRICT INSPECTOR
            </div>
            <div style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 16, color: '#CBD5E1', marginBottom: 12, letterSpacing: '0.05em' }}>
              {city.short}
            </div>

            {/* Eco score bar */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="kpi-label">ECO-EFFICIENCY</span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: ecoScore > 70 ? '#10B981' : ecoScore > 40 ? '#F59E0B' : '#EF4444' }}>{ecoScore}%</span>
              </div>
              <div style={{ height: 3, background: 'rgba(100,116,139,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${ecoScore}%`, background: ecoScore > 70 ? '#10B981' : ecoScore > 40 ? '#F59E0B' : '#EF4444', borderRadius: 2, transition: 'width 1s ease' }} />
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'FLEET', value: totalVehicles.toString(), color: '#64FFDA' },
                { label: 'CAV UNITS', value: cavVehicles.toString(), color: '#64FFDA' },
                { label: 'INCIDENTS', value: shockwaveActive ? '1' : '0', color: shockwaveActive ? '#EF4444' : '#10B981' },
                { label: 'AQI', value: aqi.toFixed(0), color: aqi > 100 ? '#EF4444' : aqi > 60 ? '#F59E0B' : '#10B981' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,116,139,0.1)', borderRadius: 3, padding: '8px 10px' }}>
                  <div className="kpi-label" style={{ marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 16, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Controls */}
          <div className="panel" style={{ padding: '12px 14px', backdropFilter: 'blur(20px)', background: 'rgba(11,17,27,0.88)' }}>
            <div className="panel-header">⚙ OPERATIONAL CONTROLS</div>

            {/* Speed Limit */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="kpi-label">SPEED LIMIT</span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#64FFDA' }}>{speedLimit} KM/H</span>
              </div>
              <input
                type="range" min={40} max={120} step={10} value={speedLimit}
                onChange={e => handleSpeedChange(Number(e.target.value))}
              />
            </div>

            {/* CAV Penetration */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="kpi-label">CAV PENETRATION</span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#64FFDA' }}>{cavPenetration}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={cavPenetration}
                onChange={e => handleCavChange(Number(e.target.value))}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="btn-tactical danger" onClick={() => setConfirmAction('jam')} style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column', height: 48, gap: 4 }}>
                  <Icon.Warn /> <span style={{ fontSize: 9 }}>PHANTOM JAM</span>
                </button>
                <button className="btn-tactical warning" onClick={() => setConfirmAction('cutin')} style={{ justifyContent: 'center', textAlign: 'center', flexDirection: 'column', height: 48, gap: 4 }}>
                  <Icon.Cut /> <span style={{ fontSize: 9 }}>INJECT CUT-IN</span>
                </button>
              </div>
              <button
                className={`btn-tactical ${cvccEnabled ? 'success' : 'neutral'}`}
                onClick={() => updateSettings(!cvccEnabled, cavPenetration)}
                style={{ justifyContent: 'center', width: '100%' }}
              >
                <Icon.Shield /> {cvccEnabled ? 'SHOCKWAVE MITIGATION: ON' : 'MITIGATE SHOCKWAVE'}
              </button>
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="panel" style={{ padding: '12px 14px', backdropFilter: 'blur(20px)', background: 'rgba(11,17,27,0.88)' }}>
            <div className="panel-header">▶ SIMULATION</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <button className="btn-tactical primary" style={{ justifyContent: 'center', flexDirection: 'column', height: 42, gap: 4, fontSize: 9 }}>
                <Icon.Play /> START
              </button>
              <button className="btn-tactical neutral" style={{ justifyContent: 'center', flexDirection: 'column', height: 42, gap: 4, fontSize: 9 }}>
                <Icon.Pause /> PAUSE
              </button>
              <button className="btn-tactical neutral" onClick={() => setMetricsHistory([])} style={{ justifyContent: 'center', flexDirection: 'column', height: 42, gap: 4, fontSize: 9 }}>
                <Icon.Reset /> RESET
              </button>
            </div>
          </div>

          {/* City-wide KPIs */}
          <div className="panel" style={{ padding: '12px 14px', backdropFilter: 'blur(20px)', background: 'rgba(11,17,27,0.88)' }}>
            <div className="panel-header">◈ CITY-WIDE INDEX</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'CO₂ AVOIDED', value: `${co2Saved} kg`, color: '#10B981' },
                { label: 'AVG SPEED', value: `${avgSpeedKmh.toFixed(1)} km/h`, color: '#64FFDA' },
                { label: 'FLOW RATE', value: `${(sim.metrics?.flow || 0).toFixed(0)} veh/hr`, color: '#64FFDA' },
                { label: 'NETWORK', value: shockwaveActive ? 'CRITICAL' : 'OPTIMAL', color: shockwaveActive ? '#EF4444' : '#10B981' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 3 }}>
                  <span className="kpi-label">{label}</span>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER (content for non-MAP tabs) ── */}
        {(activeTab === 'FLEET TELEMETRY' || activeTab === 'ACTIVE DISRUPTIONS' || activeTab === 'ECO-ZONES' || activeTab === 'AQI SENSORS') && (
          <div style={{
            position: 'relative', zIndex: 10,
            flex: 1, margin: '10px', overflowY: 'auto',
            background: 'rgba(11,17,27,0.92)',
            border: '1px solid rgba(100,116,139,0.12)',
            borderRadius: 4,
            padding: '16px 18px',
            backdropFilter: 'blur(20px)',
          }}>
            <div className="panel-header" style={{ fontSize: 11, marginBottom: 16 }}>
              {activeTab === 'FLEET TELEMETRY' && '⊞ FLEET TELEMETRY — ALL VEHICLES'}
              {activeTab === 'ACTIVE DISRUPTIONS' && '⚠ ACTIVE DISRUPTIONS'}
              {activeTab === 'ECO-ZONES' && '◉ ECO-ZONE STATUS'}
              {activeTab === 'AQI SENSORS' && '◈ AQI SENSOR NETWORK'}
            </div>
            {activeTab === 'FLEET TELEMETRY' && <FleetTable vehicles={sim.vehicles || []} />}
            {activeTab === 'ACTIVE DISRUPTIONS' && <IncidentPanel shockwaveActive={shockwaveActive} cityShort={city.short} />}
            {activeTab === 'ECO-ZONES' && <EcoZonePanel vehicles={sim.vehicles || []} totalCo2={sim.metrics?.total_co2 || 0} />}
            {activeTab === 'AQI SENSORS' && <AQIPanel aqi={aqi} />}
          </div>
        )}

        {/* ── RIGHT PANEL ── */}
        <div style={{
          position: 'relative', zIndex: 10,
          width: 300,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '10px 10px 10px 0',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>

          {/* Status Banner */}
          <div className="panel" style={{
            padding: '12px 14px',
            backdropFilter: 'blur(20px)',
            background: shockwaveActive ? 'rgba(239,68,68,0.08)' : 'rgba(11,17,27,0.88)',
            borderColor: shockwaveActive ? 'rgba(239,68,68,0.3)' : undefined,
            transition: 'all 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', color: shockwaveActive ? '#EF4444' : 'rgba(16,185,129,0.7)', marginBottom: 4, textTransform: 'uppercase' }}>
                  {shockwaveActive ? 'CRITICAL DISRUPTION' : 'NETWORK STATUS'}
                </div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 600, color: '#CBD5E1' }}>
                  {shockwaveActive ? 'PHANTOM SHOCKWAVE DETECTED' : 'LAMINAR FLOW MAINTAINED'}
                </div>
              </div>
              {shockwaveActive && (
                <div style={{ textAlign: 'right' }}>
                  <div className="kpi-label" style={{ marginBottom: 2 }}>V-TARGET</div>
                  <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 18, fontWeight: 600, color: '#EF4444' }}>
                    {sim.metrics?.v_target_advisory ?? '--'} <span style={{ fontSize: 10 }}>km/h</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Telemetry Charts */}
          <div className="panel" style={{ padding: '12px 14px', backdropFilter: 'blur(20px)', background: 'rgba(11,17,27,0.88)', flex: 'none', height: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="panel-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>◈ REAL-TIME TELEMETRY</div>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, fontWeight: 600, color: '#64FFDA' }}>
                {avgSpeedKmh.toFixed(1)} <span style={{ fontSize: 9, color: 'rgba(100,255,218,0.6)' }}>km/h</span>
              </div>
            </div>
            <div style={{ height: 'calc(100% - 32px)' }}>
              <MetricsCharts data={metricsHistory} />
            </div>
          </div>

          {/* KPI Cards */}
          <div className="panel" style={{ padding: '12px 14px', backdropFilter: 'blur(20px)', background: 'rgba(11,17,27,0.88)' }}>
            <div className="panel-header">◆ OPERATIONAL KPIs</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'HARM. SPEED', value: `${avgSpeedKmh.toFixed(1)}`, unit: 'km/h', color: '#64FFDA' },
                { label: 'DENSITY', value: `${(sim.metrics?.density[0] || 0).toFixed(0)}`, unit: 'veh/km', color: '#64FFDA' },
                { label: 'PM2.5 IDX', value: aqi.toFixed(0), unit: 'AQI', color: aqi > 100 ? '#EF4444' : '#F59E0B' },
                { label: 'CAV RATIO', value: totalVehicles > 0 ? `${((cavVehicles / totalVehicles) * 100).toFixed(0)}` : '0', unit: '%', color: '#10B981' },
              ].map(({ label, value, unit, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(100,116,139,0.1)', borderRadius: 3, padding: '8px 10px' }}>
                  <div className="kpi-label" style={{ marginBottom: 4 }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 18, fontWeight: 600, color, lineHeight: 1 }}>{value}</span>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 9, color: 'rgba(148,163,184,0.5)' }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Logs */}
          <div className="panel" style={{ padding: '12px 14px', backdropFilter: 'blur(20px)', background: 'rgba(11,17,27,0.88)', flex: 1, minHeight: 150, display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon.Signal /> SYSTEM LOGS
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {logs.length === 0 ? (
                <div style={{ color: 'rgba(148,163,184,0.3)', fontFamily: 'JetBrains Mono,monospace', fontSize: 10, paddingTop: 8 }}>Awaiting events...</div>
              ) : (
                logs.map((log, i) => {
                  let cls = 'log-line';
                  if (log.includes('[WARN]') || log.includes('[ALERT]')) cls += ' warn';
                  else if (log.includes('[ERROR]')) cls += ' error';
                  else if (log.includes('[UPLINK]') || log.includes('[FLEET]')) cls += ' info';
                  else if (log.includes('dampened') || log.includes('[SYS]')) cls += ' success';
                  return <div key={i} className={cls}>{log}</div>;
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

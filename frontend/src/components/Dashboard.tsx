"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Activity, CloudFog, Factory, MapPin, Radio, ShieldAlert, Cpu, Zap, ActivitySquare } from 'lucide-react';
import MetricsCharts from './MetricsCharts';
import dynamic from 'next/dynamic';

const CityMap3D = dynamic(() => import('./CityMap3D'), { ssr: false });

const WS_URL = 'ws://localhost:8000/ws';
const API_URL = 'http://localhost:8000/api';

const CITIES = {
  bengaluru: { name: 'Bengaluru (Silk Board / ORR)', short: 'BLR - ORR', lat: 12.9172, lng: 77.6228 },
  chennai: { name: 'Chennai (OMR IT Corridor)', short: 'MAA - OMR', lat: 12.9712, lng: 80.2459 },
  mumbai: { name: 'Mumbai (Western Exp Hwy)', short: 'BOM - WEH', lat: 19.0833, lng: 72.8490 },
  delhi: { name: 'Delhi NCR (Cyber City)', short: 'DEL - NCR', lat: 28.4950, lng: 77.0895 }
};

export default function Dashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [simulationState, setSimulationState] = useState<any>(null);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  
  const [cvccEnabled, setCvccEnabled] = useState(false);
  const [cavPenetration, setCavPenetration] = useState(5);
  const [speedLimit, setSpeedLimit] = useState(80);
  const [activeCity, setActiveCity] = useState<keyof typeof CITIES>('bengaluru');
  const [isIsometric, setIsIsometric] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isSubscribed = true;

    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isSubscribed) setIsConnected(true);
        };

        ws.onclose = () => {
          if (isSubscribed) {
            setIsConnected(false);
            timeoutId = setTimeout(connect, 2000);
          }
        };

        ws.onerror = () => {
          if (isSubscribed) setIsConnected(false);
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data);
            setSimulationState(data);
            if (data?.zones) setZones(data.zones);

            if (data?.metrics && Array.isArray(data.metrics.v_mean) && data.metrics.v_mean.length > 0) {
              const avgSpeedVal = (data.metrics.v_mean.reduce((a: number, b: number) => a + b, 0) / data.metrics.v_mean.length) * 3.6;
              const maxDensityVal = Array.isArray(data.metrics.density) && data.metrics.density.length > 0
                ? data.metrics.density.reduce((a: number, b: number) => Math.max(a, b), 0)
                : 0;

              setMetricsHistory(prev => {
                const newHistory = [...prev, {
                  time: Number(data.time?.toFixed(1) || 0),
                  avgSpeed: Number(avgSpeedVal.toFixed(1)),
                  density: Number(maxDensityVal.toFixed(1)),
                  cvcc_active: data.cvcc_enabled ? 1 : 0
                }];
                return newHistory.slice(-100);
              });
            }
          } catch {
            // Ignore parse errors
          }
        };
      } catch {
        if (isSubscribed) {
          setIsConnected(false);
          timeoutId = setTimeout(connect, 2000);
        }
      }
    };

    connect();

    return () => {
      isSubscribed = false;
      clearTimeout(timeoutId);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleStart = async () => { try { await fetch(`${API_URL}/start`, { method: 'POST' }); } catch (err) {} };
  const handlePause = async () => { try { await fetch(`${API_URL}/pause`, { method: 'POST' }); } catch (err) {} };
  const handleReset = async () => {
    setMetricsHistory([]);
    try { await fetch(`${API_URL}/reset`, { method: 'POST' }); } catch (err) {}
  };

  const handleAnomaly = async () => { try { await fetch(`${API_URL}/anomaly`, { method: 'POST' }); } catch (err) {} };
  
  const updateSettings = async (cvcc: boolean, penetration: number) => {
    setCvccEnabled(cvcc);
    setCavPenetration(penetration);
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvcc_enabled: cvcc, cav_penetration: penetration / 100.0 })
      });
    } catch (err) {}
  };

  const shockwaveActive = simulationState?.metrics?.shockwave_detected;
  const ecoScore = shockwaveActive ? 32 : (cvccEnabled ? 94 : 68);
  const totalVehicles = simulationState?.vehicles?.length || 0;
  const activeDampers = Math.floor(totalVehicles * (cavPenetration / 100));
  const hotspots = zones.filter(z => z.color === 'Red' || z.color === 'Purple').length;
  
  return (
    <div className="relative w-full h-screen bg-[#0e0e0e] text-slate-100 font-inter overflow-hidden selection:bg-[#00f0ff] selection:text-black">
      
      {/* FULLSCREEN BACKGROUND 3D MAP */}
      <div className="absolute inset-0 z-0">
        <CityMap3D 
          zones={zones} 
          vehicles={simulationState?.vehicles || []} 
          cityCoords={CITIES[activeCity]} 
          isIsometric={isIsometric}
          onToggleView={() => setIsIsometric(!isIsometric)}
        />
      </div>
      
      {/* CSS Scanlines Overlay - more subtle now */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.2) 1px, transparent 1px)', backgroundSize: '100% 4px' }} />
      <div className="pointer-events-none absolute inset-0 z-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />

      {/* TOP HUD NAVIGATION BAR */}
      <header className="absolute top-0 left-0 right-0 h-16 z-20 flex justify-between items-center px-8 bg-black/40 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          <ActivitySquare className="w-7 h-7 text-[#00f0ff] filter drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
          <div className="flex flex-col">
            <h1 className="text-xl font-rajdhani font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#10b981]">
              TRINETRA OS
            </h1>
            <p className="text-[10px] text-slate-400 tracking-[0.2em] font-rajdhani uppercase">Tactical Digital Twin</p>
          </div>
        </div>
        
        {/* Exact Prompt Tabs */}
        <div className="hidden md:flex gap-8 text-[11px] font-rajdhani font-bold tracking-widest text-slate-400 uppercase">
          <span className="text-[#00f0ff] border-b-2 border-[#00f0ff] pb-1 cursor-pointer">MAP</span>
          <span className="hover:text-slate-200 transition-colors pb-1 cursor-pointer">ECO-ZONES</span>
          <span className="hover:text-slate-200 transition-colors pb-1 cursor-pointer">FLEET TELEMETRY</span>
          <span className="hover:text-slate-200 transition-colors pb-1 cursor-pointer">ACTIVE DISRUPTIONS</span>
          <span className="hover:text-slate-200 transition-colors pb-1 cursor-pointer">AQI SENSORS</span>
        </div>

        <div className="flex items-center gap-6">
          <select 
            value={activeCity}
            onChange={(e) => setActiveCity(e.target.value as keyof typeof CITIES)}
            className="bg-slate-900/50 border border-slate-700/50 text-slate-200 text-[11px] py-2 px-4 rounded-md outline-none focus:border-[#00f0ff] appearance-none cursor-pointer uppercase tracking-wider font-rajdhani font-semibold backdrop-blur-md transition-colors hover:bg-slate-800/50"
          >
            {Object.entries(CITIES).map(([key, city]) => (
              <option key={key} value={key} className="bg-slate-900">{city.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isConnected ? 'text-[#10b981] animate-pulse' : 'text-[#ff0055]'}`} />
            <span className="text-[10px] font-rajdhani tracking-[0.15em] text-slate-400 font-bold">{isConnected ? 'UPLINK: ACTIVE' : 'UPLINK: OFFLINE'}</span>
          </div>
        </div>
      </header>

      {/* LEFT COLUMN - SCROLLABLE CONTAINER */}
      <div className="absolute top-20 left-6 z-20 w-[340px] flex flex-col gap-4 max-h-[calc(100vh-100px)] overflow-y-auto pb-6 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        
        {/* District Inspector */}
        <div className="bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 p-6 rounded-xl shadow-2xl">
          <div className="text-[11px] text-[#00f0ff]/80 font-rajdhani font-bold tracking-[0.2em] mb-2 uppercase">District Inspector</div>
          <div className="text-2xl font-rajdhani font-bold text-white flex items-center gap-2 mb-6 tracking-wide">
            <MapPin className="w-5 h-5 text-[#00f0ff]" /> {CITIES[activeCity].short}
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-[11px] mb-2 font-rajdhani font-bold uppercase tracking-wider">
              <span className="text-slate-400">ECO-EFFICIENCY</span>
              <span className="text-[#00f0ff] drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]">{ecoScore}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 shadow-[0_0_10px_currentColor] rounded-full ${ecoScore > 80 ? 'bg-[#10b981] text-[#10b981]' : ecoScore > 50 ? 'bg-amber-400 text-amber-400' : 'bg-[#ff0055] text-[#ff0055]'}`} 
                style={{ width: `${ecoScore}%` }}
              />
            </div>
          </div>

          <div className="space-y-2 text-xs font-inter">
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
              <span className="text-slate-300">Active CAV Dampers</span>
              <span className="text-[#00f0ff] font-semibold">[{activeDampers}/{totalVehicles}]</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
              <span className="text-slate-300">AQI Hotspots Resolved</span>
              <span className={`font-semibold ${hotspots > 0 ? 'text-[#ff0055]' : 'text-[#10b981]'}`}>[{4 - hotspots}/4]</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
              <span className="text-slate-300">Shockwaves Detected</span>
              <span className={`font-semibold ${shockwaveActive ? 'text-[#ff0055]' : 'text-slate-400'}`}>[{shockwaveActive ? 1 : 0}/2]</span>
            </div>
          </div>
        </div>

        {/* Tactical Overrides */}
        <div className="bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 p-6 rounded-xl shadow-2xl">
          <h2 className="text-[11px] text-[#00f0ff]/80 font-rajdhani font-bold tracking-[0.2em] mb-6 flex items-center gap-2 uppercase">
            <Cpu className="w-4 h-4" /> TACTICAL OVERRIDES
          </h2>

          <div className="mb-6">
            <div className="flex justify-between text-[10px] mb-2 text-slate-400 font-rajdhani font-bold uppercase tracking-widest">
              <span>CAV PENETRATION</span>
              <span className="text-[#00f0ff]">{cavPenetration}%</span>
            </div>
            <input 
              type="range" min="0" max="100" value={cavPenetration}
              onChange={(e) => updateSettings(cvccEnabled, parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
            />
          </div>

          <div className="mb-8">
            <div className="flex justify-between text-[10px] mb-2 text-slate-400 font-rajdhani font-bold uppercase tracking-widest">
              <span>SPEED LIMIT OVERRIDE</span>
              <span className="text-emerald-400">{speedLimit} km/h</span>
            </div>
            <input 
              type="range" min="40" max="120" step="10" value={speedLimit}
              onChange={(e) => setSpeedLimit(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div className="space-y-3 mb-6">
            <button 
              onClick={handleAnomaly} 
              className="w-full flex items-center justify-center gap-2 bg-[#ff0055]/10 hover:bg-[#ff0055]/20 border border-[#ff0055]/50 text-[#ff0055] py-3 rounded-lg transition-all text-xs font-rajdhani font-bold tracking-[0.15em] shadow-[0_0_15px_rgba(255,0,85,0.15)] hover:shadow-[0_0_25px_rgba(255,0,85,0.4)]"
            >
              <AlertTriangle className="w-4 h-4" /> TRIGGER PHANTOM JAM
            </button>
            
            <button 
              onClick={() => updateSettings(!cvccEnabled, cavPenetration)} 
              className={`w-full flex items-center justify-center gap-2 border py-3 rounded-lg transition-all text-xs font-rajdhani font-bold tracking-[0.15em] ${
                cvccEnabled 
                  ? 'bg-[#10b981]/10 border-[#10b981]/50 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]' 
                  : 'bg-black/40 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4" /> {cvccEnabled ? 'SHOCKWAVE MITIGATED' : 'MITIGATE SHOCKWAVE'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleStart} className="flex flex-col items-center justify-center gap-1.5 bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 p-3 rounded-lg transition-colors text-[10px] font-rajdhani font-bold tracking-widest uppercase">
              <Play className="w-3.5 h-3.5" /> START
            </button>
            <button onClick={handlePause} className="flex flex-col items-center justify-center gap-1.5 bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 p-3 rounded-lg transition-colors text-[10px] font-rajdhani font-bold tracking-widest uppercase">
              <Pause className="w-3.5 h-3.5" /> PAUSE
            </button>
            <button onClick={handleReset} className="flex flex-col items-center justify-center gap-1.5 bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 p-3 rounded-lg transition-colors text-[10px] font-rajdhani font-bold tracking-widest uppercase">
              <RotateCcw className="w-3.5 h-3.5" /> RESET
            </button>
          </div>
        </div>

        {/* City-Wide Index (Now smoothly flowing in the scroll container, no overlap) */}
        <div className="bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 p-6 rounded-xl shadow-2xl">
          <div className="text-[11px] text-cyan-500/80 font-rajdhani font-bold tracking-[0.2em] mb-4 uppercase">City-Wide Index</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <div className="text-[9px] text-slate-400 font-rajdhani font-bold tracking-widest mb-1">TOTAL CO2 AVOIDED</div>
              <div className="text-2xl font-bold font-inter text-[#10b981] drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">
                {simulationState?.metrics?.total_co2 ? (simulationState.metrics.total_co2 / 1200).toFixed(1) : '0.0'} <span className="text-xs text-emerald-800">kg</span>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/5">
              <div className="text-[9px] text-slate-400 font-rajdhani font-bold tracking-widest mb-1">TOTAL FLEET SIZE</div>
              <div className="text-2xl font-bold font-inter text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">
                {totalVehicles} <span className="text-xs text-cyan-800">veh</span>
              </div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex justify-between text-[10px] mb-2 font-rajdhani font-bold text-slate-400 uppercase tracking-widest">
              <span>LAMINAR FLOW PROGRESS</span>
              <span className={shockwaveActive ? "text-[#ff0055]" : "text-[#10b981]"}>{shockwaveActive ? "CRITICAL" : "OPTIMAL"}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-1000 rounded-full ${shockwaveActive ? "bg-[#ff0055] w-[20%]" : "bg-[#10b981] w-[95%]"}`} />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - SCROLLABLE CONTAINER */}
      <div className="absolute top-20 right-6 z-20 w-[420px] flex flex-col gap-4 max-h-[calc(100vh-100px)] overflow-y-auto pb-6 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        
        {/* Dynamic Alert Banner */}
        <div className={`p-5 rounded-xl border backdrop-blur-xl transition-all duration-500 shadow-2xl flex items-center justify-between ${
          shockwaveActive 
            ? 'bg-[#ff0055]/10 border-[#ff0055]/50 shadow-[0_0_30px_rgba(255,0,85,0.15)]' 
            : 'bg-[#0f172a]/70 border-white/10'
        }`}>
          <div className="flex items-center gap-4">
            {shockwaveActive ? <ShieldAlert className="w-10 h-10 text-[#ff0055] animate-pulse" /> : <Activity className="w-10 h-10 text-[#10b981]" />}
            <div>
              <div className={`text-[10px] font-rajdhani font-bold tracking-[0.2em] mb-1 uppercase ${shockwaveActive ? 'text-[#ff0055]' : 'text-emerald-500/80'}`}>
                {shockwaveActive ? 'CRITICAL DISRUPTION' : 'NETWORK STATUS'}
              </div>
              <div className="text-sm font-inter font-bold text-white tracking-wide">
                {shockwaveActive ? 'PHANTOM SHOCKWAVE DETECTED' : 'LAMINAR FLOW MAINTAINED'}
              </div>
            </div>
          </div>
          {shockwaveActive && simulationState.metrics?.v_target_advisory && (
            <div className="text-right pl-4 border-l border-[#ff0055]/20">
              <div className="text-[9px] font-rajdhani font-bold text-[#ff0055] tracking-widest uppercase">V-TARGET</div>
              <div className="text-2xl font-inter font-black text-white drop-shadow-[0_0_8px_rgba(255,0,85,0.8)]">
                {simulationState.metrics.v_target_advisory}
              </div>
            </div>
          )}
        </div>

        {/* Charts Panel */}
        <div className="bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 p-6 rounded-xl shadow-2xl h-[420px] flex flex-col">
          <div className="text-[11px] text-cyan-500/80 font-rajdhani font-bold tracking-[0.2em] mb-6 uppercase">Real-Time Telemetry</div>
          <div className="flex-1 min-h-0">
            <MetricsCharts data={metricsHistory} />
          </div>
        </div>
        
      </div>

    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Vehicle } from '../hooks/useSimulation';
import { Camera, RefreshCw } from 'lucide-react';

interface CityMapProps {
  zones: any[];
  vehicles: Vehicle[];
  cityCoords: {
    lat: number;
    lng: number;
    name: string;
    short?: string;
    zoom?: number;
  };
  isIsometric: boolean;
  activeTab: string;
  onToggleView: () => void;
}

const RADIUS = 0.005; // ~500m

// Custom DivIcons
const getVehicleIcon = (v: Vehicle) => {
  const statusClass = v.braking ? 'veh-marker-crit' : (v.type === 'cav' ? 'veh-marker-normal' : 'veh-marker-warn');
  return L.divIcon({
    className: `veh-marker ${statusClass}`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
};

const getAqiIcon = (color: string, label: string) => {
  let cls = 'aqi-good';
  if (color === '#F59E0B') cls = 'aqi-mod';
  if (color === '#EF4444') cls = 'aqi-bad';
  
  return L.divIcon({
    className: `aqi-marker ${cls}`,
    html: `<span style="color:#000;">${label}</span>`,
    iconSize: [40, 16],
    iconAnchor: [20, 8],
  });
};

const getTransitHubIcon = () => {
  return L.divIcon({
    className: `aqi-marker aqi-mod`,
    html: `<span style="color:#000;">HUB</span>`,
    iconSize: [30, 16],
    iconAnchor: [15, 8],
  });
};

// Component to handle programmatic map moves
function MapController({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

export default function CityMap({ zones, vehicles, cityCoords, isIsometric, activeTab, onToggleView }: CityMapProps) {
  const [mapError, setMapError] = useState<string | null>(null);

  const center: [number, number] = [cityCoords.lat, cityCoords.lng];
  const zoom = cityCoords.zoom || 15.5;

  // ─── Vehicle Positions ───────────────────────────────────────────────────────
  const vehicleMarkers = useMemo(() => {
    return vehicles.map(v => {
      const angle = (v.position / 1500.0) * Math.PI * 2 - Math.PI / 2;
      const lat = cityCoords.lat + RADIUS * Math.sin(angle);
      const lng = cityCoords.lng + RADIUS * Math.cos(angle) * 1.2;
      return { ...v, lat, lng };
    });
  }, [vehicles, cityCoords]);

  // ─── District Polygon ───────────────────────────────────────────────────────
  const districtPolygon = useMemo(() => {
    const r = RADIUS * 1.5;
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [cityCoords.lng - r * 1.4, cityCoords.lat + r],
            [cityCoords.lng + r * 1.4, cityCoords.lat + r],
            [cityCoords.lng + r * 1.4, cityCoords.lat - r],
            [cityCoords.lng - r * 1.4, cityCoords.lat - r],
            [cityCoords.lng - r * 1.4, cityCoords.lat + r],
          ]],
        },
        properties: { name: 'Active District' },
      }],
    };
  }, [cityCoords]);

  // ─── Highway Corridor Polyline ──────────────────────────────────────────────
  const corridorPositions = useMemo(() => {
    const coords: [number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2 - Math.PI / 2;
      const lat = cityCoords.lat + RADIUS * Math.sin(angle);
      const lng = cityCoords.lng + RADIUS * Math.cos(angle) * 1.2;
      coords.push([lat, lng]);
    }
    return coords;
  }, [cityCoords]);

  // ─── Waypoints (AQI Sensors) ────────────────────────────────────────────────
  const aqiSensors = useMemo(() => [
    { id: 'AQI-01', lat: cityCoords.lat + 0.002, lng: cityCoords.lng + 0.003, color: '#EF4444', aqi: 185 },
    { id: 'AQI-02', lat: cityCoords.lat + 0.001, lng: cityCoords.lng - 0.004, color: '#F59E0B', aqi: 120 },
    { id: 'AQI-03', lat: cityCoords.lat - 0.004, lng: cityCoords.lng + 0.001, color: '#10B981', aqi: 45 },
    { id: 'AQI-04', lat: cityCoords.lat - 0.003, lng: cityCoords.lng - 0.002, color: '#10B981', aqi: 52 },
  ], [cityCoords]);

  const transitHub = useMemo(() => ({ lat: cityCoords.lat - 0.001, lng: cityCoords.lng - 0.003 }), [cityCoords]);

  const showDistrict = activeTab !== 'FLEET TELEMETRY';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#05070A' }}>
      
      {/* ── HUD Overlays ──────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 30, display: 'flex', gap: 8 }}>
        <button
          onClick={onToggleView}
          className="bg-black/80 border border-[#00f0ff]/50 text-[#00f0ff] p-2 rounded backdrop-blur-md hover:bg-[#00f0ff]/20 transition-all flex items-center gap-2 text-xs font-rajdhani uppercase font-bold tracking-widest shadow-[0_0_10px_rgba(0,240,255,0.2)] pointer-events-auto"
        >
          <Camera className="w-4 h-4" />
          {isIsometric ? 'RE-CENTER' : 'FIT CITY'}
        </button>
      </div>

      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 30 }}
        className="bg-black/80 border border-[#00f0ff]/50 backdrop-blur-md px-4 py-2 rounded font-rajdhani text-xs font-bold text-[#00f0ff] flex items-center gap-2 shadow-[0_0_10px_rgba(0,240,255,0.2)] uppercase tracking-wider"
      >
        <RefreshCw className="w-4 h-4 animate-spin text-[#00f0ff]" />
        MAP LINK: {mapError ? 'DEGRADED' : 'ESTABLISHED'}
      </div>

      {/* ── Tactical Grid Overlay ─────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        backgroundImage: 'linear-gradient(rgba(100,255,218,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(100,255,218,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      
      {/* ── Map Container ─────────────────────────────────────────────────── */}
      <MapContainer 
        center={center} 
        zoom={zoom} 
        zoomControl={false}
        style={{ height: '100%', width: '100%', background: '#05070A' }}
      >
        <MapController center={center} zoom={zoom} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setMapError('Failed to load tile stream.')
          }}
        />

        {/* District Boundary */}
        {showDistrict && (
          <GeoJSON 
            data={districtPolygon} 
            pathOptions={{ color: '#00f0ff', weight: 2, dashArray: '6, 6', fillColor: '#00f0ff', fillOpacity: activeTab === 'ECO-ZONES' ? 0.15 : 0.05 }} 
            eventHandlers={{
              click: () => {}
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'Rajdhani', minWidth: 150 }}>
                <strong style={{ color: '#00f0ff' }}>ZONE: {cityCoords.short}</strong><br/>
                ECO EFFICIENCY: 87%<br/>
                CO2 REDUCTION: 12%<br/>
                AQI: MODERATE
              </div>
            </Popup>
          </GeoJSON>
        )}

        {/* Highway Corridor */}
        <Polyline 
          positions={corridorPositions} 
          pathOptions={{ color: '#00f0ff', weight: 6, opacity: 0.4 }} 
        />
        <Polyline 
          positions={corridorPositions} 
          pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.8 }} 
        />

        {/* AQI Sensors */}
        {aqiSensors.map(sensor => (
          <Marker 
            key={sensor.id} 
            position={[sensor.lat, sensor.lng]} 
            icon={getAqiIcon(sensor.color, sensor.aqi.toString())}
          >
            <Popup>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                <strong style={{ color: sensor.color }}>{sensor.id}</strong><br/>
                AQI: {sensor.aqi}<br/>
                PM2.5: {Math.round(sensor.aqi * 0.4)}<br/>
                PM10: {Math.round(sensor.aqi * 0.7)}<br/>
                STATUS: {sensor.color === '#EF4444' ? 'UNHEALTHY' : (sensor.color === '#F59E0B' ? 'MODERATE' : 'GOOD')}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Transit Hub */}
        <Marker position={[transitHub.lat, transitHub.lng]} icon={getTransitHubIcon()}>
          <Popup>
            <div style={{ fontFamily: 'Rajdhani' }}>
              <strong style={{ color: '#F59E0B' }}>TRANSIT HUB</strong><br/>
              STATUS: ACTIVE
            </div>
          </Popup>
        </Marker>

        {/* Vehicles */}
        {vehicleMarkers.map(v => (
          <Marker 
            key={v.id} 
            position={[v.lat, v.lng]} 
            icon={getVehicleIcon(v)}
          >
            <Popup>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                <strong style={{ color: '#64FFDA' }}>{v.id}</strong><br/>
                SPEED: {Math.round(v.velocity * 3.6)} km/h<br/>
                HEADING: {Math.round((v.position / 1500) * 360)}°<br/>
                STATUS: {v.braking ? 'CRITICAL' : 'NOMINAL'}<br/>
                TYPE: {v.type.toUpperCase()}
              </div>
            </Popup>
          </Marker>
        ))}

      </MapContainer>
    </div>
  );
}

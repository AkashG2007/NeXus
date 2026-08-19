"use client";

import React, { useRef, useState, useEffect, useMemo } from 'react';
import Map, { Layer, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Camera, RefreshCw } from 'lucide-react';

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

interface CityMap3DProps {
  zones: any[];
  vehicles: Vehicle[];
  cityCoords: { lat: number; lng: number; name: string };
  isIsometric: boolean;
  onToggleView: () => void;
}

export default function CityMap3D({ zones, vehicles, cityCoords, isIsometric, onToggleView }: CityMap3DProps) {
  const mapRef = useRef<any>(null);
  
  // Base configuration
  const initialViewState = {
    longitude: cityCoords.lng,
    latitude: cityCoords.lat,
    zoom: 15.5,
    pitch: isIsometric ? 60 : 0,
    bearing: isIsometric ? -20 : 0
  };

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [cityCoords.lng, cityCoords.lat],
        pitch: isIsometric ? 60 : 0,
        bearing: isIsometric ? -20 : 0,
        duration: 2000,
        essential: true
      });
    }
  }, [cityCoords, isIsometric]);

  // Map 1D corridor position to a circle around the city center
  const radiusInDegrees = 0.005; // Roughly 500m radius
  const vehicleFeatures = useMemo(() => {
    return vehicles.map(v => {
      // 1.5km total length => map position [0, 1500) to [0, 2PI)
      const angle = (v.position / 1500.0) * Math.PI * 2 - Math.PI / 2;
      const lat = cityCoords.lat + radiusInDegrees * Math.sin(angle);
      const lng = cityCoords.lng + radiusInDegrees * Math.cos(angle) * 1.2; // Adjust for projection
      
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: v.id,
          color: v.braking ? '#ff0055' : (v.color === 'blue' ? '#00f0ff' : '#10b981'),
          braking: v.braking,
          size: v.type === 'cav' ? 12 : 8
        }
      };
    });
  }, [vehicles, cityCoords]);

  // Generate a fake ward/district polygon around the center
  const districtPolygon = useMemo(() => {
    const r = radiusInDegrees * 1.5;
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [cityCoords.lng + r, cityCoords.lat + r],
            [cityCoords.lng + r, cityCoords.lat - r],
            [cityCoords.lng - r, cityCoords.lat - r],
            [cityCoords.lng - r, cityCoords.lat + r],
            [cityCoords.lng + r, cityCoords.lat + r],
          ]]
        },
        properties: { name: 'Active District' }
      }]
    };
  }, [cityCoords]);

  // Generate static 3D waypoints (AQI Monitors, Transit Hubs)
  const waypoints = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [cityCoords.lng + 0.002, cityCoords.lat + 0.002] },
          properties: { type: 'AQI_SENSOR', color: '#ff0055' }
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [cityCoords.lng - 0.003, cityCoords.lat - 0.001] },
          properties: { type: 'TRANSIT_HUB', color: '#fbbf24' }
        }
      ]
    };
  }, [cityCoords]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0e0e0e]">
      {/* HUD Overlays */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button 
          onClick={onToggleView}
          className="bg-black/80 border border-[#00f0ff]/50 text-[#00f0ff] p-2 rounded backdrop-blur-md hover:bg-[#00f0ff]/20 transition-all flex items-center gap-2 text-xs font-rajdhani uppercase font-bold tracking-widest shadow-[0_0_10px_rgba(0,240,255,0.2)]"
        >
          <Camera className="w-4 h-4" />
          {isIsometric ? 'ISO-CAM' : 'TOP-DOWN'}
        </button>
      </div>

      <div className="absolute top-4 right-4 z-10 bg-black/80 border border-[#00f0ff]/50 backdrop-blur-md px-4 py-2 rounded font-rajdhani text-xs font-bold text-[#00f0ff] flex items-center gap-2 shadow-[0_0_10px_rgba(0,240,255,0.2)] uppercase tracking-wider">
        <RefreshCw className="w-4 h-4 animate-spin text-[#00f0ff]" />
        LIVE {cityCoords.name} FEED
      </div>

      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        interactive={true}
        antialias={true}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Interactive District/Ward Boundaries */}
        <Source id="district-bounds" type="geojson" data={districtPolygon as any}>
          <Layer 
            id="district-line"
            type="line"
            paint={{
              'line-color': '#00f0ff',
              'line-width': 2,
              'line-dasharray': [2, 2],
              'line-opacity': 0.6
            }}
          />
          <Layer 
            id="district-fill"
            type="fill"
            paint={{
              'fill-color': '#00f0ff',
              'fill-opacity': 0.05
            }}
          />
        </Source>

        {/* Dynamic HUD Overlays: Waypoints (AQI Sensors, Hubs) */}
        <Source id="waypoints" type="geojson" data={waypoints as any}>
          <Layer
            id="waypoint-glow"
            type="circle"
            paint={{
              'circle-radius': 20,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.2,
              'circle-blur': 1,
              'circle-pitch-alignment': 'map'
            }}
          />
          <Layer
            id="waypoint-core"
            type="circle"
            paint={{
              'circle-radius': 6,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.9,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#000',
              'circle-pitch-alignment': 'map'
            }}
          />
        </Source>

        {/* CVCC Vehicles */}
        <Source id="vehicles" type="geojson" data={{ type: 'FeatureCollection', features: vehicleFeatures } as any}>
          <Layer
            id="vehicle-glow"
            type="circle"
            paint={{
              'circle-radius': ['+', ['get', 'size'], 12],
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.3,
              'circle-blur': 1,
              'circle-pitch-alignment': 'map'
            }}
          />
          <Layer
            id="vehicle-point"
            type="circle"
            paint={{
              'circle-radius': ['get', 'size'],
              'circle-color': ['get', 'color'],
              'circle-opacity': 1,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#fff',
              'circle-pitch-alignment': 'map'
            }}
          />
        </Source>
      </Map>
    </div>
  );
}

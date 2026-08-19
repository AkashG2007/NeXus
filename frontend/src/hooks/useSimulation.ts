import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

export interface Vehicle {
  id: string;
  type: 'human' | 'cav';
  lane: number;
  position: number;
  velocity: number;
  acceleration: number;
  braking: boolean;
  color: string;
}

export interface SimulationState {
  time: number;
  vehicles: Vehicle[];
  metrics: {
    density: number[];
    v_mean: number[];
    flow: number;
    shockwave_detected: boolean;
    v_target_advisory?: number;
    total_co2: number;
    aqi: number;
  };
  zones: any[];
  cvcc_enabled: boolean;
}

const DEFAULT_METRICS = {
  density: [0], v_mean: [22], flow: 0, shockwave_detected: false, total_co2: 0, aqi: 45
};

export function useSimulation(cityCoords: { lat: number; lng: number; name: string }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [state, setState] = useState<SimulationState>({
    time: 0, vehicles: [], metrics: DEFAULT_METRICS, zones: [], cvcc_enabled: false
  });
  const [logs, setLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Settings
  const settingsRef = useRef({ cvccEnabled: false, cavPenetration: 5, speedLimit: 80, phantomJam: false, cutIn: false });

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const updateSettings = useCallback((cvcc: boolean, penetration: number) => {
    settingsRef.current.cvccEnabled = cvcc;
    settingsRef.current.cavPenetration = penetration;
    if (cvcc && !state.cvcc_enabled) addLog(`[SYS] CVCC Engaged at ${penetration}% Penetration`);
  }, [addLog, state.cvcc_enabled]);

  const triggerJam = useCallback(() => {
    settingsRef.current.phantomJam = true;
    addLog(`[WARN] Phantom Jam Triggered - Forced braking sequence initiated`);
  }, [addLog]);

  const injectCutIn = useCallback(() => {
    settingsRef.current.cutIn = true;
    addLog(`[ALERT] Rogue vehicle cut-in injected into corridor`);
  }, [addLog]);

  const setSpeedLimit = useCallback((limit: number) => {
    settingsRef.current.speedLimit = limit;
    addLog(`[SYS] Speed limit override set to ${limit} km/h`);
  }, [addLog]);

  // Dual-mode Connection Logic
  useEffect(() => {
    let fallbackTimer: NodeJS.Timeout;
    let isSubscribed = true;

    const connectWS = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isSubscribed) {
            setIsConnected(true);
            setIsFallbackMode(false);
            clearTimeout(fallbackTimer);
            addLog("[UPLINK] WebSocket connection established.");
          }
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data);
            setState(prev => ({ ...prev, ...data }));
          } catch {}
        };

        ws.onerror = () => {
          if (isSubscribed && !isFallbackMode) {
            addLog("[ERROR] WebSocket failed. Engaging autonomous fallback engine...");
            setIsFallbackMode(true);
          }
        };

        ws.onclose = () => {
          if (isSubscribed) setIsConnected(false);
        };
      } catch {
        if (isSubscribed && !isFallbackMode) {
          setIsFallbackMode(true);
        }
      }
    };

    // Try WS immediately, if no open within 1.5s, engage fallback
    connectWS();
    fallbackTimer = setTimeout(() => {
      if (!isConnected && isSubscribed) {
        setIsFallbackMode(true);
        addLog("[WARN] Uplink timeout. Local microscopic physics engine started.");
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearTimeout(fallbackTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [addLog]);

  // Fallback JavaScript Microscopic Simulation (Runs at 25 Hz)
  useEffect(() => {
    if (!isFallbackMode) return;

    let time = 0;
    const dt = 0.04; // 25 Hz
    const N_VEHICLES = 80;
    const LENGTH = 1500; // 1.5 km ring

    // Initialize vehicles
    let vehicles: Vehicle[] = Array.from({ length: N_VEHICLES }, (_, i) => {
      const type = (Math.random() * 100 < settingsRef.current.cavPenetration) ? 'cav' : 'human';
      return {
        id: `V-${i.toString().padStart(3, '0')}`,
        type,
        lane: 0,
        position: (i / N_VEHICLES) * LENGTH,
        velocity: (settingsRef.current.speedLimit / 3.6) * (0.9 + Math.random() * 0.2),
        acceleration: 0,
        braking: false,
        color: type === 'cav' ? '#00f0ff' : '#10b981'
      };
    });

    let shockwaveActive = false;
    let shockwavePos = 0;
    let totalCo2 = 12000;
    let aqi = 45;

    const interval = setInterval(() => {
      time += dt;
      const v0 = settingsRef.current.speedLimit / 3.6; // target velocity m/s
      const cvcc = settingsRef.current.cvccEnabled;
      const pen = settingsRef.current.cavPenetration;

      // Update types based on penetration if changed dynamically
      vehicles.forEach(v => {
        if (v.type === 'cav' && Math.random() * 100 > pen) v.type = 'human';
        if (v.type === 'human' && Math.random() * 100 < pen) v.type = 'cav';
        v.color = v.type === 'cav' ? '#00f0ff' : '#10b981';
      });

      // Phantom Jam Logic
      if (settingsRef.current.phantomJam) {
        settingsRef.current.phantomJam = false;
        shockwaveActive = true;
        shockwavePos = LENGTH * 0.7; // jam near end of ring
        const jammer = vehicles[Math.floor(N_VEHICLES * 0.7)];
        jammer.velocity = 2.0; // hard brake
      }

      // Cut-in Logic
      if (settingsRef.current.cutIn) {
        settingsRef.current.cutIn = false;
        const target = vehicles[Math.floor(N_VEHICLES * 0.5)];
        target.velocity *= 0.3; // sudden slow down
        shockwaveActive = true;
      }

      let totalV = 0;
      let shockCount = 0;

      // Simple Car-Following (Microscopic)
      for (let i = 0; i < N_VEHICLES; i++) {
        const v = vehicles[i];
        const leader = vehicles[(i + 1) % N_VEHICLES];
        
        let dx = leader.position - v.position;
        if (dx < 0) dx += LENGTH; // wrap around

        let s_star = 2.0 + v.velocity * 1.5 + (v.velocity * (v.velocity - leader.velocity)) / (2 * Math.sqrt(1.5 * 2.0));
        if (s_star < 2.0) s_star = 2.0;

        let a = 1.0 * (1 - Math.pow(v.velocity / v0, 4) - Math.pow(s_star / dx, 2));

        if (dx < 5.0) a = -5.0; // Collision avoidance

        // CVCC Mitigation: CAVs look further ahead and dampen acceleration
        if (cvcc && v.type === 'cav') {
          a = a * 0.5 + (v0 - v.velocity) * 0.1; // Smooth out
          if (shockwaveActive) {
            a += 0.5; // Help accelerate out of jam
          }
        }

        v.acceleration = a;
        v.velocity += a * dt;
        if (v.velocity < 0) v.velocity = 0;
        if (v.velocity > v0 * 1.2) v.velocity = v0 * 1.2;
        
        v.position += v.velocity * dt;
        if (v.position >= LENGTH) v.position -= LENGTH;

        v.braking = a < -1.5;
        if (v.braking) {
          v.color = '#ff0055';
          shockCount++;
        }

        totalV += v.velocity;
        totalCo2 += (v.velocity * 0.01 + (a > 0 ? a * 0.05 : 0)) * dt;
      }

      // Macroscopic metrics
      const avgV = totalV / N_VEHICLES;
      const density = N_VEHICLES / (LENGTH / 1000); // veh/km
      const flow = density * (avgV * 3.6); // veh/hr

      // Auto-resolve shockwave if enough CAVs
      if (shockwaveActive) {
        aqi += 0.05;
        if (cvcc && pen > 10 && shockCount < N_VEHICLES * 0.1) {
          shockwaveActive = false;
          addLog("[SYS] Shockwave successfully dampened by CAV platoon.");
        } else if (shockCount === 0) {
          shockwaveActive = false;
        }
      } else {
        if (aqi > 45) aqi -= 0.02;
      }

      setState({
        time,
        vehicles: [...vehicles], // deep enough clone for React rendering refs
        metrics: {
          density: [density],
          v_mean: [avgV],
          flow,
          shockwave_detected: shockwaveActive,
          v_target_advisory: shockwaveActive && cvcc ? Math.floor(avgV * 3.6 * 1.1) : undefined,
          total_co2: totalCo2,
          aqi: Number(aqi.toFixed(1))
        },
        zones: [
          { id: 'z1', center: 0.25, length: 0.1, color: aqi > 60 ? 'Red' : 'Green' },
          { id: 'z2', center: 0.7, length: 0.15, color: shockwaveActive ? 'Purple' : 'Green' }
        ],
        cvcc_enabled: cvcc
      });

    }, dt * 1000);

    return () => clearInterval(interval);
  }, [isFallbackMode, addLog]);

  return {
    isConnected,
    isFallbackMode,
    state,
    logs,
    updateSettings,
    triggerJam,
    injectCutIn,
    setSpeedLimit,
    activeCityCoords: cityCoords
  };
}

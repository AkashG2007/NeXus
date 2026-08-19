import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from simulation.corridor import Corridor
from digital_twin.digital_twin import DigitalTwin

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State
corridor = Corridor(length=1500.0, num_lanes=1)
digital_twin = DigitalTwin(corridor_length=1500.0, num_segments=15)
is_running = False
simulation_task = None
cav_penetration = 0.05
corridor.cvcc_enabled = False

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

# Simulation Loop
async def simulation_loop():
    global is_running
    dt = 0.05 # 20 Hz logical step
    while True:
        if is_running:
            corridor.step(dt)
            digital_twin.update(corridor.vehicles, dt)
            corridor.v_target_advisory = digital_twin.v_target_advisory
            
            # Broadcast state
            state = {
                "time": corridor.time,
                "vehicles": corridor.get_state(),
                "metrics": digital_twin.get_metrics(),
                "zones": corridor.aqi_service.get_state(),
                "cvcc_enabled": corridor.cvcc_enabled,
                "cav_penetration": cav_penetration
            }
            await manager.broadcast(json.dumps(state))
            
        await asyncio.sleep(1/30.0) # Send updates at 30Hz

@app.on_event("startup")
async def startup_event():
    global simulation_task
    corridor.spawn_vehicles(num_vehicles=60, cav_penetration=cav_penetration)
    simulation_task = asyncio.create_task(simulation_loop())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from the client right now
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# REST Endpoints
class SettingsModel(BaseModel):
    cav_penetration: float
    cvcc_enabled: bool

@app.post("/api/start")
async def start_sim():
    global is_running
    is_running = True
    return {"status": "started"}

@app.post("/api/pause")
async def pause_sim():
    global is_running
    is_running = False
    return {"status": "paused"}

@app.post("/api/reset")
async def reset_sim():
    corridor.time = 0.0
    digital_twin.total_co2 = 0.0
    digital_twin.total_pm25 = 0.0
    # Also reset the AQI service state
    for zone in corridor.aqi_service.zones:
        zone["aqi"] = zone["base_aqi"]
    corridor.spawn_vehicles(num_vehicles=60, cav_penetration=cav_penetration)
    return {"status": "reset"}

@app.post("/api/anomaly")
async def trigger_anomaly():
    corridor.trigger_anomaly(brake_amount=-5.0, duration=2.0)
    return {"status": "anomaly_triggered"}

class PollutionSpikeModel(BaseModel):
    zone_id: str
    amount: float

@app.post("/api/pollution_spike")
async def trigger_pollution_spike(spike: PollutionSpikeModel):
    corridor.aqi_service.simulate_pollution_spike(spike.zone_id, spike.amount)
    return {"status": "pollution_spike_triggered"}

@app.post("/api/settings")
async def update_settings(settings: SettingsModel):
    global cav_penetration
    cav_penetration = settings.cav_penetration
    corridor.cvcc_enabled = settings.cvcc_enabled
    # Optional: Respawn immediately if penetration rate changed? 
    # For now, just setting it for next reset or dynamic insertion (if we implement it)
    # Actually, we can update existing vehicles or just respawn
    return {"status": "settings_updated"}

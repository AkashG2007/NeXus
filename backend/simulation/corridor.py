import random
from .vehicle import HDV, CAV
from environment.aqi_service import AQIService

class Corridor:
    """A multi-lane circular highway (ring road)."""
    def __init__(self, length=1500.0, num_lanes=2):
        self.length = length
        self.num_lanes = num_lanes
        self.vehicles = []
        self.time = 0.0
        self.cvcc_enabled = False
        self.v_target_advisory = None # from Tier 1
        self.aqi_service = AQIService(corridor_length=length)

    def spawn_vehicles(self, num_vehicles=60, cav_penetration=0.05, v0=30.0):
        self.vehicles = []
        spacing = self.length / num_vehicles
        
        for i in range(num_vehicles):
            # Assign lane pseudo-randomly for even distribution
            lane = i % self.num_lanes
            pos = i * spacing
            vel = v0 * random.uniform(0.8, 1.0)
            
            if random.random() < cav_penetration:
                v = CAV(position=pos, velocity=vel, lane=lane, v0=v0, cvcc_enabled=self.cvcc_enabled)
            else:
                v = HDV(position=pos, velocity=vel, lane=lane, v0=v0)
                
            self.vehicles.append(v)
            
    def get_leader(self, vehicle):
        """Finds the leader in the same lane for a given vehicle on the ring road."""
        min_dist = float('inf')
        leader = None
        
        for other in self.vehicles:
            if other.id == vehicle.id or other.lane != vehicle.lane:
                continue
                
            # Distance on a ring road
            dist = (other.position - vehicle.position) % self.length
            
            if dist < min_dist and dist > 0:
                min_dist = dist
                leader = other
                
        return leader, min_dist

    def step(self, dt=0.05):
        self.time += dt
        
        # 1. Compute accelerations
        for v in self.vehicles:
            leader, dist = self.get_leader(v)
            
            if leader is None:
                # Should only happen if 1 car in lane
                gap = 1000
                leader_vel = v.velocity
            else:
                gap = dist - leader.length
                leader_vel = leader.velocity
                
            zone = self.aqi_service.get_zone_for_position(v.position)
            zone_severity = zone["color"]
                
            if isinstance(v, CAV):
                v.cvcc_enabled = self.cvcc_enabled
                v.compute_acceleration_with_gap(gap, leader_vel, self.v_target_advisory, zone_severity)
            else:
                v.compute_acceleration_with_gap(gap, leader_vel)
                
        # 2. Update positions and wrap around, and collect emissions
        pm25_emitted = {}
        for v in self.vehicles:
            v.update(dt)
            v.position %= self.length
            
            zone = self.aqi_service.get_zone_for_position(v.position)
            pm25_emitted[zone["id"]] = pm25_emitted.get(zone["id"], 0.0) + (v.emissions["pm25"] * dt)
            
        # 3. Update Environment
        self.aqi_service.update_pollution(pm25_emitted)

    def trigger_anomaly(self, brake_amount=-4.0, duration=2.0):
        """Forces a random HDV to brake hard to trigger a shockwave."""
        hdvs = [v for v in self.vehicles if isinstance(v, HDV)]
        if hdvs:
            target = random.choice(hdvs)
            target.acceleration = brake_amount
            target.velocity = max(0, target.velocity + brake_amount * duration)
            target.braking = True
            
    def get_state(self):
        """Returns the state of all vehicles for telemetry."""
        return [
            {
                "id": v.id,
                "type": v.type,
                "lane": v.lane,
                "position": v.position,
                "velocity": v.velocity,
                "acceleration": v.acceleration,
                "braking": v.braking,
                "color": v.color
            }
            for v in self.vehicles
        ]

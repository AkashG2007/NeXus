import random
import uuid
from .models import IDM
from .emission_model import EmissionModel

class Vehicle:
    def __init__(self, position, velocity, lane, length=5.0):
        self.id = str(uuid.uuid4())[:8]
        self.position = position
        self.velocity = velocity
        self.acceleration = 0.0
        self.lane = lane
        self.length = length
        self.type = "base"
        self.color = "gray"
        self.braking = False
        self.emissions = {"co2": 0.0, "pm25": 0.0}

    def update(self, dt):
        self.velocity += self.acceleration * dt
        self.velocity = max(0, self.velocity) # No reversing
        self.position += self.velocity * dt
        self.braking = self.acceleration < -1.0 # arbitrary threshold for brake lights
        
        # Calculate instantaneous emissions
        self.emissions = EmissionModel.compute_emissions(self.velocity, self.acceleration)

class HDV(Vehicle):
    """Human-Driven Vehicle with IDM and stochastic noise."""
    def __init__(self, position, velocity, lane, v0=30.0):
        super().__init__(position, velocity, lane)
        self.type = "HDV"
        self.color = "red"
        # Base IDM parameters, human drivers have slightly varied parameters
        T_human = random.uniform(1.2, 1.8)
        self.idm = IDM(v0=v0, T=T_human)
        self.noise_std = 0.2 # std dev for acceleration noise to trigger jams

    def compute_acceleration(self, leader, v_target_advisory=None):
        if leader is None:
            accel = self.idm.get_acceleration(self.velocity, self.velocity, 1000)
        else:
            s = leader.position - self.position - leader.length
            # Wrap around for ring road is handled by the corridor passing correct 's' or fake leader
            # Wait, better pass gap and leader_vel directly to avoid coupling with ring road logic here.
            # Let's refactor parameter to accept gap and leader_vel
            pass

    def compute_acceleration_with_gap(self, gap, leader_vel):
        accel = self.idm.get_acceleration(self.velocity, leader_vel, gap)
        # Add stochastic noise if velocity is not zero
        if self.velocity > 0:
            accel += random.gauss(0, self.noise_std)
        self.acceleration = max(-5.0, min(accel, self.idm.a))
        return self.acceleration

class CAV(Vehicle):
    """Connected Autonomous Vehicle with CVCC wave-absorbing logic."""
    def __init__(self, position, velocity, lane, v0=30.0, cvcc_enabled=True):
        super().__init__(position, velocity, lane)
        self.type = "CAV"
        self.color = "blue"
        self.idm = IDM(v0=v0, T=1.0) # Tighter headway for CAVs
        self.cvcc_enabled = cvcc_enabled

    def compute_acceleration_with_gap(self, gap, leader_vel, v_target_advisory=None, zone_severity="Green"):
        # Apply variable speed advisory if CVCC is active
        original_v0 = self.idm.v0
        if self.cvcc_enabled and v_target_advisory is not None:
            self.idm.v0 = v_target_advisory
            
        accel = self.idm.get_acceleration(self.velocity, leader_vel, gap)
        
        # Defensive gap-closing logic for cut-ins (simplified: if gap is very small, brake harder but smoothly)
        if gap < self.idm.s0 + 2:
            accel = min(accel, -2.0)
            
        # Eco-CVCC constraints: strict smoothing in Red/Purple zones
        if self.cvcc_enabled and zone_severity in ["Red", "Purple"]:
            # Hard limit on throttle to reduce PM2.5 and NOx spikes
            accel = min(accel, 1.0)
            
        self.acceleration = max(-5.0, min(accel, self.idm.a))
        
        # Restore original v0
        self.idm.v0 = original_v0
        return self.acceleration

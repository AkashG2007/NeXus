import numpy as np

class DigitalTwin:
    """Tier 1: Edge Digital Twin & Infrastructure Service."""
    
    def __init__(self, corridor_length=1500.0, num_segments=15):
        self.corridor_length = corridor_length
        self.num_segments = num_segments
        self.segment_length = corridor_length / num_segments
        
        # State metrics per segment
        self.density = np.zeros(num_segments) # veh/km
        self.flow = np.zeros(num_segments)    # veh/hr
        self.v_mean = np.zeros(num_segments)  # m/s
        self.v_target_advisory = None
        
        # Shockwave detection
        self.shockwave_detected = False
        
        # Eco Telemetry
        self.total_co2 = 0.0
        self.total_pm25 = 0.0
        
    def update(self, vehicles, dt=0.05):
        """Ingests telemetry to compute macroscopic metrics and VAS."""
        if not vehicles:
            return
            
        segment_counts = np.zeros(self.num_segments)
        segment_speeds = [[] for _ in range(self.num_segments)]
        
        for v in vehicles:
            seg_idx = int(v.position / self.segment_length) % self.num_segments
            segment_counts[seg_idx] += 1
            segment_speeds[seg_idx].append(v.velocity)
            
            # Aggregate emissions
            self.total_co2 += v.emissions.get("co2", 0.0) * dt
            self.total_pm25 += v.emissions.get("pm25", 0.0) * dt
            
        # Compute macroscopic metrics
        for i in range(self.num_segments):
            # Density K: veh/km
            self.density[i] = segment_counts[i] / (self.segment_length / 1000.0)
            
            # Harmonic mean speed V_mean
            if segment_speeds[i]:
                # Avoid div by zero for stopped cars by adding small epsilon
                speeds = np.array(segment_speeds[i])
                speeds = np.maximum(speeds, 0.1)
                self.v_mean[i] = len(speeds) / np.sum(1.0 / speeds)
            else:
                self.v_mean[i] = 30.0 # free flow assumption
                
            # Flow Q: veh/hr (K * V)
            self.flow[i] = self.density[i] * (self.v_mean[i] * 3.6) # Convert m/s to km/h for flow
            
        self.detect_shockwave()
        self.compute_advisory_speed()
        
    def detect_shockwave(self):
        """Detect backward-propagating deceleration gradients."""
        # Simple detection: if any segment has very high density and low speed
        self.shockwave_detected = False
        for i in range(self.num_segments):
            if self.density[i] > 60 and self.v_mean[i] < 10.0:
                self.shockwave_detected = True
                break
                
    def compute_advisory_speed(self):
        """Compute optimal harmonic pacing speed (V_target) if shockwave detected."""
        if self.shockwave_detected:
            # Drop the speed limit to dampen the wave (e.g. 15 m/s)
            self.v_target_advisory = 15.0
        else:
            self.v_target_advisory = None
            
    def get_metrics(self):
        """Return macroscopic metrics for telemetry."""
        return {
            "density": self.density.tolist(),
            "flow": self.flow.tolist(),
            "v_mean": self.v_mean.tolist(),
            "shockwave_detected": self.shockwave_detected,
            "v_target_advisory": self.v_target_advisory,
            "total_co2": self.total_co2,
            "total_pm25": self.total_pm25
        }

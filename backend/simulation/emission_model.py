import math

class EmissionModel:
    """
    Simplified VT-Micro style polynomial emission model.
    Computes instantaneous CO2 (g/s) and PM2.5 (mg/s) based on velocity and acceleration.
    """
    @staticmethod
    def compute_emissions(v, a):
        """
        v: velocity (m/s)
        a: acceleration (m/s^2)
        Returns a dictionary with 'co2' (g/s) and 'pm25' (mg/s).
        """
        # A very simplified polynomial approximation to mimic VT-Micro behaviors:
        # High emissions during hard acceleration, lower during steady cruise, negligible during coasting/idling.
        
        # Ensure v is non-negative
        v = max(0.0, v)
        
        # Base idling emissions
        base_co2 = 1.0 # g/s
        base_pm25 = 0.01 # mg/s
        
        if v == 0 and a <= 0:
            return {"co2": base_co2, "pm25": base_pm25}
            
        # Velocity penalty (non-linear air resistance at high speeds)
        # v in m/s (30 m/s ~ 108 km/h)
        v_penalty_co2 = 0.05 * v + 0.001 * (v**3)
        v_penalty_pm25 = 0.0005 * v + 0.00001 * (v**3)
        
        # Acceleration penalty (sharp increase when a > 0)
        if a > 0:
            a_penalty_co2 = 5.0 * a + 2.0 * (a**2)
            a_penalty_pm25 = 0.5 * a + 0.2 * (a**2)
        else:
            # Braking/Coasting: emissions drop significantly
            a_penalty_co2 = 0.0
            a_penalty_pm25 = 0.0
            # Some brake wear particulate matter during hard braking (pm25)
            if a < -1.0:
                a_penalty_pm25 += 0.5 * abs(a)
                
        co2 = base_co2 + v_penalty_co2 + a_penalty_co2
        pm25 = base_pm25 + v_penalty_pm25 + a_penalty_pm25
        
        return {"co2": co2, "pm25": pm25}

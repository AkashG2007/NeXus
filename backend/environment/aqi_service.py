import random

class AQIService:
    """
    Mock AQI Service that divides the 1.5km corridor into 3 zones.
    Zone A: Residential (0-500m) - Highly sensitive
    Zone B: Open Freeway (500-1000m) - Normal sensitivity
    Zone C: Industrial (1000-1500m) - Moderately sensitive
    """
    def __init__(self, corridor_length=1500.0):
        self.corridor_length = corridor_length
        self.zones = [
            {
                "id": "A",
                "name": "Residential Zone",
                "start": 0.0,
                "end": 500.0,
                "base_aqi": 30,
                "aqi": 30,
                "pm25": 10.0,
                "no2": 15.0,
                "sensitivity": 2.0, # High penalty for pollution
                "color": "Green"
            },
            {
                "id": "B",
                "name": "Open Freeway",
                "start": 500.0,
                "end": 1000.0,
                "base_aqi": 20,
                "aqi": 20,
                "pm25": 5.0,
                "no2": 10.0,
                "sensitivity": 1.0, # Normal
                "color": "Green"
            },
            {
                "id": "C",
                "name": "Industrial Basin",
                "start": 1000.0,
                "end": 1500.0,
                "base_aqi": 80,
                "aqi": 80,
                "pm25": 25.0,
                "no2": 35.0,
                "sensitivity": 1.5, # Moderate
                "color": "Yellow"
            }
        ]
        
    def get_zone_for_position(self, position):
        """Returns the zone dictionary for a given linear position."""
        pos = position % self.corridor_length
        for zone in self.zones:
            if zone["start"] <= pos < zone["end"]:
                return zone
        return self.zones[-1]

    def update_pollution(self, pm25_emitted_per_zone):
        """
        Updates the AQI for each zone based on cumulative PM2.5 emissions.
        pm25_emitted_per_zone: dict with zone id as key, total pm25 emitted in current tick as value
        """
        for zone in self.zones:
            emitted = pm25_emitted_per_zone.get(zone["id"], 0.0)
            # Add some baseline drift towards base_aqi
            drift = (zone["base_aqi"] - zone["aqi"]) * 0.05
            
            # Temporary spike based on recent emissions
            spike = emitted * zone["sensitivity"] * 0.1
            
            zone["aqi"] = max(0, min(500, zone["aqi"] + drift + spike))
            
            # Add random noise
            zone["aqi"] += random.uniform(-1, 1)
            
            # Update color based on AQI
            if zone["aqi"] <= 50:
                zone["color"] = "Green"
            elif zone["aqi"] <= 100:
                zone["color"] = "Yellow"
            elif zone["aqi"] <= 150:
                zone["color"] = "Orange"
            elif zone["aqi"] <= 200:
                zone["color"] = "Red"
            else:
                zone["color"] = "Purple"
                
    def get_state(self):
        return self.zones

    def simulate_pollution_spike(self, zone_id, amount=100):
        """Manually inject a pollution spike for testing."""
        for zone in self.zones:
            if zone["id"] == zone_id:
                zone["aqi"] = min(500, zone["aqi"] + amount)

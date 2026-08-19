import math

class IDM:
    """Intelligent Driver Model for car-following."""
    
    def __init__(self, v0=30.0, T=1.5, s0=2.0, a=1.0, b=1.5, delta=4.0):
        self.v0 = v0      # desired speed (m/s)
        self.T = T        # safe time headway (s)
        self.s0 = s0      # minimum gap (m)
        self.a = a        # maximum acceleration (m/s^2)
        self.b = b        # comfortable deceleration (m/s^2)
        self.delta = delta # acceleration exponent

    def get_acceleration(self, v, v_leader, s):
        """
        Calculates acceleration based on current state.
        :param v: current velocity of the vehicle
        :param v_leader: velocity of the leading vehicle
        :param s: net distance gap to the leading vehicle
        """
        # Free road term
        if self.v0 == 0:
            free_road_accel = 0
        else:
            free_road_accel = self.a * (1 - (v / self.v0) ** self.delta)
        
        # If there is no leader or gap is very large, act as if free road
        if s > 1000:
            return free_road_accel

        # Interaction term
        delta_v = v - v_leader
        s_star = self.s0 + max(0, v * self.T + (v * delta_v) / (2 * math.sqrt(self.a * self.b)))
        
        # Prevent division by zero
        if s <= 0:
            s = 0.1
            
        interaction_accel = -self.a * (s_star / s) ** 2
        
        accel = free_road_accel + interaction_accel
        
        # Hard limits on acceleration
        return max(-5.0, min(accel, self.a))

class MOBIL:
    """Minimizing Overall Braking Induced by Lane change (MOBIL)."""
    
    def __init__(self, politeness=0.1, safe_decel=-2.0, threshold=0.1):
        self.p = politeness
        self.b_safe = safe_decel # max safe braking deceleration (negative value)
        self.a_thr = threshold   # acceleration threshold for lane change

    def evaluate_lane_change(self, v,
                             accel_old_lane, accel_new_lane,
                             accel_old_follower, accel_new_follower,
                             accel_old_follower_after, accel_new_follower_after):
        """
        Evaluates whether a lane change is safe and beneficial.
        All arguments are acceleration values computed by IDM.
        """
        # Safety criterion: new follower must not brake too hard
        if accel_new_follower_after < self.b_safe:
            return False
            
        # Incentive criterion: is the overall advantage greater than threshold?
        # Advantage = (my_new_accel - my_old_accel) + p * (new_follower_new_accel - new_follower_old_accel + old_follower_new_accel - old_follower_old_accel)
        advantage = (accel_new_lane - accel_old_lane) + \
                    self.p * ((accel_new_follower_after - accel_new_follower) + \
                              (accel_old_follower_after - accel_old_follower))
                              
        return advantage > self.a_thr

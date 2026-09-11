from src.signal_decay.engine import decay_engine

class SimulationController:
    def __init__(self):
        # Default start point based on available sample data
        # Let's say we start at 2025-10-23 08:00 (since we saw 2025-10-23 in the sample output)
        self.sim_date_str = "2025-10-23"
        self.sim_hour = 8
        self.elapsed_seconds = 0.0
        self.active_route_path = None
        
    def step(self, delta_seconds: float):
        self.elapsed_seconds += delta_seconds
        
        # Advance hour if elapsed time crosses 3600 seconds
        # For simplicity, we just add hours based on elapsed time directly
        # E.g., if we run simulation in fast forward.
        hours_passed = int(self.elapsed_seconds // 3600)
        current_hour = (8 + hours_passed) % 24
        self.sim_hour = current_hour
        
        # Tell decay engine about the time advance
        decay_engine.update_time(self.elapsed_seconds)
        
    def reset(self):
        self.sim_hour = 8
        self.elapsed_seconds = 0.0
        self.active_route_path = None
        decay_engine.reset()
        
    def get_state(self):
        return {
            "date": self.sim_date_str,
            "hour": self.sim_hour,
            "elapsed_seconds": self.elapsed_seconds,
            "active_decay_events": decay_engine.get_active_events()
        }

sim_controller = SimulationController()

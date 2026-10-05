from src.pada_r.profiles import PADA_PROFILES, evaluate_feasibility
from src.config.loader import WEIGHTS_CONFIG
from src.signal_decay.engine import decay_engine
from src.models.edge_state import EdgeState, PhysicalState, AccessibilityState, DynamicState, TemporalState
from src.weather.service import weather_service
from src.weather.impact import calculate_weather_impact
import math

def build_edge_state(u, v, data) -> EdgeState:
    base_dist = data.get('length', data.get('length_m', 0))
    if hasattr(base_dist, 'iloc'): base_dist = base_dist.iloc[0]
    
    physical = PhysicalState(
        distance=base_dist,
        highway=data.get('highway', 'unknown'),
        surface=data.get('surface', 'unknown')
    )
    
    accessibility = AccessibilityState(
        stairs=data.get('stairs', False),
        ramp=data.get('ramp', False),
        slope_percent=data.get('slope_percent'),
        slope_status=data.get('slope_status', 'unknown'),
        crossing=data.get('crossing', 'no'),
        barrier=data.get('barrier', 'no'),
        subway=data.get('subway', False)
    )
    
    # Base Dynamic State without weather
    # In the future, this will be populated directly from real IoT event ingestion.
    # We check if the data dict already has these dynamic fields.
    congestion_penalty = data.get('congestion_penalty', 0.0)
    water_depth = data.get('water_depth', 0.0)
        
    dynamic = DynamicState(
        congestion_penalty=congestion_penalty,
        active_events=0,
        weather_impact=0.0, # to be calculated
        waterlogging_depth=water_depth
    )
    
    temporal = TemporalState()
    
    return EdgeState(u=u, v=v, physical=physical, accessibility=accessibility, dynamic=dynamic, temporal=temporal)

def calculate_pada_cost(u, v, data, profile_name):
    """
    Evaluates the PADA-R cost for a given edge using normalized multipliers.
    Returns (status, total_cost, breakdown, explanation_list)
    If status == 'INACCESSIBLE', total_cost is float('inf').
    """
    profile_name = profile_name.lower() if profile_name else "general"
    if profile_name not in PADA_PROFILES:
        profile_name = "general"
        
    weights = PADA_PROFILES[profile_name]
    
    # 1. Build unified Edge State
    edge_state = build_edge_state(u, v, data)
    
    # 2. Feasibility Gate & Base Multipliers
    status, multipliers, explanation = evaluate_feasibility(data, profile_name)
    if status == 'INACCESSIBLE':
        return status, float('inf'), None, explanation
        
    base_dist = edge_state.physical.distance
    
    # 3. Normalized Accessibility, Effort, Safety Costs
    weighted_dist = base_dist * weights["distance_weight"]
    weighted_acc = base_dist * weights["accessibility_weight"] * multipliers["accessibility"]
    weighted_eff = base_dist * weights["effort_weight"] * multipliers["effort"]
    weighted_saf = base_dist * weights["safety_weight"] * multipliers["safety"]
    
    # 4. Congestion Cost
    weighted_cong = edge_state.dynamic.congestion_penalty * weights["congestion_weight"]
        
    # 5. Traffic Signal Cost
    signal_cost = 0.0
    if data.get('signals', []):
        gamma = WEIGHTS_CONFIG['dynamic_weights']['gamma_signal']
        signal_cost = gamma # Flat penalty for signals if applicable
    weighted_sig = signal_cost * weights["signal_weight"]
        
    # 6. Signal Decay Cost
    delta = WEIGHTS_CONFIG['dynamic_weights']['delta_decay']
    raw_decay = decay_engine.get_penalty(u, v)
    decay_cost = delta * raw_decay
    weighted_decay = decay_cost * weights["decay_weight"]
    
    # 7. Weather Impact Cost
    current_weather = weather_service.get_current_weather()
    weather_cost = calculate_weather_impact(current_weather, edge_state, profile_name)
    edge_state.dynamic.weather_impact = weather_cost
    weighted_weather = weather_cost # No explicit weight in PADA_PROFILES yet, defaults to 1.0 multiplier
    
    # 8. Waterlogging IoT Cost
    water_depth = edge_state.dynamic.waterlogging_depth
    waterlogging_cost = 0.0
    if water_depth > 0:
        if profile_name == "wheelchair" and water_depth >= 3.0:
            return 'INACCESSIBLE', float('inf'), None, ["Water depth exceeds safe threshold for wheelchairs."]
        elif profile_name in ["elderly", "pregnant"] and water_depth >= 5.0:
            return 'INACCESSIBLE', float('inf'), None, [f"Water depth ({water_depth}cm) is unsafe for {profile_name} profile."]
        elif water_depth >= 8.0:
            return 'INACCESSIBLE', float('inf'), None, [f"Water depth ({water_depth}cm) is severely flooded."]
        
        # Calculate penalty for non-inaccessible waterlogging
        water_multiplier = {
            "general": 20.0,
            "elderly": 50.0,
            "pregnant": 50.0,
            "wheelchair": 100.0
        }.get(profile_name, 20.0)
        
        waterlogging_cost = water_depth * water_multiplier
    edge_state.routing.waterlogging_cost = waterlogging_cost
    weighted_waterlogging = waterlogging_cost
    
    # Total PADA-R Edge Cost
    total_cost = weighted_dist + weighted_acc + weighted_eff + weighted_saf + weighted_cong + weighted_sig + weighted_decay + weighted_weather + weighted_waterlogging
    
    breakdown = {
        'distance': weighted_dist,
        'accessibility': weighted_acc,
        'effort': weighted_eff,
        'safety': weighted_saf,
        'congestion': weighted_cong,
        'signal': weighted_sig,
        'decay': weighted_decay,
        'weather': weighted_weather,
        'waterlogging': weighted_waterlogging
    }
    
    if weighted_weather > 0:
        explanation.append(f"Weather conditions increased traversal difficulty by {weighted_weather:.1f}.")
    if weighted_waterlogging > 0:
        explanation.append(f"IoT Sensor reported waterlogging ({water_depth}cm), adding {weighted_waterlogging:.1f} to traversal difficulty.")
    
    return status, total_cost, breakdown, explanation

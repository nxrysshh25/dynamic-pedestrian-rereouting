from src.pada_r.profiles import PADA_PROFILES, evaluate_feasibility
from src.config.loader import WEIGHTS_CONFIG
from src.congestion.model import congestion_model
from src.signal_decay.engine import decay_engine

def calculate_pada_cost(u, v, data, profile_name, sim_date_str, sim_hour):
    """
    Evaluates the PADA-R cost for a given edge using normalized multipliers.
    Returns (status, total_cost, breakdown, explanation_list)
    If status == 'INACCESSIBLE', total_cost is float('inf').
    """
    profile_name = profile_name.lower() if profile_name else "general"
    if profile_name not in PADA_PROFILES:
        profile_name = "general"
        
    weights = PADA_PROFILES[profile_name]
    
    # 1. Feasibility Gate & Base Multipliers
    status, multipliers, explanation = evaluate_feasibility(data, profile_name)
    if status == 'INACCESSIBLE':
        return status, float('inf'), None, explanation
        
    # Base Distance
    base_dist = data.get('length', data.get('length_m', 0))
    if hasattr(base_dist, 'iloc'): base_dist = base_dist.iloc[0]
    
    # 2. Normalized Accessibility, Effort, Safety Costs
    # Cost = Distance * ProfileWeight * FactorMultiplier
    weighted_dist = base_dist * weights["distance_weight"]
    weighted_acc = base_dist * weights["accessibility_weight"] * multipliers["accessibility"]
    weighted_eff = base_dist * weights["effort_weight"] * multipliers["effort"]
    weighted_saf = base_dist * weights["safety_weight"] * multipliers["safety"]
    
    # 3. Congestion Cost
    congestion_cost = 0.0
    sensors = data.get('sensors', [])
    if sensors and sim_date_str and sim_hour is not None:
        if congestion_model.df is None:
            congestion_model.load_data()
        c_sum = sum(congestion_model.get_current_congestion(s, sim_date_str, sim_hour) for s in sensors)
        p_sum = sum(congestion_model.get_predictive_congestion(s, sim_hour) for s in sensors)
        avg_c = c_sum / len(sensors)
        avg_p = p_sum / len(sensors)
        
        alpha = WEIGHTS_CONFIG['dynamic_weights']['alpha_congestion']
        beta = WEIGHTS_CONFIG['dynamic_weights']['beta_predictive']
        # Normalize congestion against base_dist so short highly-congested edges don't outweigh long empty ones
        congestion_cost = ((alpha * avg_c) + (beta * avg_p)) * (base_dist / 100.0) 
        
    weighted_cong = congestion_cost * weights["congestion_weight"]
        
    # 4. Traffic Signal Cost
    signal_cost = 0.0
    if data.get('signals', []):
        gamma = WEIGHTS_CONFIG['dynamic_weights']['gamma_signal']
        signal_cost = gamma # Flat penalty for signals if applicable
    weighted_sig = signal_cost * weights["signal_weight"]
        
    # 5. Signal Decay Cost
    delta = WEIGHTS_CONFIG['dynamic_weights']['delta_decay']
    raw_decay = decay_engine.get_penalty(u, v)
    # Decay penalty is already heavily weighted by distance conceptually in the injection
    decay_cost = delta * raw_decay
    weighted_decay = decay_cost * weights["decay_weight"]
    
    # Total PADA-R Edge Cost
    total_cost = weighted_dist + weighted_acc + weighted_eff + weighted_saf + weighted_cong + weighted_sig + weighted_decay
    
    breakdown = {
        'distance': weighted_dist,
        'accessibility': weighted_acc,
        'effort': weighted_eff,
        'safety': weighted_saf,
        'congestion': weighted_cong,
        'signal': weighted_sig,
        'decay': weighted_decay,
    }
    
    return status, total_cost, breakdown, explanation

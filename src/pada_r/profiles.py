"""
PADA-R Profile Definitions and Feasibility Gate
"""

# Normalized Weights: (Distance, Accessibility, Effort, Safety, Congestion, Predictive, Signal, Decay)
PADA_PROFILES = {
    "general": {
        "distance_weight": 1.0,
        "accessibility_weight": 0.0,
        "effort_weight": 0.0,
        "safety_weight": 0.0,
        "congestion_weight": 1.0,
        "signal_weight": 1.0,
        "decay_weight": 1.0,
        "stability_threshold": 15.0,
    },
    "wheelchair": {
        "distance_weight": 0.7,
        "accessibility_weight": 2.5,
        "effort_weight": 0.8,
        "safety_weight": 0.2,
        "congestion_weight": 1.0,
        "signal_weight": 0.8,
        "decay_weight": 1.0,
        "stability_threshold": 10.0,
    },
    "elderly": {
        "distance_weight": 0.6, 
        "accessibility_weight": 1.0, 
        "effort_weight": 1.5, 
        "safety_weight": 1.5, 
        "congestion_weight": 1.1,
        "signal_weight": 1.0,
        "decay_weight": 1.0,
        "stability_threshold": 15.0,
    },
    "pregnant": {
        "distance_weight": 0.7,
        "accessibility_weight": 1.0,
        "effort_weight": 1.0,
        "safety_weight": 1.8,
        "congestion_weight": 1.1,
        "signal_weight": 1.0,
        "decay_weight": 1.0,
        "stability_threshold": 15.0,
    }
}

BAD_SURFACES = ['cobblestone', 'unpaved', 'gravel', 'dirt', 'grass', 'sand', 'sett']
GOOD_SURFACES = ['asphalt', 'concrete', 'paved', 'paving_stones']

def _clean_val(val):
    if val is None:
        return 'unknown'
    if hasattr(val, 'iloc'):
        val = val.iloc[0]
    if isinstance(val, list) and len(val) > 0:
        val = val[0]
    return str(val).lower().strip()

def evaluate_feasibility(edge_data, profile_name):
    """
    Returns (status, multipliers, explanation_list)
    multipliers = {'accessibility': M_acc, 'effort': M_eff, 'safety': M_saf}
    Status can be 'FEASIBLE', 'WARNING', 'INACCESSIBLE'
    """
    profile_name = profile_name.lower() if profile_name else "general"
    if profile_name not in PADA_PROFILES:
        profile_name = "general"
        
    has_stairs = edge_data.get('stairs', False)
    if has_stairs is None: has_stairs = False
    if hasattr(has_stairs, 'iloc'): has_stairs = has_stairs.iloc[0]
    has_stairs = bool(has_stairs)
    
    wc_access = edge_data.get('wheelchair_accessible')
    if hasattr(wc_access, 'iloc'): wc_access = wc_access.iloc[0]
    
    surface = _clean_val(edge_data.get('surface_type'))
    smoothness = _clean_val(edge_data.get('smoothness_value'))
    tactile = _clean_val(edge_data.get('tactile_paving'))
    incline = _clean_val(edge_data.get('incline_value'))
    
    signals = edge_data.get('signals', [])
    
    # Base multipliers
    m_acc = 0.0
    m_eff = 0.0
    m_saf = 0.0
    
    explanation = []
    status = "FEASIBLE"
    
    # 1. Effort calculation
    if surface in BAD_SURFACES:
        m_eff += 0.5  # 50% extra effort per meter
    elif surface in GOOD_SURFACES:
        m_eff -= 0.1  # 10% less effort
        
    if smoothness == 'bad' or smoothness == 'intermediate':
        m_eff += 0.3
        
    if incline in ['up', 'down']:
        m_eff += 0.8
        
    # 2. Safety calculation
    if len(signals) > 0:
        m_saf -= 0.4 # Reward traffic signals (safer crossing)
        
    if tactile == 'no':
        m_saf += 0.5 # Penalty for no tactile paving
    elif tactile == 'yes':
        m_saf -= 0.3 # Reward for tactile paving

    # 3. Profile-Specific Hard Constraints & Explanations
    if profile_name == "wheelchair":
        if has_stairs or wc_access is False:
            return "INACCESSIBLE", None, ["Inaccessible due to stairs or barriers."]
        if surface in BAD_SURFACES:
            m_acc += 2.0
            status = "WARNING"
            explanation.append("Warning: Difficult surface type.")
            
    elif profile_name == "elderly":
        if has_stairs:
            m_eff += 5.0
            status = "WARNING"
            explanation.append("High effort penalty for stairs.")
            
    elif profile_name == "pregnant":
        if has_stairs:
            m_eff += 3.0
            m_saf += 1.0
            status = "WARNING"
            explanation.append("Effort and safety penalty for stairs.")
            
    elif profile_name == "general":
        if has_stairs:
            m_eff += 0.5
            
    multipliers = {
        'accessibility': max(0.0, m_acc),
        'effort': max(0.0, m_eff),
        'safety': max(0.0, m_saf)
    }
            
    return status, multipliers, explanation

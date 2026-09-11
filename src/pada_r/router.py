import networkx as nx
from typing import List, Dict, Any, Tuple
from src.routing import get_nearest_node
from src.pada_r.profiles import PADA_PROFILES
from src.pada_r.cost_model import calculate_pada_cost

def compute_pada_route(G, origin, destination, profile_name, sim_date_str, sim_hour, active_route_path=None):
    """
    Executes the PADA-R search and stability check.
    Returns (path, path_edges, route_status, route_explanation, stats)
    """
    orig_node = get_nearest_node(G, origin)
    dest_node = get_nearest_node(G, destination)
    
    profile_name = profile_name.lower() if profile_name else "general"
    if profile_name not in PADA_PROFILES:
        profile_name = "general"
        
    weights = PADA_PROFILES[profile_name]
    stability_threshold = weights['stability_threshold']
    
    # Store edge metadata for explanation extraction later
    edge_cache = {}
    
    def pada_weight_func(u, v, data):
        if G.is_multigraph():
            min_cost = float('inf')
            best_key = None
            best_res = None
            for key, edge_attrs in data.items():
                status, total_cost, breakdown, explanation = calculate_pada_cost(
                    u, v, edge_attrs, profile_name, sim_date_str, sim_hour
                )
                if status != 'INACCESSIBLE' and total_cost < min_cost:
                    min_cost = total_cost
                    best_key = key
                    best_res = (status, total_cost, breakdown, explanation)
            
            if best_res is None:
                return float('inf')
            
            edge_cache[(u, v)] = (best_key, best_res)
            return min_cost
        else:
            status, total_cost, breakdown, explanation = calculate_pada_cost(
                u, v, data, profile_name, sim_date_str, sim_hour
            )
            if status == 'INACCESSIBLE':
                return float('inf')
            edge_cache[(u, v)] = (None, (status, total_cost, breakdown, explanation))
            return total_cost
        
        
    try:
        candidate_path = nx.shortest_path(G, source=orig_node, target=dest_node, weight=pada_weight_func)
    except nx.NetworkXNoPath:
        return None, None, "NO_PATH_FOUND", ["No physically accessible path exists."], None
        
    # Evaluate candidate cost
    candidate_cost = 0.0
    for i in range(len(candidate_path) - 1):
        u, v = candidate_path[i], candidate_path[i+1]
        _, best_res = edge_cache[(u, v)]
        candidate_cost += best_res[1]
        
    # Stability Check
    route_status = "PERSONALIZED_OPTIMAL"
    final_path = candidate_path
    route_explanation = [f"Route selected because it minimizes personalized accessibility cost for the {profile_name.replace('_', ' ').title()} profile."]
    
    # Check if active route is still valid and evaluate its cost
    if active_route_path and len(active_route_path) > 0 and active_route_path[0] == orig_node and active_route_path[-1] == dest_node:
        current_cost = 0.0
        current_feasible = True
        for i in range(len(active_route_path) - 1):
            u, v = active_route_path[i], active_route_path[i+1]
            data = G.get_edge_data(u, v)
            if data is None:
                current_feasible = False
                break
            
            if G.is_multigraph():
                min_cost = float('inf')
                best_res = None
                for key, edge_attrs in data.items():
                    s, c, b, e = calculate_pada_cost(
                        u, v, edge_attrs, profile_name, sim_date_str, sim_hour
                    )
                    if s != 'INACCESSIBLE' and c < min_cost:
                        min_cost = c
                        best_res = (s, c, b, e)
                
                if best_res is None:
                    current_feasible = False
                    break
                status, cost, breakdown, explanation = best_res
            else:
                status, cost, breakdown, explanation = calculate_pada_cost(
                    u, v, data, profile_name, sim_date_str, sim_hour
                )
            
            
            if status == 'INACCESSIBLE' or cost == float('inf'):
                current_feasible = False
                break
            current_cost += cost
            
        if current_feasible:
            improvement = current_cost - candidate_cost
            if improvement > 0 and improvement < stability_threshold:
                # Retain current route for stability
                final_path = active_route_path
                route_status = "STABLE_RETAINED"
                route_explanation.append(f"Route retained because the alternative improvement ({improvement:.1f}) was below the route-change threshold ({stability_threshold:.1f}).")
            elif improvement >= stability_threshold:
                route_explanation.append(f"Selected because alternative improvement ({improvement:.1f}) exceeded stability threshold ({stability_threshold:.1f}).")
            
    # Build edge list for final path
    path_edges = []
    total_cost = 0.0
    total_dist = 0.0
    total_physical_dist = 0.0
    total_acc = 0.0
    total_eff = 0.0
    total_saf = 0.0
    total_cong = 0.0
    total_sig = 0.0
    total_decay = 0.0
    
    has_congestion = False
    has_decay = False
    has_warning = False
    
    for i in range(len(final_path) - 1):
        u, v = final_path[i], final_path[i+1]
        raw = G.get_edge_data(u, v)
        if raw is None:
            continue
            
        if G.is_multigraph():
            if (u, v) in edge_cache:
                chosen_key, best_res = edge_cache[(u, v)]
                edge_data = raw[chosen_key].copy()
                status, cost, breakdown, explanation = best_res
            else:
                # Fallback if edge not in cache (e.g. from stable active route)
                min_cost = float('inf')
                best_res = None
                chosen_key = None
                for key, edge_attrs in raw.items():
                    s, c, b, e = calculate_pada_cost(
                        u, v, edge_attrs, profile_name, sim_date_str, sim_hour
                    )
                    if s != 'INACCESSIBLE' and c < min_cost:
                        min_cost = c
                        best_res = (s, c, b, e)
                        chosen_key = key
                if best_res is None:
                    # Defensive fallback
                    chosen_key = list(raw.keys())[0]
                    best_res = calculate_pada_cost(u, v, raw[chosen_key], profile_name, sim_date_str, sim_hour)
                
                edge_data = raw[chosen_key].copy()
                status, cost, breakdown, explanation = best_res
        else:
            edge_data = raw.copy()
            status, cost, breakdown, explanation = calculate_pada_cost(
                u, v, edge_data, profile_name, sim_date_str, sim_hour
            )
        
        if breakdown is None:
            # Reconstruct fallback breakdown for INACCESSIBLE edges
            breakdown = {
                'distance': edge_data.get('length', edge_data.get('length_m', 0)),
                'accessibility': 0, 'effort': 0, 'safety': 0,
                'congestion': 0, 'signal': 0, 'decay': 0
            }
        
        edge_data['cost'] = cost
        edge_data['cost_breakdown'] = breakdown
        path_edges.append(edge_data)
        
        total_cost += cost
        total_dist += breakdown['distance']
        total_physical_dist += edge_data.get('length', edge_data.get('length_m', 0))
        total_acc += breakdown['accessibility']
        total_eff += breakdown['effort']
        total_saf += breakdown['safety']
        total_cong += breakdown['congestion']
        total_sig += breakdown['signal']
        total_decay += breakdown['decay']
        
        if breakdown['congestion'] > 0: has_congestion = True
        if breakdown['decay'] > 0: has_decay = True
        if status == 'WARNING': has_warning = True
        
    if has_warning:
        route_explanation.append("Selected because accessibility requirements outweighed the additional distance, but contains some warnings.")
    if has_decay:
        route_explanation.append("Selected because the active signal-decay penalty increased the cost of alternative segments.")
    elif has_congestion:
        route_explanation.append("Selected because alternative routes currently have high congestion.")
        
    stats = {
        'distance': total_physical_dist,
        'cost': total_cost,
        'cost_breakdown': {
            'distance': total_dist,
            'accessibility': total_acc,
            'effort': total_eff,
            'safety': total_saf,
            'congestion': total_cong,
            'signal': total_sig,
            'decay': total_decay,
            'stability': 0.0 # Just for visual completeness
        }
    }
        
    return final_path, path_edges, route_status, route_explanation, stats

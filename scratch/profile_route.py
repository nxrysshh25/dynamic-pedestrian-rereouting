import sys
sys.path.insert(0, '.')
import time
import json
import networkx as nx

from src.graph_manager import load_or_build_graph
from src.pada_r.router import compute_pada_route
from src.darr.router import compute_darr_routes
from src.darr.subgraph import subgraph_manager
from src.darr.resilience import resilience_engine
from src.darr.candidate_generator import route_generator
from src.darr.counterfactual import counterfactual_evaluator
from src.darr.collapse_predictor import collapse_predictor
from src.weather.service import weather_service
from src.routing import get_nearest_node

def profile_representative_route():
    print("=" * 60)
    print("PROFILING VIT VELLORE ROUTE REQUEST")
    print("=" * 60)

    # 1. Graph Loading
    t0 = time.perf_counter()
    G = load_or_build_graph()
    t_load = (time.perf_counter() - t0) * 1000
    print(f"1. Graph loading / build: {t_load:.2f} ms")

    # Representative OD: MGR to SJT
    locs = json.load(open('data/vit_vellore/processed/vit_manual_locations.json'))['locations']
    mgr = locs[0] # MGR
    sjt = locs[3] # SJT
    orig_point = (mgr['longitude'], mgr['latitude'])
    dest_point = (sjt['longitude'], sjt['latitude'])
    profile = "wheelchair"
    print(f"Profile: {profile}, OD: {mgr['name']} -> {sjt['name']}")

    orig_node = get_nearest_node(G, orig_point)
    dest_node = get_nearest_node(G, dest_point)

    # 2. Weather Lookup
    t0 = time.perf_counter()
    w = weather_service.get_current_weather()
    t_weather = (time.perf_counter() - t0) * 1000
    print(f"2. Weather lookup (cached): {t_weather:.2f} ms")

    # 3. Accessible Subgraph Generation
    t0 = time.perf_counter()
    G_sub = subgraph_manager.get_accessible_subgraph(G, profile)
    t_subgraph = (time.perf_counter() - t0) * 1000
    print(f"3. Accessible subgraph generation (1x): {t_subgraph:.2f} ms")

    # 4. PADA-R Routing
    t0 = time.perf_counter()
    p_path, p_edges, p_status, p_exp, p_stats = compute_pada_route(G, orig_point, dest_point, profile)
    t_pada = (time.perf_counter() - t0) * 1000
    print(f"4. PADA-R routing: {t_pada:.2f} ms")

    # 5. DARR Candidate Generation breakdown
    # Let's measure CAD standalone
    sample_edge = next(iter(G.edges(keys=True)))
    t0 = time.perf_counter()
    cad_val = resilience_engine.calculate_cad_for_edge(G, sample_edge[0], sample_edge[1], profile)
    t_cad_1 = (time.perf_counter() - t0) * 1000
    print(f"5a. CAD for single edge (no bridge cache): {t_cad_1:.2f} ms")

    # Let's measure CAD standalone with precomputed bridges
    bridges = resilience_engine._get_bridges(G_sub)
    t0 = time.perf_counter()
    cad_val_cached = resilience_engine.calculate_cad_for_edge(G, sample_edge[0], sample_edge[1], profile, bridge_cache=bridges)
    t_cad_cached = (time.perf_counter() - t0) * 1000
    print(f"5b. CAD for single edge (WITH bridge cache): {t_cad_cached:.4f} ms")

    # 6. Candidate Generation
    t0 = time.perf_counter()
    candidates = route_generator.generate_candidate_routes(G, orig_node, dest_node, profile)
    t_candidates = (time.perf_counter() - t0) * 1000
    print(f"6. DARR candidate routes generation: {t_candidates:.2f} ms")

    # 7. AOC & ARL standalone
    t0 = time.perf_counter()
    aoc = resilience_engine.calculate_aoc(G_sub, orig_node, dest_node)
    t_aoc = (time.perf_counter() - t0) * 1000
    print(f"7. AOC calculation: {t_aoc:.2f} ms (val={aoc})")

    all_paths = [c["path_nodes"] for c in candidates] if candidates else []
    t0 = time.perf_counter()
    arl = resilience_engine.calculate_arl(G_sub, orig_node, dest_node, all_paths)
    t_arl = (time.perf_counter() - t0) * 1000
    print(f"8. ARL calculation: {t_arl:.2f} ms (val={arl})")

    # 8. MAL standalone
    if candidates:
        t0 = time.perf_counter()
        mal_res = counterfactual_evaluator.simulate_assignment(G, candidates[0]["path_nodes"], profile, source=orig_node, destination=dest_node)
        t_mal = (time.perf_counter() - t0) * 1000
        print(f"9. MAL standalone simulation (1 candidate): {t_mal:.2f} ms")

    # 9. Collapse prediction
    t0 = time.perf_counter()
    collapse_res = collapse_predictor.predict_resilience(G, orig_node, dest_node, profile)
    t_collapse = (time.perf_counter() - t0) * 1000
    print(f"10. Collapse prediction: {t_collapse:.2f} ms")

    # 10. End-to-end compute_darr_routes
    t0 = time.perf_counter()
    darr_res = compute_darr_routes(G, orig_point, dest_point, profile)
    t_darr_total = (time.perf_counter() - t0) * 1000
    print(f"11. Entire compute_darr_routes: {t_darr_total:.2f} ms")

    # 11. Full End-to-end /api/route execution
    # Simulating what /api/route does
    t0 = time.perf_counter()
    p_path, p_edges, p_status, p_exp, p_stats = compute_pada_route(G, orig_point, dest_point, profile)
    darr_res = compute_darr_routes(G, orig_point, dest_point, profile)
    # response formatting
    route_coords = []
    restricted = []
    for edge in (p_edges or []):
        geom = edge.get('geometry')
        if geom and hasattr(geom, 'coords'):
            route_coords.extend(list(geom.coords))
    resp = {
        "algorithm": "DARR",
        "route_status": p_status,
        "stats": p_stats,
        "candidate_routes": darr_res.get("candidate_routes", []),
        "selected_candidate": darr_res.get("selected_route")
    }
    t_serialize_start = time.perf_counter()
    json_bytes = json.dumps(resp, default=str)
    t_serialize = (time.perf_counter() - t_serialize_start) * 1000
    t_full_route = (time.perf_counter() - t0) * 1000

    print("=" * 60)
    print(f"TOTAL /api/route EXECUTION TIME: {t_full_route:.2f} ms")
    print(f"  - PADA-R: {t_pada:.2f} ms ({t_pada/t_full_route*100:.1f}%)")
    print(f"  - DARR:   {t_darr_total:.2f} ms ({t_darr_total/t_full_route*100:.1f}%)")
    print(f"  - Serialization: {t_serialize:.2f} ms ({t_serialize/t_full_route*100:.1f}%)")
    print("=" * 60)

if __name__ == '__main__':
    profile_representative_route()

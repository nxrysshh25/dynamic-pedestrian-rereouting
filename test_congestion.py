import os
import sys
import pickle

project_root = os.path.abspath(os.path.dirname(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.pada_r.router import compute_pada_route
from src.signal_decay.engine import decay_engine
from src.routing import get_nearest_node

# Load graph
graph_path = os.path.join(project_root, "data", "vit_vellore", "processed", "vit_vellore_academic_pedestrian_network.pkl")
with open(graph_path, 'rb') as f:
    G_base = pickle.load(f)

print("=== CONGESTION INJECTION TEST ===")

# Test GDN to TT because it succeeded in the validation script
# Wait, let's use MGR to CTS or another valid one.
# Let's find valid nodes first.
locations = {
    "MGR": (79.15583638463455, 12.969035851408112),
    "CTS": (79.15623259923282, 12.970266027390673),
    "TT": (79.15953483469843, 12.97082312983498),
    "SJT": (79.16394473901578, 12.970917609834906),
}

origin = locations["TT"]
dest = locations["SJT"]

profile = "general"
sim_date_str = "2026-09-09"
sim_hour = 12

print("1. Baseline Route")
path_baseline, edges_baseline, status, explanation, stats_baseline = compute_pada_route(
    G_base, origin, dest, profile, sim_date_str, sim_hour
)
if not path_baseline:
    print("Baseline route failed.")
    sys.exit(1)

print(f"Baseline: Cost={stats_baseline['cost']:.1f}, Dist={stats_baseline['distance']:.1f}m, Nodes={len(path_baseline)}")
active_route = path_baseline

# Pick an edge in the middle to congest
mid_idx = len(path_baseline) // 2
congest_u = path_baseline[mid_idx]
congest_v = path_baseline[mid_idx+1]
print(f"\n2. Injecting HIGH congestion on edge ({congest_u}, {congest_v})")
event_id = decay_engine.add_penalty(congest_u, congest_v, penalty_value=200.0, event_type="HIGH")

print("\n3. Recalculating Route (0s decay)")
path_congested, edges_congested, status_congested, explanation, stats_congested = compute_pada_route(
    G_base, origin, dest, profile, sim_date_str, sim_hour, active_route_path=active_route
)

print(f"Congested: Cost={stats_congested['cost']:.1f}, Dist={stats_congested['distance']:.1f}m, Nodes={len(path_congested)}, Status={status_congested}")
print(f"Route changed? {path_congested != path_baseline}")
edge_used = False
for i in range(len(path_congested)-1):
    if (path_congested[i] == congest_u and path_congested[i+1] == congest_v) or \
       (path_congested[i] == congest_v and path_congested[i+1] == congest_u):
        edge_used = True
print(f"Does new route avoid congested edge? {not edge_used}")

active_route = path_congested

print("\n4. Simulating Decay (900s elapsed)")
decay_engine.update_time(900.0)
penalty = decay_engine.get_penalty(congest_u, congest_v)
print(f"Current penalty on edge: {penalty:.2f}")

print("\n5. Recalculating Route (900s decay)")
path_recovered, edges_recovered, status_recovered, explanation, stats_recovered = compute_pada_route(
    G_base, origin, dest, profile, sim_date_str, sim_hour, active_route_path=active_route
)
print(f"Recovered: Cost={stats_recovered['cost']:.1f}, Dist={stats_recovered['distance']:.1f}m, Nodes={len(path_recovered)}, Status={status_recovered}")
print(f"Route recovered to baseline? {path_recovered == path_baseline}")

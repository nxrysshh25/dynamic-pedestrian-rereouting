import os
import sys
import pickle

project_root = os.path.abspath(os.path.dirname(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.pada_r.router import compute_pada_route
from src.routing import get_nearest_edge, get_nearest_node

# Load graph
graph_path = os.path.join(project_root, "data", "vit_vellore", "processed", "vit_vellore_academic_pedestrian_network.pkl")
with open(graph_path, 'rb') as f:
    G_base = pickle.load(f)

print(f"Loaded graph with {len(G_base.nodes)} nodes and {len(G_base.edges)} edges.")

locations = {
    "MGR": (79.15583638463455, 12.969035851408112),
    "SMV": (79.15766374408548, 12.969246074425618),
    "TT": (79.15953483469843, 12.97082312983498),
    "SJT": (79.16394473901578, 12.970917609834906),
    "PRP": (79.16640540870385, 12.971264636436771),
    "Gandhi Block": (79.16799249061337, 12.972225506107774),
    "CTS": (79.15623259923282, 12.970266027390673)
}

test_pairs = [
    ("MGR", "SMV"),
    ("SMV", "TT"),
    ("TT", "SJT"),
    ("SJT", "PRP"),
    ("PRP", "Gandhi Block"),
    ("MGR", "CTS"),
    ("CTS", "SMV")
]

profiles = ["general", "elderly", "pregnant", "wheelchair"]

sim_date_str = "2026-09-09"
sim_hour = 12

for src_name, dst_name in test_pairs:
    print(f"\n--- Testing Route: {src_name} -> {dst_name} ---")
    src_lonlat = locations[src_name]
    dst_lonlat = locations[dst_name]
    
    src_node = get_nearest_node(G_base, src_lonlat)
    dst_node = get_nearest_node(G_base, dst_lonlat)
    
    # We will compute route for each profile
    for profile in profiles:
        path, path_edges, status, explanation, stats = compute_pada_route(
            G_base, src_lonlat, dst_lonlat, profile, sim_date_str, sim_hour
        )
        
        if not path:
            print(f"  [{profile.upper()}] FAILED | No Path")
        else:
            stairs = sum(1 for e in path_edges if e.get('stairs'))
            ramps = sum(1 for e in path_edges if e.get('ramp'))
            dist = stats['distance']
            cost = stats['cost']
            print(f"  [{profile.upper()}] SUCCESS | Nodes: {len(path)} | Dist: {dist:.1f}m | Cost: {cost:.1f} | Stairs: {stairs} | Ramps: {ramps}")

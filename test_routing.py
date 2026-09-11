from src.data_loader import load_data
from src.data_cleaner import merge_datasets
from src.graph_builder import build_networkx_graph
from src.pada_r.router import compute_pada_route
from src.pada_r.profiles import PADA_PROFILES as PROFILE_WEIGHTS

print("Loading data...")
melb_gdf, osm_edges, osm_nodes = load_data()
merged_gdf = merge_datasets(melb_gdf, osm_edges)
G_base = build_networkx_graph(merged_gdf)

locations = {
    "Flinders Street Station": (144.9669, -37.8183),
    "State Library": (144.9646, -37.8098)
}
start_loc = locations["Flinders Street Station"]
end_loc = locations["State Library"]
profiles = ["general", "elderly", "mobility_impaired"]

for profile in profiles:
    print(f"\n--- Testing Profile: {profile.upper()} ---")
    
    # Calculate route using dynamic weights
    path, path_edges, _, _, stats = compute_pada_route(G_base, start_loc, end_loc, profile, None, None)
    
    if path and path_edges:
        total_length = sum([edge.get('length', 0) for edge in path_edges])
        total_cost = sum([edge.get('cost', 0) for edge in path_edges])
        stairs = sum([1 for edge in path_edges if edge.get('has_stairs', False)])
        inaccessible = sum([1 for edge in path_edges if edge.get('wheelchair_accessible') is False])
        
        print(f"Route Length: {total_length:.1f} m")
        print(f"Route Cost: {total_cost:.1f}")
        print(f"Stairs: {stairs}")
        print(f"Inaccessible: {inaccessible}")
    else:
        print("No path found.")

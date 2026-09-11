import streamlit as st
import folium
from streamlit_folium import st_folium
import os
import sys
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import networkx as nx

from src.data_loader import load_data
from src.data_cleaner import merge_datasets
from src.graph_builder import build_networkx_graph
from src.pada_r.router import compute_pada_route
from src.visualization import create_map
from src.pada_r.profiles import PADA_PROFILES as PROFILE_WEIGHTS

st.set_page_config(page_title="Accessibility-Aware Routing", layout="wide")

from src.graph_manager import load_or_build_graph

@st.cache_resource
def get_graph():
    st.write("Loading graph (check console for detailed logs)...")
    return load_or_build_graph()

st.title("Accessibility-Aware Static Pedestrian Routing")
st.markdown("Proof of Concept - Milestone 1")

# Load graph (cached)
G_base = None
try:
    G_base = get_graph()
except Exception as e:
    st.error(f"Error loading data: {e}")
    st.stop()

# UI Layout
col1, col2 = st.columns([1, 3])

with col1:
    st.header("Settings")
    profile = st.selectbox("Select User Profile", list(PROFILE_WEIGHTS.keys()))
    
    st.subheader("Test Scenarios")
    
    # Pre-defined test locations (lon, lat) within Melbourne CBD bounding box
    locations = {
        "Flinders Street Station": (144.9669, -37.8183),
        "State Library": (144.9646, -37.8098),
        "Parliament House": (144.9740, -37.8115),
        "Flagstaff Gardens": (144.9555, -37.8105)
    }
    
    start_loc_name = st.selectbox("Source", list(locations.keys()), index=0)
    end_loc_name = st.selectbox("Destination", list(locations.keys()), index=1)
    
    start_loc = locations[start_loc_name]
    end_loc = locations[end_loc_name]
    
    st.markdown("---")
    st.subheader("Profile Penalty Weights")
    st.json(PROFILE_WEIGHTS[profile])
    
    st.info("Note: When offline, the map background (tiles) may not render, but the route geometry and calculations will run instantly.")

with col2:
    st.header("Route Map")
    
    if G_base is not None:
        # Calculate Route directly using dynamic weights (No graph copying needed!)
        path, path_edges, _, _, stats = compute_pada_route(G_base, start_loc, end_loc, profile, None, None)
        
        if path and path_edges:
            # Calculate stats
            total_length = stats['distance']
            total_cost = stats['cost']
            stairs_count = sum([1 for edge in path_edges if edge.get('has_stairs', False)])
            inaccessible_count = sum([1 for edge in path_edges if edge.get('wheelchair_accessible') is False])
            
            # Display Stats
            st.write(f"**Route Length:** {total_length:.1f} m | **Route Cost:** {total_cost:.1f}")
            st.write(f"**Stairs Encountered:** {stairs_count} | **Inaccessible Segments:** {inaccessible_count}")
            
            # Render Map
            m = create_map(G_base, path, path_edges, start_loc, end_loc)
            st_folium(m, width=900, height=600)
        else:
            st.warning("Could not find a path between these locations.")
    else:
        st.warning("Graph data is not available. Check logs for download errors.")

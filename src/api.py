from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any

from src.graph_manager import load_or_build_graph
from src.pada_r.router import compute_pada_route
from src.config.loader import DATASETS_CONFIG

app = FastAPI(title="Accessibility-Aware Routing API")

# Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

G_base = None

@app.get("/api/config")
def get_config():
    active_dataset = DATASETS_CONFIG.get("active", "melbourne")
    return DATASETS_CONFIG.get("datasets", {}).get(active_dataset, {})

@app.on_event("startup")
def startup_event():
    global G_base
    print("Initializing Graph on startup...")
    G_base = load_or_build_graph()
    print("Graph initialized successfully.")

class RouteRequest(BaseModel):
    origin: List[float] # [lon, lat]
    destination: List[float] # [lon, lat]
    profile: str = "general"

@app.post("/api/route")
def get_route(request: RouteRequest):
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded yet")
        
    origin_tuple = (request.origin[0], request.origin[1])
    dest_tuple = (request.destination[0], request.destination[1])
    
    # Pass simulation state to calculate_route
    from src.simulation.controller import sim_controller
    sim_state = sim_controller.get_state()
    
    path, path_edges, route_status, route_explanation, stats = compute_pada_route(
        G_base, origin_tuple, dest_tuple, request.profile, 
        sim_date_str=sim_state['date'], 
        sim_hour=sim_state['hour'],
        active_route_path=sim_controller.active_route_path
    )
    
    if not path or not path_edges:
        raise HTTPException(status_code=404, detail="No path found between these locations")
        
    # Store the active route path for stability calculations
    sim_controller.active_route_path = path
    
    # Collect coordinates to form a GeoJSON LineString
    route_coords = []
    restricted_segments = []
    
    for edge in path_edges:
        geom = edge.get('geometry')
        if geom is None or not hasattr(geom, 'coords'):
            # Defensive fallback: this should not happen after graph_manager
            # ensures geometry, but log and skip to avoid 500.
            import logging
            logging.getLogger(__name__).error(
                f"Edge {edge.get('edge_id','?')} still missing Shapely geometry at route-build time."
            )
            continue
        coords = list(geom.coords)
        route_coords.extend(coords)
        
        is_restricted = edge.get('stairs', False) or edge.get('wheelchair_accessible') is False
        if is_restricted or edge.get('cost', 0) > edge.get('length', edge.get('length_m', 0)) * 2: # Highlight high cost edges too
            restricted_segments.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                },
                "properties": {
                    "cost": edge.get('cost', 0),
                    "stairs": edge.get('stairs', False),
                    "wheelchair_accessible": edge.get('wheelchair_accessible'),
                    "cost_breakdown": edge.get('cost_breakdown', {})
                }
            })

    geojson_route = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": route_coords
        },
        "properties": {
            "profile": request.profile,
            "total_cost": stats['cost']
        }
    }
    
    return {
        "algorithm": "PADA-R",
        "route_status": route_status,
        "route_explanation": route_explanation,
        "route": geojson_route,
        "restricted_segments": {
            "type": "FeatureCollection",
            "features": restricted_segments
        },
        "stats": stats
    }

class SimStepRequest(BaseModel):
    delta_seconds: float

@app.get("/api/simulation/state")
def get_sim_state():
    from src.simulation.controller import sim_controller
    state = sim_controller.get_state()
    if G_base is not None and 'active_decay_events' in state:
        for evt in state['active_decay_events']:
            u, v = evt['edge']
            if G_base.has_node(u) and G_base.has_node(v):
                evt['coordinates'] = [
                    [G_base.nodes[u]['x'], G_base.nodes[u]['y']],
                    [G_base.nodes[v]['x'], G_base.nodes[v]['y']]
                ]
    return state

@app.post("/api/simulation/step")
def step_simulation(req: SimStepRequest):
    from src.simulation.controller import sim_controller
    sim_controller.step(req.delta_seconds)
    return sim_controller.get_state()

@app.post("/api/simulation/reset")
def reset_simulation():
    from src.simulation.controller import sim_controller
    sim_controller.reset()
    return sim_controller.get_state()

class SelectEdgeRequest(BaseModel):
    lon: float
    lat: float

@app.post("/api/simulation/select_edge")
def select_edge(req: SelectEdgeRequest):
    from src.routing import get_nearest_edge
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded")
        
    u, v, geometry, dist = get_nearest_edge(G_base, (req.lon, req.lat))
    if u is None:
        raise HTTPException(status_code=404, detail="Could not identify a pedestrian road segment here.")
        
    return {
        "u": u,
        "v": v,
        "geometry": geometry,
        "distance": dist
    }

class InjectCongestionRequest(BaseModel):
    u: Any
    v: Any
    intensity: str = "HIGH"

@app.post("/api/simulation/inject_congestion")
def inject_congestion(req: InjectCongestionRequest):
    from src.signal_decay.engine import decay_engine
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded")
        
    u_tuple = req.u
    v_tuple = req.v
    
    if not G_base.has_edge(u_tuple, v_tuple) and not G_base.has_edge(v_tuple, u_tuple):
        raise HTTPException(status_code=400, detail="Invalid edge provided")
        
    penalty_map = {
        "LOW": 50.0,
        "MEDIUM": 100.0,
        "HIGH": 200.0
    }
    applied_penalty = penalty_map.get(req.intensity.upper(), 200.0)
        
    # Inject penalty to the specific edge
    eid = decay_engine.add_penalty(u_tuple, v_tuple, penalty_value=applied_penalty, event_type=req.intensity.upper())
        
    return {"status": "success", "event_id": eid, "edge": [u_tuple, v_tuple]}

@app.get("/api/sensors")
def get_sensors():
    import os
    import pandas as pd
    active_dataset = DATASETS_CONFIG.get("active", "melbourne")
    if active_dataset != "melbourne":
        return []
    sensors_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "raw", "pedestrian_sensors", "sensor_locations.csv")
    if not os.path.exists(sensors_path):
        return []
    df = pd.read_csv(sensors_path)
    return df[['location_id', 'sensor_name', 'latitude', 'longitude']].to_dict(orient='records')

@app.get("/api/signals")
def get_signals():
    import os
    import pandas as pd
    active_dataset = DATASETS_CONFIG.get("active", "melbourne")
    if active_dataset != "melbourne":
        return []
    signals_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "raw", "traffic_signals", "victorian_traffic_signals.csv")
    if not os.path.exists(signals_path):
        return []
    df = pd.read_csv(signals_path)
    return df[['SITE_NO', 'SITE_NAME', 'LATITUDE', 'LONGITUDE']].to_dict(orient='records')

@app.get("/api/landmarks")
def get_landmarks():
    import os
    import json
    import geopandas as gpd
    active_dataset = DATASETS_CONFIG.get("active", "melbourne")
    if active_dataset == "melbourne":
        return [
            {"name": "Flinders Street Station", "coords": [144.9669, -37.8183]},
            {"name": "State Library", "coords": [144.9646, -37.8098]},
            {"name": "Parliament House", "coords": [144.9740, -37.8115]},
            {"name": "Flagstaff Gardens", "coords": [144.9555, -37.8105]},
        ]
    elif active_dataset == "vit_vellore":
        processed_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "vit_vellore", "processed")
        path = os.path.join(processed_dir, "vit_manual_locations.json")
        results = []
        if os.path.exists(path):
            with open(path, 'r') as f:
                data = json.load(f)
                for loc in data.get('locations', []):
                    results.append({
                        "name": loc['name'],
                        "coords": [loc['longitude'], loc['latitude']]
                    })
        return results
    return []

@app.get("/api/academic_blocks")
def get_academic_blocks():
    import os
    import json
    active_dataset = DATASETS_CONFIG.get("active", "melbourne")
    if active_dataset == "vit_vellore":
        processed_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "vit_vellore", "processed")
        path = os.path.join(processed_dir, "vit_manual_locations.json")
        if os.path.exists(path):
            with open(path, 'r') as f:
                data = json.load(f)
            features = []
            for loc in data.get('locations', []):
                # Return only academic blocks for the specific visual layer
                if loc.get('type') == 'academic_block':
                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [loc['longitude'], loc['latitude']]
                        },
                        "properties": {
                            "name": loc['name'],
                            "short_name": loc['short_name'],
                            "id": loc['id']
                        }
                    })
            return {"type": "FeatureCollection", "features": features}
    return {"type": "FeatureCollection", "features": []}

@app.get("/api/pedestrian_network")
def get_pedestrian_network():
    if G_base is None:
        return {"type": "FeatureCollection", "features": []}
        
    features = []
    for u, v, k, d in G_base.edges(keys=True, data=True):
        geom = d.get('geometry')
        if not geom: continue
        
        props = dict(d)
        if 'geometry' in props:
            del props['geometry']
            
        name = props.get('name')
        if name:
            props['display_name'] = name
        else:
            u_block = G_base.nodes[u].get('academic_block_id')
            v_block = G_base.nodes[v].get('academic_block_id')
            
            if u_block and v_block and u_block != v_block:
                props['display_name'] = f"{u_block}_to_{v_block}_Walkway"
            elif u_block and props.get('stairs'):
                props['display_name'] = f"{u_block} Stairs"
            elif v_block and props.get('stairs'):
                props['display_name'] = f"{v_block} Stairs"
            elif props.get('stairs'):
                props['display_name'] = "STAIRS"
            elif props.get('ramp'):
                props['display_name'] = "RAMP"
            else:
                props['display_name'] = None
                
        # Only keep useful properties to save bandwidth
        clean_props = {
            "edge_id": props.get("edge_id"),
            "name": props.get("name"),
            "display_name": props.get("display_name"),
            "stairs": props.get("stairs", False),
            "ramp": props.get("ramp", False),
            "highway": props.get("highway")
        }
                
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": list(geom.coords)
            },
            "properties": clean_props
        })
        
    return {"type": "FeatureCollection", "features": features}

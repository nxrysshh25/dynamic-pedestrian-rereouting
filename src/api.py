from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
import os
import json

from src.graph_manager import load_or_build_graph
from src.pada_r.router import compute_pada_route
from src.config.loader import DATASETS_CONFIG
from src.darr.router import compute_darr_routes
from src.darr.resilience import resilience_engine
from src.darr.collapse_predictor import collapse_predictor
from src.darr.counterfactual import counterfactual_evaluator
from src.weather.service import weather_service
from src.pcvc import pcvc_controller, evidence_tracker, VerificationEventCreateRequest
import time

app = FastAPI(title="Dynamic Accessibility Resilience Routing (DARR) API")

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
    active_dataset = DATASETS_CONFIG.get("active", "vit_vellore")
    return DATASETS_CONFIG.get("datasets", {}).get(active_dataset, {})

@app.on_event("startup")
def startup_event():
    global G_base
    print("Initializing Graph on startup...")
    G_base = load_or_build_graph()
    print("Graph initialized successfully.")

class RouteRequest(BaseModel):
    origin: List[float]
    destination: List[float]
    profile: str = "general"

@app.post("/api/route")
def get_route(request: RouteRequest):
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded yet")
        
    origin_tuple = (request.origin[0], request.origin[1])
    dest_tuple = (request.destination[0], request.destination[1])
    
    path, path_edges, route_status, route_explanation, stats = compute_pada_route(
        G_base, origin_tuple, dest_tuple, request.profile
    )
    
    if not path or not path_edges:
        raise HTTPException(status_code=404, detail="No path found between these locations")
        
    route_coords = []
    restricted_segments = []
    
    for edge in path_edges:
        geom = edge.get('geometry')
        if geom is None or not hasattr(geom, 'coords'):
            continue
        coords = list(geom.coords)
        route_coords.extend(coords)
        
        is_restricted = edge.get('stairs', False) or edge.get('wheelchair_accessible') is False
        if is_restricted or edge.get('cost', 0) > edge.get('length', edge.get('length_m', 0)) * 2:
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
    
    try:
        darr_res = compute_darr_routes(G_base, origin_tuple, dest_tuple, request.profile)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"DARR candidate computation fallback: {e}")
        darr_res = {
            "status": "FALLBACK",
            "candidate_routes": [],
            "selected_route": None,
            "network_resilience": None,
            "collapse_risk": None,
            "decision_summary": "PADA-R single-route baseline active."
        }

    return {
        "algorithm": "DARR (Dynamic Accessibility Resilience Routing)",
        "route_status": route_status,
        "route_explanation": route_explanation,
        "route": geojson_route,
        "restricted_segments": {
            "type": "FeatureCollection",
            "features": restricted_segments
        },
        "stats": stats,
        "candidate_routes": darr_res.get("candidate_routes", []),
        "selected_candidate": darr_res.get("selected_route"),
        "network_resilience": darr_res.get("network_resilience"),
        "collapse_risk": darr_res.get("collapse_risk"),
        "decision_summary": darr_res.get("decision_summary", "")
    }

@app.get("/api/weather")
def get_weather():
    return weather_service.get_current_weather()

@app.get("/api/landmarks")
def get_landmarks():
    import os
    import json
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

@app.get("/api/academic_blocks")
def get_academic_blocks():
    import os
    import json
    processed_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "vit_vellore", "processed")
    path = os.path.join(processed_dir, "vit_manual_locations.json")
    if os.path.exists(path):
        with open(path, 'r') as f:
            data = json.load(f)
        features = []
        for loc in data.get('locations', []):
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

@app.get("/api/pedestrian_network/stats")
def get_pedestrian_network_stats():
    if G_base is None:
        return {}
    
    stairs = 0
    ramps = 0
    crossings = 0
    barriers = 0
    slopes = 0
    subways = 0
    
    for u, v, d in G_base.edges(data=True):
        if d.get("stairs"): stairs += 1
        if d.get("ramp"): ramps += 1
        if d.get("crossing") and d.get("crossing") != "no": crossings += 1
        if d.get("barrier") and d.get("barrier") != "no": barriers += 1
        if d.get("subway"): subways += 1
        
        status = d.get("slope_status")
        percent = d.get("slope_percent")
        if status in ["up", "down"]:
            slopes += 1
        elif status == "measured" and percent is not None and percent > 4:
            slopes += 1
            
    return {
        "stairs": stairs,
        "ramps": ramps,
        "crossings": crossings,
        "barriers": barriers,
        "slopes": slopes,
        "subways": subways
    }

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
                
        clean_props = {
            "edge_id": props.get("edge_id"),
            "name": props.get("name"),
            "display_name": props.get("display_name"),
            "stairs": props.get("stairs", False),
            "ramp": props.get("ramp", False),
            "highway": props.get("highway"),
            "slope_percent": props.get("slope_percent"),
            "slope_status": props.get("slope_status"),
            "barrier": props.get("barrier"),
            "crossing": props.get("crossing"),
            "subway": props.get("subway", False)
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

@app.post("/api/routes/candidates")
def get_candidate_routes(request: RouteRequest):
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded yet")
        
    origin_tuple = (request.origin[0], request.origin[1])
    dest_tuple = (request.destination[0], request.destination[1])
    
    result = compute_darr_routes(G_base, origin_tuple, dest_tuple, request.profile)
    if result["status"] == "NO_PATH_FOUND":
        raise HTTPException(status_code=404, detail=result["message"])
    elif result["status"] == "NO_NODES_FOUND":
        raise HTTPException(status_code=400, detail=result["message"])
        
    return result

@app.get("/api/accessibility/resilience")
def get_accessibility_resilience(
    origin_lon: float = 79.155836,
    origin_lat: float = 12.969035,
    dest_lon: float = 79.159534,
    dest_lat: float = 12.970823,
    profile: str = "wheelchair"
):
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded")
        
    from src.routing import get_nearest_node
    from src.darr.subgraph import subgraph_manager
    u = get_nearest_node(G_base, (origin_lon, origin_lat))
    v = get_nearest_node(G_base, (dest_lon, dest_lat))
    
    G_sub = subgraph_manager.get_accessible_subgraph(G_base, profile)
    aoc = resilience_engine.calculate_aoc(G_sub, u, v)
    arl = resilience_engine.calculate_arl(G_sub, u, v)
    
    return {
        "profile": profile,
        "origin_node": u,
        "destination_node": v,
        "aoc": aoc,
        "arl": arl
    }

@app.get("/api/accessibility/collapse-risk")
def get_accessibility_collapse_risk(
    origin_lon: float = 79.155836,
    origin_lat: float = 12.969035,
    dest_lon: float = 79.159534,
    dest_lat: float = 12.970823,
    forecast_seconds: float = 300.0
):
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded")
        
    from src.routing import get_nearest_node
    u = get_nearest_node(G_base, (origin_lon, origin_lat))
    v = get_nearest_node(G_base, (dest_lon, dest_lat))
    
    return collapse_predictor.evaluate_all_profiles(G_base, u, v, forecast_seconds)

@app.get("/api/accessibility/critical-edges")
def get_critical_edges(profile: str = "wheelchair", threshold: float = 0.4):
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded")
        
    edges = resilience_engine.identify_critical_edges(G_base, profile, threshold)
    features = []
    for e in edges:
        if e.get("coordinates"):
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": e["coordinates"]
                },
                "properties": {
                    "u": e["u"],
                    "v": e["v"],
                    "name": e["name"],
                    "cad": e["cad"],
                    "differential_cad": e["differential_cad"],
                    "is_cut_edge": e["is_cut_edge"]
                }
            })
    return {"type": "FeatureCollection", "features": features}

class SimulateAssignmentRequest(BaseModel):
    candidate_path: List[Any]
    target_profile: str = "wheelchair"
    simulated_load: Optional[int] = 25

@app.post("/api/routing/simulate-assignment")
def simulate_assignment(req: SimulateAssignmentRequest):
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded")
        
    if not req.candidate_path or len(req.candidate_path) < 2:
        raise HTTPException(status_code=400, detail="candidate_path must contain at least 2 nodes")
        
    return counterfactual_evaluator.simulate_assignment(
        G_base, req.candidate_path, req.target_profile, simulated_load=req.simulated_load
    )

# ============================================================================
# PCVC (Profile-Coupled Counterfactual Verification Controller) Endpoints
# ============================================================================

@app.get("/api/accessibility/verification-target")
def get_verification_target(profile: str = "wheelchair", top_k: int = 5):
    """
    PCVC Closed-Loop Target Identification:
    Finds uncertain edges for the target profile, runs counterfactual resilience analysis,
    ranks by verification priority, and performs safe-return probe selection.
    """
    if G_base is None:
        raise HTTPException(status_code=503, detail="Graph not loaded yet")
    try:
        plan = pcvc_controller.compute_verification_targets(G_base, target_profile=profile, top_k=top_k)
        return plan.dict()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"PCVC execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PCVC calculation failed: {str(e)}")

@app.post("/api/accessibility/verification-event")
def create_verification_event(req: VerificationEventCreateRequest):
    """
    Creates/logs a verification task event in PENDING state.
    Provides the integration handoff for future ESP32 + MPU6050 physical traversal evidence.
    """
    event = evidence_tracker.create_verification_event(
        edge_id=req.edge_id,
        target_profile=req.target_profile,
        probe_profile=req.probe_profile,
        anchor_node=req.anchor_node,
        notes=req.notes
    )
    return event.dict()

@app.get("/api/accessibility/verification-events")
def list_verification_events(limit: int = 50):
    """Lists recent verification task events."""
    events = evidence_tracker.list_events(limit=limit)
    return [e.dict() for e in events]

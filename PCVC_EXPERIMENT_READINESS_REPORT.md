# PCVC Experiment Readiness Report
**Project:** Profile-Coupled Counterfactual Verification Controller (PCVC) for Accessibility-Aware Pedestrian Networks  
**Target Publication:** IEEE Access  
**Audit Date:** 2026-10-05  
**Audit Scope:** Ground-Truth Codebase and Dataset Verification  
**Repository Root:** `d:\dynamic_pedestrian_rerouting`

---

## Executive Summary

This report provides a code-verified audit of the software implementation, graph dataset, mathematical models, experimental capabilities, and reproducibility parameters of the PCVC project. Every metric, attribute count, equation, and status reported herein was directly extracted from the active source code, configuration files, test suite, and loaded graph instance (`MultiGraph` with 1,551 nodes and 1,721 edges) on 2026-10-05.

### Key Audit Findings

1. **Active Dataset:** The system strictly uses the VIT Vellore pedestrian network loaded from [data/vit_vellore/processed/vit_vellore_academic_pedestrian_network.pkl](file:///d:/dynamic_pedestrian_rerouting/data/vit_vellore/processed/vit_vellore_academic_pedestrian_network.pkl). All Melbourne CBD datasets and references are decoupled from the routing and PCVC controllers.
2. **Implementation Status:** The closed-loop verification pipeline is fully implemented across `src/pcvc/` (uncertainty quantification, counterfactual edge removal, multi-attribute ranking, closed-loop safe-return probe selection, and evidence freshness decay).
3. **Software Correctness:** The test suite ([tests/test_pcvc.py](file:///d:/dynamic_pedestrian_rerouting/tests/test_pcvc.py), [tests/test_darr.py](file:///d:/dynamic_pedestrian_rerouting/tests/test_darr.py), [tests/test_routing_dynamic.py](file:///d:/dynamic_pedestrian_rerouting/tests/test_routing_dynamic.py), [tests/test_signal_decay.py](file:///d:/dynamic_pedestrian_rerouting/tests/test_signal_decay.py)) passes 40 of 40 tests in 36.52 seconds.
4. **Important Experimental Diagnostic (Redundant/Coupled Impact Metrics):** The code audit proves that in [src/pcvc/counterfactual.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/counterfactual.py) and [src/darr/resilience.py](file:///d:/dynamic_pedestrian_rerouting/src/darr/resilience.py), `baseline_arl == float(baseline_aoc)`, `cf_arl == float(cf_aoc)`, `delta_arl == float(delta_aoc)`, and `mal_impact == delta_arl`. As a consequence, $\Delta\text{AOC}$, $\Delta\text{ARL}$, and $\text{MAL}$ are completely identical and collinear in candidate priority scoring.
5. **Priority Score Weight Implementation Discrepancy:** In [src/pcvc/controller.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py), `w_cost` (0.03) and `w_risk` (0.02) are defined in `DEFAULT_PCVC_WEIGHTS` but **omitted** from the priority score calculation, causing used weights to sum to 0.95.
6. **Experimental Readiness:** Experiments E1 (Natural Uncertainty), E4 (Profile Sensitivity), E5 (Safe-Return Evaluation), E6 (Probe Correctness), and E8 (Runtime) are **READY**. Experiments E2 (Oracle Masking), E3 (Ranking Comparison), E7 (Ablation), and E9 (Scalability) are **PARTIALLY READY**, requiring dedicated harness scripts.

---

## Part 1 — Project Structure

### Technology Stack & Versions

- **Frontend:**
  - Framework: React `19.2.8`
  - Build Tool / Dev Server: Vite `8.2.2`
  - Geospatial Rendering: MapLibre GL `6.6.0` (`maplibre-gl`), `react-map-gl` `8.1.2`
  - UI Icons: `lucide-react` `1.39.0`
  - Linter: `oxlint` `1.79.0`
  - Source Location: [frontend/](file:///d:/dynamic_pedestrian_rerouting/frontend)
- **Backend:**
  - Language: Python `3.14.2` (Windows 64-bit)
  - API Framework: FastAPI `0.141.1` (listed as `0.115.6` in [requirements.txt](file:///d:/dynamic_pedestrian_rerouting/requirements.txt))
  - ASGI Server: Uvicorn `0.52.4` (listed as `0.34.0` in [requirements.txt](file:///d:/dynamic_pedestrian_rerouting/requirements.txt))
  - Schema / Validation: Pydantic `2.13.5` (listed as `2.10.3` in [requirements.txt](file:///d:/dynamic_pedestrian_rerouting/requirements.txt))
  - Configuration: PyYAML `6.0.3`
  - Package Manager: `pip` `25.3` within virtual environment `.venv`
- **Routing & Graph Libraries:**
  - Graph Topology: NetworkX `3.6.1` (listed as `3.4.2` in [requirements.txt](file:///d:/dynamic_pedestrian_rerouting/requirements.txt))
  - Geospatial Network Analysis: OSMnx `2.1.1` (listed as `1.9.4` in [requirements.txt](file:///d:/dynamic_pedestrian_rerouting/requirements.txt))
  - Spatial Data: GeoPandas `1.1.4` (listed as `1.0.1` in [requirements.txt](file:///d:/dynamic_pedestrian_rerouting/requirements.txt))
  - Geometry Engine: Shapely `2.1.2`
  - Tabular Data: Pandas `3.0.5` (listed as `2.2.3` in [requirements.txt](file:///d:/dynamic_pedestrian_rerouting/requirements.txt)), NumPy `2.5.2`

### Directory Inventory

```
d:\dynamic_pedestrian_rerouting\
├── data/
│   ├── graph_cache_vit_vellore.pkl       # Fallback/alternative pickle cache
│   └── vit_vellore/
│       ├── map.osm                       # Raw OpenStreetMap XML extract of VIT Vellore
│       ├── boundary.geojson              # Campus boundary polygon
│       ├── locations.json                # Landmark definitions
│       ├── osm_edges.geojson             # Raw OSM edge layer
│       ├── osm_nodes.geojson             # Raw OSM node layer
│       ├── pedestrian_paths.geojson      # Raw pedestrian geometry
│       ├── raw/
│       │   └── friend_base_pedestrian_network.csv # Base pedestrian survey dataset
│       ├── processed/
│       │   ├── vit_vellore_academic_pedestrian_network.pkl     # ACTIVE production graph cache
│       │   ├── vit_vellore_academic_pedestrian_network.graphml # GraphML export
│       │   ├── vit_manual_locations.json                       # 9 campus landmarks & snapped nodes
│       │   ├── academic_blocks.geojson                         # Verified academic building polygons
│       │   ├── campus_boundary.geojson                         # OSM relation 15931944 boundary
│       │   ├── pedestrian_edges.geojson                        # Processed edge GeoJSON
│       │   ├── pedestrian_nodes.geojson                        # Processed node GeoJSON
│       │   ├── stairs.geojson                                  # Confirmed stairs edge subset
│       │   ├── crossings.geojson                               # Pedestrian crossing edge subset
│       │   ├── ramps.geojson                                   # Confirmed ramp edge subset
│       │   └── subways.geojson                                 # Grade-separated subway edge subset
│       └── validation/
│           └── validation_report.json    # Geometry and topological validation results
├── frontend/                             # React 19 + Vite 8 interactive map application
│   ├── package.json                      # Frontend dependency manifest
│   ├── src/                              # React application source
│   └── dist/                             # Compiled production bundle
├── src/                                  # Backend Python source packages
│   ├── api.py                            # FastAPI application router & API endpoints
│   ├── graph_manager.py                  # Graph loader & edge geometry repair
│   ├── routing.py                        # Nearest-node and legacy routing utilities
│   ├── accessibility.py                  # OSM tag parsing utility
│   ├── config/
│   │   ├── loader.py                     # YAML configuration loader
│   │   ├── datasets.yaml                 # Active dataset configuration
│   │   ├── darr_config.yaml              # Mobility profiles & resilience parameters
│   │   └── weights.yaml                  # Congestion and signal weights
│   ├── darr/                             # Dynamic Accessibility Resilience Routing package
│   │   ├── config.py                     # DARR configuration validator & profile loader
│   │   ├── subgraph.py                   # AccessibleSubgraphManager (profile filtering)
│   │   ├── resilience.py                 # AccessibilityResilienceEngine (AOC, ARL, CAD)
│   │   ├── router.py                     # DARR multi-candidate routing
│   │   ├── candidate_generator.py        # K-diverse corridor path generator
│   │   ├── collapse_predictor.py         # Network resilience forward forecasting
│   │   ├── counterfactual.py             # Route assignment load simulation
│   │   └── scorer.py                     # Resilience-weighted path scoring
│   ├── pada_r/                           # Profile-Aware Dynamic Accessibility Router
│   │   ├── profiles.py                   # Profile definitions & feasibility evaluator
│   │   ├── cost_model.py                 # Multi-factor edge cost model
│   │   └── router.py                     # PADA-R baseline Dijkstra search
│   ├── pcvc/                             # Profile-Coupled Counterfactual Verification Controller
│   │   ├── __init__.py                   # Package exports
│   │   ├── models.py                     # Pydantic data schemas & Enums
│   │   ├── uncertainty.py                # Uncertainty quantification & edge scanner
│   │   ├── counterfactual.py             # Counterfactual edge removal impact evaluator
│   │   ├── controller.py                 # Priority scoring & ranking controller
│   │   ├── probe_selector.py             # Closed-loop safe-return probe evaluator
│   │   └── evidence.py                   # Evidence freshness tracker & event manager
│   ├── signal_decay/
│   │   └── engine.py                     # Signal penalty exponential decay tracker
│   ├── weather/
│   │   ├── service.py                    # Real-time weather provider (Open-Meteo)
│   │   └── impact.py                     # Weather traversal multiplier calculator
│   ├── models/
│   │   └── edge_state.py                 # Dynamic edge state schema
│   ├── evaluation/
│   │   └── benchmark.py                  # Benchmark script (contains legacy Melbourne coordinates)
│   ├── data/
│   │   ├── vit_loader.py                 # Dataset loader wrapper
│   │   ├── melbourne_loader.py           # Legacy Melbourne CBD downloader (unused)
│   │   └── fetch_datasets.py             # Legacy Melbourne Overpass downloader (unused)
│   ├── congestion/                       # Empty directory (only __pycache__)
│   ├── simulation/                       # Empty directory (only __pycache__)
│   └── traffic/                          # Empty directory
├── scripts/
│   ├── build_vit_dataset_from_csv.py     # Active dataset synthesis script (CSV + OSM)
│   ├── build_final_dataset.py            # Comprehensive dataset synthesis script
│   ├── build_vit_dataset.py              # Direct OSMnx dataset download script
│   ├── validate_vit_dataset.py           # Graph topological and connectivity validator
│   └── write_audit.py                    # Forensic codebase audit script
├── tests/
│   ├── test_pcvc.py                      # 12 PCVC verification unit tests
│   ├── test_darr.py                      # 21 DARR resilience and routing unit tests
│   ├── test_routing_dynamic.py           # 3 PADA-R dynamic routing tests
│   └── test_signal_decay.py              # 4 Signal decay engine tests
└── scratch/                              # Ad-hoc diagnostic and audit scripts
```

### Exact Execution Entry Points

| Component | Exact Command Line | Working Directory | Primary Entry Point |
| :--- | :--- | :--- | :--- |
| **Backend API** | `uvicorn src.api:app --reload --port 8000` | Project root | [src/api.py](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L19) |
| **Frontend UI** | `npm run dev` | `frontend/` | [frontend/src/main.jsx](file:///d:/dynamic_pedestrian_rerouting/frontend/src) / `vite` |
| **Test Suite** | `pytest tests/ -v` | Project root | [tests/](file:///d:/dynamic_pedestrian_rerouting/tests) |
| **Dataset Build** | `python scripts/build_vit_dataset_from_csv.py` | Project root | [scripts/build_vit_dataset_from_csv.py](file:///d:/dynamic_pedestrian_rerouting/scripts/build_vit_dataset_from_csv.py#L48) |
| **PCVC Target Selection (Python)** | `from src.pcvc import pcvc_controller; plan = pcvc_controller.compute_verification_targets(G, target_profile="wheelchair", top_k=5)` | Project root | [src/pcvc/controller.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L67) |
| **PCVC Target Selection (HTTP)** | `GET http://localhost:8000/api/accessibility/verification-target?profile=wheelchair&top_k=5` | Remote / Local | [src/api.py](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L382) |

---

## Part 2 — Active Dataset Audit

### Dataset Identity & Configuration

The active dataset is dynamically determined by [src/config/datasets.yaml](file:///d:/dynamic_pedestrian_rerouting/src/config/datasets.yaml) via [src/config/loader.py](file:///d:/dynamic_pedestrian_rerouting/src/config/loader.py) and loaded in [src/graph_manager.py](file:///d:/dynamic_pedestrian_rerouting/src/graph_manager.py):

- **Active Key:** `vit_vellore`
- **Exact File Path:** `d:\dynamic_pedestrian_rerouting\data\vit_vellore\processed\vit_vellore_academic_pedestrian_network.pkl`
- **Format:** Python binary pickle (`pickle.load()`) of a NetworkX `MultiGraph`
- **Post-Load Geometry Validation:** [src/graph_manager.py](file:///d:/dynamic_pedestrian_rerouting/src/graph_manager.py#L25-L61) executes `_ensure_edge_geometry(G)`. Any edge missing a Shapely `LineString` or containing WKT strings is reconstructed from endpoint node coordinates $(x, y)$.

### Graph Topological Properties (Calculated directly from loaded graph)

| Topological Metric | Verified Value | Implementation Detail / Code Reference |
| :--- | :--- | :--- |
| **Graph Class** | `networkx.classes.multigraph.MultiGraph` | Undirected multi-edge graph |
| **Directedness** | `False` (`G.is_directed() == False`) | Pedestrian walkways are modeled as bidirectionally traversable |
| **MultiGraph Flag** | `True` (`G.is_multigraph() == True`) | Allows parallel edges between identical $(u, v)$ pairs |
| **Total Nodes** | `1,551` | `len(G.nodes)` |
| **Total Edges** | `1,721` | `len(G.edges(keys=True))` |
| **Connected Components** | `9` | `len(list(nx.connected_components(G)))` |
| **Largest Component Size** | `1,509` nodes (97.29% of network) | Component distribution: `[1509, 14, 13, 6, 3, 2, 2, 1, 1]` |
| **Isolated Nodes** | `2` nodes | Nodes with `G.degree(n) == 0` (nodes `14095322500` and `14095322501`) |
| **Parallel Edge Pairs** | `24` node pairs (48 edges total) | Distinct $(u, v)$ pairs sharing multiple edge keys |
| **Coordinate Reference System** | `EPSG:4326` (WGS84) | Coordinates stored as decimal degrees `(lon, lat)` |
| **Spatial Bounding Box** | Longitude: `[79.1382836, 79.1733106]`<br>Latitude: `[12.9576761, 12.9941877]` | Extracted from `node['x']` and `node['y']` |
| **Geographic Location** | Vellore Institute of Technology (VIT), Vellore, Tamil Nadu, India | Centered at approx `[79.155, 12.971]` |

### Dataset Provenance & Preprocessing Pipeline

The active dataset was generated by [scripts/build_final_dataset.py](file:///d:/dynamic_pedestrian_rerouting/scripts/build_final_dataset.py) and [scripts/build_vit_dataset_from_csv.py](file:///d:/dynamic_pedestrian_rerouting/scripts/build_vit_dataset_from_csv.py) through the following steps:
1. **OSM XML Ingestion:** Nodes and ways parsed from [data/vit_vellore/map.osm](file:///d:/dynamic_pedestrian_rerouting/data/vit_vellore/map.osm) (775 OSM nodes, 219 OSM ways).
2. **Pedestrian Network Integration:** Survey records loaded from [data/vit_vellore/raw/friend_base_pedestrian_network.csv](file:///d:/dynamic_pedestrian_rerouting/data/vit_vellore/raw/friend_base_pedestrian_network.csv).
3. **Geometry Extraction:** Segment geometries extracted from OSM way node slices; missing segments interpolated using endpoint LineStrings.
4. **Road / Pathway Filtering:** Motor roads (`primary`, `tertiary`) excluded unless tagged with foot access or identified as pedestrian crossings.
5. **Academic Block Entrance Snapping:** 9 academic block polygons from OSM snapped to nearest pedestrian nodes, tagging them as `building_entrance`.
6. **Dead-End Pruning:** Non-entrance degree-1 nodes pruned iteratively, preserving entrances, stairs, and crossings.
7. **Largest Component Extraction:** Graph filtered to ensure main connectivity, with isolated campus perimeters saved.

---

## Part 3 — Edge Attribute Audit

### Attribute Specifications & Handling

| Attribute Name | Storage Type | Possible Values in Graph | Semantic Meaning | Handling of Missing / Unknown Values | Usage in PCVC |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `wheelchair` | `str` | `'unknown'`, `'likely'`, `'no'` | Wheelchair infrastructure confirmation tag | Strings `'unknown'`, `'none'`, `''` evaluated as unknown in `is_attribute_known()` | Uncertainty weight: 0.35 (wheelchair profile). Hard barrier if `'no'`. |
| `wheelchair_accessible` | `NoneType` | `None` on all edges | Boolean accessibility flag | Evaluated as unknown if `None` | Fallback checked in `compute_edge_uncertainty()` |
| `stairs` | `bool` | `True`, `False` | Presence of outdoor stairs/steps | `False` is treated as a confirmed boolean fact | Hard constraint for wheelchair (excluded). Uncertainty weight for elderly/pregnant (0.25). |
| `slope_percent` | `float` / `None` | `2.0`, `3.0`, `3.5`, `12.0`, `None` | Longitudinal walkway grade percentage | Evaluated as known only if `isinstance(val, (int, float))` | Uncertainty weight across all profiles (0.20-0.25). Feasibility barrier if $>6\%$ (wheelchair) or $>8\%$ (elderly/pregnant). |
| `slope_status` | `str` | `'measured'`, `'down'`, `'up'` | Grade derivation methodology | Informational | Used in frontend stats API |
| `width_m` | `float` | `2.0` (constant across all edges) | Clear walkable corridor width (meters) | Known if `val > 0` | Uncertainty weight across all profiles (0.15-0.25). Feasibility barrier if $<0.9\text{m}$ (wheelchair) or $<0.6\text{m}$ (elderly). |
| `ramp` | `bool` | `False` on all edges | Presence of ADA-compliant wheelchair ramp | Evaluated as known boolean | Uncertainty weight: 0.10 (wheelchair profile). |
| `surface` | `str` | `'unknown'`, `'asphalt'`, `'unpaved'`, `'paving_stones'`, `'ground'`, `'paved'`, `'dirt'`, `'compacted'` | Physical ground paving material | Strings `'unknown'`, `'none'` evaluated as unknown | Uncertainty weight across all profiles (0.10-0.30). Used in PADA-R effort multiplier. |
| `surface_type` | `NoneType` | `None` on all edges | Schema alias for `surface` | None on all edges | Fallback checked in `compute_edge_uncertainty()` |
| `smoothness_value` | `NoneType` | `None` on all edges | Surface micro-roughness rating | None on all edges | Uncertainty weight across all profiles (0.05-0.25). |
| `tactile_paving` | `NoneType` | `None` on all edges | Blind/visual tactile paving tag | None on all edges | Uncertainty weight across all profiles (0.05). |
| `highway` | `str` | `'service'`, `'residential'`, `'footway'`, `'unclassified'`, `'primary'`, `'tertiary'`, `'track'`, `'path'`, `'steps'` | OSM highway classification | Known on all edges | Used to identify steps and routing classes |
| `accessible` | `bool` | `True`, `False` | Precomputed general accessibility flag | `False` on exactly the 7 stairs edges | Base accessibility routing flag |
| `length_m` | `float` | Continuous $(2.16\text{m} - 326.6\text{m})$ | Physical length of walkway | Known on all edges | Used for shortest path distance and travel cost calculations |

### Empirical Attribute Distribution (1,721 Total Edges)

| Attribute | Known Count | Unknown Count | % Unknown | Exact Distribution of Values |
| :--- | :--- | :--- | :--- | :--- |
| `wheelchair` | 324 | 1,397 | **81.17%** | `'unknown'`: 1,397 (81.17%), `'likely'`: 317 (18.42%), `'no'`: 7 (0.41%) |
| `stairs` | 1,721 | 0 | **0.00%** | `False`: 1,714 (99.59%), `True`: 7 (0.41%) |
| `slope_percent` | 1,714 | 7 | **0.41%** | `2.0%`: 1,564 (90.88%), `3.0%`: 81 (4.71%), `3.5%`: 64 (3.72%), `12.0%`: 5 (0.29%), `None`: 7 (0.41%) |
| `width_m` | 1,721 | 0 | **0.00%** | `2.0m`: 1,721 (100.00% synthetic constant default) |
| `ramp` | 1,721 | 0 | **0.00%** | `False`: 1,721 (100.00% — zero confirmed ramps) |
| `surface` | 607 | 1,114 | **64.73%** | `'unknown'`: 1,114 (64.73%), `'asphalt'`: 409 (23.77%), `'unpaved'`: 129 (7.50%), `'paving_stones'`: 38 (2.21%), `'ground'`: 12 (0.70%), `'paved'`: 10 (0.58%), `'dirt'`: 6 (0.35%), `'compacted'`: 3 (0.17%) |
| `smoothness_value` | 0 | 1,721 | **100.00%** | `None`: 1,721 |
| `tactile_paving` | 0 | 1,721 | **100.00%** | `None`: 1,721 |
| `wheelchair_accessible` | 0 | 1,721 | **100.00%** | `None`: 1,721 |
| `accessible` | 1,721 | 0 | **0.00%** | `True`: 1,714 (99.59%), `False`: 7 (0.41%) |

### Critical Accessibility Summary Counts

- **Total Edges:** `1,721`
- **Confirmed Stairs:** `7` edges (0.41% of network)
- **Confirmed Ramps:** `0` edges (0.00% of network)
- **Explicitly Wheelchair-Accessible (OSM `yes`/`designated`):** `0` edges
- **Inferred "Likely" Wheelchair-Accessible:** `317` edges
- **Confirmed Wheelchair-Inaccessible (`stairs=True` or `wheelchair='no'`):** `7` edges (edges `E001561`, `E001517`, `E001562`, `E001518`, `E001876`, `E001874`, `E001875`)
- **Wheelchair Status UNKNOWN (Unverified):** `1,397` edges (81.17%)
- **Methodological Distinction:** UNKNOWN is strictly distinguished from INACCESSIBLE. An edge with `wheelchair="unknown"` is treated as a traversable pathway with high epistemic uncertainty, making it an active candidate for verification rather than a network disconnect.

---

## Part 4 — Profile Definitions

Four user mobility profiles are implemented in [src/pcvc/uncertainty.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/uncertainty.py#L5-L37), [src/darr/config.py](file:///d:/dynamic_pedestrian_rerouting/src/darr/config.py#L36-L113), [src/config/darr_config.yaml](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L5-L77), and [src/pada_r/profiles.py](file:///d:/dynamic_pedestrian_rerouting/src/pada_r/profiles.py#L6-L47).

### Profile Uncertainty Attribute Weights (`PROFILE_UNCERTAINTY_WEIGHTS`)

| Profile | Evaluated Attribute | Weight ($w_{p,a}$) | Cumulative Profile Weight |
| :--- | :--- | :--- | :--- |
| **wheelchair** | `wheelchair` | 0.35 | 0.35 |
| **wheelchair** | `slope_percent` | 0.20 | 0.55 |
| **wheelchair** | `width_m` | 0.15 | 0.70 |
| **wheelchair** | `ramp` | 0.10 | 0.80 |
| **wheelchair** | `surface` | 0.10 | 0.90 |
| **wheelchair** | `smoothness_value` | 0.05 | 0.95 |
| **wheelchair** | `tactile_paving` | 0.05 | **1.00** |
| **elderly** | `stairs` | 0.25 | 0.25 |
| **elderly** | `slope_percent` | 0.25 | 0.50 |
| **elderly** | `surface` | 0.20 | 0.70 |
| **elderly** | `width_m` | 0.15 | 0.85 |
| **elderly** | `smoothness_value` | 0.10 | 0.95 |
| **elderly** | `tactile_paving` | 0.05 | **1.00** |
| **pregnant** | `stairs` | 0.25 | 0.25 |
| **pregnant** | `slope_percent` | 0.25 | 0.50 |
| **pregnant** | `surface` | 0.20 | 0.70 |
| **pregnant** | `width_m` | 0.15 | 0.85 |
| **pregnant** | `smoothness_value` | 0.10 | 0.95 |
| **pregnant** | `tactile_paving` | 0.05 | **1.00** |
| **general** | `surface` | 0.30 | 0.30 |
| **general** | `smoothness_value` | 0.25 | 0.55 |
| **general** | `width_m` | 0.25 | 0.80 |
| **general** | `slope_percent` | 0.20 | **1.00** |

### Profile-Specific Constraints & Routing Logic

| Profile Feature | `general` | `elderly` | `pregnant` | `wheelchair` | Source Reference |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Walking Speed ($v_p$)** | 1.4 m/s (~5.0 km/h) | 0.9 m/s (~3.2 km/h) | 1.0 m/s (~3.6 km/h) | 0.8 m/s (~2.9 km/h) | [darr_config.yaml:L8,26,44,62](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L8) |
| **Stairs Allowed** | `True` | `True` | `True` | **`False` (Strictly Forbidden)** | [darr_config.yaml:L11,29,47,65](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L11) |
| **Stairs Traversal Penalty** | 0.5 | 5.0 (High effort) | 3.5 (Effort/safety) | 9,999.0 (Prohibitive) | [darr_config.yaml:L12,30,48,66](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L12) |
| **Max Safe Slope ($\theta_{\max}$)** | `None` (no limit) | 8.0% | 8.0% | 6.0% (ADA ramp standard) | [darr_config.yaml:L13,31,49,67](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L13) |
| **Min Corridor Width ($W_{\min}$)** | 0.0 m | 0.6 m | 0.6 m | 0.9 m (ADA clearance) | [darr_config.yaml:L14,32,50,68](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L14) |
| **Wheelchair Tag Rule** | Ignored | Ignored | Ignored | Excludes `wheelchair='no'` | [subgraph.py:L26-33](file:///d:/dynamic_pedestrian_rerouting/src/darr/subgraph.py#L26) |
| **Accessible Subgraph Edges** | **1,721** (100.0%) | **1,716** (99.71%) | **1,716** (99.71%) | **1,714** (99.59%) | `subgraph_manager.get_accessible_subgraph()` |
| **Excluded Edges** | 0 | 5 edges with slope 12% | 5 edges with slope 12% | 7 edges with stairs / `wheelchair='no'` | [subgraph.py:L12-60](file:///d:/dynamic_pedestrian_rerouting/src/darr/subgraph.py#L12) |
| **Accessible Subgraph Bridges** | 1,074 directed (537) | 1,104 directed (552) | 1,104 directed (552) | 1,116 directed (558) | `resilience_engine._get_bridges()` |

---

## Part 5 — Uncertainty Model

### Mathematical Formulation

Implemented in [src/pcvc/uncertainty.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/uncertainty.py#L74-L102):

For an edge $e$ and mobility profile $p$:

$$\text{confidence}(e, p) = \text{round}\left(\min\left(1.0, \max\left(0.0, \frac{\sum_{a \in \mathcal{A}_p, \text{is\_known}(a, e)} w_{p, a}}{\sum_{a \in \mathcal{A}_p} w_{p, a}}\right)\right), 3\right)$$

$$\text{uncertainty}(e, p) = \text{round}(1.0 - \text{confidence}(e, p), 3)$$

Where:
- $\mathcal{A}_p$ is the attribute set for profile $p$ defined in `PROFILE_UNCERTAINTY_WEIGHTS`.
- $\sum_{a \in \mathcal{A}_p} w_{p,a} = 1.00$ across all 4 profiles.
- Known vs Unknown evaluation is executed by `is_attribute_known(attr_name, val)`:
  - If `val is None` $\implies$ Unknown
  - If `val` is a string in `["", "unknown", "none", "null"]` $\implies$ Unknown
  - If `attr_name == "wheelchair"` and `val == "unknown"` $\implies$ Unknown
  - If `attr_name == "slope_percent"` $\implies$ Known if and only if `isinstance(val, (int, float))`
  - If `attr_name == "width_m"` $\implies$ Known if and only if `isinstance(val, (int, float)) and val > 0`
  - All other non-null values (including `ramp=False` and `stairs=False`) fall through as Known.

### Thresholds, Rounding & Candidate Scanning

- **Uncertainty Range:** $[0.0, 1.0]$
- **Rounding:** 3 decimal places (`round(..., 3)`)
- **Default Uncertainty Threshold:** $\tau_{\text{unc}} = 0.40$ (specified in [src/pcvc/controller.py:L72](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L72) and [src/pcvc/uncertainty.py:L107](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/uncertainty.py#L107))
- **Scanning Function:** `get_uncertain_edges(G, profile, uncertainty_threshold, limit)`
  - Hard constraint exclusion: If `profile == "wheelchair"` and `edge_data.get("stairs") is True`, the edge is bypassed (`continue`) because it is known impassable, not uncertain.
  - Sorting: Candidates are sorted descending by `accessibility_uncertainty`.
  - Batch Limit: `limit=40` candidates evaluated during controller planning.

### Empirical Uncertainty Distribution on VIT Network

| Profile | Candidate Pool ($\text{unc} \ge 0.0$) | Candidates Above Threshold ($\text{unc} \ge 0.4$) | Uncertainty Value Breakdown (Value: Edge Count) |
| :--- | :--- | :--- | :--- |
| `wheelchair` | 1,714 (7 stairs excluded) | **1,398** | `0.55`: 866, `0.45`: 527, `0.20`: 241, `0.10`: 80, `0.75`: 4, `0.40`: 3 |
| `elderly` | 1,721 | **7** | `0.35`: 1,107, `0.15`: 607, `0.60`: 7 |
| `pregnant` | 1,721 | **7** | `0.35`: 1,107, `0.15`: 607, `0.60`: 7 |
| `general` | 1,721 | **1,114** | `0.55`: 1,107, `0.25`: 607, `0.75`: 7 |

*Explanation of Distribution:* For the wheelchair profile, an edge with unknown wheelchair tag, unknown surface, but known slope (0.20), width (0.15), and ramp=False (0.10) has $\text{confidence} = 0.45$, yielding $\text{uncertainty} = 0.55$ (866 edges). If surface is known, confidence rises to $0.55$, yielding uncertainty $= 0.45$ (527 edges).

---

## Part 6 — Counterfactual Model

### Implementation & Step-by-Step Logic

Implemented in [src/pcvc/counterfactual.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/counterfactual.py#L7-L97):

1. **Subgraph Extraction:** Profile-accessible subgraph $G_{\text{sub}}$ derived via `subgraph_manager.get_accessible_subgraph(G_base, target_profile)`.
2. **Feasibility Check:** If candidate edge $(u, v, \text{key})$ or endpoint nodes do not exist in $G_{\text{sub}}$, returns all zeros (`baseline_aoc=0, baseline_arl=0.0, delta_aoc=0, delta_arl=0.0, mal=0.0, cad=0.0, is_cut_edge=False`).
3. **Baseline Metrics:**
   - $\text{baseline\_aoc} = \text{resilience\_engine.calculate\_aoc}(G_{\text{sub}}, u, v)$
   - $\text{baseline\_arl} = \text{resilience\_engine.calculate\_arl}(G_{\text{sub}}, u, v)$
4. **Critical Accessibility Dependency (CAD):**
   - Evaluated via `resilience_engine.calculate_cad_for_edge(G_base, u, v, target_profile, bridge_cache)`.
   - If $(u, v) \in \text{bridge\_cache} \implies \text{is\_cut\_edge} = \text{True}, \text{CAD} = 1.0$.
   - Else if $\min(\text{deg}(u), \text{deg}(v)) \le 2 \implies \text{CAD} = 0.5$.
   - Else if $\min(\text{deg}(u), \text{deg}(v)) == 3 \implies \text{CAD} = 0.3$.
   - Else $\implies \text{CAD} = 0.1$.
5. **Counterfactual Removal:** Deep copy $G_{\text{counterfactual}} = G_{\text{sub}}.\text{copy}()$, followed by `G_counterfactual.remove_edge(u, v, key)`.
6. **Counterfactual Metrics:**
   - If `is_cut_edge == True` $\implies \text{cf\_aoc} = 0, \text{cf\_arl} = 0.0$.
   - Else $\implies \text{cf\_aoc} = \text{calculate\_aoc}(G_{\text{counterfactual}}, u, v)$, $\text{cf\_arl} = \text{calculate\_arl}(G_{\text{counterfactual}}, u, v)$.
7. **Impact Differentials:**
   - $\Delta\text{AOC} = \max(0, \text{baseline\_aoc} - \text{cf\_aoc})$
   - $\Delta\text{ARL} = \max(0.0, \text{round}(\text{baseline\_arl} - \text{cf\_arl}, 2))$
   - $\text{MAL} = \Delta\text{ARL}$

### IMPORTANT EXPERIMENTAL DIAGNOSTIC — REDUNDANT/COUPLED IMPACT METRICS

> [!CAUTION]
> **Code-Verified Finding:** In the current implementation, the continuous resilience metric $\text{ARL}$ collapses identically to the integer connectivity metric $\text{AOC}$, making $\Delta\text{AOC}$, $\Delta\text{ARL}$, and $\text{MAL}$ mathematically identical.

**Proof from Code:**
1. In [src/darr/resilience.py:L105-106](file:///d:/dynamic_pedestrian_rerouting/src/darr/resilience.py#L105):
   ```python
   if candidate_paths is None or len(candidate_paths) == 0:
       return float(aoc)
   ```
2. In [src/pcvc/counterfactual.py:L49,78](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/counterfactual.py#L49), `calculate_arl` is called without `candidate_paths`:
   ```python
   baseline_arl = resilience_engine.calculate_arl(G_sub, u, v)  # candidate_paths is None -> returns float(baseline_aoc)
   cf_arl = resilience_engine.calculate_arl(G_counterfactual, u, v)  # candidate_paths is None -> returns float(cf_aoc)
   ```
3. Therefore:
   $$\text{baseline\_arl} \equiv \text{float}(\text{baseline\_aoc})$$
   $$\text{cf\_arl} \equiv \text{float}(\text{cf\_aoc})$$
   $$\Delta\text{ARL} \equiv \text{float}(\Delta\text{AOC})$$
   $$\text{MAL} \equiv \Delta\text{ARL} \equiv \text{float}(\Delta\text{AOC})$$
4. **Empirical Verification:** An automated audit of all evaluated candidates confirmed 0 discrepancies across all candidates.

---

## Part 7 — Priority Score

### Weight Specifications

Defined in [src/pcvc/controller.py:L15-L23](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L15):

```python
DEFAULT_PCVC_WEIGHTS = {
    "w_uncertainty": 0.25,
    "w_delta_arl": 0.25,
    "w_delta_aoc": 0.15,
    "w_mal": 0.15,
    "w_cad": 0.15,
    "w_cost": 0.03,    # DEFINED BUT NOT CURRENTLY USED
    "w_risk": 0.02     # DEFINED BUT NOT CURRENTLY USED
}
```

### Exact Implemented Formula

Implemented in [src/pcvc/controller.py:L141-L148](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L141):

$$\text{Priority Score}(e) = \text{round}\left(w_{\text{unc}} \cdot \tilde{U}(e) + w_{\Delta\text{ARL}} \cdot \widetilde{\Delta\text{ARL}}(e) + w_{\Delta\text{AOC}} \cdot \widetilde{\Delta\text{AOC}}(e) + w_{\text{MAL}} \cdot \widetilde{\text{MAL}}(e) + w_{\text{CAD}} \cdot \text{CAD}(e), 3\right)$$

Where normalized terms are scaled against the candidate set maximum:
- $\tilde{U}(e) = \text{uncertainty}(e)$
- $\widetilde{\Delta\text{ARL}}(e) = \frac{\Delta\text{ARL}(e)}{\max_{c} \Delta\text{ARL}(c)}$
- $\widetilde{\Delta\text{AOC}}(e) = \frac{\Delta\text{AOC}(e)}{\max_{c} \Delta\text{AOC}(c)}$
- $\widetilde{\text{MAL}}(e) = \frac{\text{MAL}(e)}{\max_{c} \text{MAL}(c)}$
- $\text{CAD}(e) \in [0.1, 1.0]$

Because $\widetilde{\Delta\text{ARL}} \equiv \widetilde{\Delta\text{AOC}} \equiv \widetilde{\text{MAL}}$, the effective equation implemented by the code is:

$$\text{Priority Score}_{\text{effective}}(e) = 0.25 \cdot \tilde{U}(e) + 0.55 \cdot \widetilde{\Delta\text{ARL}}(e) + 0.15 \cdot \text{CAD}(e)$$

### Defined But Unused Weights

- `w_cost` ($0.03$): **DEFINED BUT NOT CURRENTLY USED** in [src/pcvc/controller.py:L141-L147](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L141).
- `w_risk` ($0.02$): **DEFINED BUT NOT CURRENTLY USED** in [src/pcvc/controller.py:L141-L147](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L141).
- **Weight Sum:** The weights actively evaluated sum to $0.25 + 0.25 + 0.15 + 0.15 + 0.15 = 0.95$, not $1.00$.

### Sorting & Tie-Breaking

Candidates are sorted using Python's stable `sort` with a deterministic 3-tuple key:
```python
candidates.sort(key=lambda x: (x.priority_score, x.impact.cad, x.uncertainty), reverse=True)
```
1. `priority_score` (Descending)
2. `cad` (Descending)
3. `uncertainty` (Descending)

---

## Part 8 — Safe-Return Probe Selection

Implemented in [src/pcvc/probe_selector.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/probe_selector.py).

### Anchor Selection & Geographic Properties

- **Landmark Source:** [data/vit_vellore/processed/vit_manual_locations.json](file:///d:/dynamic_pedestrian_rerouting/data/vit_vellore/processed/vit_manual_locations.json) (9 verified campus landmarks).
- **Anchor Search:** `find_nearest_landmark_anchor(G, node)` calculates Euclidean distance $\sqrt{(x_u - x_{\text{lm}})^2 + (y_u - y_{\text{lm}})^2}$ from candidate node $u$ to all 9 landmark coordinates.
- **Profile Independence:** The nearest landmark anchor is strictly geographic and independent of mobility profile.
- **Fallback Behavior:** If no landmark is found or graph node is detached, the anchor falls back to the candidate edge node itself (`anchor_node = u`, `anchor_name = f"Node_{u}"`).

### Closed-Loop Safe-Return Rule

A probe profile $p \in \{\text{general}, \text{elderly}, \text{pregnant}, \text{wheelchair}\}$ is eligible if and only if all three conditions are satisfied:

$$\text{Eligible}(p, e, \text{Anchor}) \iff \mathcal{F}_{\text{target}}(p, e) \land \mathcal{F}_{\text{outbound}}(p, \text{Anchor} \to u) \land \mathcal{F}_{\text{return}}(p, v \to \text{Anchor})$$

1. **Target Edge Feasibility ($\mathcal{F}_{\text{target}}$):**
   - Evaluated via `subgraph_manager.is_edge_accessible(edge_data, profile_cfg, u, v)` AND `evaluate_feasibility(edge_data, profile_name)[0] != "INACCESSIBLE"`.
   - Rejects wheelchair if `stairs=True` or `wheelchair='no'`.
   - Rejects wheelchair if slope $> 6\%$, width $< 0.9\text{m}$.
   - Rejects elderly/pregnant if slope $> 8\%$, width $< 0.6\text{m}$.
2. **Outbound Feasibility ($\mathcal{F}_{\text{outbound}}$):**
   - Feasible if $\text{Anchor} == u$ OR path exists in $G_{\text{sub}}(p)$ from $\text{Anchor}$ to $u$ (`nx.has_path(G_sub, anchor_node, u)`).
   - $D_{\text{outbound}} = \text{nx.shortest\_path\_length}(G_{\text{sub}}, \text{anchor\_node}, u, \text{weight}=\text{length\_m})$.
3. **Return Feasibility ($\mathcal{F}_{\text{return}}$):**
   - Feasible if $\text{Anchor} == v$ OR path exists in $G_{\text{sub}}(p)$ from $v$ to $\text{Anchor}$ (`nx.has_path(G_sub, v, anchor_node)`).
   - $D_{\text{return}} = \text{nx.shortest\_path\_length}(G_{\text{sub}}, v, \text{anchor\_node}, \text{weight}=\text{length\_m})$.

### Travel Cost & Probe Selection

- **Cost Formula:**
  $$\text{Travel Cost}(p) = \text{round}(D_{\text{outbound}} + L_e + D_{\text{return}}, 1)$$
- **Selection Decision:** Eligible probes are sorted ascending by `travel_cost`:
  ```python
  eligible.sort(key=lambda x: x.travel_cost)
  ```
  The lowest-cost eligible probe is selected (`eligible[0]`).
- **Tie-Breaking Rule:** When travel costs are identical (e.g., standard walkways without profile-specific detours), Python's stable sort preserves insertion order: `general` $\to$ `elderly` $\to$ `pregnant` $\to$ `wheelchair`.
- **Failure Handling:** If zero profiles pass all three tests, returns `selected_probe = None` with `selection_reason = "No safe probe profile is currently available for this verification target."`

---

## Part 9 — Evidence & Verification Event Lifecycle

Implemented in [src/pcvc/models.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/models.py) and [src/pcvc/evidence.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/evidence.py).

### State Enumerations

- **`VerificationEventStatus`:**
  - `PENDING` (Initial created state)
  - `IN_PROGRESS` (Dispatched / active verification probe)
  - `COMPLETED` (Verification finished, observation recorded)
  - `REJECTED` (Aborted / operator rejected)
- **`VerificationStatus`:**
  - `UNKNOWN` (Zero historical observations recorded)
  - `UNCERTAIN` (Partial observation or confidence $< 1.0$)
  - `VERIFIED` (Observation recorded and freshness $\ge \tau_{\text{stale}}$)
  - `STALE` (Observation recorded but freshness decayed $< \tau_{\text{stale}}$)

### Telemetry & Event Schemas

- **`VerificationEvent` Fields:** `event_id`, `edge_id`, `target_profile`, `probe_profile`, `anchor_node`, `anchor_name`, `status`, `created_at` (ISO-8601 UTC), `updated_at`, `notes`, `evidence` (`Optional[HardwareEvidencePayload]`).
- **`HardwareEvidencePayload` Fields (Future IoT Contract):**
  `timestamp`, `edge_id`, `pitch_mean_deg`, `pitch_std_deg`, `roll_mean_deg`, `roll_std_deg`, `acc_x_rms`, `acc_y_rms`, `acc_z_rms`, `vibration_jerk_metric`, `traversal_duration_s`, `sample_count`, `device_id`, `signal_quality`.

### Evidence Freshness Decay Formulation

$$\text{freshness}(t) = \exp(-\lambda_{\text{evidence}} \cdot \Delta t)$$

Where:
- $\Delta t = \max(0.0, t_{\text{current}} - t_{\text{last\_verified}})$ in seconds.
- **Decay Parameter:** $\lambda_{\text{evidence}} = 0.0001\text{ s}^{-1}$ (specified in [src/pcvc/evidence.py:L20](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/evidence.py#L20)).
  - Half-life: $t_{1/2} = \frac{\ln 2}{0.0001} \approx 6,931.47\text{ s} \approx 1.925\text{ hours}$.
- **Stale Threshold:** $\tau_{\text{stale}} = 0.40$.
  - Transition time to STALE: $t_{\text{stale}} = \frac{-\ln 0.40}{0.0001} \approx 9,162.91\text{ s} \approx 2.545\text{ hours}$.
- **Decoupling:** Completely isolated from traffic signal decay ($\lambda_{\text{signal}} = 0.005$).

### Implementation vs Future Work Matrix

| Capability | Current Status | Code Verification Details |
| :--- | :--- | :--- |
| **Event State Machine** | **IMPLEMENTED** | `create_verification_event()`, `update_event_status()` in [src/pcvc/evidence.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/evidence.py) |
| **Freshness Decay Math** | **IMPLEMENTED** | `get_freshness()`, `get_verification_status()` in [src/pcvc/evidence.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/evidence.py) |
| **Observation Storage** | **IMPLEMENTED (In-Memory)** | Stored in singleton dictionary `evidence_tracker.edge_observations` |
| **Graph Mutation on Verified** | **NOT IMPLEMENTED** | Event completion does **not** write attributes back to `G_base` or disk |
| **Dynamic Graph Recomputation** | **NOT IMPLEMENTED** | Event completion does **not** trigger network recalculation |
| **Physical IoT Hardware Ingestion** | **DEFINED FOR FUTURE INTEGRATION** | `HardwareEvidencePayload` is strictly a schema contract; no serial/MQTT/HTTP hardware listener exists |
| **Sensor Data Generation** | **NONE** | No simulated sensor noise or dummy values are generated |

---

## Part 10 — PCVC Execution Flow

The end-to-end execution flow follows 7 deterministic stages:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Operator / API Client
    participant API as FastAPI Router (src/api.py)
    participant Ctrl as PCVCController (src/pcvc/controller.py)
    participant Unc as Uncertainty Module (src/pcvc/uncertainty.py)
    participant CF as Counterfactual Module (src/pcvc/counterfactual.py)
    participant DARR as Subgraph & Resilience Engine (src/darr/)
    participant Probe as Probe Selector (src/pcvc/probe_selector.py)
    participant Evid as Evidence Tracker (src/pcvc/evidence.py)

    Client->>API: GET /api/accessibility/verification-target?profile=wheelchair&top_k=5
    API->>Ctrl: compute_verification_targets(G_base, "wheelchair", top_k=5)
    
    Ctrl->>Unc: get_uncertain_edges(G_base, profile="wheelchair", threshold=0.4, limit=40)
    Unc-->>Ctrl: List[EdgeEvidenceState] (sorted descending by uncertainty)
    
    Ctrl->>DARR: get_accessible_subgraph(G_base, "wheelchair") + _get_bridges(G_sub)
    DARR-->>Ctrl: G_sub, bridge_cache
    
    loop For each candidate edge (up to 40)
        Ctrl->>CF: evaluate_counterfactual_impact(G_base, u, v, key, "wheelchair", bridge_cache)
        CF->>DARR: calculate_aoc(G_sub, u, v), calculate_arl(G_sub, u, v), calculate_cad_for_edge(...)
        CF->>CF: G_counterfactual = G_sub.copy(); G_counterfactual.remove_edge(u, v, key)
        CF->>DARR: calculate_aoc(G_counterfactual, u, v), calculate_arl(G_counterfactual, u, v)
        CF-->>Ctrl: CounterfactualImpact (delta_aoc, delta_arl, mal, cad, is_cut_edge)
    end
    
    Ctrl->>Ctrl: Normalize metrics & compute Priority Score (weights: 0.25, 0.25, 0.15, 0.15, 0.15)
    Ctrl->>Ctrl: Sort candidates by (priority_score DESC, cad DESC, uncertainty DESC) -> slice top_k
    
    Ctrl->>Probe: select_best_probe(G_base, target.u, target.v, target.key)
    Probe->>Probe: find_nearest_landmark_anchor(G_base, target.u)
    loop For prof in [general, elderly, pregnant, wheelchair]
        Probe->>Probe: is_safe_probe(G_base, prof, u, v, key, anchor_node)
    end
    Probe-->>Ctrl: ProbeSelectionResult (selected_probe, travel_cost, eligible_probes, rejected_probes)
    
    Ctrl-->>API: VerificationPlanResponse
    API-->>Client: JSON Verification Plan
    
    opt Verification Event Dispatch
        Client->>API: POST /api/accessibility/verification-event
        API->>Evid: create_verification_event(edge_id, target_profile, probe_profile, anchor_node)
        Evid-->>API: VerificationEvent (status=PENDING, id=VE-XXXXXXXX)
        API-->>Client: JSON VerificationEvent
    end
```

---

## Part 11 — Current API Endpoints

All endpoints implemented in [src/api.py](file:///d:/dynamic_pedestrian_rerouting/src/api.py):

| Method | Endpoint | Query / Body Parameters | Response Content | Source Function |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/config` | None | Active dataset configuration, campus coordinates, zoom | `get_config` [src/api.py:L31](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L31) |
| `POST` | `/api/route` | JSON: `origin`, `destination`, `profile` | GeoJSON route, restricted segments, DARR resilience stats | `get_route` [src/api.py:L48](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L48) |
| `GET` | `/api/weather` | None | Temperature, rain, wind, weather code | `get_weather` [src/api.py:L132](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L132) |
| `GET` | `/api/landmarks` | None | List of verified VIT landmarks with `[lon, lat]` | `get_landmarks` [src/api.py:L136](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L136) |
| `GET` | `/api/academic_blocks` | None | GeoJSON FeatureCollection of campus academic buildings | `get_academic_blocks` [src/api.py:L153](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L153) |
| `GET` | `/api/pedestrian_network/stats` | None | Counts: stairs (7), ramps (0), crossings (14), barriers (0), slopes (7), subways (2) | `get_pedestrian_network_stats` [src/api.py:L180](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L180) |
| `GET` | `/api/pedestrian_network` | None | GeoJSON FeatureCollection of full 1,721 edge network | `get_pedestrian_network` [src/api.py:L215](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L215) |
| `POST` | `/api/routes/candidates` | JSON: `origin`, `destination`, `profile` | K-diverse alternative routes, network resilience, collapse risk | `get_candidate_routes` [src/api.py:L274](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L274) |
| `GET` | `/api/accessibility/resilience` | `origin_lon`, `origin_lat`, `dest_lon`, `dest_lat`, `profile` | Source/dest nodes, AOC, ARL | `get_accessibility_resilience` [src/api.py:L290](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L290) |
| `GET` | `/api/accessibility/collapse-risk`| `origin_lon`, `origin_lat`, `dest_lon`, `dest_lat`, `forecast_seconds` | Profile collapse predictions, warnings, projected ARL | `get_accessibility_collapse_risk` [src/api.py:L318](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L318) |
| `GET` | `/api/accessibility/critical-edges`| `profile`, `threshold` | GeoJSON FeatureCollection of critical bottleneck edges | `get_critical_edges` [src/api.py:L335](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L335) |
| `POST` | `/api/routing/simulate-assignment`| JSON: `candidate_path`, `target_profile`, `simulated_load` | Baseline vs counterfactual travel time and congestion | `simulate_assignment` [src/api.py:L366](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L366) |
| **`GET`** | **`/api/accessibility/verification-target`** | **`profile: str = "wheelchair"`, `top_k: int = 5`** | **`VerificationPlanResponse` (selected target, probe selection, ranked candidate list)** | **`get_verification_target` [src/api.py:L382](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L382)** |
| **`POST`** | **`/api/accessibility/verification-event`** | **JSON: `edge_id`, `target_profile`, `probe_profile`, `anchor_node`, `notes`** | **`VerificationEvent` (event ID, status PENDING, timestamps)** | **`create_verification_event` [src/api.py:L399](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L399)** |
| **`GET`** | **`/api/accessibility/verification-events`** | **`limit: int = 50`** | **List of recent `VerificationEvent` objects** | **`list_verification_events` [src/api.py:L414](file:///d:/dynamic_pedestrian_rerouting/src/api.py#L414)** |

---

## Part 12 — Test Status

### Test Execution Summary

Executed via `pytest tests/ -v`:
- **Total Tests Collected:** `40`
- **Passed:** `40` (100.0%)
- **Failed:** `0`
- **Skipped:** `0`
- **Runtime:** `36.52 seconds`

### Test Suite Breakdown

| Test File | Count | Execution Scope & Validated Behaviors |
| :--- | :--- | :--- |
| [tests/test_pcvc.py](file:///d:/dynamic_pedestrian_rerouting/tests/test_pcvc.py) | **12** | Validates uncertain edge discovery, counterfactual degradation ($\Delta\text{ARL} > 0$), priority ranking on cut-edges, profile impact differentiation, probe rejection on stairs, probe acceptance on feasible routes, dead-end safe return rejection, verification event state transitions (`PENDING` $\to$ `IN_PROGRESS` $\to$ `COMPLETED`), exponential freshness decay, compatibility with existing routing, preservation of 9 VIT landmarks, and zero Melbourne/simulation imports. |
| [tests/test_darr.py](file:///d:/dynamic_pedestrian_rerouting/tests/test_darr.py) | **21** | Validates candidate route generation, route diversity, profile filtering, AOC/ARL calculations, shared bottleneck detection, CAD bridge identification, collapse forecasting, marginal accessibility loss, traffic redistribution, and edge case routing scenarios (Cases A-I). |
| [tests/test_routing_dynamic.py](file:///d:/dynamic_pedestrian_rerouting/tests/test_routing_dynamic.py) | **3** | Validates baseline PADA-R route computation for general and wheelchair profiles and verifies route stability under dynamic edge penalties. |
| [tests/test_signal_decay.py](file:///d:/dynamic_pedestrian_rerouting/tests/test_signal_decay.py) | **4** | Validates traffic signal crossing penalty decay, exponential decay rate ($\lambda = 0.005$), multi-event aggregation, and penalty expiration ($\epsilon = 0.1$). |

### Methodological Separation: Correctness vs Research Validation

> [!IMPORTANT]
> **Unit Test Passing $\ne$ Experimental Research Performance.**
> The passing unit tests prove that the software functions without syntax errors, runtime crashes, or regression breaks. They do **not** demonstrate experimental superiority, ranking optimality, or probe deployment efficiency over baselines.

---

## Part 13 — Existing Experiment Capability

| Experiment ID & Topic | Readiness Status | Reason / Current Implementation State |
| :--- | :--- | :--- |
| **E1 — Natural Uncertainty Analysis** | **READY** | Functions `compute_edge_uncertainty()` and `get_uncertain_edges()` in [src/pcvc/uncertainty.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/uncertainty.py) can be run immediately across all 1,721 edges for all 4 profiles. Empirical distributions and confidence scores are immediately measurable. |
| **E2 — Oracle Hold-Out / Masking** | **PARTIALLY READY** | Ground truth attributes exist (324 edges with wheelchair, 607 with surface, 1,714 with slope). PCVC controller can rank masked graphs. **Missing:** Standalone experiment harness script to execute in-memory masking, run ranking, extract true impact, and compute rank correlation (Spearman $\rho$, Kendall $\tau$). |
| **E3 — Ranking Comparison** | **PARTIALLY READY** | PCVCController accepts custom weight dictionaries, allowing Uncertainty-only, CAD-only, and Impact-only baselines to execute directly. **Missing:** Batch experiment script to execute all baselines across candidate sets, collect top-$K$ selections, and compute NDCG / Precision@K. |
| **E4 — Profile Sensitivity** | **READY** | Supported directly by invoking `pcvc_controller.compute_verification_targets(G, target_profile=p)` across the 4 profiles. Differences in candidate uncertainty, subgraph topologies, and ranking are immediately obtainable. |
| **E5 — Safe-Return Evaluation** | **READY** | Probe selector in [src/pcvc/probe_selector.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/probe_selector.py) returns complete metrics for outbound distance, traversal distance, return distance, and rejection reasons across all 4 profiles. Can be executed immediately on any candidate edge. |
| **E6 — Probe Correctness** | **READY** | Hard constraint checks (`subgraph_manager.is_edge_accessible`) and PADA-R feasibility gates are implemented and verified by tests. Constraint violations can be systematically measured across all edges. |
| **E7 — Ablation** | **PARTIALLY READY** | Weight ablations can be passed via `PCVCController(weights=...)`. However, because $\Delta\text{AOC}$, $\Delta\text{ARL}$, and $\text{MAL}$ are collinear, individual component ablations across those three metrics are mathematically uninformative unless collapsed into a single impact metric ($\Delta\text{ARL}$). |
| **E8 — Runtime** | **READY** | Sub-component timings (uncertainty scanning, counterfactual evaluation, probe selection) and end-to-end execution can be measured directly using standard `time.perf_counter()`. (Measured at 4.44s for 40 candidates). |
| **E9 — Scalability** | **PARTIALLY READY** | `limit` is currently hardcoded to 40 in [src/pcvc/controller.py:L86](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L86). Testing scalability to 100, 250, or 500 candidates requires exposing `candidate_limit` as a parameter in `compute_verification_targets()`. |

---

## Part 14 — Oracle Ground Truth Feasibility

### Feasibility Assessment

**Feasible with Non-Destructive In-Memory Masking:** The dataset contains sufficient confirmed attributes to perform an oracle hold-out masking experiment without modifying the underlying dataset files.

### Attribute Masking Matrix

| Attribute | Known Edges | Maskable? | Oracle Ground Truth Role | Experimental Validity & Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **`surface`** | 607 | **YES** | True paving material (`asphalt`, `paved`, `unpaved`, etc.) | **High Validity.** Masking `surface` to `'unknown'` reduces confidence by 0.10 (wheelchair) to 0.30 (general). True surface allows verifying impact on traversal speed/effort. |
| **`wheelchair`** | 324 | **YES** | True accessibility tag (`'likely'`, `'no'`) | **High Validity.** 317 edges have `'likely'`, 7 have `'no'`. Masking to `'unknown'` increases uncertainty by 0.35. Allows evaluating whether PCVC prioritizes true barriers. |
| **`slope_percent`** | 1,714 | **YES** | True measured grade percentage ($2.0\% - 12.0\%$) | **Moderate Validity.** 1,709 edges have slope $\le 3.5\%$; only 5 have slope $>8\%$ (all 5 are stairs). Masking slope evaluates grade uncertainty. |
| **`stairs`** | 7 | **CAUTION** | Confirmed stairs edges | Only 7 stairs exist in the entire network. Masking stairs to `False` tests if PCVC identifies them as critical bridges, but small sample size ($N=7$). |
| **`width_m`** | 1,721 | **NO** | Synthetic constant ($2.0\text{m}$) | Synthetic constant with zero variance across network. Masking provides no meaningful ground truth variance. |
| **`ramp`** | 1,721 | **NO** | Zero positive cases (`False` on all edges) | Zero confirmed ramps exist in dataset. Cannot evaluate positive detection. |
| **`tactile_paving`** | 0 | **NO** | 100% missing in dataset | Zero known values to hold out. |
| **`smoothness_value`** | 0 | **NO** | 100% missing in dataset | Zero known values to hold out. |

### Minimum Eligible Sample Pools

- **Simultaneous Co-occurrence (`wheelchair` AND `surface` known):** **80 edges**.
- **Simultaneous Co-occurrence (`wheelchair`, `surface`, AND `slope` known):** **80 edges**.
- **`wheelchair` Known Pool:** **324 edges** (317 likely accessible, 7 confirmed stairs).
- **`surface` Known Pool:** **607 edges**.

### Non-Destructive In-Memory Protocol

Experiments must execute in-memory on graph copies:
1. Deep-copy graph: `G_exp = G_base.copy()`.
2. Extract and cache true attribute values for hold-out edges: `oracle_truth[edge_id] = {'surface': d['surface'], 'wheelchair': d['wheelchair']}`.
3. Mask attributes in `G_exp`: `d['surface'] = 'unknown'`, `d['wheelchair'] = 'unknown'`.
4. Execute `pcvc_controller.compute_verification_targets(G_exp)`.
5. Compare PCVC priority ranking against True Counterfactual Impact computed on `G_base`.
6. Discard `G_exp`. The disk file [data/vit_vellore/processed/vit_vellore_academic_pedestrian_network.pkl](file:///d:/dynamic_pedestrian_rerouting/data/vit_vellore/processed/vit_vellore_academic_pedestrian_network.pkl) remains completely untouched.

---

## Part 15 — Baseline Feasibility

### Proposed Baseline Method Formulations

| Baseline Identifier | Governing Score Equation | Implementation Mechanism in Current Code |
| :--- | :--- | :--- |
| **B1: Random** | $\text{Score}_{\text{random}}(e) \sim \mathcal{U}(0, 1)$ | Generate uniform random score for each candidate edge. |
| **B2: Uncertainty-Only** | $\text{Score}_{\text{unc}}(e) = \text{uncertainty}(e, p)$ | `PCVCController(weights={"w_uncertainty": 1.0, "w_delta_arl": 0.0, "w_delta_aoc": 0.0, "w_mal": 0.0, "w_cad": 0.0, "w_cost": 0.0, "w_risk": 0.0})` |
| **B3: CAD-Only (Bottleneck)** | $\text{Score}_{\text{CAD}}(e) = \text{CAD}(e, p)$ | `PCVCController(weights={"w_uncertainty": 0.0, "w_delta_arl": 0.0, "w_delta_aoc": 0.0, "w_mal": 0.0, "w_cad": 1.0, "w_cost": 0.0, "w_risk": 0.0})` |
| **B4: Counterfactual Impact-Only** | $\text{Score}_{\text{impact}}(e) = \widetilde{\Delta\text{ARL}}(e)$ | `PCVCController(weights={"w_uncertainty": 0.0, "w_delta_arl": 1.0, "w_delta_aoc": 0.0, "w_mal": 0.0, "w_cad": 0.0, "w_cost": 0.0, "w_risk": 0.0})` |
| **B5: Uncertainty + CAD** | $\text{Score}_{\text{unc+CAD}}(e) = 0.5 \cdot \tilde{U}(e) + 0.5 \cdot \text{CAD}(e)$ | `PCVCController(weights={"w_uncertainty": 0.5, "w_delta_arl": 0.0, "w_delta_aoc": 0.0, "w_mal": 0.0, "w_cad": 0.5, "w_cost": 0.0, "w_risk": 0.0})` |
| **B6: Full PCVC (Implemented)** | $\text{Score}_{\text{PCVC}}(e) = 0.25 \tilde{U} + 0.25 \widetilde{\Delta\text{ARL}} + 0.15 \widetilde{\Delta\text{AOC}} + 0.15 \widetilde{\text{MAL}} + 0.15 \text{CAD}$ | Default `PCVCController()` execution. |

### Single Clean Impact Metric Recommendation

Because $\Delta\text{AOC} \equiv \Delta\text{ARL} \equiv \text{MAL}$ in the current codebase, the paper must explicitly acknowledge this coupling. For clean, non-collinear comparative experiments, **$\Delta\text{ARL}$ (or normalized $\widetilde{\Delta\text{ARL}}$)** should be used as the sole representative counterfactual impact metric.

---

## Part 16 — Experiment Parameters

| Parameter Name | Current Value / Default | Source Location | Storage Type | Reconfigurable via API / Arg? |
| :--- | :--- | :--- | :--- | :--- |
| `uncertainty_threshold` | `0.40` | [src/pcvc/controller.py:L72](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L72) | Hard-coded default | Yes (Function argument) |
| `candidate_evaluation_limit` | `40` | [src/pcvc/controller.py:L86](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L86) | Hard-coded integer | No (Hardcoded in controller) |
| `top_k_candidates` | `5` | [src/pcvc/controller.py:L71](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L71) | Hard-coded default | Yes (Function / API query param) |
| `w_uncertainty` | `0.25` | [src/pcvc/controller.py:L16](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L16) | Hard-coded default | Yes (Controller init arg) |
| `w_delta_arl` | `0.25` | [src/pcvc/controller.py:L17](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L17) | Hard-coded default | Yes (Controller init arg) |
| `w_delta_aoc` | `0.15` | [src/pcvc/controller.py:L18](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L18) | Hard-coded default | Yes (Controller init arg) |
| `w_mal` | `0.15` | [src/pcvc/controller.py:L19](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L19) | Hard-coded default | Yes (Controller init arg) |
| `w_cad` | `0.15` | [src/pcvc/controller.py:L20](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L20) | Hard-coded default | Yes (Controller init arg) |
| `w_cost` (unused) | `0.03` | [src/pcvc/controller.py:L21](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L21) | Hard-coded default | Yes (Controller init arg) |
| `w_risk` (unused) | `0.02` | [src/pcvc/controller.py:L22](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py#L22) | Hard-coded default | Yes (Controller init arg) |
| `lambda_evidence` | `0.0001` s$^{-1}$ | [src/pcvc/evidence.py:L20](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/evidence.py#L20) | Hard-coded default | Yes (Tracker init arg) |
| `stale_threshold` | `0.40` | [src/pcvc/evidence.py:L20](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/evidence.py#L20) | Hard-coded default | Yes (Tracker init arg) |
| `wheelchair_max_slope` | `6.0%` | [darr_config.yaml:L67](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L67) | Configuration file | Yes (via YAML) |
| `wheelchair_min_width` | `0.9m` | [darr_config.yaml:L68](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L68) | Configuration file | Yes (via YAML) |
| `elderly_max_slope` | `8.0%` | [darr_config.yaml:L31](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L31) | Configuration file | Yes (via YAML) |
| `elderly_min_width` | `0.6m` | [darr_config.yaml:L32](file:///d:/dynamic_pedestrian_rerouting/src/config/darr_config.yaml#L32) | Configuration file | Yes (via YAML) |
| `random_seeds` | None configured | N/A | Non-existent | PCVC logic is fully deterministic |

---

## Part 17 — Reproducibility Information

### Exact Environment & Package Manifest

- **Operating System:** Windows 11 (build verified via win32 platform Python 3.14.2)
- **Python Version:** `3.14.2`
- **Node.js Version:** `v24.13.0`
- **npm Version:** `11.6.2`

| Package Name | Installed Runtime Version (.venv) | Version in requirements.txt |
| :--- | :--- | :--- |
| `networkx` | `3.6.1` | `3.4.2` |
| `osmnx` | `2.1.1` | `1.9.4` |
| `geopandas` | `1.1.4` | `1.0.1` |
| `shapely` | `2.1.2` | (implicit via geopandas) |
| `pandas` | `3.0.5` | `2.2.3` |
| `numpy` | `2.5.2` | (implicit via pandas) |
| `fastapi` | `0.141.1` | `0.115.6` |
| `uvicorn` | `0.52.4` | `0.34.0` |
| `pydantic` | `2.13.5` | `2.10.3` |
| `pyyaml` | `6.0.3` | `6.0.3` |
| `pytest` | `9.1.1` | (installed in venv) |

### Reproduction Commands

```powershell
# 1. Activate Virtual Environment
.\.venv\Scripts\Activate.ps1

# 2. Run Test Suite (Software Correctness Validation)
python -m pytest tests/ -v

# 3. Launch Backend API Server
python -m uvicorn src.api:app --reload --port 8000

# 4. Launch Frontend UI (Separate Terminal)
cd frontend
npm run dev

# 5. Execute PCVC Target Selection via cURL / PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/api/accessibility/verification-target?profile=wheelchair&top_k=5" -Method GET | ConvertTo-Json -Depth 5
```

---

## Part 18 — Legacy & Conflict Audit

| Audit Category / Target | Status | Exact Path(s) | Operational Impact on PCVC |
| :--- | :--- | :--- | :--- |
| **Melbourne Network References** | **FOUND (Isolated)** | [src/data/melbourne_loader.py](file:///d:/dynamic_pedestrian_rerouting/src/data/melbourne_loader.py), [src/data/fetch_datasets.py](file:///d:/dynamic_pedestrian_rerouting/src/data/fetch_datasets.py), [README.md](file:///d:/dynamic_pedestrian_rerouting/README.md), [src/evaluation/benchmark.py](file:///d:/dynamic_pedestrian_rerouting/src/evaluation/benchmark.py) | **Zero Impact on PCVC.** PCVC has zero imports of Melbourne modules (verified by [tests/test_pcvc.py:L274](file:///d:/dynamic_pedestrian_rerouting/tests/test_pcvc.py#L274)). |
| **Active Simulation Engine** | **NOT FOUND** | `src/simulation/` contains only `__pycache__` | No synthetic simulation engine is active in production. |
| **Congestion Engine** | **NOT FOUND** | `src/congestion/` contains only `__pycache__` | Legacy Melbourne pedestrian sensor model decoupled. |
| **Traffic Signals Module** | **NOT FOUND** | `src/traffic/` is an empty directory | No traffic signal mock runs. |
| **Congestion Injection Scripts** | **FOUND (Scratch)** | [scratch/test_demo_flow.py](file:///d:/dynamic_pedestrian_rerouting/scratch/test_demo_flow.py), [scratch/test_waterlogging.py](file:///d:/dynamic_pedestrian_rerouting/scratch/test_waterlogging.py) | Obsolete scratch scripts that fail on collection if run globally. Bypassed by targeting `tests/`. |
| **Waterlogging Dynamic Attributes** | **NOT FOUND in Graph** | Verified: zero edges in active graph contain `water_depth` | Dynamic waterlogging logic in [src/darr/subgraph.py](file:///d:/dynamic_pedestrian_rerouting/src/darr/subgraph.py) remains inactive during PCVC graph scans. |
| **Legacy Streamlit App** | **NOT FOUND in src** | Mentioned in [README.md](file:///d:/dynamic_pedestrian_rerouting/README.md) (`src/app.py`), but `src/app.py` has been deleted | Streamlit is replaced by React/Vite in `frontend/`. |
| **Folium Imports** | **NOT FOUND in src** | Zero Folium imports in `src/` | Folium replaced by MapLibre GL in React frontend. |
| **Duplicate PCVC Modules** | **NOT FOUND** | Only one PCVC package exists at [src/pcvc/](file:///d:/dynamic_pedestrian_rerouting/src/pcvc) | No conflicting PCVC implementations. |

---

## Part 19 — IEEE Access Paper-Ready Verified Facts

These statements are directly verified by code and data analysis and can be incorporated into the IEEE Access submission:

### A. System Architecture
1. PCVC is implemented as an autonomous closed-loop controller in Python (FastAPI/NetworkX) operating over a real-world pedestrian accessibility network.
2. The controller couples profile-specific accessibility constraints with counterfactual network degradation and safe-return path feasibility.

### B. Dataset
1. The empirical network corresponds to the academic pedestrian network of Vellore Institute of Technology (VIT), Vellore, India, comprising 1,551 nodes and 1,721 edges across a spatial bounding box of $[79.138^{\circ}\text{E}, 79.173^{\circ}\text{E}]$ and $[12.958^{\circ}\text{N}, 12.994^{\circ}\text{N}]$.
2. The network exhibits 9 connected components, with the primary connected campus component containing 1,509 nodes (97.29% of the network).
3. The graph is an undirected NetworkX `MultiGraph` with 24 parallel edge pairs (48 edges total) and 2 isolated nodes.

### C. Accessibility Attributes
1. Out of 1,721 edges, exactly 7 edges (0.41%) are confirmed outdoor stairs, and 0 edges are confirmed ramps.
2. Wheelchair accessibility status is unverified (`'unknown'`) on 1,397 edges (81.17%), confirmed inaccessible on 7 edges (0.41%), and inferred likely on 317 edges (18.42%).
3. Paving surface is confirmed on 607 edges (35.27%) and unknown on 1,114 edges (64.73%).
4. Walkway slope is quantitatively measured on 1,714 edges (99.59%), with 1,709 edges $\le 3.5\%$ and 5 edges at $12.0\%$ (all 5 coinciding with stairs).
5. All 1,721 edges currently carry a constant width attribute of 2.0 meters.

### D. Mobility Profiles
1. The system models four user profiles: General Pedestrian ($v=1.4\text{ m/s}$), Elderly ($v=0.9\text{ m/s}$, slope $\le 8\%$, stairs allowed with penalty 5.0), Pregnant ($v=1.0\text{ m/s}$, slope $\le 8\%$, stairs allowed with penalty 3.5), and Mobility-Constrained / Wheelchair ($v=0.8\text{ m/s}$, slope $\le 6\%$, width $\ge 0.9\text{m}$, stairs strictly forbidden).
2. The accessible subgraph filter retains 1,721 edges for General, 1,716 edges for Elderly and Pregnant (excluding 5 steep 12% slope segments), and 1,714 edges for Wheelchair (excluding 7 confirmed stairs).

### E. Uncertainty Model
1. Uncertainty is quantified as $\text{uncertainty}(e, p) = 1.0 - \text{confidence}(e, p)$ using normalized, profile-tailored attribute weight vectors.
2. Wheelchair uncertainty is governed primarily by wheelchair designation tag (0.35), slope (0.20), width (0.15), and surface/ramp (0.10 each).
3. For wheelchair users on the VIT network, candidate uncertainty values are discrete with 866 edges at $\text{unc} = 0.55$, 527 edges at $\text{unc} = 0.45$, and 1,398 edges meeting the candidate discovery threshold ($\text{unc} \ge 0.40$).

### F. Counterfactual Model
1. Counterfactual edge removal assesses resilience loss by simulating edge failure on the profile-accessible subgraph $G_{\text{sub}}(p)$.
2. Critical cut-edges (bridges) in $G_{\text{sub}}(p)$ are detected in linear time; removal of a bridge disconnects $(u, v)$ and reduces counterfactual $\text{AOC}$ to 0.
3. In the current implementation, because candidate path sets are omitted during edge evaluation, continuous $\text{ARL}$ collapses to integer $\text{AOC}$, resulting in the exact identity $\Delta\text{ARL} \equiv \Delta\text{AOC} \equiv \text{MAL}$.

### G. Priority Model
1. Verification priority is computed by combining normalized uncertainty, counterfactual degradation ($\Delta\text{ARL}, \Delta\text{AOC}, \text{MAL}$), and Critical Accessibility Dependency ($\text{CAD}$).
2. The active weights sum to 0.95 ($0.25\tilde{U} + 0.25\widetilde{\Delta\text{ARL}} + 0.15\widetilde{\Delta\text{AOC}} + 0.15\widetilde{\text{MAL}} + 0.15\text{CAD}$), while cost (0.03) and risk (0.02) weights remain unused in the current scoring loop.

### H. Safe-Return Model
1. Verification probes must satisfy the Closed-Loop Safe-Return Rule: $\mathcal{F}_{\text{target}} \land \mathcal{F}_{\text{outbound}} \land \mathcal{F}_{\text{return}}$ anchored at the nearest of 9 campus landmarks.
2. The controller tests all 4 profiles and selects the eligible probe minimizing total traversal distance: $D_{\text{outbound}} + L_e + D_{\text{return}}$.
3. On edges with stairs or steep slopes, the probe selector correctly rejects restricted profiles (e.g., wheelchair probes rejected on stairs) and safely routes alternative eligible probes (general, elderly) around profile-feasible paths.

### I. Evidence Lifecycle
1. Verification events follow a strict 4-state lifecycle (`PENDING` $\to$ `IN_PROGRESS` $\to$ `COMPLETED` / `REJECTED`).
2. Evidence freshness decays exponentially according to $\text{freshness}(t) = \exp(-\lambda_{\text{evidence}} \Delta t)$ with $\lambda = 0.0001\text{ s}^{-1}$ (half-life $\approx 1.925$ hours, stale threshold $\tau = 0.40$).
3. Hardware telemetry payload schemas (`HardwareEvidencePayload`) are formally specified for future ESP32/MPU6050 physical integration.

### J. Experimental Readiness
1. Real-world execution of end-to-end PCVC target selection on the VIT Vellore network runs in 4.44 seconds for 40 counterfactually evaluated candidates (~111 ms per candidate edge).

### K. Current Limitations
1. No automated graph attribute write-back or network recomputation occurs upon verification event completion.
2. Hardware integration is currently limited to data schema definitions; physical sensor telemetry is neither ingested nor simulated.
3. Walkway corridor widths are uniformly set to 2.0 meters, and ramps are unconfirmed across the current dataset.

---

## Part 20 — Phase 6 Experiment Execution Checklist

### Readiness Classification

#### READY NOW (Can be executed immediately with zero code changes)
- [x] **E1: Natural Uncertainty Distribution Analysis**
  - Execute `compute_edge_uncertainty()` across all 1,721 edges for General, Elderly, Pregnant, and Wheelchair profiles.
  - Generate histogram plots and missing attribute frequency tables.
- [x] **E4: Profile Sensitivity Comparison**
  - Run `compute_verification_targets()` across all 4 profiles.
  - Measure Jaccard similarity and rank divergence of top-10 candidate edges between Wheelchair vs Elderly vs General.
- [x] **E5: Safe-Return Detour & Feasibility Evaluation**
  - Execute `select_best_probe()` on all 1,398 candidate edges.
  - Quantify percentage of edges where safe-return is feasible vs rejected, and plot detour overhead ratio: $\frac{D_{\text{outbound}} + D_{\text{return}}}{L_e}$.
- [x] **E6: Probe Constraint Correctness Validation**
  - Verify that across all edges, zero probe assignments violate profile hard constraints (stairs, slope limits).
- [x] **E8: Computational Runtime Profiling**
  - Benchmark execution times across sub-routines: subgraph extraction, bridge detection, candidate copy & removal, flow calculation, and probe selection.

#### PARTIALLY READY (Requires dedicated standalone experiment harness script)
- [ ] **E2: Oracle Hold-Out / Masking Experiment**
  - *Current Status:* Ground truth attributes exist (80 co-occurring edges; 324 wheelchair edges; 607 surface edges). In-memory masking is feasible.
  - *Minimum Code Addition Required:* Create `scripts/experiments/run_e2_oracle_masking.py` that:
    1. Copies `G_base` in memory.
    2. Masks `wheelchair` and `surface` on $K \in \{20, 40, 80\}$ held-out edges to `'unknown'`.
    3. Runs PCVC to produce predicted priority ranking.
    4. Computes True Counterfactual Impact using true held-out attributes.
    5. Computes Spearman rank correlation $\rho$ and Kendall $\tau$ between PCVC rank and Oracle rank.
- [ ] **E3: Baseline Ranking Comparison**
  - *Current Status:* `PCVCController` accepts custom weights, supporting Uncertainty-only, CAD-only, and Impact-only directly.
  - *Minimum Code Addition Required:* Create `scripts/experiments/run_e3_baselines.py` that:
    1. Runs B1 (Random), B2 (Uncertainty-only), B3 (CAD-only), B4 (Impact-only), B5 (Uncertainty+CAD), and B6 (Full PCVC).
    2. Computes top-$K$ overlap, Normalized Discounted Cumulative Gain (NDCG@K), and mean resilience preservation.
- [ ] **E7: Metric Ablation Study**
  - *Current Status:* Weights are configurable, but $\Delta\text{AOC} \equiv \Delta\text{ARL} \equiv \text{MAL}$.
  - *Minimum Code Addition Required:* Create `scripts/experiments/run_e7_ablation.py` that:
    1. Formulates clean ablated models: Full PCVC ($0.25 U + 0.55 \Delta\text{ARL} + 0.15\text{CAD}$), No-Uncertainty ($0.70 \Delta\text{ARL} + 0.30\text{CAD}$), No-CAD ($0.30 U + 0.70 \Delta\text{ARL}$), and No-Counterfactual ($0.50 U + 0.50\text{CAD}$).
    2. Evaluates ranking stability and alignment against oracle ground truth.
- [ ] **E9: Scalability Benchmarking**
  - *Current Status:* Candidate evaluation limit is hardcoded to 40 in `controller.py`.
  - *Minimum Code Addition Required:* Add parameter `candidate_limit: int = 40` to `compute_verification_targets()` in [src/pcvc/controller.py](file:///d:/dynamic_pedestrian_rerouting/src/pcvc/controller.py) and create `scripts/experiments/run_e9_scalability.py` to evaluate execution time and memory usage for limits $N \in [10, 20, 40, 80, 160, 320]$.

#### MISSING / FUTURE INTEGRATION (Out of scope for initial paper or post-publication extension)
- [ ] **Live Hardware Integration:** Serial / MQTT ingestion daemon connecting physical ESP32 IMU sensor telemetry to `POST /api/accessibility/verification-event`.
- [ ] **Dynamic Closed-Loop Graph Feedback:** Automatic edge attribute update and graph cache re-serialization upon verification event completion.
- [ ] **In-Situ Corridor Width & Ramp Measurement:** Field surveying to replace default 2.0m width and 0 ramp constants with empirical laser/lidar measurements.

---
*Report certified by Codebase Forensic Audit on 2026-10-05.*

import pandas as pd
import geopandas as gpd
from src.accessibility import extract_accessibility_features

def clean_osm_data(osm_edges):
    """
    Extracts structured accessibility features from raw OSM edge tags.
    """
    features_list = []
    for _, row in osm_edges.iterrows():
        features = extract_accessibility_features(row)
        features_list.append(features)
        
    features_df = pd.DataFrame(features_list)
    # Join features back to the geometry
    clean_osm = pd.concat([osm_edges.reset_index(drop=True), features_df], axis=1)
    
    # Keep only relevant columns
    cols_to_keep = ['geometry', 'has_stairs', 'wheelchair_accessible', 'incline_value', 
                    'surface_type', 'smoothness_value', 'tactile_paving']
    return clean_osm[cols_to_keep]

def merge_datasets(melb_edges, osm_edges):
    """
    Spatially joins the OSM accessibility features onto the Melbourne Pedestrian Network.
    Uses sjoin_nearest to find the closest OSM edge within a reasonable threshold (e.g. 10m).
    """
    # Project both to EPSG:28355 (GDA94 / MGA zone 55 - standard for Melbourne) for metric operations
    melb_proj = melb_edges.to_crs("EPSG:28355")
    
    if osm_edges.empty:
        print("OSM data is empty. Skipping spatial join.")
        merged_wgs84 = melb_edges.copy()
        # Add default columns for missing OSM data
        merged_wgs84['has_stairs'] = False
        merged_wgs84['wheelchair_accessible'] = None
        merged_wgs84['incline_value'] = None
        merged_wgs84['surface_type'] = 'unknown'
        merged_wgs84['smoothness_value'] = 'unknown'
        merged_wgs84['tactile_paving'] = 'unknown'
        return merged_wgs84
        
    osm_proj = osm_edges.to_crs("EPSG:28355")
    
    clean_osm_proj = clean_osm_data(osm_proj)
    
    print("Performing spatial join (nearest) between Melbourne Network and OSM data...")
    # Find nearest OSM edge for each Melbourne edge within 15 meters
    merged = gpd.sjoin_nearest(
        melb_proj, 
        clean_osm_proj, 
        how='left', 
        max_distance=15, 
        distance_col='osm_dist'
    )
    
    # Since sjoin_nearest can return multiple matches if distances are exactly equal, 
    # we drop duplicates based on the original index of the melb_edges.
    merged = merged[~merged.index.duplicated(keep='first')]
    
    # Project back to WGS84 for mapping
    merged_wgs84 = merged.to_crs("EPSG:4326")
    
    # Fill NA for boolean features where no OSM data was found
    merged_wgs84['has_stairs'] = merged_wgs84['has_stairs'].fillna(False)
    
    print(f"Data merge complete. Total edges: {len(merged_wgs84)}")
    return merged_wgs84

from shapely.geometry import Point

def map_poi_to_edges(edges_gdf, poi_df, lat_col='latitude', lon_col='longitude', max_dist=20, id_col='location_id'):
    """
    Spatially maps Points of Interest (sensors/signals) to the nearest network edges.
    Returns a dictionary mapping edge_index (from edges_gdf) to a list of POI IDs.
    """
    if poi_df.empty:
        return {}
        
    geometry = [Point(xy) for xy in zip(poi_df[lon_col], poi_df[lat_col])]
    poi_gdf = gpd.GeoDataFrame(poi_df, geometry=geometry, crs="EPSG:4326")
    
    poi_proj = poi_gdf.to_crs("EPSG:28355")
    edges_proj = edges_gdf.to_crs("EPSG:28355")
    
    # Drop index_right and index_left if they exist from previous spatial joins to avoid ValueError
    gdf_edges_clean = edges_proj.drop(columns=['index_right', 'index_left'], errors='ignore')

    # Find the nearest edge for each POI
    joined = gpd.sjoin_nearest(
        poi_proj,
        gdf_edges_clean,
        how='left', 
        max_distance=max_dist, 
        distance_col='dist'
    )
    
    mapping = {}
    for _, row in joined.iterrows():
        edge_idx = row['index_right']
        poi_id = row[id_col]
        if edge_idx not in mapping:
            mapping[edge_idx] = []
        mapping[edge_idx].append(poi_id)
        
    return mapping


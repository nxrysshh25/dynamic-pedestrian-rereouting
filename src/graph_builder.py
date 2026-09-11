import networkx as nx
from shapely.geometry import LineString
from shapely.geometry import LineString

def build_networkx_graph(gdf):
    """
    Builds an undirected NetworkX graph from the pedestrian network GeoDataFrame.
    Uses start and end coordinates of each LineString as nodes.
    """
    G = nx.Graph()
    print("Building NetworkX graph from GeoDataFrame...")
    for idx, row in gdf.iterrows():
        geom = row['geometry']
        if not isinstance(geom, LineString):
            continue
            
        # Node coordinates as tuple of floats for hashing
        coords = list(geom.coords)
        u = (round(coords[0][0], 6), round(coords[0][1], 6))
        v = (round(coords[-1][0], 6), round(coords[-1][1], 6))
        
        import pyproj
        geod = pyproj.Geod(ellps='WGS84')
        distance = geod.geometry_length(geom)
        
        # Add nodes with their coordinates
        G.add_node(u, x=u[0], y=u[1])
        G.add_node(v, x=v[0], y=v[1])
        
        # Add edge with attributes
        edge_attrs = {
            'geometry': geom,
            'length': distance,
            'has_stairs': row.get('has_stairs', False),
            'wheelchair_accessible': row.get('wheelchair_accessible', None),
            'incline_value': row.get('incline_value', None),
            'surface_type': row.get('surface_type', 'unknown'),
            'smoothness_value': row.get('smoothness_value', 'unknown'),
            'tactile_paving': row.get('tactile_paving', 'unknown'),
            'sensors': row.get('sensors', []),
            'signals': row.get('signals', [])
        }
        
        G.add_edge(u, v, **edge_attrs)
        
    print(f"Graph built with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges.")
    return G



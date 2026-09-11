import folium
import geopandas as gpd

def create_map(G, path, path_edges, origin, destination):
    """
    Creates an interactive Folium map showing the start/end points and the calculated route.
    """
    # Initialize map around the origin
    m = folium.Map(location=[origin[1], origin[0]], zoom_start=15)
    
    # Add origin and destination markers
    folium.Marker(
        [origin[1], origin[0]], 
        popup='Start', 
        icon=folium.Icon(color='green', icon='play')
    ).add_to(m)
    
    folium.Marker(
        [destination[1], destination[0]], 
        popup='Destination', 
        icon=folium.Icon(color='red', icon='stop')
    ).add_to(m)
    
    if not path or not path_edges:
        return m
        
    # Draw the route
    route_coords = []
    for edge in path_edges:
        # Extract coordinates from LineString geometry
        coords = list(edge['geometry'].coords)
        # Folium expects [lat, lon]
        route_coords.extend([[c[1], c[0]] for c in coords])
        
    folium.PolyLine(
        route_coords,
        weight=5,
        color='blue',
        opacity=0.8,
        tooltip="Recommended Route"
    ).add_to(m)
    
    # Highlight restrictive/high penalty segments
    for edge in path_edges:
        if edge.get('has_stairs', False) or edge.get('wheelchair_accessible') is False:
            coords = list(edge['geometry'].coords)
            edge_coords = [[c[1], c[0]] for c in coords]
            folium.PolyLine(
                edge_coords,
                weight=5,
                color='red',
                opacity=1.0,
                tooltip=f"Restricted/Stairs/Inaccessible Segment (Cost: {edge.get('cost', 0):.1f})"
            ).add_to(m)
            
    return m

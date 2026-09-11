import React, { useEffect, useRef, useState } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapCanvas({ routeData, injectMode, onMapClick, activeEvents, selectedEdge }) {
  const mapRef = useRef();
  
  // Default map view centered on VIT Vellore Campus
  const [viewState, setViewState] = useState({
    longitude: 79.155,
    latitude: 12.971,
    zoom: 15.5,
    pitch: 45,
    bearing: 0
  });

  const [configLoaded, setConfigLoaded] = useState(false);

  const [sensors, setSensors] = useState([]);
  const [signals, setSignals] = useState([]);
  const [academicBlocks, setAcademicBlocks] = useState(null);
  const [pedestrianNetwork, setPedestrianNetwork] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/config')
      .then(res => res.json())
      .then(cfg => {
        if (cfg.center) {
          setViewState(prev => ({
            ...prev,
            longitude: cfg.center[0],
            latitude: cfg.center[1],
            zoom: cfg.zoom || 14.5
          }));
        }
        setConfigLoaded(true);
      })
      .catch(console.error);

    fetch('http://127.0.0.1:8000/api/sensors')
      .then(res => res.json())
      .then(setSensors)
      .catch(console.error);

    fetch('http://127.0.0.1:8000/api/signals')
      .then(res => res.json())
      .then(setSignals)
      .catch(console.error);

    fetch('http://127.0.0.1:8000/api/academic_blocks')
      .then(res => res.json())
      .then(data => {
        console.log(`Academic block features received: ${data.features ? data.features.length : 0}`);
        setAcademicBlocks(data);
      })
      .catch(console.error);

    fetch('http://127.0.0.1:8000/api/pedestrian_network')
      .then(res => res.json())
      .then(setPedestrianNetwork)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (routeData && mapRef.current) {
      const coords = routeData.route.geometry.coordinates;
      if (coords && coords.length > 0) {
        // Find bounding box to fit the route
        const bounds = coords.reduce(
          (acc, coord) => [
            [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
            [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
          ],
          [[coords[0][0], coords[0][1]], [coords[0][0], coords[0][1]]]
        );
        
        if (!routeData.isBackground) {
          mapRef.current.fitBounds(bounds, { 
            padding: { top: 120, bottom: 250, left: 450, right: 400 }, 
            duration: 1500 
          });
        }
      }
    }
  }, [routeData]);

  const handleMapClick = (e) => {
    if (injectMode && onMapClick) {
      onMapClick(e.lngLat.lng, e.lngLat.lat);
      return;
    }
    
    // Check for academic block clicks
    if (mapRef.current) {
      const features = mapRef.current.queryRenderedFeatures(e.point, {
        layers: ['academic-blocks-marker', 'academic-blocks-label']
      });
      if (features.length > 0) {
        const feature = features[0];
        setPopupInfo({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          name: feature.properties.name,
          short_name: feature.properties.short_name
        });
      } else {
        setPopupInfo(null);
      }
    }
  };

  const routeLayerStyle = {
    id: 'route',
    type: 'line',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#2563eb', // strong blue
      'line-width': 8,
      'line-opacity': 1.0
    }
  };

  // Restricted segments style
  const restrictedLayerStyle = {
    id: 'restricted-segments',
    type: 'line',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#dc2626', // danger color
      'line-width': 8,
      'line-opacity': 0.9,
      'line-dasharray': [2, 2]
    }
  };

  const cursorStyle = injectMode ? 'crosshair' : 'grab';

  const activeEventsGeoJSON = {
    type: 'FeatureCollection',
    features: (activeEvents || [])
      .filter(evt => evt.coordinates)
      .map(evt => {
        const percent = Math.min(100, Math.max(0, (evt.current_penalty / evt.initial_penalty) * 100));
        let color = '#4caf50'; // Low penalty / decayed
        if (percent > 66) color = '#dc2626'; // High
        else if (percent > 33) color = '#f97316'; // Medium

        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: evt.coordinates
          },
          properties: {
            color: color,
            penalty: evt.current_penalty,
            opacity: 0.2 + (percent / 100.0) * 0.6 // From 0.2 to 0.8
          }
        };
      })
  };

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        mapLibre={maplibregl}
        style={{ width: '100%', height: '100%' }}
        cursor={cursorStyle}
        interactiveLayerIds={['academic-blocks-marker', 'academic-blocks-label']}
      >
        {/* Background Pedestrian Network Layer */}
        {pedestrianNetwork && pedestrianNetwork.features.length > 0 && (
          <Source id="pedestrian-network-source" type="geojson" data={pedestrianNetwork}>
            {/* Standard footways */}
            <Layer
              id="pedestrian-network-base"
              type="line"
              filter={['!has', 'stairs']}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#9ca3af', // gray-400
                'line-width': 2,
                'line-opacity': 0.4
              }}
            />
            {/* Stairs */}
            <Layer
              id="pedestrian-network-stairs"
              type="line"
              filter={['==', 'stairs', true]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#f59e0b', // amber
                'line-width': 3,
                'line-dasharray': [1, 1],
                'line-opacity': 0.8
              }}
            />
            {/* Ramps */}
            <Layer
              id="pedestrian-network-ramps"
              type="line"
              filter={['==', 'ramp', true]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#10b981', // emerald
                'line-width': 4,
                'line-opacity': 0.8
              }}
            />
            {/* Crossings - DISABLED FOR DEBUGGING BLUE DOTS
            <Layer
              id="pedestrian-network-crossings"
              type="line"
              filter={['==', 'highway', 'crossing']}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#60a5fa', // lighter blue
                'line-width': 4,
                'line-dasharray': [2, 2], // actual dashes instead of dots to prevent looking like nodes
                'line-opacity': 0.8
              }}
            />
            */}
            {/* Pedestrian Edge Labels */}
            <Layer
              id="pedestrian-edge-labels"
              type="symbol"
              filter={['has', 'display_name']}
              layout={{
                'symbol-placement': 'line',
                'text-field': ['get', 'display_name'],
                'text-font': ['Open Sans Regular'],
                'text-size': 13,
                'text-max-angle': 45,
                'text-pitch-alignment': 'viewport',
                'text-keep-upright': true,
                'symbol-spacing': 250
              }}
              paint={{
                'text-color': '#1f2937',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2
              }}
            />
          </Source>
        )}

        {/* Academic Blocks Layer */}
        {academicBlocks && academicBlocks.features.length > 0 && (
          <Source id="academic-blocks-source" type="geojson" data={academicBlocks}>
            {/* Academic Blocks Marker - DISABLED FOR DEBUGGING BLUE DOTS
            <Layer
              id="academic-blocks-marker"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': '#4f46e5', // indigo
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
              }}
            />
            */}
            <Layer
              id="academic-blocks-label"
              type="symbol"
              layout={{
                'symbol-placement': 'point',
                'text-field': [
                  'case',
                  ['==', ['get', 'short_name'], ['get', 'name']],
                  ['get', 'name'],
                  ['concat', ['get', 'short_name'], ' — ', ['get', 'name']]
                ],
                'text-font': ['Open Sans Regular'],
                'text-size': 16,
                'text-anchor': 'center',
                'text-allow-overlap': true
              }}
              paint={{
                'text-color': '#000000',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2
              }}
            />
          </Source>
        )}

        {/* Academic Block Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            anchor="bottom"
            offset={[0, -10]}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
          >
            <div style={{ padding: '4px', textAlign: 'center' }}>
              <strong style={{ fontSize: '14px', display: 'block' }}>{popupInfo.short_name}</strong>
              <span style={{ fontSize: '12px', color: '#4b5563' }}>{popupInfo.name}</span>
              <div style={{ fontSize: '10px', marginTop: '4px', color: '#6b7280' }}>Type: Academic Block</div>
            </div>
          </Popup>
        )}

        {/* Sensors Layer - DISABLED FOR DEBUGGING BLUE DOTS
        {sensors.length > 0 && (
          <Source id="sensors-source" type="geojson" data={{
            type: 'FeatureCollection',
            features: sensors.map(s => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
              properties: { id: s.location_id, name: s.sensor_name }
            }))
          }}>
            <Layer
              id="sensors-layer"
              type="circle"
              paint={{
                'circle-radius': 4,
                'circle-color': '#1890ff',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
              }}
            />
          </Source>
        )}
        */}

        {/* Signals Layer */}
        {signals.length > 0 && (
          <Source id="signals-source" type="geojson" data={{
            type: 'FeatureCollection',
            features: signals.map(s => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [s.LONGITUDE, s.LATITUDE] },
              properties: { id: s.SITE_NO, name: s.SITE_NAME }
            }))
          }}>
            <Layer
              id="signals-layer"
              type="circle"
              paint={{
                'circle-radius': 3,
                'circle-color': '#faad14',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#000000'
              }}
            />
          </Source>
        )}

        {/* Selected Edge Highlight */}
        {selectedEdge && selectedEdge.geometry && (
          <Source id="selected-edge-source" type="geojson" data={{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: selectedEdge.geometry
            }
          }}>
            <Layer
              id="selected-edge-layer"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': '#2563eb', // strong blue
                'line-width': 8,
                'line-opacity': 1.0
              }}
            />
          </Source>
        )}

        {/* Active Decay Events Layer */}
        {activeEventsGeoJSON.features.length > 0 && (
          <Source id="active-events-source" type="geojson" data={activeEventsGeoJSON}>
            <Layer
              id="active-events-layer"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round'
              }}
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 8,
                'line-opacity': ['get', 'opacity']
              }}
            />
          </Source>
        )}

        {routeData && (
          <>
            {/* Main Route */}
            <Source id="route-source" type="geojson" data={routeData.route}>
              <Layer {...routeLayerStyle} />
              <Layer
                id="route-arrows"
                type="symbol"
                layout={{
                  'symbol-placement': 'line',
                  'symbol-spacing': 80,
                  'text-field': '>',
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 20,
                  'text-keep-upright': false,
                  'text-offset': [0, -0.1]
                }}
                paint={{
                  'text-color': '#ffffff'
                }}
              />
              <Layer
                id="route-label"
                type="symbol"
                layout={{
                  'symbol-placement': 'line',
                  'symbol-spacing': 400,
                  'text-field': 'PADA-R ROUTE',
                  'text-size': 14,
                  'text-offset': [0, -1.5],
                  'text-keep-upright': true
                }}
                paint={{
                  'text-color': '#1d4ed8',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 2
                }}
              />
            </Source>

            {/* Restricted Segments */}
            {routeData.restricted_segments.features.length > 0 && (
              <Source id="restricted-source" type="geojson" data={routeData.restricted_segments}>
                <Layer {...restrictedLayerStyle} />
              </Source>
            )}

            {/* Origin Marker */}
            <Source id="origin-source" type="geojson" data={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: routeData.route.geometry.coordinates[0]
              }
            }}>
              <Layer
                id="origin-marker"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': '#22c55e',
                  'circle-stroke-width': 3,
                  'circle-stroke-color': '#ffffff'
                }}
              />
              <Layer
                id="origin-label"
                type="symbol"
                layout={{
                  'text-field': `START – ${routeData.originName || 'Origin'}`,
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 14,
                  'text-offset': [0, 1.5],
                  'text-anchor': 'top'
                }}
                paint={{
                  'text-color': '#166534',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 2
                }}
              />
            </Source>

            {/* Destination Marker */}
            <Source id="dest-source" type="geojson" data={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: routeData.route.geometry.coordinates[routeData.route.geometry.coordinates.length - 1]
              }
            }}>
              <Layer
                id="dest-marker"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': '#ef4444',
                  'circle-stroke-width': 3,
                  'circle-stroke-color': '#ffffff'
                }}
              />
              <Layer
                id="dest-label"
                type="symbol"
                layout={{
                  'text-field': `DESTINATION – ${routeData.destName || 'Destination'}`,
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 14,
                  'text-offset': [0, 1.5],
                  'text-anchor': 'top'
                }}
                paint={{
                  'text-color': '#991b1b',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 2
                }}
              />
            </Source>
          </>
        )}
      </Map>
    </div>
  );
}

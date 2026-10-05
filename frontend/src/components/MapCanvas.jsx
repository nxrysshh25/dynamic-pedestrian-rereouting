import React, { useEffect, useRef, useState } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MapCanvas({
  routeData,
  activeCandidateId,
  onSelectCandidate,
  verificationTarget,
  verificationAnchor
}) {
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

  // Focus map on verification target edge when selected (if not viewing calculated route)
  useEffect(() => {
    if (!routeData && verificationTarget?.coordinates?.length && mapRef.current) {
      const coords = verificationTarget.coordinates;
      const bounds = coords.reduce(
        (acc, coord) => [
          [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
          [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
        ],
        [[coords[0][0], coords[0][1]], [coords[0][0], coords[0][1]]]
      );
      mapRef.current.fitBounds(bounds, {
        padding: { top: 150, bottom: 150, left: 380, right: 380 },
        duration: 1200,
        maxZoom: 18
      });
    }
  }, [verificationTarget, routeData]);

  const handleMapClick = (e) => {
    // Check for academic block clicks
    if (mapRef.current) {
      // Check for candidate route clicks
      const candFeatures = mapRef.current.queryRenderedFeatures(e.point, {
        layers: ['candidate-routes-line']
      });
      if (candFeatures.length > 0 && onSelectCandidate) {
        const clickedId = candFeatures[0].properties.route_id;
        const matched = routeData?.candidate_routes?.find(c => c.route_id === clickedId);
        if (matched) {
          onSelectCandidate(matched);
          return;
        }
      }

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

  const cursorStyle = 'grab';



  const CANDIDATE_COLORS = {
    route_1_fastest: '#2563eb', // Strong Blue
    route_2_congestion: '#d97706', // Amber / Orange
    route_3_resilience: '#059669', // Emerald / Green
  };

  const activeSelectedId = activeCandidateId || routeData?.selected_candidate?.route_id || (routeData?.candidate_routes && routeData.candidate_routes[0]?.route_id);

  const candidatesGeoJSON = {
    type: 'FeatureCollection',
    features: (routeData?.candidate_routes || []).map((cand) => {
      const isSelected = cand.route_id === activeSelectedId;
      const themeColor = CANDIDATE_COLORS[cand.route_id] || '#6366f1';
      return {
        type: 'Feature',
        geometry: cand.geometry,
        properties: {
          route_id: cand.route_id,
          name: cand.name,
          color: themeColor,
          width: isSelected ? 8 : 4.5,
          opacity: isSelected ? 1.0 : 0.65,
          isSelected: isSelected,
          order: isSelected ? 2 : 1
        }
      };
    }).sort((a, b) => a.properties.order - b.properties.order)
  };

  const criticalEdgesGeoJSON = {
    type: 'FeatureCollection',
    features: (routeData?.selected_candidate?.edge_sequence || [])
      .filter(e => e.cad >= 0.4 && e.coordinates)
      .map(e => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: e.coordinates
        },
        properties: {
          name: e.name || 'Critical Corridor',
          cad: e.cad
        }
      }))
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
        interactiveLayerIds={['academic-blocks-marker', 'academic-blocks-label', 'candidate-routes-line']}
      >
        {/* Background Pedestrian Network Layer */}
        {pedestrianNetwork && pedestrianNetwork.features.length > 0 && (
          <Source id="pedestrian-network-source" type="geojson" data={pedestrianNetwork}>
            {/* Standard Pedestrian Paths (footway, path, pedestrian) */}
            <Layer
              id="pedestrian-network-base"
              type="line"
              filter={['match', ['get', 'highway'], ['footway', 'pedestrian', 'path'], true, false]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#9ca3af', // gray-400
                'line-width': 2.5,
                'line-opacity': 0.8
              }}
            />
            
            {/* Restricted Paths (e.g. primary, tertiary, service) */}
            <Layer
              id="pedestrian-network-restricted"
              type="line"
              filter={['match', ['get', 'highway'], ['primary', 'secondary', 'tertiary', 'service', 'residential', 'unclassified', 'track'], true, false]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#d1d5db', // gray-300
                'line-width': 1.5,
                'line-dasharray': [2, 2],
                'line-opacity': 0.6
              }}
            />
            
            {/* Slopes Base Line */}
            <Layer
              id="pedestrian-network-slopes-line"
              type="line"
              filter={[
                'any',
                ['in', ['get', 'slope_status'], ['literal', ['up', 'down']]],
                ['all',
                  ['==', ['get', 'slope_status'], 'measured'],
                  ['>', ['get', 'slope_percent'], 4]
                ]
              ]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#8b5cf6', // purple
                'line-width': ['interpolate', ['linear'], ['zoom'], 15, 3, 18, 6],
                'line-opacity': 1.0
              }}
            />
            
            {/* Crossings Base Line */}
            <Layer
              id="pedestrian-network-crossings-line"
              type="line"
              filter={['!=', 'crossing', 'no']}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#60a5fa', // blue
                'line-width': ['interpolate', ['linear'], ['zoom'], 15, 3, 18, 6],
                'line-dasharray': [2, 2], // actual dashes, not dots
                'line-opacity': 0.9
              }}
            />
            
            {/* Barriers Base Line */}
            <Layer
              id="pedestrian-network-barriers-line"
              type="line"
              filter={['!=', 'barrier', 'no']}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#ef4444', // red
                'line-width': ['interpolate', ['linear'], ['zoom'], 15, 3, 18, 6],
                'line-opacity': 0.9
              }}
            />
            
            {/* Subways Base Line */}
            <Layer
              id="pedestrian-network-subways-line"
              type="line"
              filter={['==', 'subway', true]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#06b6d4', // cyan-500
                'line-width': ['interpolate', ['linear'], ['zoom'], 15, 4, 18, 8],
                'line-dasharray': [1, 2], // distinct dashed
                'line-opacity': 1.0
              }}
            />
            
            {/* Stairs Base Line */}
            <Layer
              id="pedestrian-network-stairs-line"
              type="line"
              filter={['==', 'stairs', true]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#b45309', // darker amber for better visibility
                'line-width': ['interpolate', ['linear'], ['zoom'], 15, 4, 18, 8],
                'line-dasharray': [0.5, 0.5], // step pattern
                'line-opacity': 1.0
              }}
            />
            
            {/* Ramps Base Line */}
            <Layer
              id="pedestrian-network-ramps-line"
              type="line"
              filter={['==', 'ramp', true]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#10b981', // emerald
                'line-width': ['interpolate', ['linear'], ['zoom'], 15, 4, 18, 8],
                'line-opacity': 1.0
              }}
            />

            {/* Symbols and Labels for all features */}
            <Layer
              id="feature-labels"
              type="symbol"
              filter={[
                'any',
                ['==', 'subway', true],
                ['==', 'stairs', true],
                ['==', 'ramp', true],
                ['!=', 'crossing', 'no'],
                ['!=', 'barrier', 'no'],
                ['in', ['get', 'slope_status'], ['literal', ['up', 'down']]],
                ['all',
                  ['==', ['get', 'slope_status'], 'measured'],
                  ['>', ['get', 'slope_percent'], 4]
                ]
              ]}
              layout={{
                'symbol-placement': 'line',
                'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 14, 500, 18, 150],
                'text-field': [
                  'case',
                  ['==', ['get', 'subway'], true], '⬇ SUBWAY',
                  ['==', ['get', 'stairs'], true], '🪜 STAIRS',
                  ['==', ['get', 'ramp'], true], '♿ RAMP',
                  ['!=', ['get', 'barrier'], 'no'], '🚧 BARRIER',
                  ['!=', ['get', 'crossing'], 'no'], '🚸 CROSSING',
                  ['==', ['get', 'slope_status'], 'measured'], ['concat', '↗ ', ['get', 'slope_percent'], '% SLOPE'],
                  ['==', ['get', 'slope_status'], 'up'], '↗ UPHILL',
                  ['==', ['get', 'slope_status'], 'down'], '↘ DOWNHILL',
                  ''
                ],
                'text-font': ['Open Sans Bold'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 14],
                'text-max-angle': 45,
                'text-pitch-alignment': 'viewport',
                'text-keep-upright': true,
                'text-allow-overlap': false
              }}
              paint={{
                'text-color': [
                  'case',
                  ['==', ['get', 'subway'], true], '#0891b2',
                  ['==', ['get', 'stairs'], true], '#92400e',
                  ['==', ['get', 'ramp'], true], '#065f46',
                  ['!=', ['get', 'barrier'], 'no'], '#991b1b',
                  ['!=', ['get', 'crossing'], 'no'], '#1e40af',
                  ['in', ['get', 'slope_status'], ['literal', ['up', 'down']]], '#4c1d95',
                  ['all',
                    ['==', ['get', 'slope_status'], 'measured'],
                    ['>', ['get', 'slope_percent'], 4]
                  ], '#4c1d95',
                  '#1f2937'
                ],
                'text-halo-color': '#ffffff',
                'text-halo-width': 2
              }}
            />
            
            {/* Standard Edge Labels (fallback for normal walkways) */}
            <Layer
              id="pedestrian-edge-labels"
              type="symbol"
              filter={[
                'all',
                ['has', 'display_name'],
                ['!=', ['get', 'subway'], true],
                ['!=', ['get', 'stairs'], true],
                ['!=', ['get', 'ramp'], true],
                ['==', ['get', 'crossing'], 'no'],
                ['==', ['get', 'barrier'], 'no'],
                ['!', ['in', ['get', 'slope_status'], ['literal', ['up', 'down']]]],
                ['!', ['all',
                  ['==', ['get', 'slope_status'], 'measured'],
                  ['>', ['get', 'slope_percent'], 4]
                ]]
              ]}
              layout={{
                'symbol-placement': 'line',
                'text-field': ['get', 'display_name'],
                'text-font': ['Open Sans Regular'],
                'text-size': 12,
                'text-max-angle': 45,
                'text-pitch-alignment': 'viewport',
                'text-keep-upright': true,
                'symbol-spacing': 250
              }}
              paint={{
                'text-color': '#4b5563',
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



        {routeData && (
          <>
            {/* DARR Multi-Route Candidate Layer */}
            {candidatesGeoJSON.features.length > 0 ? (
              <Source id="candidate-routes-source" type="geojson" data={candidatesGeoJSON}>
                {/* Alternative and Selected Route Lines */}
                <Layer
                  id="candidate-routes-line"
                  type="line"
                  layout={{
                    'line-join': 'round',
                    'line-cap': 'round'
                  }}
                  paint={{
                    'line-color': ['get', 'color'],
                    'line-width': ['get', 'width'],
                    'line-opacity': ['get', 'opacity']
                  }}
                />

                {/* Arrow symbols for the selected route */}
                <Layer
                  id="candidate-route-arrows"
                  type="symbol"
                  filter={['==', ['get', 'isSelected'], true]}
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

                {/* Labels along candidate paths */}
                <Layer
                  id="candidate-route-labels"
                  type="symbol"
                  layout={{
                    'symbol-placement': 'line',
                    'symbol-spacing': 350,
                    'text-field': ['get', 'name'],
                    'text-size': 13,
                    'text-offset': [0, -1.2],
                    'text-keep-upright': true
                  }}
                  paint={{
                    'text-color': ['get', 'color'],
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2.5
                  }}
                />
              </Source>
            ) : (
              /* Fallback single route */
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
                    'text-field': 'DARR ROUTE',
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
            )}

            {/* Critical Accessibility Bottlenecks Highlight */}
            {criticalEdgesGeoJSON.features.length > 0 && (
              <Source id="critical-corridors-source" type="geojson" data={criticalEdgesGeoJSON}>
                <Layer
                  id="critical-corridors-glow"
                  type="line"
                  layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{
                    'line-color': '#ea580c',
                    'line-width': 12,
                    'line-opacity': 0.5,
                    'line-dasharray': [2, 2]
                  }}
                />
              </Source>
            )}

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

        {/* PCVC Verification Target Edge Highlight */}
        {verificationTarget?.coordinates?.length > 0 && (
          <Source id="pcvc-target-edge-source" type="geojson" data={{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: verificationTarget.coordinates
            },
            properties: {
              name: verificationTarget.name,
              edge_id: verificationTarget.edge_id
            }
          }}>
            <Layer
              id="pcvc-target-edge-glow"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#f59e0b',
                'line-width': 12,
                'line-opacity': 0.85
              }}
            />
            <Layer
              id="pcvc-target-edge-core"
              type="line"
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#ffffff',
                'line-width': 3,
                'line-dasharray': [2, 2]
              }}
            />
            <Layer
              id="pcvc-target-edge-label"
              type="symbol"
              layout={{
                'symbol-placement': 'line',
                'text-field': 'PCVC TARGET',
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-offset': [0, -1.2],
                'text-keep-upright': true
              }}
              paint={{
                'text-color': '#b45309',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2
              }}
            />
          </Source>
        )}

        {/* PCVC Probe Safe Anchor Marker */}
        {verificationAnchor?.anchor_coords && (
          <Source id="pcvc-anchor-source" type="geojson" data={{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: verificationAnchor.anchor_coords
            },
            properties: {
              name: verificationAnchor.anchor_name
            }
          }}>
            <Layer
              id="pcvc-anchor-marker"
              type="circle"
              paint={{
                'circle-radius': 9,
                'circle-color': '#8b5cf6',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff'
              }}
            />
            <Layer
              id="pcvc-anchor-label"
              type="symbol"
              layout={{
                'text-field': `PROBE ANCHOR: ${verificationAnchor.anchor_name || 'Landmark'}`,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 12,
                'text-offset': [0, 1.4],
                'text-anchor': 'top'
              }}
              paint={{
                'text-color': '#6d28d9',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2
              }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}

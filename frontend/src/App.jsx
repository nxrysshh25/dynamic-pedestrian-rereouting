import { useState, useRef, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import MapCanvas from './components/MapCanvas'
import MapLegend from './components/MapLegend'
import CongestionPanel from './components/CongestionPanel'
import StatusNotification from './components/StatusNotification'
import CongestionBanner from './components/CongestionBanner'

import './index.css'
import './App.css'

function App() {
  const [routeData, setRouteData] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [appState, setAppState] = useState({
    status: 'IDLE', // IDLE, ROUTING, ROUTE_READY, ANALYZING, CONGESTION_ACTIVE, ERROR
    message: 'Ready to plan your walk.',
    type: 'neutral'
  });
  const [congestionRefreshCount, setCongestionRefreshCount] = useState(0);
  
  const [isMapSelectionMode, setIsMapSelectionMode] = useState(false);
  const [selectedMapLocation, setSelectedMapLocation] = useState(null);

  const handleStartMapSelection = () => {
    setIsMapSelectionMode(true);
    setSelectedMapLocation(null);
    setAppState({ status: 'ANALYZING', message: 'Click a pedestrian path on the map to select a location.', type: 'neutral' });
  };

  const handleMapLocationSelected = (locationData) => {
    setIsMapSelectionMode(false);
    setSelectedMapLocation(locationData);
    setAppState({ status: 'IDLE', message: 'Location selected.', type: 'success' });
  };

  const handleCancelMapSelection = () => {
    setIsMapSelectionMode(false);
    setAppState({ status: 'IDLE', message: 'Selection cancelled.', type: 'neutral' });
  };

  // Clear congestion on fresh browser load
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/congestion/reset', { method: 'POST' })
      .then(() => setCongestionRefreshCount(prev => prev + 1))
      .catch(err => console.error('Failed to reset congestion on load:', err));
  }, []);

  // Store last requested route parameters and data for recalculation
  const lastRequest = useRef(null);
  const previousRouteData = useRef(null);

  const setStatus = (status, message, type = 'neutral') => {
    setAppState({ status, message, type });
  };

  const handleRouteCalculation = useCallback(async (origin, destination, profile, isBackground = false, originName = 'Origin', destName = 'Destination') => {
    if (!isBackground) {
      setStatus('ROUTING', 'Finding the lowest-cost pedestrian route...', 'neutral');
      setRouteData(null);
      previousRouteData.current = null;
    }
    lastRequest.current = { origin, destination, profile, originName, destName };
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, profile }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorDetail = errorData.detail || 'Route calculation failed.';
        throw new Error(errorDetail);
      }
      
      const data = await response.json();
      data.isBackground = isBackground;
      data.originName = originName;
      data.destName = destName;
      setRouteData(data);
      if (data.selected_candidate) {
        setSelectedCandidate(data.selected_candidate);
      }

      if (isBackground && previousRouteData.current) {
        const oldCoords = JSON.stringify(previousRouteData.current.route.geometry.coordinates);
        const newCoords = JSON.stringify(data.route.geometry.coordinates);
        const routeChanged = oldCoords !== newCoords;
        
        if (routeChanged && data.route_explanation?.avoids_congestion) {
           setStatus('ROUTE_READY', '⚠ ROUTE UPDATED: ' + data.route_explanation.reason, 'warning');
        } else if (!routeChanged && data.route_explanation?.congestion_affected) {
           setStatus('ROUTE_READY', '✓ ROUTE STILL OPTIMAL: ' + data.route_explanation.reason, 'success');
        } else if (routeChanged) {
           setStatus('ROUTE_READY', '⚠ ROUTE UPDATED based on new network conditions.', 'neutral');
        }
      } else if (!isBackground) {
        // Evaluate route for congestion
        if (data.route_explanation?.congestion_affected) {
          setStatus('ROUTE_READY', data.route_explanation.reason, 'warning');
        } else {
          setStatus('ROUTE_READY', data.route_explanation?.reason || 'Profile-optimized pedestrian route selected.', 'success');
        }
      }
      
      previousRouteData.current = data;

    } catch (err) {
      if (!isBackground) {
        setStatus('ERROR', err.message || 'Unable to calculate route. Please try again.', 'danger');
        setRouteData({ error: err.message, status: 'NO_ACCESSIBLE_ROUTE_FOUND' });
      }
    }
  }, []);

  const handleRecalculate = useCallback(() => {
    setCongestionRefreshCount(prev => prev + 1); // trigger map refresh
    if (lastRequest.current) {
      handleRouteCalculation(
        lastRequest.current.origin, 
        lastRequest.current.destination, 
        lastRequest.current.profile, 
        true,
        lastRequest.current.originName,
        lastRequest.current.destName
      );
    }
  }, [handleRouteCalculation]);

  const [showPedestrianNetwork, setShowPedestrianNetwork] = useState(true);

  return (
    <div className="app-container">
      <Sidebar 
        onCalculate={handleRouteCalculation} 
        appState={appState}
        routeData={routeData}
        activeCandidateId={selectedCandidate?.route_id}
        onSelectCandidate={setSelectedCandidate}
      />
      <div className="map-container">
        <MapCanvas 
          routeData={routeData} 
          activeCandidateId={selectedCandidate?.route_id}
          onSelectCandidate={setSelectedCandidate}
          refreshTrigger={congestionRefreshCount}
          isMapSelectionMode={isMapSelectionMode}
          selectedMapLocation={selectedMapLocation}
          onMapLocationSelected={handleMapLocationSelected}
          showPedestrianNetwork={showPedestrianNetwork}
        />
        <CongestionBanner refreshTrigger={congestionRefreshCount} />
        <CongestionPanel 
          onRecalculate={handleRecalculate} 
          onRefreshMap={() => setCongestionRefreshCount(prev => prev + 1)}
          setAppStatus={setStatus} 
          isMapSelectionMode={isMapSelectionMode}
          selectedMapLocation={selectedMapLocation}
          onStartMapSelection={handleStartMapSelection}
          onCancelMapSelection={handleCancelMapSelection}
          onClearSelectedMapLocation={() => setSelectedMapLocation(null)}
        />

        <MapLegend 
          showPedestrianNetwork={showPedestrianNetwork}
          onTogglePedestrianNetwork={() => setShowPedestrianNetwork(prev => !prev)}
        />
        <StatusNotification appState={appState} />
      </div>
    </div>
  )
}

export default App

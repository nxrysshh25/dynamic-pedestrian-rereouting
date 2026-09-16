import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import MapCanvas from './components/MapCanvas'
import StatsOverlay from './components/StatsOverlay'
import SimulationControls from './components/SimulationControls'
import SignalDecayMonitor from './components/SignalDecayMonitor'
import CongestionSelectionPanel from './components/CongestionSelectionPanel'
import MapLegend from './components/MapLegend'
import './index.css'

function App() {
  const [routeData, setRouteData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [simState, setSimState] = useState(null);
  const [injectMode, setInjectMode] = useState(false);
  
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showCongestionPanel, setShowCongestionPanel] = useState(false);
  
  // Store last requested route parameters for recalculation
  const lastRequest = useRef(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/simulation/state')
      .then(res => res.json())
      .then(setSimState)
      .catch(console.error);
  }, []);

  const handleRouteCalculation = useCallback(async (origin, destination, profile, isBackground = false, originName = 'Origin', destName = 'Destination') => {
    if (!isBackground) {
      setIsLoading(true);
      setError(null);
      setRouteData(null);
    }
    lastRequest.current = { origin, destination, profile, originName, destName };
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, profile }),
      });
      
      if (!response.ok) {
        if (response.status === 400 || response.status === 422) {
          throw new Error('Invalid route request.');
        }
        throw new Error('Route calculation failed. Check the backend response.');
      }
      
      const data = await response.json();
      data.isBackground = isBackground;
      data.originName = originName;
      data.destName = destName;
      setRouteData(data);
    } catch (err) {
      if (!isBackground) {
        if (err.message.includes('Failed to fetch')) {
          setError('Routing server is unavailable. Please start the FastAPI backend.');
        } else {
          setError(err.message);
        }
      } else {
        console.error('Background route recalculation failed:', err);
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleRecalculate = useCallback(() => {
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

  const handleMapClick = async (lon, lat) => {
    if (!injectMode) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/simulation/select_edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lon, lat })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to select edge');
      }
      const data = await res.json();
      setSelectedEdge(data);
      setShowCongestionPanel(true);
      setInjectMode(false);
    } catch (e) {
      alert(e.message || "Unable to select a road segment. Please try again.");
    }
  };

  const handleInjectCongestion = async (intensity) => {
    if (!selectedEdge) return;
    try {
      await fetch('http://127.0.0.1:8000/api/simulation/inject_congestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          u: selectedEdge.u, 
          v: selectedEdge.v, 
          intensity: intensity 
        })
      });
      
      alert("Congestion injected into selected road segment successfully.");
      
      // Clear panel state
      setShowCongestionPanel(false);
      setSelectedEdge(null);
      
      // Force simState refresh to instantly show new event
      const stateRes = await fetch('http://127.0.0.1:8000/api/simulation/state');
      const stateData = await stateRes.json();
      setSimState(stateData);
      
      handleRecalculate();
    } catch (e) {
      console.error('Failed to inject congestion', e);
      alert("Unable to inject congestion. Check that the backend is running.");
    }
  };

  const handleCancelInjection = () => {
    setShowCongestionPanel(false);
    setSelectedEdge(null);
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <Sidebar 
        onCalculate={handleRouteCalculation} 
        isLoading={isLoading} 
        error={error} 
      />
      <div style={{ flex: 1, position: 'relative' }}>
        <MapCanvas 
          routeData={routeData} 
          injectMode={injectMode}
          onMapClick={handleMapClick}
          activeEvents={simState?.active_decay_events}
          selectedEdge={selectedEdge}
        />
        {routeData && (
          <div style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 10,
            maxHeight: 'calc(100vh - 48px)',
            pointerEvents: 'none',
            overflowY: 'auto'
          }}>
            <div style={{ pointerEvents: 'auto' }}>
              <StatsOverlay 
                stats={routeData.stats} 
                profile={routeData.route.properties.profile} 
                algorithm={routeData.algorithm}
                routeStatus={routeData.route_status}
              />
            </div>
          </div>
        )}
        
        <SimulationControls 
          simState={simState} 
          setSimState={setSimState} 
          onRecalculate={handleRecalculate}
          onInjectCongestion={setInjectMode}
        />
        
        {simState && <SignalDecayMonitor activeEvents={simState.active_decay_events} />}
        
        {showCongestionPanel && (
          <CongestionSelectionPanel 
            selectedEdge={selectedEdge}
            onCancel={handleCancelInjection}
            onInject={handleInjectCongestion}
          />
        )}
        
        <MapLegend />
      </div>
    </div>
  )
}

export default App


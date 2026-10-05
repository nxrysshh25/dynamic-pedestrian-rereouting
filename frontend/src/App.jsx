import { useState, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import MapCanvas from './components/MapCanvas'
import MapLegend from './components/MapLegend'
import DARRDecisionPanel from './components/DARRDecisionPanel'
import AccessibilityVerification from './components/AccessibilityVerification'
import './index.css'

function App() {
  const [routeData, setRouteData] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // PCVC state
  const [activeTab, setActiveTab] = useState('pcvc'); // 'darr' or 'pcvc'
  const [verificationTarget, setVerificationTarget] = useState(null);
  const [verificationAnchor, setVerificationAnchor] = useState(null);

  // Store last requested route parameters for recalculation
  const lastRequest = useRef(null);

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
      if (data.selected_candidate) {
        setSelectedCandidate(data.selected_candidate);
      }
      // When route arrives, auto-switch to DARR tab
      setActiveTab('darr');
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
          activeCandidateId={selectedCandidate?.route_id}
          onSelectCandidate={setSelectedCandidate}
          verificationTarget={verificationTarget}
          verificationAnchor={verificationAnchor}
        />
        
        {/* Right Floating Drawer: Tab toggle between DARR and PCVC */}
        <div style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 10,
          maxHeight: 'calc(100vh - 48px)',
          pointerEvents: 'none',
          overflowY: 'auto'
        }}>
          {/* Top Segmented Controls */}
          <div style={{
            pointerEvents: 'auto',
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(8px)',
            borderRadius: '8px',
            padding: '3px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            width: '360px'
          }}>
            <button
              onClick={() => setActiveTab('darr')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.6875rem',
                fontWeight: activeTab === 'darr' ? '700' : '500',
                backgroundColor: activeTab === 'darr' ? 'var(--accent-color)' : 'transparent',
                color: activeTab === 'darr' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Route Resilience (DARR)
            </button>
            <button
              onClick={() => setActiveTab('pcvc')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.6875rem',
                fontWeight: activeTab === 'pcvc' ? '700' : '500',
                backgroundColor: activeTab === 'pcvc' ? '#059669' : 'transparent',
                color: activeTab === 'pcvc' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Verification (PCVC)
            </button>
          </div>

          <div style={{ pointerEvents: 'auto' }}>
            {activeTab === 'darr' ? (
              routeData ? (
                <DARRDecisionPanel 
                  routeData={routeData}
                  selectedCandidate={selectedCandidate}
                  onSelectCandidate={setSelectedCandidate}
                  profile={lastRequest.current?.profile || routeData.route?.properties?.profile || 'general'}
                />
              ) : (
                <div className="glass-panel" style={{ width: '360px', padding: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Calculate a route from the left sidebar to view DARR resilience and alternative candidate corridors.
                </div>
              )
            ) : (
              <AccessibilityVerification 
                onSelectTargetEdge={setVerificationTarget}
                onSelectAnchor={setVerificationAnchor}
              />
            )}
          </div>
        </div>
        
        <MapLegend />
      </div>
    </div>
  )
}

export default App


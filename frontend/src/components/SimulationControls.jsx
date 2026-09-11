import React, { useState, useEffect } from 'react';

export default function SimulationControls({ simState, setSimState, onInjectCongestion, onRecalculate }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [injectMode, setInjectMode] = useState(false);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://127.0.0.1:8000/api/simulation/step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delta_seconds: 300 }) // advance 5 mins
          });
          const data = await res.json();
          setSimState(data);
          onRecalculate();
        } catch (e) {
          console.error(e);
          setIsPlaying(false);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, setSimState, onRecalculate]);

  const handleReset = async () => {
    const res = await fetch('http://127.0.0.1:8000/api/simulation/reset', { method: 'POST' });
    const data = await res.json();
    setSimState(data);
    onRecalculate();
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60) % 60;
    const hrs = Math.floor(secs / 3600);
    return `+${hrs}h ${mins}m`;
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: 20,
      background: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      width: '320px'
    }}>
      <h3 style={{ margin: 0, fontSize: '16px' }}>Simulation Controls</h3>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
        <span><strong>Time:</strong> {simState?.date} {simState?.hour}:00</span>
        <span><strong>Elapsed:</strong> {formatTime(simState?.elapsed_seconds || 0)}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ flex: 1, padding: '8px', background: isPlaying ? '#ff4d4f' : '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {isPlaying ? 'Pause' : 'Play (x300)'}
        </button>
        <button 
          onClick={handleReset}
          style={{ flex: 1, padding: '8px', background: '#f0f0f0', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' }}
        >
          Reset
        </button>
      </div>

      <button 
        onClick={() => {
          setInjectMode(!injectMode);
          onInjectCongestion(!injectMode); // toggle mode in parent
        }}
        style={{ padding: '8px', background: injectMode ? '#52c41a' : '#faad14', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '5px', fontWeight: injectMode ? 'bold' : 'normal' }}
      >
        {injectMode ? 'SELECT A ROAD SEGMENT' : 'Inject Congestion'}
      </button>
    </div>
  );
}

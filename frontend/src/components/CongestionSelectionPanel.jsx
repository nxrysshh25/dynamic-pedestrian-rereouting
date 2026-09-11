import React, { useState } from 'react';

export default function CongestionSelectionPanel({ selectedEdge, onCancel, onInject }) {
  const [intensity, setIntensity] = useState('HIGH');

  if (!selectedEdge) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: 100,
      width: '300px',
      border: '2px solid #2563eb'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#1f2937' }}>ROAD SEGMENT SELECTED</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <strong>Intensity:</strong>
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="intensity" 
              value="LOW" 
              checked={intensity === 'LOW'} 
              onChange={() => setIntensity('LOW')}
              style={{ marginRight: '8px' }}
            />
            LOW (Penalty: 50)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="intensity" 
              value="MEDIUM" 
              checked={intensity === 'MEDIUM'} 
              onChange={() => setIntensity('MEDIUM')}
              style={{ marginRight: '8px' }}
            />
            MEDIUM (Penalty: 100)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="intensity" 
              value="HIGH" 
              checked={intensity === 'HIGH'} 
              onChange={() => setIntensity('HIGH')}
              style={{ marginRight: '8px' }}
            />
            HIGH (Penalty: 200)
          </label>
        </div>
      </div>
      
      <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', marginBottom: '15px' }}>
        Signal decay will reduce this penalty as simulation time advances.
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <button 
          onClick={onCancel}
          style={{ flex: 1, padding: '8px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
        >
          CANCEL
        </button>
        <button 
          onClick={() => onInject(intensity)}
          style={{ flex: 1, padding: '8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          INJECT CONGESTION
        </button>
      </div>
    </div>
  );
}

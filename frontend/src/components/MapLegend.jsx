import React, { useState, useEffect } from 'react';

export default function MapLegend() {
  const [stats, setStats] = useState({
    stairs: 0,
    ramps: 0,
    slopes: 0,
    crossings: 0,
    barriers: 0
  });

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/pedestrian_network/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  const legendItems = [
    { label: 'Pedestrian Path', icon: '—', color: '#9ca3af', type: 'line', count: null },
    { label: 'STAIRS', icon: '🪜', color: '#b45309', type: 'line', dashArray: '4,4', count: stats.stairs },
    { label: 'SIGNIFICANT SLOPE', icon: '↗', color: '#5b21b6', type: 'line', count: stats.slopes },
    { label: 'CROSSING', icon: '🚸', color: '#1d4ed8', type: 'line', dashArray: '4,4', count: stats.crossings },
    { label: 'BARRIER', icon: '🚧', color: '#b91c1c', type: 'line', count: stats.barriers },
    { label: 'RAMP', icon: '♿', color: '#047857', type: 'line', count: stats.ramps },
    { label: 'CONGESTION', icon: '🚨', color: '#dc2626', type: 'line', count: null },
    { label: 'RESTRICTED PATH', icon: '⛔', color: '#d1d5db', type: 'line', dashArray: '4,4', count: null },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: '24px',
      left: '24px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      zIndex: 10,
      pointerEvents: 'auto',
      minWidth: '220px',
      border: '1px solid #e5e7eb'
    }}>
      <h3 style={{ 
        margin: '0 0 4px 0', 
        fontSize: '14px', 
        fontWeight: '600',
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        Map Legend
      </h3>
      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '12px', lineHeight: '1.4' }}>
        Only slopes {'>'}4% are visually emphasized; smaller slopes remain active in routing calculations.
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {legendItems.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>
                {item.icon}
              </span>
              <div style={{
                width: '16px',
                height: '4px',
                backgroundColor: item.dashArray ? 'transparent' : item.color,
                borderTop: item.dashArray ? `4px dashed ${item.color}` : 'none',
                borderRadius: '2px'
              }} />
              <span style={{ 
                fontSize: '12px', 
                color: '#374151',
                fontWeight: '500'
              }}>
                {item.label}
              </span>
            </div>
            {item.count !== null && (
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>
                {item.count}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

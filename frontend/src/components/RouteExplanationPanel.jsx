import React from 'react';

export default function RouteExplanationPanel({ stats, route, routeExplanation }) {
  if (!stats || !stats.cost_breakdown) return null;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      width: '320px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333' }}>Cost Breakdown</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Total Cost:</strong> {Number(stats.cost).toFixed(2)}</p>
      </div>
      
      <div style={{ fontSize: '13px', color: '#666', borderTop: '1px solid #eee', paddingTop: '10px' }}>
        <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
          <li>Distance: {Number(stats.cost_breakdown.distance).toFixed(2)}</li>
          <li>Accessibility: {Number(stats.cost_breakdown.accessibility).toFixed(2)}</li>
          <li>Effort: {Number(stats.cost_breakdown.effort).toFixed(2)}</li>
          <li>Safety: {Number(stats.cost_breakdown.safety).toFixed(2)}</li>
          <li>Congestion: {Number(stats.cost_breakdown.congestion).toFixed(2)}</li>
          <li>Traffic Signals: {Number(stats.cost_breakdown.signal).toFixed(2)}</li>
          <li>Decay Penalties: {Number(stats.cost_breakdown.decay).toFixed(2)}</li>
        </ul>
      </div>

      {routeExplanation && routeExplanation.length > 0 && (
        <div style={{ fontSize: '13px', color: '#666', borderTop: '1px solid #eee', paddingTop: '10px', marginTop: '10px' }}>
          <strong style={{ display: 'block', marginBottom: '5px' }}>Why this route?</strong>
          <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            {routeExplanation.map((exp, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>{exp}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

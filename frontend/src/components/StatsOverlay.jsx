import React from 'react';
import { Activity, Route, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

// Average pedestrian walking speeds (m/s) by profile
const WALKING_SPEEDS = {
  General: 1.4,    // ~5.0 km/h
  Elderly: 0.9,    // ~3.2 km/h
  Pregnant: 1.0,   // ~3.6 km/h
  Wheelchair: 0.8  // ~2.9 km/h
};

export default function StatsOverlay({ stats, profile, algorithm, routeStatus }) {
  if (!stats) return null;

  const speedMs = WALKING_SPEEDS[profile] || WALKING_SPEEDS.General;
  const distanceM = Number(stats.distance);
  const travelTimeSec = distanceM / speedMs;
  const travelTimeMin = Math.ceil(travelTimeSec / 60);

  return (
    <div className="glass-panel" style={{
      width: '320px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '4px' }}>
        Route Summary
      </h3>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        backgroundColor: 'rgba(21, 128, 61, 0.1)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--success-color)',
        fontWeight: '600'
      }}>
        <CheckCircle size={24} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>{algorithm || 'Routing'} Active</span>
          {routeStatus && <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>{routeStatus.replace('_', ' ')}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--bg-color)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', marginBottom: '4px' }}>
            <Route size={14} /> Distance
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
            {distanceM.toFixed(0)} m
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: 'var(--bg-color)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', marginBottom: '4px' }}>
            <Clock size={14} /> Time
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
            {travelTimeMin} min
          </div>
        </div>
      </div>


      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
        Profile: <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{profile.replace('_', ' ')}</span>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, Search } from 'lucide-react';

const PROFILES = [
  { id: 'general', name: 'General' },
  { id: 'elderly', name: 'Elderly' },
  { id: 'pregnant', name: 'Pregnant' },
  { id: 'wheelchair', name: 'Wheelchair' },
];

import WeatherPanel from './WeatherPanel';

export default function Sidebar({ onCalculate, isLoading, error }) {
  const [profile, setProfile] = useState('general');
  const [originIdx, setOriginIdx] = useState(0);
  const [destIdx, setDestIdx] = useState(1);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/landmarks')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setLocations(data);
          setOriginIdx(0);
          setDestIdx(1 % data.length);
        }
      })
      .catch(console.error);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (locations.length > 0) {
      onCalculate(
        locations[originIdx].coords, 
        locations[destIdx].coords, 
        profile, 
        false, 
        locations[originIdx].name, 
        locations[destIdx].name
      );
    }
  };

  return (
    <div style={{
      width: '380px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      boxSizing: 'border-box',
      borderRight: '1px solid var(--border-color)',
      backgroundColor: 'var(--panel-bg)',
      zIndex: 10
    }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={24} color="var(--accent-color)" />
          Accessibility-Aware Routing
        </h1>
        <p style={{ fontSize: '0.875rem' }}>
          Intelligent pedestrian navigation adapted to accessibility needs.
        </p>
      </div>
      
      <WeatherPanel />

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>
            User Profile
          </label>
          <select value={profile} onChange={e => setProfile(e.target.value)}>
            {PROFILES.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} color="var(--success-color)" /> From
          </label>
          <select value={originIdx} onChange={e => setOriginIdx(Number(e.target.value))}>
            {locations.map((loc, idx) => (
              <option key={idx} value={idx}>{loc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} color="var(--danger-color)" /> To
          </label>
          <select value={destIdx} onChange={e => setDestIdx(Number(e.target.value))}>
            {locations.map((loc, idx) => (
              <option key={idx} value={idx}>{loc.name}</option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Calculating...' : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} /> Find Accessible Route
            </span>
          )}
        </button>
      </form>

      {error && (
        <div style={{
          marginTop: '24px',
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger-color)',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { CloudRain, Sun, Wind, Cloud, AlertCircle, Thermometer } from 'lucide-react';

export default function WeatherPanel() {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(null);

  const fetchWeather = () => {
    fetch('http://127.0.0.1:8000/api/weather')
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(data => {
        setWeather(data);
        setError(null);
      })
      .catch(err => {
        setError("Unavailable");
        console.error(err);
      });
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 60000); // 1 min poll
    return () => clearInterval(interval);
  }, []);



  if (error) {
    return (
      <div style={{
        backgroundColor: 'var(--panel-bg)',
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '24px'
      }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> Weather Data
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: UNAVAILABLE</p>
      </div>
    );
  }

  if (!weather) return null;

  const Icon = weather.precipitation > 0 ? CloudRain : (weather.temperature > 30 ? Sun : Cloud);

  return (
    <div style={{
      backgroundColor: 'var(--panel-bg)',
      padding: '16px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-md)',
      marginBottom: '24px'
    }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           Current Weather
        </span>
        <span style={{ 
          fontSize: '0.7rem', 
          padding: '2px 6px', 
          borderRadius: '12px', 
          backgroundColor: weather.freshness === 'LIVE' ? '#dcfce7' : '#fef3c7',
          color: weather.freshness === 'LIVE' ? '#166534' : '#92400e'
        }}>
          {weather.freshness}
        </span>
      </h3>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
        <Icon size={32} color={weather.precipitation > 0 ? '#3b82f6' : '#f59e0b'} />
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
            {weather.temperature !== null ? `${weather.temperature.toFixed(1)}°C` : '--'}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {weather.weather_condition}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CloudRain size={14} /> {weather.precipitation || 0}mm
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Wind size={14} /> {weather.wind_speed || 0}km/h
        </span>
      </div>


    </div>
  );
}

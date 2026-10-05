import React from 'react';
import { Clock, Route, ShieldAlert, Activity, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

const ROUTE_THEMES = {
  route_1_fastest: {
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.08)',
    border: '#93c5fd',
    label: 'Fastest Feasible'
  },
  route_2_congestion: {
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: '#fcd34d',
    label: 'Lower Congestion'
  },
  route_3_resilience: {
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.08)',
    border: '#6ee7b7',
    label: 'Max Resilience'
  }
};

export default function CandidateRoutesPanel({ candidates, selectedRouteId, onSelectRoute, profile }) {
  if (!candidates || candidates.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
          Candidate Routes ({candidates.length})
        </span>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          DARR Multi-Evaluation
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {candidates.map((route, idx) => {
          const theme = ROUTE_THEMES[route.route_id] || {
            color: '#6366f1',
            bg: 'rgba(99, 102, 241, 0.08)',
            border: '#c7d2fe',
            label: route.name || `Route ${idx + 1}`
          };
          const isSelected = route.route_id === selectedRouteId || (!selectedRouteId && route.selection_status === 'SELECTED');

          const mins = Math.ceil(route.estimated_travel_time / 60);

          return (
            <div
              key={route.route_id || idx}
              onClick={() => onSelectRoute && onSelectRoute(route)}
              style={{
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '8px',
                border: isSelected ? `2px solid ${theme.color}` : '1px solid var(--border-color)',
                backgroundColor: isSelected ? theme.bg : '#ffffff',
                boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Header: Badge & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: theme.color,
                  backgroundColor: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`
                }}>
                  {theme.label}
                </span>

                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? '#16a34a' : '#f3f4f6',
                  color: isSelected ? '#ffffff' : '#6b7280'
                }}>
                  {isSelected ? 'SELECTED' : 'ALTERNATIVE'}
                </span>
              </div>

              {/* Title & Core Metrics */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
                  {route.name}
                </div>
                <div style={{ fontSize: '0.8125rem', fontWeight: '700', color: '#374151' }}>
                  {route.total_distance.toFixed(0)} m • {mins} min
                </div>
              </div>

              {/* DARR Specific Metrics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
                fontSize: '0.6875rem',
                backgroundColor: 'rgba(255,255,255,0.7)',
                padding: '6px',
                borderRadius: '6px'
              }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.625rem' }}>MAL Impact</div>
                  <div style={{ fontWeight: '700', color: route.marginal_accessibility_loss > 0.5 ? '#dc2626' : '#16a34a' }}>
                    {route.marginal_accessibility_loss > 0 ? `-${route.marginal_accessibility_loss.toFixed(1)} ARL` : '0 (None)'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.625rem' }}>Collapse Risk</div>
                  <div style={{
                    fontWeight: '700',
                    color: route.accessibility_collapse_risk === 'CRITICAL' ? '#dc2626' :
                           route.accessibility_collapse_risk === 'WARNING' ? '#d97706' : '#16a34a'
                  }}>
                    {route.accessibility_collapse_risk}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#6b7280', fontSize: '0.625rem' }}>Critical Edges</div>
                  <div style={{ fontWeight: '700', color: route.critical_edge_count > 0 ? '#d97706' : '#4b5563' }}>
                    {route.critical_edge_count} CAD
                  </div>
                </div>
              </div>

              {/* Computed Reason Snippet */}
              {route.reason && (
                <div style={{ fontSize: '0.6875rem', color: '#4b5563', lineHeight: '1.3', borderTop: '1px dashed #e5e7eb', paddingTop: '6px' }}>
                  <span style={{ fontWeight: '600' }}>Reason: </span>
                  {route.reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

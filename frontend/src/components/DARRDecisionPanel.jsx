import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Network, Info, Award, Gauge, Shuffle } from 'lucide-react';
import CandidateRoutesPanel from './CandidateRoutesPanel';

export default function DARRDecisionPanel({
  routeData,
  selectedCandidate,
  onSelectCandidate,
  profile
}) {
  if (!routeData) return null;

  const resilience = routeData.network_resilience || {
    aoc: 2,
    arl: 1.8,
    shared_edges_count: 1,
    shared_nodes_count: 1,
    is_single_corridor: true
  };

  const collapseRisk = routeData.collapse_risk || {
    collapse_risk: 'NORMAL',
    risk_score: 0.2
  };

  const activeCandidate = selectedCandidate || routeData.selected_candidate || (routeData.candidate_routes && routeData.candidate_routes[0]);
  const explanation = routeData.decision_summary || (activeCandidate && activeCandidate.reason) || "Optimal route evaluated under dynamic conditions.";

  const riskColor = collapseRisk.collapse_risk === 'CRITICAL' ? '#dc2626' :
                    collapseRisk.collapse_risk === 'WARNING' ? '#d97706' :
                    collapseRisk.collapse_risk === 'ELEVATED' ? '#f59e0b' : '#16a34a';

  return (
    <div className="glass-panel" style={{
      width: '360px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Network size={20} color="var(--accent-color)" /> DARR Decision Engine
          </h2>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
            Accessibility-Resilience Architecture
          </span>
        </div>
        <span style={{
          fontSize: '0.6875rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          padding: '2px 8px',
          borderRadius: '12px',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          color: 'var(--accent-color)'
        }}>
          {profile}
        </span>
      </div>

      {/* Network Resilience & Risk Metrics Card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px'
      }}>
        {/* AOC & ARL */}
        <div style={{
          padding: '10px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-color)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
            <Gauge size={13} /> Network Resilience
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '800', color: '#111827' }}>
            ARL {resilience.arl.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#6b7280' }}>/ AOC {resilience.aoc}</span>
          </div>
          <div style={{ fontSize: '0.625rem', color: resilience.is_single_corridor ? '#d97706' : '#16a34a', marginTop: '2px' }}>
            {resilience.is_single_corridor ? 'Shared Bottleneck Detected' : 'Fully Independent Corridors'}
          </div>
        </div>

        {/* Collapse Risk */}
        <div style={{
          padding: '10px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-color)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
            <ShieldAlert size={13} color={riskColor} /> Collapse Risk
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '800', color: riskColor }}>
            {collapseRisk.collapse_risk}
          </div>
          <div style={{ fontSize: '0.625rem', color: '#6b7280', marginTop: '2px' }}>
            Protected Threshold: 2.0
          </div>
        </div>
      </div>

      {/* Decision Summary Box */}
      <div style={{
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        border: '1px solid rgba(37, 99, 235, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-color)' }}>
          <Award size={15} /> System Decision Rationale
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.4', color: '#374151' }}>
          {explanation}
        </p>
      </div>

      {/* Candidate Routes List */}
      <CandidateRoutesPanel
        candidates={routeData.candidate_routes}
        selectedRouteId={activeCandidate?.route_id}
        onSelectRoute={onSelectCandidate}
        profile={profile}
      />
    </div>
  );
}

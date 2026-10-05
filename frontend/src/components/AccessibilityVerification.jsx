import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Send, 
  AlertTriangle, 
  Activity, 
  HelpCircle,
  Cpu,
  Layers
} from 'lucide-react';

const PROFILES = [
  { id: 'wheelchair', label: 'Wheelchair' },
  { id: 'elderly', label: 'Elderly' },
  { id: 'pregnant', label: 'Pregnant' },
  { id: 'general', label: 'General' }
];

export default function AccessibilityVerification({ onSelectTargetEdge, onSelectAnchor }) {
  const [targetProfile, setTargetProfile] = useState('wheelchair');
  const [planData, setPlanData] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventCreated, setEventCreated] = useState(null);
  const [error, setError] = useState(null);

  // Fetch PCVC verification target when profile changes
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setEventCreated(null);

    fetch(`http://127.0.0.1:8000/api/accessibility/verification-target?profile=${targetProfile}&top_k=5`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch verification target.`);
        return res.json();
      })
      .then(data => {
        if (!isMounted) return;
        setPlanData(data);
        const top = data.selected_target || (data.ranked_candidates && data.ranked_candidates[0]);
        setSelectedCandidate(top);
        if (top && onSelectTargetEdge) {
          onSelectTargetEdge(top);
        }
        if (data.probe_selection && onSelectAnchor) {
          onSelectAnchor(data.probe_selection);
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message || 'Verification calculation failed.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetProfile]);

  const handleSelectCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    if (onSelectTargetEdge) {
      onSelectTargetEdge(candidate);
    }
  };

  const handleCreateTask = async () => {
    if (!selectedCandidate || !planData?.probe_selection) return;
    setIsCreatingEvent(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/accessibility/verification-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edge_id: selectedCandidate.edge_id,
          target_profile: targetProfile,
          probe_profile: planData.probe_selection.selected_probe || 'general',
          anchor_node: planData.probe_selection.anchor_node,
          notes: `Prioritized verification: CAD=${selectedCandidate.impact?.cad}, ΔARL=${selectedCandidate.impact?.delta_arl}`
        })
      });
      if (!res.ok) throw new Error('Failed to create verification task.');
      const eventData = await res.json();
      setEventCreated(eventData);
    } catch (err) {
      alert(`Could not log verification task: ${err.message}`);
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const target = selectedCandidate || planData?.selected_target;
  const probeSel = planData?.probe_selection;
  const priorityScore = target?.priority_score || 0.0;
  const priorityBadge = priorityScore >= 0.75 ? { text: 'HIGH', bg: '#fee2e2', color: '#dc2626' } :
                        priorityScore >= 0.45 ? { text: 'MEDIUM', bg: '#fef3c7', color: '#d97706' } :
                        { text: 'LOW', bg: '#dcfce7', color: '#16a34a' };

  return (
    <div className="glass-panel" style={{
      width: '360px',
      padding: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={18} color="var(--accent-color)" /> PCVC Controller
          </h2>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
            Profile-Coupled Counterfactual Verification
          </span>
        </div>
        <span style={{
          fontSize: '0.625rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          padding: '2px 8px',
          borderRadius: '10px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: '#059669',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          CLOSED-LOOP
        </span>
      </div>

      {/* Profile Selector */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
          Target Profile (Vulnerability Under Edge Failure):
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          {PROFILES.map(p => (
            <button
              key={p.id}
              onClick={() => setTargetProfile(p.id)}
              style={{
                padding: '6px 4px',
                fontSize: '0.6875rem',
                fontWeight: targetProfile === p.id ? '700' : '500',
                borderRadius: '6px',
                border: targetProfile === p.id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                backgroundColor: targetProfile === p.id ? 'var(--accent-color)' : 'var(--bg-color)',
                color: targetProfile === p.id ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
          <Activity size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: 'var(--accent-color)' }} />
          Computing counterfactual accessibility impact...
        </div>
      ) : error ? (
        <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.75rem' }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
          {error}
        </div>
      ) : target ? (
        <>
          {/* Target Pathway Card */}
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.625rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Recommended Target Pathway
                </span>
                <div style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {target.name}
                </div>
                <div style={{ fontSize: '0.625rem', fontFamily: 'monospace', color: '#6b7280' }}>
                  {target.edge_id}
                </div>
              </div>
              <span style={{
                fontSize: '0.625rem',
                fontWeight: '800',
                padding: '3px 8px',
                borderRadius: '12px',
                backgroundColor: priorityBadge.bg,
                color: priorityBadge.color
              }}>
                {priorityBadge.text} PRIORITY
              </span>
            </div>

            {/* Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              marginTop: '4px'
            }}>
              <div style={{ padding: '6px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.5625rem', color: '#6b7280', display: 'block' }}>Uncertainty</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#d97706' }}>
                  {Math.round(target.uncertainty * 100)}%
                </span>
              </div>
              <div style={{ padding: '6px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.5625rem', color: '#6b7280', display: 'block' }}>Δ ARL</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#dc2626' }}>
                  -{target.impact?.delta_arl?.toFixed(1) || '0.0'}
                </span>
              </div>
              <div style={{ padding: '6px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.5625rem', color: '#6b7280', display: 'block' }}>Δ AOC</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#dc2626' }}>
                  -{target.impact?.delta_aoc || '0'}
                </span>
              </div>
              <div style={{ padding: '6px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.5625rem', color: '#6b7280', display: 'block' }}>CAD</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#2563eb' }}>
                  {target.impact?.cad?.toFixed(2) || '0.0'}
                </span>
              </div>
            </div>

            {/* Why this edge? */}
            <div style={{
              padding: '8px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              borderLeft: '3px solid #dc2626',
              fontSize: '0.6875rem',
              color: 'var(--text-primary)',
              lineHeight: '1.3'
            }}>
              <strong>Why this edge?</strong> {target.reason || 'High accessibility impact under counterfactual removal.'}
            </div>
          </div>

          {/* Probe Eligibility Section */}
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layers size={13} /> Probe Eligibility (Safe-Return Rule)
              </span>
              {probeSel?.anchor_name && (
                <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>
                  Anchor: <strong>{probeSel.anchor_name}</strong>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {PROFILES.map(prof => {
                const isEligible = probeSel?.eligible_probes?.some(p => p.profile === prof.id);
                const isSelected = probeSel?.selected_probe === prof.id;
                const probeDetails = probeSel?.eligible_probes?.find(p => p.profile === prof.id) ||
                                     probeSel?.rejected_probes?.find(p => p.profile === prof.id);

                return (
                  <div
                    key={prof.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '5px',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                      border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                      fontSize: '0.6875rem'
                    }}
                  >
                    <span style={{ fontWeight: isSelected ? '700' : '500', color: 'var(--text-primary)' }}>
                      {prof.label}
                      {isSelected && (
                        <span style={{ marginLeft: '6px', fontSize: '0.5625rem', color: 'var(--accent-color)', fontWeight: '700' }}>
                          (SELECTED)
                        </span>
                      )}
                    </span>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: '700',
                      fontSize: '0.625rem',
                      color: isEligible ? '#16a34a' : '#dc2626'
                    }}>
                      {isEligible ? (
                        <>
                          <CheckCircle2 size={12} /> SAFE
                        </>
                      ) : (
                        <>
                          <XCircle size={12} /> UNSAFE
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Selected Probe Explanation */}
            {probeSel?.selected_probe ? (
              <div style={{
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(37, 99, 235, 0.06)',
                borderLeft: '3px solid var(--accent-color)',
                fontSize: '0.6875rem',
                color: 'var(--text-primary)',
                lineHeight: '1.3'
              }}>
                <strong>Selected Probe: {probeSel.selected_probe.toUpperCase()}</strong>
                <p style={{ margin: '3px 0 0 0', color: 'var(--text-secondary)' }}>
                  {probeSel.selection_reason}
                </p>
              </div>
            ) : (
              <div style={{
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: '#fee2e2',
                fontSize: '0.6875rem',
                color: '#991b1b'
              }}>
                No safe probe profile can currently traverse and return from this target.
              </div>
            )}
          </div>

          {/* Action: Create Verification Task */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={handleCreateTask}
              disabled={isCreatingEvent || !probeSel?.selected_probe}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: probeSel?.selected_probe ? 'var(--accent-color)' : '#9ca3af',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '0.75rem',
                border: 'none',
                cursor: probeSel?.selected_probe ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
            >
              <Send size={14} />
              {isCreatingEvent ? 'Logging Verification Task...' : 'CREATE VERIFICATION TASK'}
            </button>

            {eventCreated && (
              <div style={{
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: '#dcfce7',
                border: '1px solid #86efac',
                fontSize: '0.6875rem',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={14} color="#16a34a" />
                <span>
                  Task <strong>{eventCreated.event_id}</strong> logged! Status: <strong>{eventCreated.status}</strong>. Ready for IoT telemetry.
                </span>
              </div>
            )}
          </div>

          {/* Alternative Ranked Candidates List */}
          {planData.ranked_candidates && planData.ranked_candidates.length > 1 && (
            <div>
              <span style={{ fontSize: '0.6875rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Other High-Priority Verification Targets:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {planData.ranked_candidates.map((cand, idx) => {
                  const isCur = selectedCandidate?.edge_id === cand.edge_id;
                  return (
                    <div
                      key={cand.edge_id}
                      onClick={() => handleSelectCandidate(cand)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: isCur ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                        backgroundColor: isCur ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.6875rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontWeight: '700',
                          color: isCur ? 'var(--accent-color)' : '#6b7280',
                          width: '14px'
                        }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontWeight: isCur ? '700' : '500', color: 'var(--text-primary)' }}>
                          {cand.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: '700', color: '#4b5563' }}>
                        Score: {cand.priority_score.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

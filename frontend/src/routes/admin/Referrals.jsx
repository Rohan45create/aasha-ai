import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';

// ─── Status config (matching existing "Pending","Admitted","Discharged","Follow-up Due") ──
const STATUS_CONFIG = {
  'Pending':        { label: 'Pending Review', color: '#BA7517', bg: '#FAEEDA', icon: 'pending_actions' },
  'Admitted':       { label: 'Admitted',        color: '#185FA5', bg: '#E6F1FB', icon: 'local_hospital' },
  'Discharged':     { label: 'Discharged',      color: '#27500A', bg: '#EAF3DE', icon: 'home' },
  'Follow-up Due':  { label: 'Follow-up Due',   color: '#E24B4A', bg: '#FCEBEB', icon: 'calendar_today' },
  'Rejected':       { label: 'Rejected',         color: '#E24B4A', bg: '#FCEBEB', icon: 'cancel' },
};

const RISK_CONFIG = {
  CRITICAL: { color: '#E24B4A', bg: '#FCEBEB' },
  HIGH:     { color: '#BA7517', bg: '#FAEEDA' },
  MEDIUM:   { color: '#185FA5', bg: '#E6F1FB' },
  LOW:      { color: '#27500A', bg: '#EAF3DE' },
};

// ─── Admin review modal ───────────────────────────────────────────────────────
const ReviewModal = ({ referral, onClose }) => {
  const [status,  setStatus]  = useState(referral.status  || 'Pending');
  const [nrcName, setNrcName] = useState(referral.nrcName || '');
  const [notes,   setNotes]   = useState(referral.notes   || '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // Build update payload
      const payload = {
        status,
        nrcName:   nrcName || null,
        notes:     notes   || null,
        updatedAt: serverTimestamp(),
      };

      // Auto-fill date fields when status changes
      const today = new Date().toISOString().split('T')[0];
      if (status === 'Admitted'      && !referral.admittedDate)   payload.admittedDate    = today;
      if (status === 'Discharged'    && !referral.dischargedDate) payload.dischargedDate  = today;
      if (status === 'Follow-up Due' && !referral.followUpDueDate) payload.followUpDueDate = today;

      await updateDoc(doc(db, 'referrals', referral.id), payload);
      onClose();
    } catch (e) {
      console.error('[Referrals] update error:', e);
      setError('Failed to update. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const rCfg = RISK_CONFIG[referral.riskLevel] || RISK_CONFIG.LOW;
  const sCfg = STATUS_CONFIG[status] || STATUS_CONFIG['Pending'];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '24px',
          width: '100%',
          maxWidth: '500px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'fadeIn 0.2s ease-out',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <style>{`@keyframes fadeIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1A1A18' }}>Review NRC Referral</h3>
            <p style={{ fontSize: '13px', color: '#777' }}>Submitted by ASHA: <strong>{referral.ashaId}</strong></p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}><span className="material-symbols-outlined">close</span></button>
        </div>

        {/* Child info card */}
        <div style={{ background: rCfg.bg, borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontWeight: '700', fontSize: '16px', color: '#1A1A18' }}>{referral.childName}</p>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                {referral.village && <><span className="material-symbols-outlined text-[14px] align-middle">location_on</span> {referral.village} &middot; </>}Referred: {referral.referredDate || 'N/A'}
              </p>
              <p style={{ fontSize: '13px', color: rCfg.color, fontWeight: '600', marginTop: '6px' }}>
                {referral.reason}
              </p>
            </div>
            {referral.riskLevel && (
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  background: rCfg.color, color: '#fff',
                  fontSize: '11px', fontWeight: '700',
                  padding: '3px 10px', borderRadius: '20px',
                }}>{referral.riskLevel}</span>
                {referral.riskScore && (
                  <p style={{ fontSize: '20px', fontWeight: '800', color: rCfg.color, marginTop: '6px' }}>
                    {referral.riskScore}/100
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* NRC Name — admin fills this */}
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#555', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span className="material-symbols-outlined" style={{fontSize: '16px', verticalAlign: 'middle', marginRight: '4px'}}>local_hospital</span> NRC / Facility Name <span style={{ color: '#E24B4A' }}>*</span>
        </label>
        <input
          type="text"
          value={nrcName}
          onChange={e => setNrcName(e.target.value)}
          placeholder="e.g. District Hospital Beed NRC"
          style={{
            width: '100%', padding: '10px 12px',
            border: '1px solid #D3D1C7', borderRadius: '10px',
            fontSize: '14px', outline: 'none',
            fontFamily: 'inherit', marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        />

        {/* Status selector */}
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#555', marginBottom: '8px', textTransform: 'uppercase' }}>
          Update Status
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              style={{
                padding: '8px 4px',
                borderRadius: '10px',
                border: `2px solid ${status === key ? cfg.color : '#D3D1C7'}`,
                background: status === key ? cfg.bg : '#fff',
                color: status === key ? cfg.color : '#777',
                fontSize: '11px',
                fontWeight: status === key ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{cfg.icon}</span>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Notes */}
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#555', marginBottom: '6px', textTransform: 'uppercase' }}>
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Admission details, follow-up instructions, or rejection reason…"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px',
            border: '1px solid #D3D1C7', borderRadius: '10px',
            fontSize: '13px', resize: 'none', outline: 'none',
            fontFamily: 'inherit', marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        />

        {error && <p style={{ color: '#E24B4A', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px',
              background: '#fff', border: '1px solid #D3D1C7',
              borderRadius: '12px', color: '#555', cursor: 'pointer', fontSize: '14px',
            }}
          >Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              flex: 2, padding: '12px',
              background: sCfg.color,
              border: 'none', borderRadius: '12px',
              color: '#fff', fontWeight: '700',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : <><span className="material-symbols-outlined" style={{fontSize: '14px', verticalAlign: 'middle', marginRight: '4px'}}>{sCfg.icon}</span> Save — {sCfg.label}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Referrals admin page ────────────────────────────────────────────────
export default function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('All');
  const [reviewing, setReviewing] = useState(null);

  const { headId, user } = useAuthStore();

  useEffect(() => {
    const resolvedHeadId = headId || localStorage.getItem('headId');
    if (!resolvedHeadId) { setLoading(false); return; }

    // Real-time listener — query by headId first; also listen for all if headId field missing on old docs
    const q = query(
      collection(db, 'referrals'),
      where('headId', '==', resolvedHeadId)
    );

    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort newest first
      docs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || new Date(a.referredDate || 0).getTime();
        const tb = b.createdAt?.toMillis?.() || new Date(b.referredDate || 0).getTime();
        return tb - ta;
      });
      setReferrals(docs);
      setLoading(false);
    }, err => {
      console.error('[Referrals] Firestore error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [headId]);

  const FILTERS = ['All', 'Pending', 'Admitted', 'Discharged', 'Follow-up Due', 'Rejected'];
  const filtered = filter === 'All' ? referrals : referrals.filter(r => r.status === filter);
  const pendingCount = referrals.filter(r => r.status === 'Pending').length;

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A18' }}>NRC Referrals</h1>
          {pendingCount > 0 && (
            <span style={{
              background: '#E24B4A', color: '#fff',
              fontSize: '12px', fontWeight: '700',
              padding: '2px 10px', borderRadius: '20px',
            }}>{pendingCount} pending</span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: '#777', marginTop: '4px' }}>
          Review NRC admission requests from your ASHA workers
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {FILTERS.map(f => {
          const sCfg = f !== 'All' ? STATUS_CONFIG[f] : null;
          const count = f === 'All' ? referrals.length : referrals.filter(r => r.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px',
                borderRadius: '20px',
                border: `1px solid ${filter === f ? (sCfg?.color || '#1D9E75') : '#D3D1C7'}`,
                background: filter === f ? (sCfg?.bg || '#EAF3DE') : '#fff',
                color: filter === f ? (sCfg?.color || '#085041') : '#555',
                fontSize: '12px', fontWeight: filter === f ? '700' : '500',
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {sCfg ? <><span className="material-symbols-outlined" style={{fontSize: '14px', verticalAlign: 'middle', marginRight: '4px'}}>{sCfg.icon}</span> {f}</> : f} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: '#F5F4EF', borderRadius: '14px',
              height: '120px', marginBottom: '12px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: '#F5F4EF', borderRadius: '16px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '40px', marginBottom: '12px', color: '#888' }}>assignment</span>
          <p style={{ fontWeight: '600', color: '#1A1A18' }}>
            No referrals {filter !== 'All' ? `with status "${filter}"` : 'yet'}
          </p>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '6px' }}>
            Referrals submitted from the Priority List will appear here
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(r => {
            const sCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG['Pending'];
            const rCfg = RISK_CONFIG[r.riskLevel] || {};

            return (
              <div
                key={r.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E8E6DF',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{ fontWeight: '700', fontSize: '15px', color: '#1A1A18' }}>{r.childName}</h3>
                      {r.riskLevel && (
                        <span style={{
                          background: rCfg.bg, color: rCfg.color,
                          fontSize: '10px', fontWeight: '700',
                          padding: '2px 8px', borderRadius: '8px',
                        }}>{r.riskLevel}</span>
                      )}
                    </div>
                    {r.village && (
                      <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}><span className="material-symbols-outlined" style={{fontSize: '14px', verticalAlign: 'middle'}}>location_on</span> {r.village}</p>
                    )}
                    <p style={{ fontSize: '13px', color: rCfg.color || '#555', fontWeight: '600', marginBottom: '4px' }}>
                      {r.reason}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div style={{ textAlign: 'right', marginLeft: '12px', flexShrink: 0 }}>
                    <span style={{
                      background: sCfg.bg, color: sCfg.color,
                      fontSize: '11px', fontWeight: '700',
                      padding: '4px 10px', borderRadius: '20px',
                      display: 'block', marginBottom: '4px', whiteSpace: 'nowrap',
                    }}>
                      <span className="material-symbols-outlined" style={{fontSize: '14px', verticalAlign: 'middle', marginRight: '4px'}}>{sCfg.icon}</span> {r.status}
                    </span>
                    <p style={{ fontSize: '10px', color: '#aaa' }}>
                      {r.referredDate || (r.createdAt?.toDate?.()?.toLocaleDateString('en-IN', {day:'numeric',month:'short'}) || '')}
                    </p>
                  </div>
                </div>

                {/* Meta row */}
                <div style={{
                  display: 'flex', gap: '8px', flexWrap: 'wrap',
                  background: '#F5F4EF', borderRadius: '8px',
                  padding: '8px 12px', marginBottom: '12px',
                  fontSize: '12px', color: '#666',
                }}>
                  <span><span className="material-symbols-outlined" style={{fontSize: '14px', verticalAlign: 'middle'}}>medical_services</span> <strong>{r.ashaId}</strong></span>
                  {r.nrcName && <span>&middot; <span className="material-symbols-outlined" style={{fontSize: '14px', verticalAlign: 'middle'}}>local_hospital</span> <strong>{r.nrcName}</strong></span>}
                  {r.riskScore && <span>· Score: <strong style={{ color: rCfg.color }}>{r.riskScore}/100</strong></span>}
                </div>

                {/* Notes */}
                {r.notes && (
                  <div style={{
                    background: '#FAEEDA', borderRadius: '8px',
                    padding: '8px 12px', marginBottom: '12px',
                    fontSize: '12px', color: '#666',
                  }}>
                    <span className="material-symbols-outlined" style={{fontSize: '14px', verticalAlign: 'middle'}}>edit_note</span> {r.notes}
                  </div>
                )}

                {/* Review button */}
                <button
                  onClick={() => setReviewing(r)}
                  style={{
                    width: '100%', padding: '10px',
                    background: r.status === 'Pending' ? '#1D9E75' : '#F5F4EF',
                    color: r.status === 'Pending' ? '#fff' : '#555',
                    border: r.status === 'Pending' ? 'none' : '1px solid #D3D1C7',
                    borderRadius: '10px',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {r.status === 'Pending' ? <><span className="material-symbols-outlined" style={{fontSize: '16px', verticalAlign: 'middle', marginRight: '4px'}}>edit_document</span> Review & Assign NRC</> : <><span className="material-symbols-outlined" style={{fontSize: '16px', verticalAlign: 'middle', marginRight: '4px'}}>edit</span> Update Status / NRC Name</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Review modal */}
      {reviewing && (
        <ReviewModal
          referral={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

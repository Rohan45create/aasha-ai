import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebase';
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp, getDoc, doc
} from 'firebase/firestore';

// ─── Risk colour config ───────────────────────────────────────────────────────
const RISK_CONFIG = {
  CRITICAL: { color: '#E24B4A', bg: '#FCEBEB', border: '#E24B4A', dot: <span className="material-symbols-outlined" style={{color: '#E24B4A'}}>error</span>, label: 'CRITICAL' },
  HIGH:     { color: '#BA7517', bg: '#FAEEDA', border: '#BA7517', dot: <span className="material-symbols-outlined" style={{color: '#BA7517'}}>warning</span>, label: 'HIGH' },
  MEDIUM:   { color: '#185FA5', bg: '#E6F1FB', border: '#185FA5', dot: <span className="material-symbols-outlined" style={{color: '#185FA5'}}>info</span>, label: 'MEDIUM' },
  LOW:      { color: '#27500A', bg: '#EAF3DE', border: '#1D9E75', dot: <span className="material-symbols-outlined" style={{color: '#1D9E75'}}>check_circle</span>, label: 'LOW' },
};

// ─── Detail bottom-sheet for a single priority item ──────────────────────────
const DetailSheet = ({ item, ashaId, ashaName, headId, onClose }) => {
  const cfg = RISK_CONFIG[item.risk_level] || RISK_CONFIG.LOW;
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(item._referralSent || false);
  const [referralId, setReferralId] = useState(item._referralId || null);
  const [error, setError]         = useState('');

  const canRefer = ['CRITICAL', 'HIGH'].includes(item.risk_level) && !sent;

  const sendReferral = async () => {
    setSending(true);
    setError('');
    try {
      // Fetch village + householdId from the children doc
      let village = '';
      let householdId = '';
      try {
        const childDoc = await getDoc(doc(db, 'children', item.id));
        if (childDoc.exists()) {
          const cd = childDoc.data();
          village     = cd.village     || cd.villageName || '';
          householdId = cd.householdId || cd.hh_id       || '';
        }
      } catch (_) {}

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const ref = await addDoc(collection(db, 'referrals'), {
        // ── Core identifiers ────────────────────────────────
        childId:           item.id,
        childName:         item.name,
        ashaId:            ashaId,
        headId:            headId || '',        // for admin queries
        householdId:       householdId,
        village:           village,
        // ── Clinical info ───────────────────────────────────
        reason:            item.primary_driver || 'High risk — requires NRC evaluation',
        riskScore:         item.risk_score || 0,
        riskLevel:         item.risk_level,
        recommendedAction: item.recommended_action || '',
        // ── Status & dates ──────────────────────────────────
        status:            'Pending',
        referredDate:      today,             // string "YYYY-MM-DD" matching existing schema
        admittedDate:      null,
        dischargedDate:    null,
        followUpDueDate:   null,
        // ── Admin-filled fields ─────────────────────────────
        nrcName:           null,              // filled by admin on review
        generatedFormUrl:  null,
        // ── Timestamps ──────────────────────────────────────
        createdAt:         serverTimestamp(),
      });
      setSent(true);
      setReferralId(ref.id);
      item._referralSent = true;
      item._referralId   = ref.id;
    } catch (e) {
      console.error('[Referral] send error:', e);
      setError('Failed to send referral. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const scoreColor =
    item.risk_score >= 80 ? '#E24B4A' :
    item.risk_score >= 50 ? '#BA7517' :
    item.risk_score >= 30 ? '#185FA5' : '#1D9E75';

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 900,
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 36px',
          maxHeight: '88vh',
          overflowY: 'auto',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        {/* Handle + close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ width: '40px', height: '4px', background: '#D3D1C7', borderRadius: '2px', margin: '0 auto' }} />
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888', position: 'absolute', right: '20px', top: '20px' }}
            ><span className="material-symbols-outlined">close</span></button>
        </div>

        {/* Risk badge + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '28px', display: 'flex', alignItems: 'center' }}>{cfg.dot}</span>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1A1A18' }}>{item.name}</h2>
            <p style={{ fontSize: '13px', color: '#777' }}>
              {item.type === 'child' ? `${item.age_months} months old` : 'Pregnancy case'}
            </p>
          </div>
          <span style={{
            marginLeft: 'auto',
            background: cfg.color, color: '#fff',
            fontSize: '11px', fontWeight: '700',
            padding: '4px 12px', borderRadius: '20px',
          }}>{cfg.label}</span>
        </div>

        {/* Confidence / risk score bar */}
        <div style={{
          background: '#F5F4EF', borderRadius: '14px',
          padding: '16px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#555', fontWeight: '500' }}>AI Confidence Score</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: scoreColor }}>{item.risk_score}/100</span>
          </div>
          {/* Progress bar */}
          <div style={{ background: '#E0DED7', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
            <div style={{
              width: `${item.risk_score}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${scoreColor}99, ${scoreColor})`,
              borderRadius: '6px',
              transition: 'width 0.6s ease-out',
            }} />
          </div>
        </div>

        {/* Primary finding */}
        <div style={{
          background: cfg.bg,
          border: `1px solid ${cfg.border}33`,
          borderRadius: '12px',
          padding: '14px',
          marginBottom: '14px',
        }}>
          <p style={{ fontSize: '12px', color: '#777', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Finding</p>
          <p style={{ fontSize: '15px', color: cfg.color, fontWeight: '600' }}>{item.primary_driver || '—'}</p>
        </div>

        {/* Recommended action */}
        <div style={{
          background: '#F5F4EF',
          borderRadius: '12px',
          padding: '14px',
          marginBottom: '20px',
        }}>
          <p style={{ fontSize: '12px', color: '#777', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommended Action</p>
          <p style={{ fontSize: '14px', color: '#1A1A18' }}>
            {item.recommended_action
              ? `→ ${item.recommended_action}`
              : '→ Continue regular monitoring'}
          </p>
        </div>

        {/* Immediate referral required (only CRITICAL/HIGH) */}
        {['CRITICAL', 'HIGH'].includes(item.risk_level) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#FCEBEB', borderRadius: '10px', padding: '10px 14px',
            marginBottom: '20px', border: '1px solid #E24B4A33',
          }}>
            <span className="material-symbols-outlined text-[#E24B4A]">warning</span>
            <p style={{ fontSize: '13px', color: '#E24B4A', fontWeight: '600' }}>
              Immediate referral to NRC required for specialised care
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{ color: '#E24B4A', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>
        )}

        {/* Referral button */}
        {sent ? (
          <div style={{
            background: '#EAF3DE', border: '1px solid #1D9E75',
            borderRadius: '14px', padding: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <span className="material-symbols-outlined text-[#1D9E75] text-[24px]">check_circle</span>
            <div>
              <p style={{ fontWeight: '700', color: '#085041', fontSize: '15px' }}>NRC Referral Sent</p>
              <p style={{ fontSize: '12px', color: '#555' }}>Awaiting admin review</p>
            </div>
          </div>
        ) : canRefer ? (
          <button
            onClick={sendReferral}
            disabled={sending}
            style={{
              width: '100%',
              padding: '16px',
              background: sending ? '#ccc' : '#E24B4A',
              color: '#fff',
              border: 'none',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: sending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: sending ? 'none' : '0 4px 16px rgba(226,75,74,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {sending ? (
              <><span className="material-symbols-outlined animate-spin mr-1">autorenew</span> Sending Referral…</>
            ) : (
              <><span className="material-symbols-outlined mr-1">local_hospital</span> Generate NRC Referral →</>
            )}
          </button>
        ) : (
          <button
            style={{
              width: '100%', padding: '14px',
              background: '#F5F4EF', color: '#888',
              border: '1px solid #D3D1C7',
              borderRadius: '14px', fontSize: '14px', cursor: 'default',
            }}
          >
            No immediate referral needed
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: '12px',
            padding: '14px', background: 'none',
            border: '1px solid #D3D1C7', borderRadius: '14px',
            color: '#555', fontSize: '14px', cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

// ─── Main PriorityList page ───────────────────────────────────────────────────
const PriorityList = () => {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [source, setSource]         = useState('');
  const [selected, setSelected]     = useState(null); // item shown in detail sheet

  const auth = getAuth();
  const { ashaId: storeAshaId, user } = useAuthStore();
  const hasAutoTriggered = useRef(false);

  const getAshaId = () => storeAshaId || localStorage.getItem('ashaId') || auth.currentUser?.uid;
  const getHeadId = () => localStorage.getItem('headId') || '';
  const ashaName  = user?.displayName || '';

  // Load existing referrals from Firestore so cards show "Referral Sent" badge
  const loadExistingReferrals = async (ashaId, children) => {
    try {
      const snap = await getDocs(
        query(collection(db, 'referrals'), where('ashaId', '==', ashaId))
      );
      const sentIds = {};
      snap.docs.forEach(d => {
        sentIds[d.data().childId] = d.id;
      });
      return children.map(c => ({
        ...c,
        _referralSent: !!sentIds[c.id],
        _referralId:   sentIds[c.id] || null,
      }));
    } catch (e) {
      return children;
    }
  };

  // Fallback: load directly from Firestore children collection
  const loadFromFirestore = async (ashaId) => {
    try {
      const snap = await getDocs(
        query(collection(db, 'children'), where('ashaId', '==', ashaId))
      );
      if (snap.empty) return [];
      const children = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Unknown',
          risk_level: data.riskLevel || 'LOW',
          risk_score: data.riskScore || 0,
          age_months: data.ageMonths || 0,
          type: 'child',
          primary_driver: data.riskPrimaryDriver || '',
          recommended_action: data.riskRecommendedAction || '',
        };
      });
      children.sort((a, b) => b.risk_score - a.risk_score);
      return children.filter(c => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(c.risk_level));
    } catch (e) {
      console.error('[PriorityList] Firestore fallback error:', e);
      return [];
    }
  };

  const fetchPriority = async () => {
    setLoading(true);
    const ashaId = getAshaId();
    if (!ashaId) { setLoading(false); return; }

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/risk/priority/${ashaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      if (data.length > 0) {
        const withReferrals = await loadExistingReferrals(ashaId, data);
        setItems(withReferrals);
        setSource('api');
      } else {
        const fsData = await loadFromFirestore(ashaId);
        const withReferrals = await loadExistingReferrals(ashaId, fsData);
        setItems(withReferrals);
        setSource('firestore');
        if (withReferrals.length === 0 && !hasAutoTriggered.current) {
          hasAutoTriggered.current = true;
          triggerCalculation();
        }
      }
    } catch (e) {
      console.warn('[PriorityList] Backend unavailable, using Firestore:', e.message);
      const fsData = await loadFromFirestore(ashaId);
      const withReferrals = await loadExistingReferrals(ashaId, fsData);
      setItems(withReferrals);
      setSource('firestore');
    } finally {
      setLoading(false);
    }
  };

  const triggerCalculation = async () => {
    setCalculating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const ashaId = getAshaId();
      if (!ashaId) return;
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/risk/calculate-now/${ashaId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) await fetchPriority();
    } catch (e) {
      console.error('[PriorityList] Calculation failed:', e);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => { fetchPriority(); }, [storeAshaId]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '20px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: '#F5F4EF', borderRadius: '12px',
          height: '90px', marginBottom: '12px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
    </div>
  );

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1A1A18' }}>Today's Priority Visits</h2>
          {source && (
            <p style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
              {source === 'firestore' ? (
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">inventory_2</span> From Firestore (direct)</span>
              ) : (
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">smart_toy</span> From Risk Engine</span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={fetchPriority}
          disabled={calculating || loading}
          style={{
            fontSize: '12px', padding: '7px 14px',
            background: '#1D9E75', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontWeight: '600', opacity: (calculating || loading) ? 0.6 : 1,
          }}
        >
          <span className={`material-symbols-outlined text-[16px] ${calculating ? 'animate-spin' : ''}`}>sync</span> {calculating ? 'Calculating…' : 'Refresh'}
        </button>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
          <p style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><span className="material-symbols-outlined text-[48px] text-gray-400">local_hospital</span></p>
          <p style={{ fontWeight: '600' }}>No priority visits today</p>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>All children in your area are healthy!</p>
          <button
            onClick={triggerCalculation}
            disabled={calculating}
            style={{
              marginTop: '16px', padding: '10px 20px',
              background: '#1D9E75', color: 'white',
              border: 'none', borderRadius: '10px', cursor: calculating ? 'not-allowed' : 'pointer',
              fontWeight: '600', opacity: calculating ? 0.6 : 1,
            }}
          >
            {calculating ? (
               <><span className="material-symbols-outlined text-[16px] animate-spin mr-1 align-middle">autorenew</span> Calculating…</>
            ) : 'Calculate Risk Scores Now'}
          </button>
        </div>
      ) : (
        items.map(item => {
          const cfg = RISK_CONFIG[item.risk_level] || RISK_CONFIG.LOW;
          return (
            <div
              key={item.id}
              onClick={() => setSelected(item)}
              style={{
                background: cfg.bg,
                borderLeft: `4px solid ${cfg.color}`,
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '12px',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <p style={{ fontWeight: '700', fontSize: '15px', color: '#1a1a1a' }}>
                      <span className="mr-1 inline-flex items-center align-middle">{cfg.dot}</span> {item.name}
                    </p>
                    {item._referralSent && (
                      <span style={{
                        fontSize: '10px', fontWeight: '700',
                        background: '#EAF3DE', color: '#085041',
                        padding: '1px 6px', borderRadius: '8px',
                        display: 'inline-flex', alignItems: 'center', gap: '2px'
                      }}><span className="material-symbols-outlined text-[12px]">check</span> Referred</span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: '#555' }}>
                    {item.type === 'child' ? `${item.age_months} months` : 'Pregnancy'} · Score: {item.risk_score}/100
                  </p>
                  <p style={{ fontSize: '12px', color: cfg.color, marginTop: '4px', fontWeight: '600' }}>
                    {item.primary_driver}
                  </p>
                  <p style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                    → {item.recommended_action}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span style={{
                    background: cfg.color, color: 'white',
                    fontSize: '10px', padding: '3px 9px',
                    borderRadius: '10px', fontWeight: '700',
                  }}>{cfg.label}</span>
                  <span style={{ fontSize: '10px', color: '#999' }}>Tap for details →</span>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Detail bottom sheet */}
      {selected && (
        <DetailSheet
          item={selected}
          ashaId={getAshaId()}
          ashaName={ashaName}
          headId={getHeadId()}
          onClose={() => {
            setSelected(null);
            // Refresh to pick up any new referral sent flags
            fetchPriority();
          }}
        />
      )}
    </div>
  );
};

export default PriorityList;

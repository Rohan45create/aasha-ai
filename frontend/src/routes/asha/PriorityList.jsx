import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const PriorityList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [source, setSource] = useState(''); // 'api' or 'firestore'
  const auth = getAuth();
  const navigate = useNavigate();
  const { ashaId: storeAshaId } = useAuthStore();

  const hasAutoTriggered = useRef(false);

  const getAshaId = () => {
    const id = storeAshaId || localStorage.getItem('ashaId') || auth.currentUser?.uid;
    console.log('[PriorityList] Using ashaId:', id);
    return id;
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
      // Sort by riskScore descending (client-side, no composite index needed)
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
        setItems(data);
        setSource('api');
      } else {
        // API returned empty — fall back to Firestore
        const fsData = await loadFromFirestore(ashaId);
        setItems(fsData);
        setSource('firestore');
        if (fsData.length === 0 && !hasAutoTriggered.current) {
          hasAutoTriggered.current = true;
          triggerCalculation();
        }
      }
    } catch (e) {
      console.warn('[PriorityList] Backend unavailable, using Firestore:', e.message);
      const fsData = await loadFromFirestore(ashaId);
      setItems(fsData);
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
      if (res.ok) {
        await fetchPriority();
      }
    } catch (e) {
      console.error('[PriorityList] Calculation failed:', e);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => { fetchPriority(); }, [storeAshaId]);



  const RISK_CONFIG = {
    CRITICAL: { color: '#E24B4A', bg: '#FCEBEB', dot: '🔴', label: 'CRITICAL' },
    HIGH:     { color: '#BA7517', bg: '#FAEEDA', dot: '🟡', label: 'HIGH' },
    MEDIUM:   { color: '#185FA5', bg: '#E6F1FB', dot: '🔵', label: 'MEDIUM' },
    LOW:      { color: '#27500A', bg: '#EAF3DE', dot: '🟢', label: 'LOW' },
  };

  if (loading) return <div style={{padding:'20px',textAlign:'center'}}>Loading priority list...</div>;

  return (
    <div style={{padding:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div>
          <h2 style={{fontSize:'18px',fontWeight:'600'}}>Today's Priority Visits</h2>
          {source && <p style={{fontSize:'10px',color:'#888',marginTop:'2px'}}>{source === 'firestore' ? '📦 From Firestore (direct)' : '🤖 From Risk Engine'}</p>}
        </div>
        <button onClick={fetchPriority} disabled={calculating || loading} style={{fontSize:'12px',padding:'6px 12px',background:'#1D9E75',color:'white',border:'none',borderRadius:'6px',cursor:'pointer'}}>
          {calculating ? '⏳ Calculating...' : '🔄 Refresh'}
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px 20px',color:'#666'}}>
          <p>No priority data yet.</p>
          <p style={{fontSize:'12px',color:'#888',marginTop:'8px'}}>Using ashaId: {getAshaId()}</p>
          <button onClick={triggerCalculation} disabled={calculating} style={{marginTop:'12px',padding:'10px 20px',background:'#1D9E75',color:'white',border:'none',borderRadius:'8px',cursor:calculating?'not-allowed':'pointer',opacity:calculating?0.6:1}}>
            {calculating ? '⏳ Calculating...' : 'Calculate Risk Scores Now'}
          </button>
        </div>
      ) : (
        items.map(item => {
          const cfg = RISK_CONFIG[item.risk_level] || RISK_CONFIG.LOW;
          return (
            <div key={item.id} style={{background:cfg.bg,borderLeft:`4px solid ${cfg.color}`,borderRadius:'8px',padding:'12px 14px',marginBottom:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <p style={{fontWeight:'600',fontSize:'15px',color:'#1a1a1a'}}>{cfg.dot} {item.name}</p>
                  <p style={{fontSize:'12px',color:'#555',marginTop:'2px'}}>
                    {item.type === 'child' ? `${item.age_months} months` : 'Pregnancy'} · Score: {item.risk_score}/100
                  </p>
                  <p style={{fontSize:'12px',color:cfg.color,marginTop:'4px',fontWeight:'500'}}>{item.primary_driver}</p>
                  <p style={{fontSize:'11px',color:'#666',marginTop:'2px'}}>→ {item.recommended_action}</p>
                </div>
                <span style={{background:cfg.color,color:'white',fontSize:'10px',padding:'2px 8px',borderRadius:'10px',fontWeight:'600'}}>{cfg.label}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
export default PriorityList;

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useTx } from '../../context/TranslationContext';

const typeBadge = {
  OCR_IMPORT:      { bg: 'bg-[#E3F2FD]', text: 'text-[#1565C0]', label: 'OCR Import' },
  AADHAAR_OVERRIDE:{ bg: 'bg-[#FCEBEB]', text: 'text-[#791F1F]', label: 'Aadhaar Override' },
  EDIT_REVIEW:     { bg: 'bg-[#FFF8E1]', text: 'text-[#BA7517]', label: 'Edit Review' },
  CRITICAL_RISK:   { bg: 'bg-[#FCEBEB]', text: 'text-[#E24B4A]', label: 'Critical Risk Alert' },
  mental_health_ngo_referral: { bg: 'bg-[#E1F5FE]', text: 'text-[#0288D1]', label: 'NGO Referral' }
};

export default function PendingReview() {
  const [reviews, setReviews]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing]         = useState(false);
  const tx = useTx();
  
  // New States for NGO / ASHA filters and Modals
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [ashaWorkers, setAshaWorkers] = useState([]);
  const [selectedAshas, setSelectedAshas] = useState([]);
  const [assignAll, setAssignAll] = useState(false);
  const [selectedAppointmentReview, setSelectedAppointmentReview] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedRescheduleReview, setSelectedRescheduleReview] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [adminNote, setAdminNote] = useState('');
  
  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '';

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const collectionsToFetch = [
        'households', 'household_members', 'birth_records', 'children',
        'vaccinations', 'pregnancies', 'anc', 'disease_cases',
        'ncd_records', 'death_records', 'family_planning', 'elderly_care',
        'village_health', 'pending_reviews' // Added pending_reviews for NGO webhooks
      ];

      let allReviews = [];

      try {
        await Promise.all(collectionsToFetch.map(async (collName) => {
          try {
            // Attempt to get items marked for review
            const q1 = query(collection(db, collName), where('reviewStatus', '==', 'pending'));
            const snap1 = await getDocs(q1);
            
            const q2 = query(collection(db, collName), where('status', '==', 'pending_review'));
            const snap2 = await getDocs(q2);

            const processSnap = (snap, defaultType) => {
              snap.docs.forEach(d => {
                const data = d.data();
                allReviews.push({
                  id: `${collName}_${d.id}`,
                  originalId: d.id,
                  collection: collName,
                  title: data.title || `${collName.replace(/_/g, ' ').toUpperCase()} Submission`,
                  worker: data.ashaId || 'Unknown',
                  village: data.village || 'Unknown',
                  type: data.type || defaultType,
                  source: data.source || 'asha',
                  createdAt: data.createdAt || data.submittedAt || new Date(),
                  confidence: data.confidence,
                  rawData: data
                });
              });
            };

            processSnap(snap1, 'EDIT_REVIEW');
            processSnap(snap2, 'EDIT_REVIEW');
            
            // Also grab CRITICAL risk items as they require admin review implicitly
            if (['children', 'pregnancies', 'disease_cases', 'ncd_records'].includes(collName)) {
                const qRisk = query(collection(db, collName), where('riskLevel', '==', 'CRITICAL'));
                const snapRisk = await getDocs(qRisk);
                snapRisk.docs.forEach(d => {
                    const data = d.data();
                    if (!data.riskReviewed) { // don't show if already reviewed
                      allReviews.push({
                        id: `${collName}_${d.id}_risk`,
                        originalId: d.id,
                        collection: collName,
                        title: `Critical Alert: ${data.name || data.motherName || data.patientName || 'Patient'}`,
                        worker: data.ashaId || 'Unknown',
                        village: data.village || 'Unknown',
                        type: 'CRITICAL_RISK',
                        source: 'asha',
                        createdAt: data.createdAt || data.submittedAt || new Date(),
                        confidence: null,
                        rawData: data
                      });
                    }
                });
            }

          } catch (e) {
            console.warn('Error fetching', collName, e);
          }
        }));

        // Sort descending by date
        allReviews.sort((a, b) => {
           const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
           const dbDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
           return dbDate.getTime() - da.getTime();
        });

        // Ensure uniqueness just in case
        const uniqueReviews = Array.from(new Map(allReviews.map(item => [item.id, item])).values());
        setReviews(uniqueReviews);
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Load ASHA workers when modal opens
  useEffect(() => {
    if (!showAppointmentModal) return;
    const supervisorId = auth.currentUser?.uid;
    if (!supervisorId) return;
    const unsub = onSnapshot(
      query(collection(db, 'ashas'), where('supervisorId', '==', supervisorId)),
      snap => setAshaWorkers(snap.docs.map(d => ({id: d.id, ...d.data()})))
    );
    return () => unsub();
  }, [showAppointmentModal]);

  const handleApprove = async () => {
    if (!selectedReview) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, selectedReview.collection, selectedReview.originalId), {
         reviewStatus: 'approved',
         status: 'approved',
         riskReviewed: true
      });
      alert(tx('Approved and saved'));
      setReviews(prev => prev.filter(r => r.id !== selectedReview.id));
      setSelectedReview(null);
    } catch (err) {
      console.error('Error approving review:', err);
      alert(tx('Failed to approve'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReview || !rejectionReason.trim()) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, selectedReview.collection, selectedReview.originalId), {
         reviewStatus: 'rejected',
         status: 'rejected',
         rejectionReason: rejectionReason,
         riskReviewed: true
      });
      alert(tx('Rejected'));
      setReviews(prev => prev.filter(r => r.id !== selectedReview.id));
      setSelectedReview(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Error rejecting review:', err);
      alert(tx('Failed to reject'));
    } finally {
      setProcessing(false);
    }
  };

  // NGO Specific Handlers
  const handleApproveNGO = async (reviewId) => {
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/ngo/approve-registration/${reviewId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('NGO registered successfully');
      setReviews(prev => prev.filter(r => r.originalId !== reviewId));
    } catch (err) {
      alert('Failed to approve NGO registration');
    }
  };

  const handleRejectReview = async (reviewId, reason) => {
    try {
      await updateDoc(doc(db, 'pending_reviews', reviewId), {
        reviewStatus: 'rejected',
        rejectionReason: reason
      });
      alert('Review rejected');
      setReviews(prev => prev.filter(r => r.originalId !== reviewId));
    } catch (err) {
      console.error(err);
      alert('Failed to reject review');
    }
  };

  const handleBookAppointment = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/ngo/book-appointment`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ngo_id: selectedAppointmentReview.rawData.ngoId || 'unknown',
          ngo_email: selectedAppointmentReview.rawData.ngoEmail,
          ngo_name: selectedAppointmentReview.rawData.ngoName || selectedAppointmentReview.rawData.ngoEmail,
          scheduled_date: appointmentDate,
          scheduled_time: appointmentTime,
          purpose: selectedAppointmentReview.rawData.requestType || 'Visit',
          assigned_asha_ids: assignAll ? ['all'] : selectedAshas,
          head_id: auth.currentUser?.uid
        })
      });
      
      await updateDoc(doc(db, 'pending_reviews', selectedAppointmentReview.originalId), {
          reviewStatus: 'approved'
      });

      alert('Appointment booked successfully!');
      setShowAppointmentModal(false);
      setReviews(prev => prev.filter(r => r.originalId !== selectedAppointmentReview.originalId));
    } catch (err) {
      alert('Failed to book appointment');
    }
  };

  const handleConfirmReschedule = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/ngo/appointment/${selectedRescheduleReview.rawData.currentAppointmentId}/update-date`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_date: rescheduleDate,
          new_time: rescheduleTime,
          review_id: selectedRescheduleReview.originalId,
          admin_note: adminNote
        })
      });
      alert('Appointment rescheduled. ASHA workers notified.');
      setShowRescheduleModal(false);
      setReviews(prev => prev.filter(r => r.originalId !== selectedRescheduleReview.originalId));
    } catch (err) {
      alert('Failed to reschedule appointment');
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (sourceFilter === 'all') return true;
    if (sourceFilter === 'asha') return r.source !== 'ngo';
    if (sourceFilter === 'ngo') return r.source === 'ngo';
    return true;
  });

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">
        {tx('Pending Review', 'pending_review')} ({reviews.length})
      </h1>

      {/* Part A: Filter Tabs */}
      <div style={{display:'flex', gap:'8px', marginBottom:'16px'}}>
        {['all','asha','ngo'].map(f => (
          <button
            key={f}
            onClick={() => setSourceFilter(f)}
            style={{
              padding:'6px 16px', borderRadius:'20px', fontSize:'13px',
              border: sourceFilter === f ? 'none' : '1px solid #ddd',
              background: sourceFilter === f ? '#1D9E75' : 'white',
              color: sourceFilter === f ? 'white' : '#666',
              cursor:'pointer'
            }}
          >
            {f === 'all' ? `All (${reviews.length})` :
             f === 'asha' ? `ASHA Workers (${reviews.filter(r=>r.source!=='ngo').length})` :
             `NGO (${reviews.filter(r=>r.source==='ngo').length})`}
          </button>
        ))}
      </div>

      <div className="flex gap-6 relative">
        {/* Review List */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center p-12 text-gray-500">Loading reviews...</div>
          ) : filteredReviews.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-[#D3D1C7]">
              <span className="material-symbols-outlined text-5xl text-[#1D9E75] mb-4 block">task_alt</span>
              <p className="text-[#5F5E5A]">{tx('All caught up! No pending reviews.')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map(r => {
                
                // Part B: Custom Render for NGO Cards
                if (r.source === 'ngo') {
                  if (r.type === 'ngo_registration') {
                    return (
                      <div key={r.id} style={{border:'1px solid #CECBF6', borderRadius:'12px', padding:'16px', background:'white'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                          <div>
                            <span style={{background:'#EEEDFE', color:'#534AB7', fontSize:'11px',
                                          padding:'3px 8px', borderRadius:'4px', fontWeight:500, display:'inline-flex', alignItems:'center'}}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>domain</span> NEW NGO REQUEST
                            </span>
                            <h4 style={{margin:'8px 0 4px', fontSize:'15px'}}>{r.rawData.ngoName}</h4>
                            <p style={{fontSize:'13px', color:'#666', margin:'0 0 4px', display:'flex', alignItems:'center'}}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>mail</span> {r.rawData.ngoEmail} <span className="mx-2">·</span> <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>call</span> {r.rawData.contactPhone}
                            </p>
                            <p style={{fontSize:'13px', color:'#666', margin:'0 0 4px', display:'flex', alignItems:'center'}}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>location_on</span> {r.rawData.village}, {r.rawData.district}
                            </p>
                            <p style={{fontSize:'13px', color:'#666', margin:'0 0 8px', display:'flex', alignItems:'center'}}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>child_care</span> {r.rawData.childrenCount} children <span className="mx-2">·</span> {r.rawData.ngoType}
                            </p>
                            {r.rawData.message && (
                              <p style={{fontSize:'12px', color:'#888', fontStyle:'italic'}}>
                                "{r.rawData.message}"
                              </p>
                            )}
                          </div>
                          <span style={{fontSize:'11px', color:'#999'}}>{r.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}</span>
                        </div>
                        <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                          <button
                            onClick={() => handleApproveNGO(r.originalId)}
                            style={{flex:1, padding:'8px', background:'#1D9E75', color:'white',
                                    border:'none', borderRadius:'8px', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px'}}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span> Approve & Register NGO
                          </button>
                          <button
                            onClick={() => handleRejectReview(r.originalId, 'NGO registration rejected')}
                            style={{flex:1, padding:'8px', background:'white', color:'#E24B4A',
                                    border:'1px solid #E24B4A', borderRadius:'8px', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px'}}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>cancel</span> Reject
                          </button>
                        </div>
                      </div>
                    );
                  } else if (r.type === 'ngo_appointment_change') {
                    return (
                      <div key={r.id} style={{border:'1px solid #CECBF6', borderRadius:'12px', padding:'16px', background:'white'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                          <div>
                            <span style={{background:'#EAF3DE', color:'#27500A', fontSize:'11px',
                                          padding:'3px 8px', borderRadius:'4px', fontWeight:500, display:'inline-flex', alignItems:'center'}}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>event</span> APPOINTMENT CHANGE
                            </span>
                            <h4 style={{margin:'8px 0 4px', fontSize:'15px'}}>{r.rawData.ngoName || r.rawData.ngoEmail}</h4>
                            <p style={{fontSize:'13px', color:'#666', margin:'0 0 4px'}}>
                              Preferred Dates: {r.rawData.preferredDate1} {r.rawData.preferredDate2 ? ` or ${r.rawData.preferredDate2}` : ''}
                            </p>
                            {r.rawData.message && (
                              <p style={{fontSize:'12px', color:'#888', fontStyle:'italic'}}>
                                "{r.rawData.message}"
                              </p>
                            )}
                          </div>
                          <span style={{fontSize:'11px', color:'#999'}}>{r.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}</span>
                        </div>
                        <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                          <button
                            onClick={() => {
                              setSelectedRescheduleReview(r);
                              setRescheduleDate(r.rawData.preferredDate1 || '');
                              setRescheduleTime('10:00');
                              setShowRescheduleModal(true);
                            }}
                            style={{flex:1, padding:'8px', background:'#2B5B84', color:'white',
                                    border:'none', borderRadius:'8px', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px'}}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_calendar</span> Reschedule Appointment
                          </button>
                        </div>
                      </div>
                    );
                  } else if (r.type === 'ngo_appointment') {
                    return (
                      <div key={r.id} style={{border:'1px solid #CECBF6', borderRadius:'12px', padding:'16px', background:'white'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                          <div>
                            <span style={{background:'#EAF3DE', color:'#27500A', fontSize:'11px',
                                          padding:'3px 8px', borderRadius:'4px', fontWeight:500, display:'inline-flex', alignItems:'center'}}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>event</span> NEW APPOINTMENT
                            </span>
                            <h4 style={{margin:'8px 0 4px', fontSize:'15px'}}>{r.rawData.ngoName || r.rawData.ngoEmail}</h4>
                            <p style={{fontSize:'13px', color:'#666', margin:'0 0 4px'}}>
                              Preferred Dates: {r.rawData.preferredDate1} {r.rawData.preferredDate2 ? ` or ${r.rawData.preferredDate2}` : ''}
                            </p>
                            {r.rawData.message && (
                              <p style={{fontSize:'12px', color:'#888', fontStyle:'italic'}}>
                                "{r.rawData.message}"
                              </p>
                            )}
                          </div>
                          <span style={{fontSize:'11px', color:'#999'}}>{r.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}</span>
                        </div>
                        <div style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                          <button
                            onClick={() => {
                              setSelectedAppointmentReview(r);
                              setAppointmentDate(r.rawData.preferredDate1 || '');
                              setAppointmentTime('10:00');
                              setShowAppointmentModal(true);
                            }}
                            style={{flex:1, padding:'8px', background:'#1D9E75', color:'white',
                                    border:'none', borderRadius:'8px', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px'}}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_today</span> Book Appointment
                          </button>
                        </div>
                      </div>
                    );
                  }
                }

                // Default ASHA Card Render
                const badge = typeBadge[r.type] || typeBadge.EDIT_REVIEW;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReview(r)}
                    className={`bg-white rounded-2xl p-4 md:p-6 shadow-sm border cursor-pointer transition-all ${
                      selectedReview?.id === r.id
                        ? 'border-[#1D9E75] bg-[#F5FBF9]'
                        : 'border-[#D3D1C7] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${badge.bg} ${badge.text}`}>
                        {tx(badge.label)}
                      </span>
                      <span className="text-xs text-[#5F5E5A]">
                        {r.createdAt?.toDate?.()?.toLocaleString() || tx('Recently')}
                      </span>
                    </div>
                    <h3 className="font-bold text-[#1A1A18] mb-1">{tx(r.title)}</h3>
                    <p className="text-sm text-[#5F5E5A]">
                      {tx('by')} {r.worker} - {r.village}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side Panel */}
        {selectedReview && (
          <div className="hidden lg:flex w-96 bg-white rounded-2xl shadow-xl border border-[#D3D1C7] overflow-hidden sticky top-24 h-[calc(100vh-200px)] flex-col">
            <div className="p-6 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-lg font-bold">{tx('Review Details')}</h2>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="text-[#5F5E5A] hover:bg-gray-100 p-2 rounded-lg"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-[#5F5E5A] mb-1">{tx('Title')}</p>
                  <p className="font-semibold">{tx(selectedReview.title)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-[#5F5E5A] mb-1">{tx('Worker')}</p>
                  <p className="font-semibold">{selectedReview.worker}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-[#5F5E5A] mb-1">{tx('Type')}</p>
                  <p className="font-semibold capitalize">
                    {selectedReview.collection.replace(/_/g, ' ')}
                  </p>
                </div>

                {/* Submitted Data Details Map */}
                {selectedReview.rawData && (
                  <div className="mt-4 border-t border-[#D3D1C7] pt-4">
                    <h3 className="font-bold mb-3 text-sm uppercase text-[#5F5E5A] tracking-wider">{tx('Submitted Data Details')}</h3>
                    <div className="space-y-2">
                      {Object.entries(selectedReview.rawData).map(([key, val]) => {
                        if (key === 'createdAt' || key === 'updatedAt' || key === 'ashaId' || key === 'householdId') return null;
                        
                        let displayVal = val;
                        if (typeof val === 'boolean') displayVal = val ? 'Yes' : 'No';
                        if (val && typeof val === 'object' && val.seconds) {
                          displayVal = new Date(val.seconds * 1000).toLocaleDateString();
                        }

                        if (typeof displayVal === 'string' || typeof displayVal === 'number') {
                          return (
                            <div key={key} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                              <span className="text-[#5F5E5A] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="font-medium text-right break-words max-w-[60%]">{String(displayVal)}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {processing && (
                  <div className="pt-4 mt-4 border-t border-[#D3D1C7]">
                    <label className="block text-sm font-medium mb-2">
                      {tx('Reason for Rejection')} *
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full p-3 border border-[#D3D1C7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E24B4A] resize-none"
                      rows="3"
                      placeholder={tx('Explain why this submission is being rejected...')}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#D3D1C7] flex-shrink-0 bg-white">
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 bg-[#1D9E75] text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[#085041] transition-colors disabled:opacity-50 text-sm"
                  >
                    <span className="material-symbols-outlined text-lg">check</span>
                    {tx('Approve', 'approve')}
                  </button>
                  <button
                    onClick={() => setProcessing(!processing)}
                    disabled={processing}
                    className="flex-1 border border-[#E24B4A] text-[#E24B4A] py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[#FCEBEB] transition-colors disabled:opacity-50 text-sm"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                    {tx('Reject', 'reject')}
                  </button>
                </div>
                {processing && (
                  <button
                    onClick={handleReject}
                    disabled={!rejectionReason.trim()}
                    className="w-full bg-[#E24B4A] text-white py-2.5 rounded-xl font-medium hover:bg-[#D63636] transition-colors disabled:opacity-50"
                  >
                    {tx('Submit Rejection')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Part C: Appointment Modal */}
      {showAppointmentModal && selectedAppointmentReview && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'white', borderRadius:'16px', padding:'24px',
            width:'400px', display:'flex', flexDirection:'column', gap:'16px', maxHeight:'90vh', overflowY:'auto'
          }}>
            <h3 style={{fontSize:'18px', fontWeight:600, margin:0, display:'flex', alignItems:'center', gap:'8px'}}>
              <span className="material-symbols-outlined">event</span> Book Appointment
            </h3>
            
            <div>
              <label style={{display:'block', fontSize:'13px', color:'#666', marginBottom:'4px'}}>Date</label>
              <input 
                type="date" 
                value={appointmentDate} 
                onChange={e => setAppointmentDate(e.target.value)}
                style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #ddd'}}
              />
            </div>

            <div>
              <label style={{display:'block', fontSize:'13px', color:'#666', marginBottom:'4px'}}>Time</label>
              <input 
                type="time" 
                value={appointmentTime} 
                onChange={e => setAppointmentTime(e.target.value)}
                style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #ddd'}}
              />
            </div>

            <div>
              <label style={{display:'block', fontSize:'13px', color:'#666', marginBottom:'8px'}}>Assign ASHA Workers</label>
              <label style={{display:'flex', alignItems:'center', gap:'8px', padding:'8px', background:'#F5FBF9', borderRadius:'8px', marginBottom:'8px', border:'1px solid #1D9E75'}}>
                <input
                  type="checkbox"
                  checked={assignAll}
                  onChange={(e) => {
                    setAssignAll(e.target.checked);
                    if (e.target.checked) setSelectedAshas([]);
                  }}
                />
                <span style={{fontSize:'14px', fontWeight:600, color:'#1D9E75'}}>Assign All Workers</span>
              </label>

              <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #ddd', borderRadius:'8px', padding:'8px'}}>
                {ashaWorkers.length === 0 ? <p style={{fontSize:'12px', color:'#999', margin:0}}>No ASHA workers found</p> : null}
                {ashaWorkers.map(asha => (
                  <label key={asha.id} style={{display:'flex', alignItems:'center', gap:'8px', padding:'6px 0'}}>
                    <input
                      type="checkbox"
                      checked={assignAll || selectedAshas.includes(asha.id)}
                      disabled={assignAll}
                      onChange={() => {
                        if (selectedAshas.includes(asha.id))
                          setSelectedAshas(prev => prev.filter(id => id !== asha.id))
                        else
                          setSelectedAshas(prev => [...prev, asha.id])
                      }}
                    />
                    <span style={{fontSize:'14px'}}>{asha.name}</span>
                    <span style={{fontSize:'12px', color:'#888'}}>({asha.village})</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{display:'flex', gap:'8px', marginTop:'8px'}}>
              <button
                onClick={handleBookAppointment}
                style={{flex:1, padding:'10px', background:'#1D9E75', color:'white',
                        border:'none', borderRadius:'8px', fontSize:'14px', cursor:'pointer'}}
              >
                Confirm Appointment
              </button>
              <button
                onClick={() => setShowAppointmentModal(false)}
                style={{padding:'10px 16px', background:'white', color:'#666',
                        border:'1px solid #ddd', borderRadius:'8px', fontSize:'14px', cursor:'pointer'}}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Part B: Reschedule Modal */}
      {showRescheduleModal && selectedRescheduleReview && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
        }}>
          <div style={{
            background:'white', borderRadius:'16px', padding:'24px',
            width:'400px', display:'flex', flexDirection:'column', gap:'16px', maxHeight:'90vh', overflowY:'auto'
          }}>
            <h3 style={{fontSize:'18px', fontWeight:600, margin:0, display:'flex', alignItems:'center', gap:'8px'}}>
              <span className="material-symbols-outlined">edit_calendar</span> Reschedule Appointment
            </h3>
            
            <p style={{fontSize:'14px', color:'#333', margin:0}}>
              NGO requested: <strong>{selectedRescheduleReview.rawData.preferredDate1}</strong> 
              {selectedRescheduleReview.rawData.preferredDate2 ? <span> or <strong>{selectedRescheduleReview.rawData.preferredDate2}</strong></span> : null}
            </p>

            <div>
              <label style={{display:'block', fontSize:'13px', color:'#666', marginBottom:'4px'}}>Confirm new date:</label>
              <div style={{display:'flex', gap:'8px'}}>
                <button
                  onClick={() => setRescheduleDate(selectedRescheduleReview.rawData.preferredDate1)}
                  style={{flex:1, padding:'10px', border: rescheduleDate===selectedRescheduleReview.rawData.preferredDate1 ? '2px solid #1D9E75' : '1px solid #ddd', borderRadius:'8px', background:'white', cursor:'pointer'}}
                >
                  {formatDate(selectedRescheduleReview.rawData.preferredDate1)}
                </button>
                {selectedRescheduleReview.rawData.preferredDate2 && (
                  <button
                    onClick={() => setRescheduleDate(selectedRescheduleReview.rawData.preferredDate2)}
                    style={{flex:1, padding:'10px', border: rescheduleDate===selectedRescheduleReview.rawData.preferredDate2 ? '2px solid #1D9E75' : '1px solid #ddd', borderRadius:'8px', background:'white', cursor:'pointer'}}
                  >
                    {formatDate(selectedRescheduleReview.rawData.preferredDate2)}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label style={{display:'block', fontSize:'13px', color:'#666', marginBottom:'4px'}}>Or pick a different date:</label>
              <input 
                type="date" 
                value={rescheduleDate} 
                onChange={e => setRescheduleDate(e.target.value)}
                style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #ddd'}}
              />
            </div>

            <div>
              <label style={{display:'block', fontSize:'13px', color:'#666', marginBottom:'4px'}}>Time</label>
              <input 
                type="time" 
                value={rescheduleTime} 
                onChange={e => setRescheduleTime(e.target.value)}
                style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #ddd'}}
              />
            </div>

            <div>
              <label style={{display:'block', fontSize:'13px', color:'#666', marginBottom:'4px'}}>Note (optional):</label>
              <textarea 
                value={adminNote} 
                onChange={e => setAdminNote(e.target.value)} 
                placeholder="e.g. Confirmed with NGO via phone"
                style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #ddd', resize:'vertical', minHeight:'60px'}} 
              />
            </div>

            <div style={{display:'flex', gap:'8px', marginTop:'8px'}}>
              <button
                onClick={handleConfirmReschedule}
                style={{flex:1, padding:'10px', background:'#1D9E75', color:'white',
                        border:'none', borderRadius:'8px', fontSize:'14px', cursor:'pointer'}}
              >
                Confirm New Date
              </button>
              <button
                onClick={() => {
                  handleRejectReview(selectedRescheduleReview.originalId, "Reschedule request declined");
                  setShowRescheduleModal(false);
                }}
                style={{flex:1, padding:'10px', background:'white', color:'#E24B4A',
                        border:'1px solid #E24B4A', borderRadius:'8px', fontSize:'14px', cursor:'pointer'}}
              >
                Reject
              </button>
              <button
                onClick={() => setShowRescheduleModal(false)}
                style={{padding:'10px 16px', background:'white', color:'#666',
                        border:'1px solid #ddd', borderRadius:'8px', fontSize:'14px', cursor:'pointer'}}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

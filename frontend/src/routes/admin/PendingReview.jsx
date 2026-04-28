import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useTx } from '../../context/TranslationContext';

const typeBadge = {
  OCR_IMPORT:      { bg: 'bg-[#E3F2FD]', text: 'text-[#1565C0]', label: 'OCR Import' },
  AADHAAR_OVERRIDE:{ bg: 'bg-[#FCEBEB]', text: 'text-[#791F1F]', label: 'Aadhaar Override' },
  EDIT_REVIEW:     { bg: 'bg-[#FFF8E1]', text: 'text-[#BA7517]', label: 'Edit Review' },
  CRITICAL_RISK:   { bg: 'bg-[#FCEBEB]', text: 'text-[#E24B4A]', label: 'Critical Risk Alert' }
};

export default function PendingReview() {
  const [reviews, setReviews]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing]         = useState(false);
  const tx = useTx();

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const collectionsToFetch = [
        'households', 'household_members', 'birth_records', 'children',
        'vaccinations', 'pregnancies', 'anc', 'disease_cases',
        'ncd_records', 'death_records', 'family_planning', 'elderly_care',
        'village_health'
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

            const processSnap = (snap, type) => {
              snap.docs.forEach(d => {
                const data = d.data();
                allReviews.push({
                  id: `${collName}_${d.id}`,
                  originalId: d.id,
                  collection: collName,
                  title: data.title || `${collName.replace(/_/g, ' ').toUpperCase()} Submission`,
                  worker: data.ashaId || 'Unknown',
                  village: data.village || 'Unknown',
                  type: type,
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

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">
        {tx('Pending Review', 'pending_review')} ({reviews.length})
      </h1>

      <div className="flex gap-6 relative">
        {/* Review List */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center p-12 text-gray-500">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-[#D3D1C7]">
              <span className="material-symbols-outlined text-5xl text-[#1D9E75] mb-4 block">task_alt</span>
              <p className="text-[#5F5E5A]">{tx('All caught up! No pending reviews.')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(r => {
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
    </div>
  );
}

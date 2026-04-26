import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const typeBadge = {
  OCR_IMPORT: { bg: 'bg-[#E3F2FD]', text: 'text-[#1565C0]', label: 'OCR Import' },
  AADHAAR_OVERRIDE: { bg: 'bg-[#FCEBEB]', text: 'text-[#791F1F]', label: 'Aadhaar Override' },
  EDIT_REVIEW: { bg: 'bg-[#FFF8E1]', text: 'text-[#BA7517]', label: 'Edit Review' },
};

export default function PendingReview() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    // Listen to pending reviews with reviewStatus == "pending"
    const q = query(collection(db, 'pending_reviews'), where('reviewStatus', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const reviewList = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setReviews(reviewList);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleApprove = async () => {
    if (!selectedReview || !user) return;
    
    setProcessing(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/supervisor/review/${selectedReview.id}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        alert('Approved and saved');
        setReviews(prev => prev.filter(r => r.id !== selectedReview.id));
        setSelectedReview(null);
      }
    } catch (err) {
      console.error('Error approving review:', err);
      alert('Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReview || !rejectionReason.trim() || !user) return;
    
    setProcessing(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ reason: rejectionReason });
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/supervisor/review/${selectedReview.id}/reject?${params}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        alert('Rejected');
        setReviews(prev => prev.filter(r => r.id !== selectedReview.id));
        setSelectedReview(null);
        setRejectionReason('');
      }
    } catch (err) {
      console.error('Error rejecting review:', err);
      alert('Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Pending Review ({reviews.length})</h1>

      <div className="flex gap-6">
        {/* Review List */}
        <div className="flex-1">
          {reviews.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-[#D3D1C7]">
              <span className="material-symbols-outlined text-5xl text-[#1D9E75] mb-4 block">task_alt</span>
              <p className="text-[#5F5E5A]">All caught up! No pending reviews.</p>
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
                        {badge.label}
                      </span>
                      <span className="text-xs text-[#5F5E5A]">{r.createdAt?.toDate?.().toLocaleString() || 'Recently'}</span>
                    </div>
                    <h3 className="font-bold text-[#1A1A18] mb-1">{r.title}</h3>
                    <p className="text-sm text-[#5F5E5A]">by {r.worker} - {r.village}</p>
                    {r.confidence && (
                      <p className={`text-sm font-semibold mt-2 ${r.confidence >= 0.8 ? 'text-[#1D9E75]' : 'text-[#BA7517]'}`}>
                        OCR Confidence: {Math.round(r.confidence * 100)}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side Panel */}
        {selectedReview && (
          <div className="hidden lg:block w-96 bg-white rounded-2xl shadow-lg border border-[#D3D1C7] overflow-hidden fixed right-8 top-24 h-[calc(100vh-200px)]">
            <div className="p-6 h-full flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Review Details</h2>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="text-[#5F5E5A] hover:bg-gray-100 p-2 rounded-lg"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Review Data */}
              <div className="space-y-4 flex-1">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-[#5F5E5A] mb-1">Title</p>
                  <p className="font-semibold">{selectedReview.title}</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-[#5F5E5A] mb-1">Worker</p>
                  <p className="font-semibold">{selectedReview.worker}</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-[#5F5E5A] mb-1">Village</p>
                  <p className="font-semibold">{selectedReview.village}</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-[#5F5E5A] mb-1">Type</p>
                  <p className="font-semibold">{typeBadge[selectedReview.type]?.label || selectedReview.type}</p>
                </div>

                {selectedReview.confidence && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-[#5F5E5A] mb-1">OCR Confidence</p>
                    <p className={`font-semibold ${selectedReview.confidence >= 0.8 ? 'text-[#1D9E75]' : 'text-[#BA7517]'}`}>
                      {Math.round(selectedReview.confidence * 100)}%
                    </p>
                  </div>
                )}

                {/* Rejection Reason Input */}
                {processing && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Reason for Rejection *</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full p-3 border border-[#D3D1C7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E24B4A] resize-none"
                      rows="3"
                      placeholder="Explain why this submission is being rejected..."
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t border-[#D3D1C7]">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex-1 bg-[#1D9E75] text-white py-2 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[#085041] transition-colors disabled:opacity-50 text-sm"
                >
                  <span className="material-symbols-outlined text-lg">check</span> Approve
                </button>
                <button
                  onClick={() => setProcessing(!processing)}
                  disabled={processing}
                  className="flex-1 border border-[#E24B4A] text-[#E24B4A] py-2 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-[#FCEBEB] transition-colors disabled:opacity-50 text-sm"
                >
                  <span className="material-symbols-outlined text-lg">close</span> Reject
                </button>
              </div>

              {/* Rejection Form */}
              {processing && (
                <div className="mt-4 pt-4 border-t border-[#D3D1C7]">
                  <button
                    onClick={handleReject}
                    disabled={!rejectionReason.trim()}
                    className="w-full bg-[#E24B4A] text-white py-2 rounded-xl font-medium hover:bg-[#D63636] transition-colors disabled:opacity-50"
                  >
                    Submit Rejection
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

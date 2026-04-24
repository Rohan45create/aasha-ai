import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';

export default function PriorityList() {
  const { ashaId, user } = useAuthStore();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);

  const fetchPriorityList = async () => {
    if (!ashaId || !user) return;
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/risk/priority/${ashaId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch priority list");
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPriorityList();
  }, [ashaId, user]);

  const handleCalculateNow = async () => {
    if (!ashaId || !user) return;
    setIsCalculating(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/risk/calculate-now/${ashaId}`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to calculate risk");
      await fetchPriorityList();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const getBorderColor = (level) => {
    const map = {
      "CRITICAL": "border-l-red-500",
      "HIGH": "border-l-orange-500",
      "MEDIUM": "border-l-yellow-400",
      "LOW": "border-l-green-500"
    };
    return map[level] || "border-l-gray-300";
  };

  const getCardBg = (level) => {
    const map = {
      "CRITICAL": "bg-red-50",
      "HIGH": "bg-orange-50",
      "MEDIUM": "bg-yellow-50",
      "LOW": "bg-green-50"
    };
    return map[level] || "bg-white";
  };

  return (
    <div className="pb-24 p-4 min-h-screen bg-gray-50">
      <div className="flex items-center space-x-3 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
          <span className="material-symbols-outlined text-2xl">priority_high</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Priority Tasks</h2>
          <p className="text-sm text-gray-500">AI-driven visit schedule</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-800 rounded-xl mb-4">
          Failed to load: {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-8">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#1D9E75]">refresh</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center border border-gray-200 flex flex-col items-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">fact_check</span>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Priority Data Found</h3>
          <p className="text-gray-500 mb-6">Run the AI risk engine to calculate risk scores for your assigned cases.</p>
          <button 
            onClick={handleCalculateNow} 
            disabled={isCalculating}
            className="px-6 py-3 bg-[#1D9E75] text-white rounded-xl font-bold hover:bg-[#16815e] disabled:opacity-50 flex items-center gap-2"
          >
            {isCalculating ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'Run Risk Calculation Now'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
             <button onClick={handleCalculateNow} disabled={isCalculating} className="text-sm font-medium text-[#1D9E75] flex items-center gap-1 hover:underline">
               <span className={`material-symbols-outlined text-sm ${isCalculating?'animate-spin':''}`}>refresh</span>
               Recalculate
             </button>
          </div>
          {items.map((item) => (
            <div key={item.id} className={`rounded-xl shadow-sm border-2 border-transparent border-l-4 ${getBorderColor(item.risk_level)} ${getCardBg(item.risk_level)} overflow-hidden`}>
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                     <span className={`text-xs font-bold px-2 py-1 rounded border uppercase tracking-wider ${
                        item.type === 'child' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'
                     }`}>
                        {item.type}
                     </span>
                     <span className="text-xs font-bold text-gray-500">Score: {item.risk_score}/100</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{item.name || 'Unknown'}</h3>
                  {item.age_months !== undefined && <p className="text-sm text-gray-600 font-medium">Age: {item.age_months} months</p>}
                  
                  <div className="mt-3 bg-white/60 p-3 rounded-lg border border-black/5">
                    <p className="text-sm font-medium text-gray-900 mb-1"><span className="text-red-600 font-bold">Driver:</span> {item.primary_driver}</p>
                    <p className="text-sm text-gray-700"><strong>Action:</strong> {item.recommended_action}</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate(item.type === 'child' ? `/asha/child-growth` : `/asha/anc`)}
                  className="w-full sm:w-auto px-6 py-3 bg-white border border-gray-300 shadow-sm text-gray-900 font-bold rounded-xl hover:bg-gray-50 active:scale-95"
                >
                  Visit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

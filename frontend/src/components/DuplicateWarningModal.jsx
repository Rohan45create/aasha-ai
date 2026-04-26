const DuplicateWarningModal = ({ existingRecord, onUpdate, onSkip, onClose }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-amber-600 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl">warning</span> Person Already in Records
        </h3>
        
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-6 space-y-2">
          <p className="text-gray-800"><strong className="text-gray-600">Name:</strong> {existingRecord.member_name}</p>
          <p className="text-gray-800"><strong className="text-gray-600">Last survey:</strong> {formatDate(existingRecord.updatedAt || existingRecord.createdAt)}</p>
          <p className="text-gray-800"><strong className="text-gray-600">Village:</strong> {existingRecord.village || 'Unknown'}</p>
        </div>
        
        <div className="flex flex-col gap-3">
          <button 
            type="button"
            className="w-full py-3 bg-[#1D9E75] text-white rounded-xl font-medium shadow-md hover:bg-[#16815e] active:scale-95 transition-all text-center" 
            onClick={onUpdate}
          >
            Update Existing Record
          </button>
          <button 
            type="button"
            className="w-full py-3 bg-amber-100 text-amber-800 rounded-xl font-medium border border-amber-200 hover:bg-amber-200 active:scale-95 transition-all text-center" 
            onClick={onSkip}
          >
            This is a Different Person
          </button>
          <button 
            type="button"
            className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 active:scale-95 transition-all text-center" 
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateWarningModal;

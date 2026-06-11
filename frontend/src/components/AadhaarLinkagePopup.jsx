import React, { useEffect, useRef } from 'react';

export default function AadhaarLinkagePopup({ isOpen, memberName, familyHeadName, moduleType, onConfirm, onReject, onClose }) {
  const popupRef = useRef(null);

  useEffect(() => {
    if (isOpen && popupRef.current) {
      popupRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div 
        ref={popupRef}
        tabIndex="-1"
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden outline-none animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#EAF3DE] px-5 py-4 border-b border-[#1D9E75]/20 flex items-center justify-between">
          <h3 className="font-bold text-[#085041] flex items-center gap-2 text-lg">
            <span className="material-symbols-outlined">link</span>
            Family Match Found
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/50 text-[#085041] transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-[#1A1A18]">
          <p className="text-[#5F5E5A]">This person matches:</p>
          
          <div className="border border-[#D3D1C7] bg-[#F5F4EF] rounded-xl p-4 flex gap-3">
            <div className="w-10 h-10 rounded-full bg-white border border-[#D3D1C7] flex items-center justify-center text-[#5F5E5A] shrink-0">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <p className="font-bold text-lg">{memberName}</p>
              <p className="text-[#5F5E5A] text-sm">in <span className="font-semibold text-[#1A1A18]">{familyHeadName}'s</span> household</p>
            </div>
          </div>

          <p className="pt-2 font-medium">Link this {moduleType} record to this family?</p>
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-[#D3D1C7] flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className="w-full py-3.5 bg-[#1D9E75] text-white rounded-xl font-bold shadow-md hover:bg-[#16815e] active:scale-[0.98] transition-all flex justify-center items-center gap-2"
          >
            Yes, Link to Family
          </button>
          <button 
            onClick={onReject}
            className="w-full py-3.5 border-2 border-[#D3D1C7] text-[#5F5E5A] rounded-xl font-bold hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            Keep Separate
          </button>
        </div>
      </div>
    </div>
  );
}

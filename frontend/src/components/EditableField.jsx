import React, { useState } from 'react';
import { Pencil } from 'lucide-react';

/**
 * EditableField — wraps any display value to allow inline editing.
 * Shows a pencil icon. On tap, opens EditModal with reason selection.
 * Writes edit_history to Firestore on save.
 */
const EditableField = ({ label, value, fieldName, onSave, disabled = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [reason, setReason] = useState('');

  const reasons = [
    'Data entry error',
    'Updated information from family',
    'Correction from supervisor',
    'OCR misread — manual fix',
    'Other',
  ];

  const handleSave = () => {
    if (editValue !== value && reason) {
      onSave({
        field: fieldName,
        old_value: value,
        new_value: editValue,
        reason,
        edited_at: new Date().toISOString(),
      });
    }
    setIsEditing(false);
    setReason('');
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setReason('');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <label className="block text-gray-500 text-xs font-bold mb-1 uppercase">{label}</label>
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 h-[44px] focus:outline-none focus:border-[#1D9E75] text-gray-800 mb-3"
          autoFocus
        />

        <label className="block text-gray-500 text-xs font-bold mb-2 uppercase">Reason for Edit*</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                reason === r
                  ? 'bg-[#1D9E75] text-white border-[#1D9E75]'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!reason || editValue === value}
            className="flex-1 bg-[#1D9E75] text-white h-10 rounded-lg font-medium text-sm disabled:opacity-40"
          >
            Save Edit
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 bg-gray-200 text-gray-700 h-10 rounded-lg font-medium text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 group">
      <label className="block text-gray-500 text-xs font-bold mb-1 uppercase">{label}</label>
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 h-[44px]">
        <span className="text-gray-800 text-sm">{value || '—'}</span>
        {!disabled && (
          <button
            onClick={() => setIsEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
          >
            <Pencil className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
};

export default EditableField;

import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { apiFetch, showToast } from '../utils/api';
import { Calendar, Clock, Edit3, CheckCircle2, X } from 'lucide-react';

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function AppointmentSheet({ 
  isOpen, 
  targetType, 
  targetId, 
  targetName, 
  onClose, 
  onScheduled 
}) {
  const { docId } = useAuthStore();
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickDates = [
    { label: 'In 10 days', date: addDays(new Date(), 10) },
    { label: 'In 20 days', date: addDays(new Date(), 20) },
    { label: 'In 1 month', date: addDays(new Date(), 30) },
  ];

  const quickTimes = [
    { label: 'Morning 9am', time: '09:00 AM' },
    { label: 'Afternoon', time: '02:00 PM' },
    { label: 'Evening 5pm', time: '05:00 PM' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!scheduledDate) {
      showToast('Please select a date', 'error');
      return;
    }
    if (!scheduledTime) {
      showToast('Please select a time', 'error');
      return;
    }

    setIsSubmitting(true);
    const appointmentData = {
      ashaId: docId,
      targetType,
      targetId,
      targetName,
      scheduledDate,
      scheduledTime,
      purpose,
      notes: ''
    };

    try {
      const result = await apiFetch('/api/appointments/schedule', {
        method: 'POST',
        body: JSON.stringify(appointmentData)
      });
      showToast(`Visit scheduled for ${scheduledDate} ✓`, 'success');
      onScheduled(result);
      onClose();
    } catch (err) {
      // Offline fallback
      if (!navigator.onLine || err.message === 'Failed to fetch') {
        const queue = JSON.parse(localStorage.getItem('appointmentQueue') || '[]');
        queue.push({ ...appointmentData, id: 'temp_' + Date.now(), status: 'scheduled' });
        localStorage.setItem('appointmentQueue', JSON.stringify(queue));
        showToast('Offline mode: Visit scheduled and will sync later ✓', 'success');
        onScheduled({ appointmentId: 'temp_' + Date.now(), offline: true });
        onClose();
      } else {
        showToast('Failed to schedule visit: ' + err.message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const tomorrow = addDays(new Date(), 1);

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity" 
        onClick={onClose}
      />
      <div 
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 flex flex-col gap-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 transform translate-y-0"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
        
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-[#1A1A18] flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#1D9E75]" />
              Schedule Appointment
            </h2>
            <p className="text-sm text-[#5F5E5A] mt-1">For: <span className="font-semibold text-[#1A1A18]">{targetName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div>
          <label className="block text-sm font-bold text-[#1A1A18] mb-3">When:</label>
          <div className="flex flex-wrap gap-2">
            {quickDates.map(qd => (
              <button
                key={qd.label}
                onClick={() => setScheduledDate(qd.date)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                  scheduledDate === qd.date 
                    ? 'bg-[#1D9E75] text-white border-[#1D9E75]' 
                    : 'bg-white text-[#5F5E5A] border-[#D3D1C7] hover:bg-gray-50'
                }`}
              >
                {qd.label}
              </button>
            ))}
            <div className="relative">
              <input 
                type="date"
                min={tomorrow}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={`absolute inset-0 opacity-0 cursor-pointer w-full h-full`}
                onClick={(e) => {
                  try {
                    if (e.target.showPicker) e.target.showPicker();
                  } catch (err) {}
                }}
              />
              <button className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border flex items-center gap-1 ${
                (!quickDates.find(q => q.date === scheduledDate) && scheduledDate !== '') 
                  ? 'bg-[#1D9E75] text-white border-[#1D9E75]' 
                  : 'bg-white text-[#5F5E5A] border-[#D3D1C7] hover:bg-gray-50'
              }`}>
                {(!quickDates.find(q => q.date === scheduledDate) && scheduledDate !== '') ? scheduledDate : 'Pick date →'}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-[#1A1A18] mb-3 flex items-center gap-1">
            <Clock className="w-4 h-4" /> Time:
          </label>
          <div className="flex flex-wrap gap-2">
            {quickTimes.map(qt => (
              <button
                key={qt.label}
                onClick={() => setScheduledTime(qt.time)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                  scheduledTime === qt.time 
                    ? 'bg-[#1D9E75] text-white border-[#1D9E75]' 
                    : 'bg-white text-[#5F5E5A] border-[#D3D1C7] hover:bg-gray-50'
                }`}
              >
                {qt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-[#1A1A18] mb-3 flex items-center gap-1">
            <Edit3 className="w-4 h-4" /> Purpose:
          </label>
          <input 
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Monthly child growth checkup"
            className="w-full p-3 border border-[#D3D1C7] rounded-xl focus:border-[#1D9E75] outline-none"
          />
        </div>

        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-[#1D9E75] hover:bg-[#16815e] active:scale-[0.98] transition-all text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"
        >
          {isSubmitting ? 'Scheduling...' : (
            <>
              <CheckCircle2 className="w-5 h-5" /> Schedule Visit
            </>
          )}
        </button>
      </div>
    </>
  );
}

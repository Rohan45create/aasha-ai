import React, { useState } from 'react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

export default function VoiceAssistantOverlay({ moduleType, onDataReceived }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleData = (fields) => {
    setIsOpen(false);
    onDataReceived(fields);
  };
  
  const { isRecording, isProcessing, transcript, startRecording, stopRecording } = useVoiceRecorder(moduleType, handleData);

  const toggleOverlay = () => {
    if (isRecording) stopRecording();
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button 
        type="button"
        onClick={toggleOverlay}
        className="fixed bottom-24 right-6 w-[72px] h-[72px] bg-[#1D9E75] text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(29,158,117,0.3)] hover:scale-105 active:scale-95 transition-transform z-40"
      >
        <span className="material-symbols-outlined text-4xl">mic</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 backdrop-blur-sm">
           <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 pb-12 shadow-2xl animate-slide-up flex flex-col items-center">
              <div className="w-12 h-1 bg-gray-200 rounded-full mb-6 sm:hidden"></div>
              
              <h3 className="text-xl font-bold text-[#1A1A18] mb-2">AshaAI Voice Assistant</h3>
              <p className="text-sm text-[#5F5E5A] text-center mb-8">
                 {isProcessing ? 'Processing your speech with AI...' : 
                  isRecording ? 'Listening... Speak clearly in Marathi or Hindi' : 
                  'Tap the microphone to start speaking'}
              </p>

              {isProcessing ? (
                 <div className="w-24 h-24 rounded-full bg-[#EAF3DE] flex items-center justify-center animate-pulse mb-8">
                    <span className="material-symbols-outlined text-[#1D9E75] text-4xl animate-spin">refresh</span>
                 </div>
              ) : (
                 <button 
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-28 h-28 rounded-full flex items-center justify-center mb-8 shadow-lg transition-all
                       ${isRecording ? 'bg-[#FCEBEB] shadow-[#E24B4A]/30 scale-110 animate-pulse' : 'bg-[#1D9E75] shadow-[#1D9E75]/30'}
                    `}
                 >
                    <span className={`material-symbols-outlined text-5xl text-white ${isRecording ? '' : ''}`}>
                       {isRecording ? 'stop' : 'mic'}
                    </span>
                 </button>
              )}

              <button 
                 type="button"
                 onClick={toggleOverlay} 
                 disabled={isProcessing}
                 className="w-full py-3 text-[#5F5E5A] font-medium border border-[#D3D1C7] rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                 Cancel
              </button>
           </div>
        </div>
      )}
    </>
  );
}

import React from 'react';
import { Mic, Square } from 'lucide-react';

const MicrophoneButton = ({ isRecording, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all z-50 ${
        isRecording 
          ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
          : 'bg-[#1D9E75] hover:bg-[#15825f]'
      }`}
    >
      {isRecording ? <Square className="text-white w-6 h-6 fill-current" /> : <Mic className="text-white w-8 h-8" />}
    </button>
  );
};

export default MicrophoneButton;

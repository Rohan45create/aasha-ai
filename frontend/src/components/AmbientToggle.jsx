import React from 'react';
import { Mic, MicOff, Wifi, WifiOff, X, Check } from 'lucide-react';
import useAmbientAI from '../hooks/useAmbientAI';

/**
 * AmbientToggle — floating component for ambient AI.
 * 
 * When ON, shows a green listening indicator ring.
 * Suggestion chips appear as overlay cards that can be accepted/dismissed.
 */
const AmbientToggle = ({ module = 'family_survey', onAcceptSuggestion }) => {
  const {
    isListening,
    suggestions,
    connectionStatus,
    startListening,
    stopListening,
    acceptSuggestion,
    dismissSuggestion,
  } = useAmbientAI(module);

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleAccept = (index) => {
    const suggestion = suggestions[index];
    if (onAcceptSuggestion) {
      onAcceptSuggestion(suggestion);
    }
    acceptSuggestion(index);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Suggestion Chips */}
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2 max-w-[280px] animate-in slide-in-from-right">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.field}-${index}`}
              className="bg-white rounded-xl shadow-lg border border-[#1D9E75]/20 p-3 flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">{suggestion.field}</p>
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {suggestion.chip_label || String(suggestion.value)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleAccept(index)}
                  className="w-7 h-7 rounded-full bg-[#1D9E75] text-white flex items-center justify-center hover:bg-[#15825f] transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => dismissSuggestion(index)}
                  className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
          isListening
            ? 'bg-[#1D9E75] ring-4 ring-[#1D9E75]/30 animate-pulse'
            : 'bg-gray-600 hover:bg-gray-500'
        }`}
      >
        {isListening ? (
          <Mic className="w-6 h-6 text-white" />
        ) : (
          <MicOff className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Connection Status Indicator */}
      {isListening && (
        <div className={`flex items-center gap-1 text-[10px] font-medium ${
          connectionStatus === 'connected' ? 'text-[#1D9E75]' :
          connectionStatus === 'connecting' ? 'text-amber-500' :
          'text-red-500'
        }`}>
          {connectionStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connectionStatus === 'connected' ? 'Listening' : connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
        </div>
      )}
    </div>
  );
};

export default AmbientToggle;

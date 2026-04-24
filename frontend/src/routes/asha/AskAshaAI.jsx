import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';


// Fallback for language store if it isn't created yet
let useLanguageStore;
try {
  useLanguageStore = require('../../stores/languageStore').useLanguageStore;
} catch (e) {
  useLanguageStore = () => ({ currentLanguage: 'en' });
}

export default function AskAshaAI() {
  const { user } = useAuthStore();
  const { currentLanguage } = useLanguageStore();
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'How can I assist you with health protocols today?', timestamp: Date.now() }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages, isTyping]);

  const sendToChatAPI = async (text) => {
    setIsTyping(true);
    setErrorState(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat?language=${currentLanguage}`, {
         method: 'POST',
         headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}` 
         },
         body: JSON.stringify({ 
            message: text,
            conversation_history: messages 
         })
      });
      if (!res.ok) throw new Error("API failed");
      
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.response, timestamp: Date.now() }]);
    } catch (err) {
      console.error(err);
      setErrorState(text);
      setMessages(prev => [...prev, { role: 'ai', content: 'Could not reach AshaAI. Check your connection.', isError: true, timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setInputText('');
    sendToChatAPI(text);
  };

  const handleRetry = () => {
    if (errorState) {
       // remove the last error message
       setMessages(prev => prev.filter(m => !m.isError));
       sendToChatAPI(errorState);
    }
  };

  const onVoiceTranscription = (fields, transcript) => {
    if (transcript) {
       setMessages(prev => [...prev, { role: 'user', content: `🎤 ${transcript}`, timestamp: Date.now() }]);
       sendToChatAPI(transcript);
    }
  };

  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceRecorder('chat', onVoiceTranscription);

  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-gray-50 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
      
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm flex items-center justify-between z-10">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#EAF3DE] rounded-full flex items-center justify-center text-[#1D9E75]">
               <span className="material-symbols-outlined">forum</span>
            </div>
            <div>
               <h2 className="font-bold text-gray-900 leading-tight">Ask AshaAI</h2>
               <p className="text-xs text-[#1D9E75] font-medium flex items-center gap-1">
                 <span className="w-2 h-2 rounded-full bg-[#1D9E75]"></span> Online
               </p>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-8">
        {messages.map((m, i) => (
           <div key={i} className={`flex flex-col ${m.role === 'ai' ? 'items-start' : 'items-end'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${m.role === 'ai' ? (m.isError ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm') : 'bg-[#1D9E75] text-white rounded-tr-sm'}`}>
                 {m.content}
                 {m.isError && (
                    <button onClick={handleRetry} className="mt-2 text-sm font-bold block hover:underline text-red-600">
                      ↻ Retry
                    </button>
                 )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1">{formatTime(m.timestamp)}</span>
           </div>
        ))}
        {isTyping && (
           <div className="flex items-start">
             <div className="bg-white border border-gray-200 rounded-2xl p-4 rounded-tl-sm shadow-sm flex gap-1">
               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="bg-white border-t border-gray-200 p-3 pt-4 px-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-10">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-2 rounded-2xl focus-within:bg-white focus-within:border-[#1D9E75] focus-within:ring-2 focus-within:ring-[#EAF3DE] transition-all">
          <button 
             onClick={isRecording ? stopRecording : startRecording}
             disabled={isProcessing}
             className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-sm ${
               isRecording ? 'bg-red-500 text-white animate-pulse' : 
               isProcessing ? 'bg-gray-200 text-gray-500' : 'bg-white text-[#1D9E75] hover:bg-[#EAF3DE]'
             }`}
          >
             {isProcessing ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : 
              <span className="material-symbols-outlined text-[20px]">{isRecording ? 'stop_circle' : 'mic'}</span>}
          </button>
          
          <input 
             type="text" 
             value={inputText}
             onChange={(e) => setInputText(e.target.value)}
             onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
             placeholder={isRecording ? "Listening..." : "Ask a health question..."}
             disabled={isRecording || isProcessing}
             className="flex-1 outline-none text-[15px] bg-transparent px-2 disabled:opacity-50"
          />
          
          <button 
             onClick={handleSendText} 
             disabled={!inputText.trim() || isRecording || isProcessing} 
             className="w-10 h-10 bg-[#1D9E75] text-white rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:bg-gray-300 transition-colors shadow-sm"
          >
             <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">AshaAI provides guidance based on official protocols. Always refer emergencies to PHC.</p>
      </div>
    </div>
  );
}

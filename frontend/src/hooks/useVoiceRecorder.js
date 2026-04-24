import { useState, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useVoiceRecorder = (moduleType, onFieldsFilled) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const { auth } = useAuthStore();

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        chunksRef.current = [];
        
        recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        recorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop()); // release mic
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            chunksRef.current = []; // clear buffer
            await sendToSTT(blob);
        };
        
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
    } catch(err) {
        console.error("Microphone access denied", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const sendToSTT = async (audioBlob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('module_type', moduleType);
      
      const { user } = useAuthStore.getState();
      const token = await user.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/voice/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      setTranscript(data.transcript);
      if (data.fields) {
         onFieldsFilled(data.fields); // This fills the form
      }
    } catch (err) {
      console.error('STT error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return { isRecording, isProcessing, transcript, startRecording, stopRecording };
};

export default useVoiceRecorder;

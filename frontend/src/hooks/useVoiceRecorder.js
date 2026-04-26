import { useState, useRef, useCallback } from 'react';
import { auth } from '../firebase';

/**
 * Voice recorder hook with complete state machine.
 * States: idle | recording | processing | done | error
 *
 * @param {string}   moduleType    - Form type key (e.g. 'anc', 'family_survey')
 * @param {Function} onFieldsFilled - Callback receiving {fieldId: value} map
 * @param {Array}    formFields    - Array of {id, label, type} from the form definition
 *                                   Used to build a precise Gemini prompt on the backend.
 */
export const useVoiceRecorder = (moduleType = 'family_survey', onFieldsFilled, formFields = []) => {
  const [state, setState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [detectedCount, setDetectedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    setErrorMsg('');
    setState('idle');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 48000, channelCount: 1, echoCancellation: true }
      });
      streamRef.current = stream;

      // Pick the best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Stop all tracks to release mic
        streamRef.current?.getTracks().forEach(t => t.stop());
        sendAudio(mimeType);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // collect chunks every 250ms for reliability
      setState('recording');
    } catch (err) {
      console.error('Microphone error:', err);
      setErrorMsg('Microphone not accessible. Please allow microphone permission and try again.');
      setState('error');
    }
  }, [moduleType]); // eslint-disable-line react-hooks/exhaustive-deps


  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('processing');
    }
  }, []);

  // NOTE: This is NOT a hook call — it's a plain async function called from onstop
  const sendAudio = async (mimeType) => {
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = []; // clear immediately

      if (blob.size < 500) {
        setErrorMsg('Recording too short. Hold the mic button and speak clearly for at least 2 seconds.');
        setState('error');
        return;
      }

      // Get token using the singleton auth instance (not a hook)
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setErrorMsg('Not authenticated. Please log in again.');
        setState('error');
        return;
      }

      const token = await currentUser.getIdToken();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('module_type', moduleType);

      // Send field definitions so Gemini can extract EXACTLY the right field IDs
      if (formFields && formFields.length > 0) {
        // Only send id, label, type — strip options arrays to keep payload small
        const slim = formFields.map(f => ({ id: f.id, label: f.label, type: f.type || 'text' }));
        formData.append('form_fields', JSON.stringify(slim));
      }

      const res = await fetch(`${backendUrl}/api/voice/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      setTranscript(data.transcript || '');
      setDetectedCount(data.fields_detected || Object.keys(data.fields || {}).length || 0);

      if (data.fields && Object.keys(data.fields).length > 0) {
        if (typeof onFieldsFilled === 'function') {
          onFieldsFilled(data.fields);
        }
        setState('done');
      } else {
        setErrorMsg(data.error || 'No data detected. Try speaking more clearly in Marathi or Hindi.');
        setState('error');
      }
    } catch (err) {
      console.error('Voice processing error:', err);
      setErrorMsg(err.message || 'Voice processing failed. Check your connection.');
      setState('error');
    }
  };


  const reset = useCallback(() => {
    setState('idle');
    setTranscript('');
    setErrorMsg('');
    setDetectedCount(0);
  }, []);

  return {
    state,
    transcript,
    detectedCount,
    errorMsg,
    startRecording,
    stopRecording,
    reset,
    // Legacy compat
    isRecording: state === 'recording',
    isProcessing: state === 'processing',
  };
};

export default useVoiceRecorder;

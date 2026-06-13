import { useState, useRef, useCallback, useEffect } from 'react';
import { auth } from '../firebase';

/**
 * useAmbientAI Hook
 * 
 * Manages the Ambient AI listener lifecycle:
 * 1. Opens a WebSocket to /ws/ambient with Firebase auth
 * 2. Uses browser SpeechRecognition to capture conversation
 * 3. Sends text + current form state to server
 * 4. Receives suggestion chips from Gemini
 * 
 * Audio is processed client-side only — never transmitted or stored.
 */
const useAmbientAI = (module = 'family_survey') => {
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected | connecting | connected | error

  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const formStateRef = useRef({});

  // Update form state without triggering re-renders
  const updateFormState = useCallback((newState) => {
    formStateRef.current = newState;
  }, []);

  // Accept a suggestion (remove it from list)
  const acceptSuggestion = useCallback((index) => {
    setSuggestions(prev => {
      const accepted = prev[index];
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Dismiss a suggestion
  const dismissSuggestion = useCallback((index) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Connect WebSocket
  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setConnectionStatus('error');
        return;
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const backendHost = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL)?.replace(/^https?:\/\//, '') || 'localhost:8000';
      const wsUrl = `${wsProtocol}//${backendHost}/ws/ambient?token=${token}&module=${module}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'suggestions' && data.suggestions?.length > 0) {
            setSuggestions(prev => [...prev, ...data.suggestions]);
          }
        } catch (e) {
          console.error('Failed to parse ambient response:', e);
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket connection failed:', err);
      setConnectionStatus('error');
    }
  }, [module]);

  // Start/stop browser speech recognition
  const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'mr-IN'; // Marathi default

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const text = lastResult[0].transcript.trim();
        if (text && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            text,
            form_state: formStateRef.current,
          }));
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still listening
      if (isListening && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already started
        }
      }
    };

    return recognition;
  }, [isListening]);

  // Start ambient listening
  const startListening = useCallback(async () => {
    // Connect WebSocket first
    await connectWebSocket();

    // Setup speech recognition
    const recognition = setupSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
      setSuggestions([]);
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  }, [connectWebSocket, setupSpeechRecognition]);

  // Stop ambient listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsListening(false);
    setConnectionStatus('disconnected');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isListening,
    suggestions,
    connectionStatus,
    startListening,
    stopListening,
    acceptSuggestion,
    dismissSuggestion,
    updateFormState,
  };
};

export default useAmbientAI;

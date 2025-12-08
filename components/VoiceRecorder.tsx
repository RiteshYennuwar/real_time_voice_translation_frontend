import React, { useState, useRef, useEffect } from 'react';

interface TranslationResult {
  original_text: string;
  translated_text: string;
  audio_base64: string;
  sample_rate: number;
  latency_ms: number;
  confidence: number;
  timestamp: number;
  is_final?: boolean;
}

interface VoiceRecorderProps {
  sourceLang: string;
  targetLang: string;
  onTranslation: (result: TranslationResult) => void;
  onError?: (error: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  sourceLang,
  targetLang,
  onTranslation,
  onError
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check API health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${API_URL}/health`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Backend health check OK:', data);
          setIsConnected(true);
        } else {
          console.error('Health check failed with status:', response.status);
          setIsConnected(false);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error('Health check failed:', error.name, error.message);
        } else {
          console.error('Health check failed:', error);
        }
        setIsConnected(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);

    return () => clearInterval(interval);
  }, []);

  // Audio level visualization
  const updateAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  // Send audio to backend for translation
  const sendAudioToBackend = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('source_lang', sourceLang);
      formData.append('target_lang', targetLang);

      const response = await fetch(`${API_URL}/api/translate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Translation failed');
      }

      const data = await response.json();

      if (data.success) {
        const result: TranslationResult = {
          original_text: data.original_text,
          translated_text: data.translated_text,
          audio_base64: data.audio_base64,
          sample_rate: data.sample_rate,
          latency_ms: data.metrics.latency_ms,
          confidence: data.metrics.confidence,
          timestamp: Date.now(),
          is_final: true
        };
        onTranslation(result);
      } else {
        throw new Error(data.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Error sending audio:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : 'Failed to translate audio');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      // Reset audio chunks
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Setup audio context for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start audio level monitoring
      updateAudioLevel();

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          await sendAudioToBackend(audioBlob);
        }
        audioChunksRef.current = [];
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error('Error starting recording:', error);
      if (onError) onError('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Stop audio level monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setIsRecording(false);
    setAudioLevel(0);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Connection Status */}
      <div className={`px-3 py-1 rounded-full text-sm ${
        isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}>
        {isConnected ? '● Connected' : '○ Disconnected'}
      </div>

      {/* Audio Level Visualizer */}
      {isRecording && (
        <div className="w-full max-w-md">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Record Button */}
      <button
        onClick={toggleRecording}
        disabled={!isConnected || isProcessing}
        className={`
          relative w-20 h-20 rounded-full transition-all duration-300
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'bg-blue-500 hover:bg-blue-600'
          }
          ${!isConnected || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          disabled:opacity-50 disabled:cursor-not-allowed
          shadow-lg hover:shadow-xl
          flex items-center justify-center
        `}
      >
        {isProcessing ? (
          <svg className="animate-spin h-10 w-10 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : isRecording ? (
          <div className="w-6 h-6 bg-white rounded-sm" />
        ) : (
          <svg
            className="w-10 h-10 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Status Text */}
      <p className="text-sm text-gray-600">
        {isProcessing 
          ? 'Processing translation...' 
          : isRecording 
            ? 'Recording... Click to stop' 
            : 'Click to start recording'
        }
      </p>

      {/* Language Info */}
      <div className="text-xs text-gray-500">
        {sourceLang.toUpperCase()} → {targetLang.toUpperCase()}
      </div>
    </div>
  );
};

export default VoiceRecorder;
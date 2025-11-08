import React, { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

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

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  sourceLang,
  targetLang,
  onTranslation,
  onError
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socket.on('connected', (data) => {
      console.log('Server confirmed connection:', data);
    });

    socket.on('recording_started', (data) => {
      console.log('Recording started:', data);
    });

    socket.on('translation_result', (result: TranslationResult) => {
      console.log('Translation received:', result);
      onTranslation(result);
    });

    socket.on('recording_stopped', (data) => {
      console.log('Recording stopped:', data);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      if (onError) onError(error.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [onTranslation, onError]);

  // Audio level visualization
  const updateAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Setup audio context for visualization
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Start audio level monitoring
      updateAudioLevel();

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle audio data
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socketRef.current) {
          // Convert blob to array buffer
          const arrayBuffer = await event.data.arrayBuffer();
          
          // Decode audio data
          const audioContext = new AudioContext({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Get audio samples as Float32Array
          const audioData = audioBuffer.getChannelData(0);
          
          // Convert to base64
          const base64Audio = btoa(
            String.fromCharCode(...new Uint8Array(audioData.buffer))
          );

          // Send to server
          socketRef.current.emit('audio_chunk', {
            audio_data: base64Audio,
            sample_rate: 16000
          });
        }
      };

      // Start recording with chunks every 1 second
      mediaRecorder.start(1000);
      setIsRecording(true);

      // Notify server
      if (socketRef.current) {
        socketRef.current.emit('start_recording', {
          source_lang: sourceLang,
          target_lang: targetLang
        });
      }

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

    // Notify server
    if (socketRef.current) {
      socketRef.current.emit('stop_recording');
    }
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
        disabled={!isConnected}
        className={`
          relative w-20 h-20 rounded-full transition-all duration-300
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'bg-blue-500 hover:bg-blue-600'
          }
          ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          disabled:opacity-50 disabled:cursor-not-allowed
          shadow-lg hover:shadow-xl
          flex items-center justify-center
        `}
      >
        {isRecording ? (
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
        {isRecording 
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
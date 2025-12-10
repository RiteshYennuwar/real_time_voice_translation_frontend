import React, { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface TranslationResult {
  original_text: string;
  translated_text: string;
  audio_base64: string;
  sample_rate: number;
  latency_ms: number;
  confidence: number;
  timestamp: string;
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
  const [mode, setMode] = useState<'realtime' | 'batch'>('realtime');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket.io connection for real-time mode
  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('✓ Socket.io connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('✗ Socket.io disconnected');
      setIsConnected(false);
    });

    socket.on('connected', (data) => {
      console.log('Server ready:', data.message);
    });

    socket.on('translation_started', (data) => {
      console.log(`Translation session: ${data.source_lang} → ${data.target_lang}`);
    });

    socket.on('translation_result', (result: TranslationResult) => {
      console.log('📝 Translation:', result.original_text, '→', result.translated_text);
      onTranslation(result);
      if (result.is_final) {
        setIsProcessing(false);
      }
    });

    socket.on('error', (error: { error: string }) => {
      console.error('Socket error:', error.error);
      if (onError) onError(error.error);
      setIsProcessing(false);
    });

    socket.on('translation_stopped', () => {
      console.log('Translation session ended');
      setIsProcessing(false);
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

  // Batch mode: Send complete audio to backend
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
          timestamp: new Date().toISOString(),
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
      // Reset
      audioChunksRef.current = [];

      // Check microphone availability
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Microphone access not available. Please use localhost (not 127.0.0.1) or HTTPS.'
        );
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      streamRef.current = stream;

      // Setup audio visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      updateAudioLevel();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      if (mode === 'realtime' && socketRef.current?.connected) {
        // Real-time streaming mode
        console.log('🎙️ Starting real-time translation...');
        
        socketRef.current.emit('start_translation', {
          source_lang: sourceLang,
          target_lang: targetLang
        });

        setIsProcessing(true);

        // Use AudioWorklet approach for real-time streaming
        const audioContext = audioContextRef.current!;
        const sampleRate = audioContext.sampleRate;
        
        // Create a script processor to capture raw audio data
        const bufferSize = 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        const source = audioContext.createMediaStreamSource(stream);
        
        let audioBuffer: Float32Array[] = [];
        const CHUNK_DURATION = 2.0; // seconds
        const samplesPerChunk = Math.floor(CHUNK_DURATION * sampleRate);
        
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          audioBuffer.push(new Float32Array(inputData));
          
          // Calculate total samples collected
          const totalSamples = audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
          
          if (totalSamples >= samplesPerChunk) {
            console.log(`📤 Sending audio chunk: ${totalSamples} samples (${(totalSamples/sampleRate).toFixed(2)}s)`);
            
            // Combine all buffers
            const combined = new Float32Array(totalSamples);
            let offset = 0;
            for (const buf of audioBuffer) {
              combined.set(buf, offset);
              offset += buf.length;
            }
            
            // Send to backend
            if (socketRef.current?.connected) {
              // Convert Float32Array to Int16Array
              const int16Array = new Int16Array(combined.length);
              for (let i = 0; i < combined.length; i++) {
                const s = Math.max(-1, Math.min(1, combined[i]));
                int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              
              // Convert to base64 in chunks to avoid stack overflow
              const bytes = new Uint8Array(int16Array.buffer);
              let binary = '';
              const chunkSize = 8192;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
                binary += String.fromCharCode.apply(null, Array.from(chunk));
              }
              const base64 = btoa(binary);
              
              console.log(`📡 Emitting audio chunk, size: ${base64.length} chars`);
              socketRef.current.emit('audio_chunk', {
                audio: base64,
                sample_rate: sampleRate,
                format: 'raw_pcm'
              });
            } else {
              console.warn('Socket not connected, skipping chunk');
            }
            
            // Clear buffer
            audioBuffer = [];
          }
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        // Store processor for cleanup
        const streamWithProcessor = stream as MediaStream & { audioProcessor?: ScriptProcessorNode };
        streamWithProcessor.audioProcessor = processor;
        
        // Still use MediaRecorder for fallback
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);

      } else {
        // Batch mode: record complete audio
        console.log('🎙️ Starting batch recording...');

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          if (audioBlob.size > 0) {
            await sendAudioToBackend(audioBlob);
          }
          audioChunksRef.current = [];
        };

        mediaRecorder.start();
        setIsRecording(true);
      }

    } catch (error) {
      console.error('Error starting recording:', error);
      
      let errorMessage = 'Failed to access microphone';
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            errorMessage = 'Microphone permission denied. Please allow microphone access.';
            break;
          case 'NotFoundError':
            errorMessage = 'No microphone found. Please connect a microphone.';
            break;
          case 'NotReadableError':
            errorMessage = 'Microphone is in use by another application.';
            break;
          case 'OverconstrainedError':
            errorMessage = 'Could not satisfy audio constraints.';
            break;
          case 'SecurityError':
            errorMessage = 'Microphone access blocked. Use HTTPS or localhost.';
            break;
          default:
            errorMessage = `Microphone error: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (onError) onError(errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop real-time translation session
    if (mode === 'realtime' && socketRef.current?.connected) {
      socketRef.current.emit('stop_translation');
    }

    if (streamRef.current) {
      // Clean up audio processor if it exists
      const streamWithProcessor = streamRef.current as MediaStream & { audioProcessor?: ScriptProcessorNode };
      if (streamWithProcessor.audioProcessor) {
        streamWithProcessor.audioProcessor.disconnect();
      }
      
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setIsRecording(false);
    setAudioLevel(0);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Mode Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Mode:</label>
          <button
            onClick={() => setMode('realtime')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              mode === 'realtime'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Real-time
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              mode === 'batch'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Batch
          </button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="flex flex-col items-center gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!isConnected || isProcessing}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isConnected && !isProcessing
                ? 'bg-red-500 hover:bg-red-600 active:scale-95'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
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
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-20 h-20 rounded-full bg-gray-700 hover:bg-gray-800 active:scale-95 flex items-center justify-center transition-all"
          >
            <div className="w-8 h-8 bg-white rounded-sm" />
          </button>
        )}

        {/* Status Text */}
        <div className="text-center">
          {isRecording && (
            <p className="text-red-500 font-medium animate-pulse">
              {mode === 'realtime' ? '🔴 Recording (Real-time)' : '🔴 Recording'}
            </p>
          )}
          {isProcessing && !isRecording && (
            <p className="text-blue-500 font-medium">
              ⏳ Processing translation...
            </p>
          )}
          {!isRecording && !isProcessing && (
            <p className="text-gray-500">
              {isConnected ? 'Click to start recording' : 'Connecting...'}
            </p>
          )}
        </div>

        {/* Audio Level Visualization */}
        {isRecording && (
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        )}

        {/* Mode Description */}
        <div className="text-xs text-gray-500 text-center mt-2">
          {mode === 'realtime' ? (
            <p>
              ⚡ Real-time: Translation streams as you speak<br />
              (Lower latency, continuous feedback)
            </p>
          ) : (
            <p>
              📦 Batch: Translation after you finish speaking<br />
              (Higher accuracy, complete processing)
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

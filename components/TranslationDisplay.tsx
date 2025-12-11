import { useState, useEffect, useRef } from 'react';
import { TranslationResult } from '../types/translation';

interface TranslationDisplayProps {
  results: TranslationResult[];
  sourceLang: string;
  targetLang: string;
}

const languageNames: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish',
  'hi': 'Hindi'
};

export const TranslationDisplay: React.FC<TranslationDisplayProps> = ({
  results,
  sourceLang,
  targetLang
}) => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioQueueRef = useRef<Array<{ audioBase64: string; index: number }>>([]);
  const isPlayingQueueRef = useRef(false);

  // Auto-scroll to latest result
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [results]);

  // Auto-play new results in sequence
  useEffect(() => {
    if (results.length > 0) {
      const latestResult = results[results.length - 1];
      const latestIndex = results.length - 1;
      
      // Add to queue
      audioQueueRef.current.push({
        audioBase64: latestResult.audio_base64,
        index: latestIndex
      });
      
      // Start playing queue if not already playing
      if (!isPlayingQueueRef.current) {
        playNextInQueue();
      }
    }
  }, [results.length]);

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      setPlayingIndex(null);
      return;
    }

    isPlayingQueueRef.current = true;
    const { audioBase64, index } = audioQueueRef.current.shift()!;
    
    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Create audio from base64
      const audioData = `data:audio/wav;base64,${audioBase64}`;
      const audio = new Audio(audioData);
      
      audioRef.current = audio;
      setPlayingIndex(index);

      audio.onended = () => {
        // Play next in queue
        playNextInQueue();
      };

      audio.onerror = () => {
        console.error('Error playing audio');
        // Continue to next in queue
        playNextInQueue();
      };

      audio.play().catch(err => {
        console.error('Error starting playback:', err);
        playNextInQueue();
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      playNextInQueue();
    }
  };

  const playAudio = (audioBase64: string, index: number) => {
    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Create audio from base64
      const audioData = `data:audio/wav;base64,${audioBase64}`;
      const audio = new Audio(audioData);
      
      audioRef.current = audio;
      setPlayingIndex(index);

      audio.onended = () => {
        setPlayingIndex(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        console.error('Error playing audio');
        setPlayingIndex(null);
        audioRef.current = null;
      };

      audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setPlayingIndex(null);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingIndex(null);
    }
  };

  const downloadAudio = (audioBase64: string, index: number) => {
    try {
      const audioData = `data:audio/wav;base64,${audioBase64}`;
      const link = document.createElement('a');
      link.href = audioData;
      link.download = `translation_${index + 1}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading audio:', error);
    }
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          <p className="text-lg">No translations yet</p>
          <p className="text-sm mt-2">Start recording to see translations</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar"
    >
      {results.map((result, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow"
        >
          {/* Header with metrics */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
            <div className="flex items-center space-x-3 text-sm text-gray-500">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {formatLatency(result.latency_ms)}
              </span>
              <span className={`flex items-center ${getConfidenceColor(result.confidence)}`}>
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>
            {result.is_final && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                Final
              </span>
            )}
          </div>

          {/* Original Text */}
          <div className="mb-3">
            <div className="flex items-center mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {languageNames[sourceLang] || sourceLang}
              </span>
            </div>
            <p className="text-gray-800 text-base leading-relaxed">
              {result.original_text || <span className="text-gray-400 italic">No speech detected</span>}
            </p>
          </div>

          {/* Translated Text */}
          <div className="mb-3 bg-blue-50 p-3 rounded-md">
            <div className="flex items-center mb-1">
              <svg className="w-4 h-4 mr-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-semibold text-blue-700 uppercase">
                {languageNames[targetLang] || targetLang}
              </span>
            </div>
            <p className="text-blue-900 text-base font-medium leading-relaxed">
              {result.translated_text || <span className="text-blue-400 italic">No translation</span>}
            </p>
          </div>

          {/* Audio Controls */}
          <div className="flex items-center space-x-2">
            {playingIndex === index ? (
              <button
                onClick={stopAudio}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={() => playAudio(result.audio_base64, index)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                <span>Play</span>
              </button>
            )}

            <button
              onClick={() => downloadAudio(result.audio_base64, index)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span>Download</span>
            </button>
          </div>
        </div>
      ))}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
};

export default TranslationDisplay;
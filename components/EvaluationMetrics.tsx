'use client';

import React, { useState, useEffect } from 'react';

interface EvaluationSummary {
  asr: {
    avg_wer: number;
    avg_cer: number;
    total_samples: number;
    interpretation: string;
  };
  mt: {
    avg_bleu: number;
    total_samples: number;
    interpretation: string;
  };
  tts: {
    avg_mos: number;
    total_samples: number;
    interpretation: string;
  };
  overall_quality: {
    score: number;
    interpretation: string;
  };
}

export default function EvaluationMetrics() {
  const [summary, setSummary] = useState<EvaluationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5000/api/evaluation/summary');
      const data = await response.json();
      
      if (data.success) {
        setSummary(data.summary);
      } else {
        setError('Failed to fetch evaluation summary');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSummary();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const resetMetrics = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/evaluation/reset', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        // Clear the summary immediately to prevent displaying null values
        setSummary(null);
        setAutoRefresh(false);
      } else {
        alert('Error resetting metrics');
      }
    } catch (err) {
      console.error(err);
      alert('Error resetting metrics');
    }
  };

  const getScoreColor = (score: number, isWER: boolean = false) => {
    if (isWER) {
      // WER: lower is better
      if (score < 0.05) return 'text-green-600';
      if (score < 0.10) return 'text-blue-600';
      if (score < 0.20) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      // BLEU, MOS, Overall: higher is better
      if (score >= 80 || score >= 4.5) return 'text-green-600';
      if (score >= 60 || score >= 4.0) return 'text-blue-600';
      if (score >= 40 || score >= 3.5) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            📊 Evaluation Metrics
          </h2>
          <p className="text-sm text-gray-600">
            WER, BLEU, and MOS Scores
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all text-sm"
          >
            {loading ? '⏳' : '🔄'}
          </button>
          
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg transition-all text-sm ${
              autoRefresh 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {autoRefresh ? '⏸️ Auto' : '▶️ Auto'}
          </button>
          
          {summary && (
            <button
              onClick={resetMetrics}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-8">
            ⚠️ {error}
          </div>
        )}

      {/* Summary Cards */}
      {summary && summary.overall_quality && summary.tts && (
        <div className="space-y-4">
          {/* Info Banner */}
          {(summary.asr.total_samples === 0 || summary.mt.total_samples === 0) && summary.tts.total_samples > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              ℹ️ <strong>Note:</strong> ASR and MT metrics require ground truth data. 
              TTS quality is automatically tracked from translations. 
              Use the evaluation endpoints with reference data for full metrics.
            </div>
          )}
          
          {/* Overall Score */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 text-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm opacity-90">⭐ Overall Quality</div>
                <div className="text-xs opacity-75">{summary.overall_quality.interpretation || 'N/A'}</div>
              </div>
              <div className="text-3xl font-bold">
                {summary.overall_quality.score?.toFixed(1) || '0.0'}
                <span className="text-lg opacity-75">/100</span>
              </div>
            </div>
          </div>

          {/* Component Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ASR Card */}
            <div className={`rounded-lg p-4 border-l-4 ${summary.asr.total_samples > 0 ? 'bg-gray-50 border-green-500' : 'bg-gray-100 border-gray-300 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎤</span>
                  <div>
                    <div className="font-bold text-gray-800">ASR</div>
                    <div className="text-xs text-gray-500">Speech Recognition</div>
                  </div>
                </div>
                <div className="text-right">
                  {summary.asr.total_samples > 0 ? (
                    <>
                      <div className={`text-xl font-bold ${getScoreColor(summary.asr.avg_wer || 0, true)}`}>
                        {((summary.asr.avg_wer || 0) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">WER</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-bold text-gray-400">—</div>
                      <div className="text-xs text-gray-400">No data</div>
                    </>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-600 text-center pt-2 border-t border-gray-200">
                {summary.asr.total_samples > 0 ? `${summary.asr.interpretation} • ${summary.asr.total_samples} samples` : 'Requires ground truth'}
              </div>
            </div>

            {/* MT Card */}
            <div className={`rounded-lg p-4 border-l-4 ${summary.mt.total_samples > 0 ? 'bg-gray-50 border-blue-500' : 'bg-gray-100 border-gray-300 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌐</span>
                  <div>
                    <div className="font-bold text-gray-800">MT</div>
                    <div className="text-xs text-gray-500">Translation</div>
                  </div>
                </div>
                <div className="text-right">
                  {summary.mt.total_samples > 0 ? (
                    <>
                      <div className={`text-xl font-bold ${getScoreColor(summary.mt.avg_bleu || 0)}`}>
                        {(summary.mt.avg_bleu || 0).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">BLEU</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-bold text-gray-400">—</div>
                      <div className="text-xs text-gray-400">No data</div>
                    </>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-600 text-center pt-2 border-t border-gray-200">
                {summary.mt.total_samples > 0 ? `${summary.mt.interpretation} • ${summary.mt.total_samples} samples` : 'Requires ground truth'}
              </div>
            </div>

            {/* TTS Card */}
            <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔊</span>
                  <div>
                    <div className="font-bold text-gray-800">TTS</div>
                    <div className="text-xs text-gray-500">Text-to-Speech</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${getScoreColor(summary.tts.avg_mos || 0)}`}>
                    {(summary.tts.avg_mos || 0).toFixed(1)}
                    <span className="text-sm text-gray-500">/5</span>
                  </div>
                  <div className="text-xs text-gray-500">MOS</div>
                </div>
              </div>
              <div className="text-xs text-gray-600 text-center pt-2 border-t border-gray-200">
                {summary.tts.interpretation || 'N/A'} • {summary.tts.total_samples || 0} samples
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!summary && !loading && !error && (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm text-gray-500">
            Click 🔄 to load evaluation metrics
          </p>
        </div>
      )}
    </div>
  );
}

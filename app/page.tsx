"use client"

import React, { useState } from 'react';
import Head from 'next/head';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { TranslationDisplay } from '../components/TranslationDisplay';
import EvaluationMetrics from '../components/EvaluationMetrics';

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

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' }
];

export default function Home() {
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  const handleTranslation = (result: TranslationResult) => {
    setResults(prev => [...prev, result]);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const swapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
  };

  const clearResults = () => {
    setResults([]);
    setError(null);
  };

  const calculateStats = () => {
    if (results.length === 0) return null;

    const avgLatency = results.reduce((sum, r) => sum + r.latency_ms, 0) / results.length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const totalWords = results.reduce((sum, r) => sum + r.original_text.split(' ').length, 0);

    return {
      totalTranslations: results.length,
      avgLatency: avgLatency.toFixed(0),
      avgConfidence: (avgConfidence * 100).toFixed(1),
      totalWords
    };
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Head>
        <title>Real-Time Voice Translation</title>
        <meta name="description" content="Translate speech in real-time across multiple languages" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1"></div>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
                🎙️ Voice Translation
              </h1>
              <p className="text-gray-600 text-lg">
                Real-time speech translation powered by AI
              </p>
            </div>
            <div className="flex-1 flex justify-end">
              <button
                onClick={() => setShowEvaluation(!showEvaluation)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span>📊</span>
                <span className="hidden sm:inline">{showEvaluation ? 'Hide' : 'Show'} Metrics</span>
              </button>
            </div>
          </div>
        </div>

        {/* Evaluation Metrics Section */}
        {showEvaluation && (
          <div className="mb-8">
            <EvaluationMetrics />
          </div>
        )}

        {/* Language Selector Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            {/* Source Language */}
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speak in
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-gray-700"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              onClick={swapLanguages}
              className="mt-6 md:mt-6 p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              title="Swap languages"
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>

            {/* Target Language */}
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Translate to
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-gray-700"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recording Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Record
            </h2>
            <VoiceRecorder
              sourceLang={sourceLang}
              targetLang={targetLang}
              onTranslation={handleTranslation}
              onError={handleError}
            />
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Translations
              </h2>
              {results.length > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    {showStats ? 'Hide' : 'Show'} Stats
                  </button>
                  <button
                    onClick={clearResults}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Statistics */}
            {showStats && stats && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalTranslations}</div>
                  <div className="text-xs text-gray-600">Translations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.avgLatency}ms</div>
                  <div className="text-xs text-gray-600">Avg Latency</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.avgConfidence}%</div>
                  <div className="text-xs text-gray-600">Avg Confidence</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.totalWords}</div>
                  <div className="text-xs text-gray-600">Total Words</div>
                </div>
              </div>
            )}

            <TranslationDisplay
              results={results}
              sourceLang={sourceLang}
              targetLang={targetLang}
            />
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-semibold text-gray-800 mb-2">Real-Time</h3>
            <p className="text-sm text-gray-600">
              Instant translation as you speak with low latency
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-4xl mb-3">🌍</div>
            <h3 className="font-semibold text-gray-800 mb-2">Multi-Language</h3>
            <p className="text-sm text-gray-600">
              Support for English, Spanish, and Hindi
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-semibold text-gray-800 mb-2">High Accuracy</h3>
            <p className="text-sm text-gray-600">
              AI-powered for natural and accurate translations
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Powered by Whisper, MarianMT, and Coqui TTS</p>
        </footer>
      </main>
    </div>
  );
}
export interface TranslationResult {
  original_text: string;
  translated_text: string;
  audio_base64: string;
  sample_rate: number;
  latency_ms: number;
  confidence: number;
  timestamp: number;
  is_final?: boolean;
}

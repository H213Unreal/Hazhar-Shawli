import React, { useState } from 'react';
import { generateSpeech } from '../services/geminiService';
import { PlayIcon } from './icons/PlayIcon';

const voices = ['Kore', 'Puck', 'Charon', 'Zephyr', 'Fenrir'];

const languages = [
  { value: 'Auto', label: 'Auto-Detect' },
  { value: 'English', label: 'English' },
  { value: 'Persian', label: 'Persian - فارسی' },
  { value: 'Kurdish (Sorani)', label: 'Kurdish (Sorani) - کوردی (سۆرانی)' },
  { value: 'Kurdish (Badini)', label: 'Kurdish (Badini) - کوردی (بادینی)' },
  { value: 'Arabic', label: 'Arabic - العربية' },
  { value: 'Spanish', label: 'Spanish - Español' },
  { value: 'French', label: 'French - Français' },
  { value: 'German', label: 'German - Deutsch' },
  { value: 'Japanese', label: 'Japanese - 日本語' },
  { value: 'Chinese (Mandarin)', label: 'Chinese (Mandarin) - 中文 (普通话)' },
];

const TTS: React.FC = () => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(voices[0]);
  const [selectedLanguage, setSelectedLanguage] = useState(languages[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const createWavUrl = (base64PcmData: string): string => {
    // Decode base64 string to a Uint8Array
    const binaryString = atob(base64PcmData);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pcmData = bytes;
  
    // WAV file header parameters
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const dataSize = pcmData.length;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
  
    // Create the full WAV file buffer
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
  
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
  
    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
  
    // Write PCM data
    new Uint8Array(buffer, 44).set(pcmData);
  
    const blob = new Blob([view], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  const handlePreview = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPreviewing) return;

    setIsPreviewing(true);
    // Do not clear the main error state for preview errors to avoid flickering
    try {
        const previewText = "Hello! I can read any text you want.";
        // Force English for the preview to ensure the text makes sense
        const base64Audio = await generateSpeech(previewText, selectedVoice, 'English');
        const url = createWavUrl(base64Audio);
        
        const audio = new Audio(url);
        audio.onended = () => setIsPreviewing(false);
        audio.onerror = () => setIsPreviewing(false);
        await audio.play();
    } catch (e) {
        console.error('Preview failed:', e);
        setIsPreviewing(false);
        // Optionally set a transient error or just log it
    }
  };

  const handleGenerateSpeech = async () => {
    if (!text) {
      setError('Please enter some text to generate speech.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const base64Audio = await generateSpeech(text, selectedVoice, selectedLanguage);
      const url = createWavUrl(base64Audio);
      setAudioUrl(url);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Speech generation failed: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-gray-800 rounded-xl p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Text-to-Speech</h2>
      <div className="space-y-6">
        <div>
          <label htmlFor="tts-text" className="block text-sm font-medium text-gray-300 mb-2">
            Text to Synthesize
          </label>
          <textarea
            id="tts-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., 'Hello, world! Welcome to the future of AI.'"
            className="w-full h-36 p-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            disabled={isLoading}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tts-language" className="block text-sm font-medium text-gray-300 mb-2">
              Language
            </label>
            <select
              id="tts-language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full p-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={isLoading}
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tts-voice" className="block text-sm font-medium text-gray-300 mb-2">
              Voice
            </label>
            <div className="flex gap-2">
                <select
                id="tts-voice"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="flex-grow p-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={isLoading}
                >
                {voices.map((voice) => (
                    <option key={voice} value={voice}>{voice}</option>
                ))}
                </select>
                <button
                    onClick={handlePreview}
                    disabled={isPreviewing || isLoading}
                    className="flex-shrink-0 w-14 flex items-center justify-center bg-gray-700 border-2 border-gray-600 rounded-lg text-gray-200 hover:bg-gray-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Preview Voice"
                    type="button"
                >
                    {isPreviewing ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <PlayIcon className="h-6 w-6" />
                    )}
                </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerateSpeech}
          disabled={!text || isLoading}
          className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-lg font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Audio...
            </>
          ) : (
            'Generate Speech'
          )}
        </button>
        {error && <div className="text-center text-red-400 bg-red-900/50 p-3 rounded-lg" role="alert">{error}</div>}
        {audioUrl && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Result</h3>
            <audio controls src={audioUrl} className="w-full">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
      </div>
    </div>
  );
};

export default TTS;
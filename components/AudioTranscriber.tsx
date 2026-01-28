import React, { useState, useRef, useEffect } from 'react';
// FIX: Removed LiveSession as it is not an exported member of '@google/genai'.
import { GoogleGenAI, Modality } from '@google/genai';

// Helper functions for audio processing
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string; mimeType: string; } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// FIX: Added a local interface for the live session object for type safety,
// since LiveSession is not exported from the SDK.
interface GeminiLiveSession {
  sendRealtimeInput(input: { media: { data: string; mimeType: string; } }): void;
  close(): void;
}

const supportedLanguages = [
  { value: 'English', label: 'English' },
  { value: 'Kurdish (Sorani)', label: 'Kurdish (Sorani) - کوردی (سۆرانی)' },
  { value: 'Kurdish (Badini)', label: 'Kurdish (Badini) - کوردی (بادینی)' },
  { value: 'Arabic', label: 'Arabic - العربية' },
  { value: 'Spanish', label: 'Spanish - Español' },
  { value: 'French', label: 'French - Français' },
  { value: 'German', label: 'German - Deutsch' },
  { value: 'Japanese', label: 'Japanese - 日本語' },
  { value: 'Chinese (Mandarin)', label: 'Chinese (Mandarin) - 中文 (普通话)' },
];

// A mapping for detailed, authoritative language instructions to improve transcription accuracy.
const languagePrompts: { [key: string]: string } = {
  'English': `**CRITICAL INSTRUCTION: The user is speaking English.** Your only task is to provide a perfect, verbatim transcription of their speech. Do not translate or summarize.`,
  'Kurdish (Sorani)': `**CRITICAL INSTRUCTION: The user is speaking Kurdish (Sorani).** Your *only* task is to provide a perfect, verbatim transcription.
- **LANGUAGE:** Kurdish (Sorani)
- **SCRIPT:** You MUST use the Arabic script exclusively.
- **ACCURACY:** Do not summarize, translate, or change anything. Capture every word exactly as spoken.
- **EXAMPLE:** A simple phrase like 'چۆنی باشی' must be transcribed exactly like that, not 'choni bashi'.
- **COMPLEX EXAMPLE:** A phrase like 'سواری ئەسپێکی سپی جوان لە شاخ' must be transcribed exactly.
- **FAILURE TO COMPLY:** Transcribing in any other language or script is a failure.`,
  'Kurdish (Badini)': `**CRITICAL INSTRUCTION: The user is speaking Kurdish (Badini / Kurmanji).** Your *only* task is to provide a perfect, verbatim transcription.
- **LANGUAGE:** Kurdish (Badini / Kurmanji)
- **SCRIPT:** You MUST use the Latin script exclusively.
- **ACCURACY:** Do not summarize, translate, or change anything. Capture every word exactly as spoken.
- **EXAMPLE:** A phrase like 'Çawa yî, baş î?' must be transcribed exactly.
- **FAILURE TO COMPLY:** Transcribing in any other language or script is a failure.`,
  'Arabic': `**CRITICAL INSTRUCTION: The user is speaking Arabic.** Your only task is to provide a perfect, verbatim transcription using the Arabic script. Do not translate or summarize. Pay close attention to the specific dialect spoken to ensure maximum accuracy.`,
  'Spanish': `**CRITICAL INSTRUCTION: The user is speaking Spanish.** Your only task is to provide a perfect, verbatim transcription of their speech. Do not translate or summarize.`,
  'French': `**CRITICAL INSTRUCTION: The user is speaking French.** Your only task is to provide a perfect, verbatim transcription of their speech. Do not translate or summarize.`,
  'German': `**CRITICAL INSTRUCTION: The user is speaking German.** Your only task is to provide a perfect, verbatim transcription of their speech. Do not translate or summarize.`,
  'Japanese': `**CRITICAL INSTRUCTION: The user is speaking Japanese.** Your only task is to provide a perfect, verbatim transcription of their speech. Do not translate or summarize.`,
  'Chinese (Mandarin)': `**CRITICAL INSTRUCTION: The user is speaking Chinese (Mandarin).** Your only task is to provide a perfect, verbatim transcription of their speech in simplified Chinese characters. Do not translate or summarize.`
};


const AudioTranscriber: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(supportedLanguages[0].value);
  const [error, setError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<GeminiLiveSession> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentTurnTextRef = useRef<string>('');
  
  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close()).catch(console.error);
      sessionPromiseRef.current = null;
    }
  };

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      cleanup();
    };
  }, []);

  const handleStartRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setError(null);
    setTranscription('');
    setInterimTranscript('');
    currentTurnTextRef.current = '';

    try {
      if (!process.env.API_KEY) {
        throw new Error('API_KEY environment variable not set.');
      }
      
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      // FIX: Cast `window` to `any` to access `webkitAudioContext` without a TypeScript error, ensuring compatibility with older browsers.
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Get the specific instruction for the selected language for better accuracy.
      const languageInstruction = languagePrompts[selectedLanguage] || `The user is speaking ${selectedLanguage}. Transcribe their speech accurately in that language.`;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!audioContextRef.current || !mediaStreamRef.current) return;
            const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);
          },
          onmessage: (message) => {
            if (message.serverContent?.inputTranscription) {
              const partialText = message.serverContent.inputTranscription.text;
              setInterimTranscript(partialText);
              currentTurnTextRef.current = partialText;
            }
            if (message.serverContent?.turnComplete) {
              const finalTurnText = currentTurnTextRef.current.trim();
              if (finalTurnText) {
                setTranscription(prev => `${prev}${prev ? '\n' : ''}${finalTurnText}`);
              }
              currentTurnTextRef.current = '';
              setInterimTranscript('');
            }
          },
          onerror: (e) => {
            console.error('Live session error:', e);
            setError('An error occurred with the live session. Please try again.');
            handleStopRecording();
          },
          onclose: () => {
            console.log('Live session closed.');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO], // Required for Live API
          inputAudioTranscription: {},
          systemInstruction: `You are a world-class, expert audio transcriber. ${languageInstruction}`,
        },
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to start recording: ${errorMessage}`);
      setIsRecording(false);
      cleanup();
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    cleanup();
  };

  return (
    <div className="max-w-3xl mx-auto bg-gray-800 rounded-xl p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Live Audio Transcription</h2>
      <div className="space-y-6">
        <div>
            <label htmlFor="language-select" className="block text-sm font-medium text-gray-300 mb-2">
              Language
            </label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={isRecording}
              className="w-full p-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
            >
              {supportedLanguages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
        <div className="flex justify-center">
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              className="px-8 py-4 bg-green-600 text-white font-bold rounded-full hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              <span>Start Recording</span>
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="px-8 py-4 bg-red-600 text-white font-bold rounded-full hover:bg-red-700 transition-colors flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10h6" /></svg>
              <span>Stop Recording</span>
            </button>
          )}
        </div>
        {isRecording && (
          <div className="flex items-center justify-center text-yellow-400 space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span>Recording... Speak now.</span>
          </div>
        )}
        {error && <div className="text-center text-red-400 bg-red-900/50 p-3 rounded-lg" role="alert">{error}</div>}
        <div className="bg-gray-900 rounded-lg p-4 min-h-[200px] text-gray-300 whitespace-pre-wrap">
          <h3 className="text-lg font-semibold text-white mb-2">Transcript:</h3>
          <span>{transcription}</span>
          <span className="text-gray-400">{interimTranscript}</span>
          {!transcription && !interimTranscript && <p className="text-gray-500">Your transcribed text will appear here...</p>}
        </div>
      </div>
    </div>
  );
};

export default AudioTranscriber;
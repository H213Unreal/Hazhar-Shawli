import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// --- Audio Utility Functions ---

// Decodes a base64 string into a Uint8Array.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Encodes a Uint8Array into a base64 string.
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Converts raw PCM audio data (Float32Array) into a base64 encoded string for the API.
function createBlob(data: Float32Array): { data: string; mimeType: string; } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Convert float from -1.0 to 1.0 to a 16-bit integer.
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000', // The API expects 16kHz PCM audio.
  };
}

// Decodes raw PCM audio data (Uint8Array) into an AudioBuffer for playback.
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// A local interface for the live session object for type safety.
interface GeminiLiveSession {
  sendRealtimeInput(input: { media: { data: string; mimeType: string; } }): void;
  close(): void;
}

type ConversationEntry = {
  role: 'user' | 'model';
  text: string;
};

type Status = 'idle' | 'connecting' | 'listening' | 'thinking';

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

// A mapping for detailed, authoritative language instructions to ensure the AI responds correctly.
const conversationLanguagePrompts: { [key: string]: string } = {
    'English': `You are a friendly and helpful AI assistant. You MUST converse in English.`,
    'Kurdish (Sorani)': `You are a friendly and helpful AI assistant. **CRITICAL INSTRUCTION:** The user is speaking Kurdish (Sorani). You MUST understand and respond *only* in Kurdish (Sorani) using the Arabic script. Your responses should be natural and conversational.`,
    'Kurdish (Badini)': `You are a friendly and helpful AI assistant. **CRITICAL INSTRUCTION:** The user is speaking Kurdish (Badini / Kurmanji). You MUST understand and respond *only* in Kurdish (Badini / Kurmanji) using the Latin script. Your responses should be natural and conversational.`,
    'Arabic': `You are a friendly and helpful AI assistant. **CRITICAL INSTRUCTION:** The user is speaking Arabic. You MUST understand and respond *only* in Arabic using the Arabic script. Pay attention to the dialect and respond appropriately.`,
    'Spanish': `You are a friendly and helpful AI assistant. You MUST converse in Spanish.`,
    'French': `You are a friendly and helpful AI assistant. You MUST converse in French.`,
    'German': `You are a friendly and helpful AI assistant. You MUST converse in German.`,
    'Japanese': `You are a friendly and helpful AI assistant. You MUST converse in Japanese.`,
    'Chinese (Mandarin)': `You are a friendly and helpful AI assistant. You MUST converse in Chinese (Mandarin).`,
  };

const Conversation: React.FC = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(supportedLanguages[0].value);

  const sessionPromiseRef = useRef<Promise<GeminiLiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputTextRef = useRef('');
  const currentOutputTextRef = useRef('');

  const cleanup = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    inputAudioContextRef.current?.close().catch(console.error);
    outputAudioContextRef.current?.close().catch(console.error);
    sessionPromiseRef.current?.then(session => session.close()).catch(console.error);

    mediaStreamRef.current = null;
    scriptProcessorRef.current = null;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    sessionPromiseRef.current = null;
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const handleStart = async () => {
    if (status !== 'idle') return;

    setStatus('connecting');
    setError(null);
    setConversation([]);
    currentInputTextRef.current = '';
    currentOutputTextRef.current = '';
    nextStartTimeRef.current = 0;

    try {
      if (!process.env.API_KEY) {
        throw new Error('API_KEY environment variable not set.');
      }
      
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // FIX: Cast `window` to `any` to access `webkitAudioContext` without a TypeScript error.
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const languageInstruction = conversationLanguagePrompts[selectedLanguage] || `You are a friendly and helpful AI assistant.`;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('listening');
            if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const serverContent = message.serverContent;
            
            if (serverContent?.inputTranscription) {
                currentInputTextRef.current = serverContent.inputTranscription.text;
            }
            if (serverContent?.outputTranscription) {
                currentOutputTextRef.current = serverContent.outputTranscription.text;
                setStatus('thinking');
            }
            
            // FIX: Safely access audio data using optional chaining to prevent crashes
            // when the response structure from the API is unexpected.
            const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  outputAudioContextRef.current,
                  24000,
                  1
                );
                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContextRef.current.destination);
                
                source.onended = () => audioSourcesRef.current.delete(source);
                
                const currentTime = outputAudioContextRef.current.currentTime;
                const startTime = Math.max(currentTime, nextStartTimeRef.current);
                source.start(startTime);
                
                nextStartTimeRef.current = startTime + audioBuffer.duration;
                audioSourcesRef.current.add(source);
            }

            if(serverContent?.interrupted){
                for(const source of audioSourcesRef.current.values()){
                    source.stop();
                }
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
            if (serverContent?.turnComplete) {
                const userTurn: ConversationEntry = { role: 'user', text: currentInputTextRef.current.trim() };
                const modelTurn: ConversationEntry = { role: 'model', text: currentOutputTextRef.current.trim() };
                
                if (userTurn.text || modelTurn.text) {
                    setConversation(prev => [...prev, userTurn, modelTurn]);
                }
                
                currentInputTextRef.current = '';
                currentOutputTextRef.current = '';
                setStatus('listening');
            }
          },
          onerror: (e) => {
            console.error('Live session error:', e);
            const message = (e as ErrorEvent).message || (e as any).toString();
            let userMessage = 'An error occurred during the conversation. Please try again.';

            if (message.toLowerCase().includes('unavailable')) {
                userMessage = 'The conversation service is temporarily unavailable. Please wait a moment and try again.';
            } else if (message.toLowerCase().includes('internal error')) {
                userMessage = 'An internal error occurred with the service. Please try starting the conversation again.';
            } else if (message.toLowerCase().includes('microphone')) {
                userMessage = 'Could not access the microphone. Please check your browser permissions.';
            }
            setError(userMessage);
            handleStop();
          },
          onclose: () => {
            console.log('Live session closed.');
            setStatus('idle');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: languageInstruction,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to start conversation: ${errorMessage}`);
      setStatus('idle');
      cleanup();
    }
  };

  const handleStop = () => {
    if (status === 'idle') return;
    cleanup();
    setStatus('idle');
  };

  const getStatusIndicator = () => {
    switch (status) {
      case 'connecting':
        return <div className="text-yellow-400">Connecting...</div>;
      case 'listening':
        return <div className="text-green-400 flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>Listening...</div>;
      case 'thinking':
        return <div className="text-blue-400 flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Thinking...
            </div>;
      default:
        return <div className="text-gray-400">Ready to start</div>;
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-gray-800 rounded-xl p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Real-Time Conversation</h2>
      <div className="space-y-6">
        <div>
            <label htmlFor="language-select-conversation" className="block text-sm font-medium text-gray-300 mb-2">
              Conversation Language
            </label>
            <select
              id="language-select-conversation"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={status !== 'idle'}
              className="w-full p-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
            >
              {supportedLanguages.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
        </div>
        <div className="flex justify-between items-center bg-gray-900 p-3 rounded-lg">
          <div className="font-mono text-sm">{getStatusIndicator()}</div>
          {status === 'idle' ? (
            <button
              onClick={handleStart}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition-colors"
            >
              Start Conversation
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-6 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition-colors"
            >
              Stop Conversation
            </button>
          )}
        </div>
        
        {error && <div className="text-center text-red-400 bg-red-900/50 p-3 rounded-lg" role="alert">{error}</div>}

        <div className="bg-gray-900 rounded-lg p-4 min-h-[400px] max-h-[60vh] overflow-y-auto flex flex-col space-y-4">
          {conversation.length === 0 && (
            <div className="flex-grow flex items-center justify-center text-gray-500">
              Your conversation will appear here...
            </div>
          )}
          {conversation.map((entry, index) => (
            entry.text && (
              <div key={index} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-prose p-3 rounded-lg ${
                    entry.role === 'user'
                      ? 'bg-blue-800 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default Conversation;
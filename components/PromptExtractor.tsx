
import React, { useState, useRef } from 'react';
import type { ImageFile } from '../types';
import { extractPromptFromImage } from '../services/geminiService';
import ImageUploader from './ImageUploader';
import { translations, Language } from '../translations';
import { InfoIcon } from './icons/InfoIcon';

interface PromptExtractorProps {
  lang: Language;
}

const PromptExtractor: React.FC<PromptExtractorProps> = ({ lang }) => {
  const [media, setMedia] = useState<ImageFile | { url: string; type: string; name: string } | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang].promptExtractor;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setExtractedText('');

    if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        setMedia({ url, type: 'video', name: file.name });
    } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setMedia({ base64, mimeType: file.type, name: file.name } as ImageFile);
        };
        reader.readAsDataURL(file);
    } else {
        setError('Unsupported file type. Please upload an image or video.');
    }
  };

  const captureFrame = (): ImageFile | null => {
    if (!videoRef.current) return null;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    
    return {
        base64,
        mimeType: 'image/jpeg',
        name: 'captured-frame.jpg'
    };
  };

  const handleExtract = async () => {
    let imageToProcess: ImageFile | null = null;

    if (!media) {
      setError(translations[lang].imageSizer.errorUpload);
      return;
    }

    if ('url' in media && media.type === 'video') {
        imageToProcess = captureFrame();
    } else {
        imageToProcess = media as ImageFile;
    }

    if (!imageToProcess) {
        setError('Could not process media.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedText('');

    try {
      const result = await extractPromptFromImage(imageToProcess);
      setExtractedText(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 animate-in fade-in duration-500">
      {/* Input Side */}
      <div className="flex flex-col space-y-6">
        <div className="bg-gray-800 rounded-3xl p-6 shadow-xl border border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-blue-500/20 rounded-xl">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
               </svg>
             </div>
             <div>
                <h2 className="text-xl font-black text-white">{t.title}</h2>
                <p className="text-xs text-gray-400">{t.desc}</p>
             </div>
          </div>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-video bg-gray-900 border-2 border-dashed border-gray-700 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-gray-800 hover:border-blue-500 transition-all overflow-hidden group"
          >
            {media ? (
               media && 'url' in media && media.type === 'video' ? (
                 <video 
                   ref={videoRef}
                   src={media.url} 
                   controls 
                   className="w-full h-full object-contain"
                   onClick={(e) => e.stopPropagation()}
                 />
               ) : (
                 <img src={(media as ImageFile).base64} className="w-full h-full object-contain" />
               )
            ) : (
              <div className="text-center text-gray-500 group-hover:text-blue-400 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                 </svg>
                 <p className="font-bold">{t.uploadLabel}</p>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*,video/*" 
            className="hidden" 
          />
          
          <div className="mt-4 flex gap-3 p-4 bg-gray-900/50 rounded-2xl border border-gray-700/50">
            <InfoIcon className="h-5 w-5 text-gray-500 shrink-0" />
            <p className="text-xs text-gray-500 italic leading-relaxed">
              {media && 'url' in media && media.type === 'video' ? t.videoHint : t.uploadLabel}
            </p>
          </div>
        </div>

        <button
          onClick={handleExtract}
          disabled={!media || isLoading}
          className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xl font-black rounded-3xl shadow-2xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 disabled:grayscale disabled:opacity-50 transition-all duration-300"
        >
          {isLoading ? (
             <div className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>{t.processing}</span>
             </div>
          ) : (
            media && 'url' in media && media.type === 'video' ? t.captureButton : t.buttonLabel
          )}
        </button>

        {error && <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-2xl border border-red-500/30">{error}</div>}
      </div>

      {/* Result Side */}
      <div className="flex flex-col">
        <div className="bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-700/50 flex-grow backdrop-blur-sm relative">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-white">{t.resultTitle}</h2>
            {extractedText && (
              <button
                onClick={handleCopy}
                className={`px-5 py-2.5 ${isCopied ? 'bg-green-600' : 'bg-gray-700'} text-white font-bold rounded-xl hover:bg-opacity-80 transition-all flex items-center gap-2`}
              >
                {isCopied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                )}
                <span>{isCopied ? t.copied : t.copy}</span>
              </button>
            )}
          </div>

          <div className="bg-gray-900/80 rounded-2xl p-6 min-h-[300px] border border-gray-700/30 overflow-y-auto">
            {isLoading ? (
               <div className="space-y-4">
                  <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4"></div>
                  <div className="h-4 bg-gray-800 rounded animate-pulse w-full"></div>
                  <div className="h-4 bg-gray-800 rounded animate-pulse w-5/6"></div>
                  <div className="h-4 bg-gray-800 rounded animate-pulse w-1/2"></div>
               </div>
            ) : extractedText ? (
              <div className="prose prose-invert max-w-none">
                <p className="text-gray-300 leading-relaxed font-medium whitespace-pre-wrap">{extractedText}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-30">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                 </svg>
                 <p>{t.placeholder}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptExtractor;

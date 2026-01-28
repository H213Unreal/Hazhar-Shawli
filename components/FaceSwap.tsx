
import React, { useState, useEffect } from 'react';
import type { ImageFile } from '../types';
import { faceSwap } from '../services/geminiService';
import ImageUploader from './ImageUploader';
import ResultDisplay from './ResultDisplay';
import { DownloadIcon } from './icons/DownloadIcon';
import { PersonIcon } from './icons/PersonIcon';
import { ImageIcon } from './icons/ImageIcon';
import { InfoIcon } from './icons/InfoIcon';
import { translations, Language } from '../translations';

interface FaceSwapProps {
  lang: Language;
}

const FaceSwap: React.FC<FaceSwapProps> = ({ lang }) => {
  const [sourceFace, setSourceFace] = useState<ImageFile | null>(null);
  const [targetImage, setTargetImage] = useState<ImageFile | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(false);

  const t = translations[lang].faceSwap;

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    try {
      const win = window as any;
      if (win.aistudio && win.aistudio.hasSelectedApiKey) {
        const selected = await win.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    } catch (e) {
      console.error("Key check failed", e);
    }
  };

  const handleOpenKeySelector = async () => {
    try {
      const win = window as any;
      if (win.aistudio && win.aistudio.openSelectKey) {
        await win.aistudio.openSelectKey();
        setHasKey(true);
      }
    } catch (e) {
      setError("Error opening key selector.");
    }
  };

  const handleSourceUpload = (imageFile: ImageFile) => {
    setSourceFace(imageFile);
    setResultImage(null);
    setError(null);
  };

  const handleTargetUpload = (imageFile: ImageFile) => {
    setTargetImage(imageFile);
    setResultImage(null);
    setError(null);
  };

  const handleSwapClick = async () => {
    if (!hasKey) {
      setError(t.errorKey);
      await handleOpenKeySelector();
      return;
    }

    if (!sourceFace || !targetImage) {
      setError('Please upload both images.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResultImage(null);

    try {
      const result = await faceSwap(sourceFace, targetImage);
      setResultImage(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(`Error: ${errorMessage}`);
      if (errorMessage.includes("entity was not found")) {
        setHasKey(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveImage = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `face-swap-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Controls Column */}
      <div className="flex flex-col space-y-6">
        <div className="bg-blue-900/30 border border-blue-500/50 rounded-2xl p-5 flex gap-4 items-start shadow-xl shadow-blue-500/5">
          <InfoIcon className="h-7 w-7 text-blue-400 shrink-0" />
          <div className="text-sm text-blue-100">
            <p className="font-bold text-base mb-1">{t.proTitle}</p>
            <p className="opacity-80">{t.proDesc}</p>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline mt-2 inline-block text-xs font-semibold text-blue-400 hover:text-blue-300">
              {t.keyInfo}
            </a>
          </div>
        </div>

        <div className="bg-gray-800/40 rounded-2xl p-6 border border-gray-700/50 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <PersonIcon className="h-6 w-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">{t.sourceLabel}</h2>
          </div>
          <ImageUploader onImageUpload={handleSourceUpload} image={sourceFace} />
          <p className="text-xs text-gray-500 mt-2 italic px-1">{t.sourceHint}</p>
        </div>

        <div className="bg-gray-800/40 rounded-2xl p-6 border border-gray-700/50 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <ImageIcon className="h-6 w-6 text-lime-400" />
            <h2 className="text-xl font-bold text-white">{t.targetLabel}</h2>
          </div>
          <ImageUploader onImageUpload={handleTargetUpload} image={targetImage} />
          <p className="text-xs text-gray-400 mt-2 italic px-1">{t.targetHint}</p>
        </div>

        {!hasKey ? (
           <button
             onClick={handleOpenKeySelector}
             className="w-full flex justify-center items-center px-6 py-4 border-2 border-blue-500 text-lg font-black rounded-2xl shadow-xl text-white bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 transition-all"
           >
             {t.selectKey}
           </button>
        ) : (
          <button
            onClick={handleSwapClick}
            disabled={!sourceFace || !targetImage || isLoading}
            className="w-full flex justify-center items-center px-6 py-5 border-none text-lg font-black rounded-2xl shadow-xl text-gray-900 bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-300 hover:to-green-400 focus:outline-none focus:ring-4 focus:ring-lime-500/20 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-300"
          >
            {isLoading ? (
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-6 w-6 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{t.processing}</span>
              </div>
            ) : (
              t.buttonLabel
            )}
          </button>
        )}
        
        {error && <div className="text-center text-red-400 bg-red-900/40 backdrop-blur-md p-4 rounded-xl border border-red-500/30 animate-shake" role="alert">{error}</div>}
      </div>

      {/* Result Column */}
      <div className="flex flex-col">
        <div className="bg-gray-800/40 rounded-3xl p-6 shadow-2xl border border-gray-700/50 flex-grow backdrop-blur-lg">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-white">{t.resultTitle}</h2>
            {resultImage && !isLoading && (
              <button
                onClick={handleSaveImage}
                className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <DownloadIcon className="h-5 w-5" />
                <span>{t.save}</span>
              </button>
            )}
          </div>
          <ResultDisplay
            imageSrc={resultImage}
            isLoading={isLoading}
            placeholderText="..."
            loadingText={t.processing}
          />
        </div>
      </div>
    </div>
  );
};

export default FaceSwap;

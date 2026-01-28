
import React, { useState, useRef, useEffect } from 'react';
import type { ImageFile } from '../types';
import { generativeResize } from '../services/geminiService';
import ImageUploader from './ImageUploader';
import ResultDisplay from './ResultDisplay';
import { DownloadIcon } from './icons/DownloadIcon';
import { LockIcon } from './icons/LockIcon';
import { UnlockIcon } from './icons/UnlockIcon';
import { translations, Language } from '../translations';
import { InfoIcon } from './icons/InfoIcon';

interface ImageSizerProps {
  lang?: Language;
}

const PRESETS = [
  { name: 'Mobile Story', width: 1080, height: 1920 },
  { name: 'HD', width: 1920, height: 1080 },
  { name: 'Square', width: 1080, height: 1080 },
];

const ImageSizer: React.FC<ImageSizerProps> = ({ lang = 'en' }) => {
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [resizedImage, setResizedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [isAspectRatioLocked, setAspectRatioLocked] = useState<boolean>(true);
  const [mode, setMode] = useState<'ai' | 'standard'>('ai');
  
  const originalDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const t = translations[lang].imageSizer;

  const handleImageUpload = (imageFile: ImageFile) => {
    setOriginalImage(imageFile);
    setResizedImage(null);
    setError(null);
    
    const img = new Image();
    img.onload = () => {
      originalDimensionsRef.current = { width: img.width, height: img.height };
      setWidth(String(img.width));
      setHeight(String(img.height));
    };
    img.src = imageFile.base64;
  };

  const handleWidthChange = (newWidthStr: string) => {
    setWidth(newWidthStr);
    if (isAspectRatioLocked && originalDimensionsRef.current?.width) {
      const newWidth = parseInt(newWidthStr, 10);
      if (!isNaN(newWidth) && newWidth > 0) {
        const aspectRatio = originalDimensionsRef.current.height / originalDimensionsRef.current.width;
        setHeight(String(Math.round(newWidth * aspectRatio)));
      }
    }
  };

  const handleHeightChange = (newHeightStr: string) => {
    setHeight(newHeightStr);
    if (isAspectRatioLocked && originalDimensionsRef.current?.height) {
      const newHeight = parseInt(newHeightStr, 10);
      if (!isNaN(newHeight) && newHeight > 0) {
        const aspectRatio = originalDimensionsRef.current.width / originalDimensionsRef.current.height;
        setWidth(String(Math.round(newHeight * aspectRatio)));
      }
    }
  };

  const handlePresetClick = (preset: { width: number; height: number }) => {
    setWidth(String(preset.width));
    setHeight(String(preset.height));
    setAspectRatioLocked(false);
  };

  const handleResize = async () => {
    if (!originalImage) {
      setError(t.errorUpload);
      return;
    }
    const targetWidth = parseInt(width, 10);
    const targetHeight = parseInt(height, 10);

    if (isNaN(targetWidth) || isNaN(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
      setError(t.errorDimensions);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResizedImage(null);

    if (mode === 'ai') {
        try {
            const result = await generativeResize(originalImage, targetWidth, targetHeight);
            setResizedImage(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'AI resize failed.');
        } finally {
            setIsLoading(false);
        }
    } else {
        // Standard Fit (Cover/Crop) - No Stretching
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas error.');

            // Draw using "Cover" logic to prevent stretching
            const imgAspect = img.width / img.height;
            const targetAspect = targetWidth / targetHeight;
            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgAspect > targetAspect) {
                drawHeight = targetHeight;
                drawWidth = targetHeight * imgAspect;
                offsetX = -(drawWidth - targetWidth) / 2;
                offsetY = 0;
            } else {
                drawWidth = targetWidth;
                drawHeight = targetWidth / imgAspect;
                offsetX = 0;
                offsetY = -(drawHeight - targetHeight) / 2;
            }

            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            const resizedDataUrl = canvas.toDataURL(originalImage.mimeType, 0.9);
            setResizedImage(resizedDataUrl);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Resize error.');
          } finally {
            setIsLoading(false);
          }
        };
        img.src = originalImage.base64;
    }
  };

  const handleSaveImage = () => {
    if (!resizedImage || !originalImage) return;
    const link = document.createElement('a');
    link.href = resizedImage;
    link.download = `resized-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
      {/* Controls */}
      <div className="flex flex-col space-y-6">
        <div className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm">1</span>
            {t.uploadTitle}
          </h2>
          <ImageUploader onImageUpload={handleImageUpload} image={originalImage} />
          <p className="text-xs text-gray-500 mt-3 italic">{t.uploadHint}</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700 space-y-6">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm">2</span>
            {t.dimensionsTitle}
          </h2>
          
          <div className="flex p-1 bg-gray-900 rounded-xl">
             <button 
                onClick={() => setMode('ai')}
                className={`flex-1 py-2 px-3 text-sm font-bold rounded-lg transition-all ${mode === 'ai' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
             >
                {t.aiMode}
             </button>
             <button 
                onClick={() => setMode('standard')}
                className={`flex-1 py-2 px-3 text-sm font-bold rounded-lg transition-all ${mode === 'standard' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
             >
                {t.standardMode}
             </button>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t.presets}</h3>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button key={p.name} onClick={() => handlePresetClick(p)} disabled={!originalImage} className="px-4 py-2 bg-gray-700/50 text-sm font-medium rounded-xl border border-gray-600 hover:border-blue-500 hover:bg-gray-700 transition-all disabled:opacity-30">{p.name}</button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">{t.custom}</h3>
              <div className="flex items-center gap-3 bg-gray-900 p-4 rounded-2xl border border-gray-700">
                <div className="flex-1">
                  <label htmlFor="width" className="block text-xs font-bold text-gray-500 mb-1">{t.width}</label>
                  <input id="width" type="number" value={width} onChange={e => handleWidthChange(e.target.value)} disabled={!originalImage} className="w-full bg-transparent border-none text-xl font-black text-white focus:ring-0 p-0" />
                </div>
                <button onClick={() => setAspectRatioLocked(!isAspectRatioLocked)} disabled={!originalImage} className="p-3 rounded-full hover:bg-gray-800 text-blue-400 disabled:opacity-30 transition-all">
                  {isAspectRatioLocked ? <LockIcon className="h-6 w-6" /> : <UnlockIcon className="h-6 w-6 text-gray-600" />}
                </button>
                <div className="flex-1">
                  <label htmlFor="height" className="block text-xs font-bold text-gray-500 mb-1">{t.height}</label>
                  <input id="height" type="number" value={height} onChange={e => handleHeightChange(e.target.value)} disabled={!originalImage} className="w-full bg-transparent border-none text-xl font-black text-white focus:ring-0 p-0 text-right" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleResize} 
          disabled={!originalImage || isLoading} 
          className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xl font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 disabled:grayscale disabled:opacity-50 transition-all"
        >
          {isLoading ? (
             <div className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>{t.processing}</span>
             </div>
          ) : (
            mode === 'ai' ? t.aiButtonLabel : t.buttonLabel
          )}
        </button>

        {error && <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-2xl border border-red-500/30 animate-pulse">{error}</div>}
      </div>

      {/* Result */}
      <div className="flex flex-col">
        <div className="bg-gray-800 rounded-3xl p-6 shadow-2xl border border-gray-700 flex-grow backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-white">{t.resultTitle}</h2>
            {resizedImage && !isLoading && (
              <button onClick={handleSaveImage} className="px-5 py-2.5 bg-lime-500 text-gray-900 font-black rounded-xl hover:bg-lime-400 shadow-lg shadow-lime-500/20 transition-all flex items-center gap-2 active:scale-95">
                <DownloadIcon className="h-5 w-5" />
                <span>{t.save}</span>
              </button>
            )}
          </div>
          <ResultDisplay 
            imageSrc={resizedImage} 
            isLoading={isLoading} 
            placeholderText={t.uploadHint}
            loadingText={t.processing} 
          />
          {mode === 'ai' && !resizedImage && !isLoading && (
              <div className="mt-4 flex gap-3 p-4 bg-blue-900/20 rounded-2xl border border-blue-500/30">
                 <InfoIcon className="h-5 w-5 text-blue-400 shrink-0" />
                 <p className="text-xs text-blue-200 leading-relaxed">
                    با انتخاب حالت <b>AI Generative Expand</b>، هوش مصنوعی محیط اطراف را بدون کشیده شدن اشیاء بازسازی می‌کند. این فرآیند ممکن است چند ثانیه زمان ببرد.
                 </p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageSizer;

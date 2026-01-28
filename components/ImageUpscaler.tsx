import React, { useState } from 'react';
import type { ImageFile } from '../types';
import { upscaleImage } from '../services/geminiService';
import ImageUploader from './ImageUploader';
import ResultDisplay from './ResultDisplay';
import { ImageIcon } from './icons/ImageIcon';
import { DownloadIcon } from './icons/DownloadIcon';

const ImageUpscaler: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (imageFile: ImageFile) => {
    setOriginalImage(imageFile);
    setUpscaledImage(null);
    setError(null);
  };

  const handleUpscaleClick = async () => {
    if (!originalImage) {
      setError('Please upload an image to upscale.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setUpscaledImage(null);

    try {
      const resultImage = await upscaleImage(originalImage);
      setUpscaledImage(resultImage);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Upscaling failed: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveImage = () => {
    if (!upscaledImage || !originalImage) return;

    const link = document.createElement('a');
    link.href = upscaledImage;
    
    const mimeType = upscaledImage.match(/^data:(.*);base64,/)?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';

    const originalName = originalImage.name;
    const nameWithoutExtension = originalName.includes('.')
      ? originalName.substring(0, originalName.lastIndexOf('.'))
      : originalName;
      
    link.download = `${nameWithoutExtension}-upscaled.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Top Controls */}
      <div className="w-full max-w-md bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">1. Upload Image to Upscale</h2>
        <ImageUploader onImageUpload={handleImageUpload} image={originalImage} />
      </div>

      <button
        onClick={handleUpscaleClick}
        disabled={!originalImage || isLoading}
        className="w-full max-w-md flex justify-center items-center px-6 py-4 border border-transparent text-lg font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Upscaling...
          </>
        ) : (
          'Upscale Image'
        )}
      </button>

      {error && <div className="w-full max-w-4xl text-center text-red-400 bg-red-900/50 p-3 rounded-lg" role="alert">{error}</div>}

      {/* Comparison View */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-4">
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Original Image</h2>
          <div className="w-full aspect-video bg-gray-700/50 rounded-lg flex items-center justify-center overflow-hidden">
            {originalImage ? (
              <img src={originalImage.base64} alt="Original" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-center text-gray-500">
                <ImageIcon className="mx-auto h-16 w-16" />
                <p className="mt-4 text-lg">Upload an image to begin</p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Upscaled Image</h2>
            {upscaledImage && !isLoading && (
                <button
                  onClick={handleSaveImage}
                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                  aria-label="Save upscaled image"
                >
                  <DownloadIcon className="h-5 w-5" />
                  <span>Save Image</span>
                </button>
            )}
          </div>
          <ResultDisplay 
            imageSrc={upscaledImage} 
            isLoading={isLoading}
            placeholderText="Your upscaled image will appear here"
            loadingText="Upscaling your image..."
          />
        </div>
      </div>
    </div>
  );
};

export default ImageUpscaler;

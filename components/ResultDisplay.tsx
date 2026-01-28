import React from 'react';
import { ImageIcon } from './icons/ImageIcon';

interface ResultDisplayProps {
  imageSrc: string | null;
  isLoading: boolean;
  placeholderText?: string;
  loadingText?: string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ imageSrc, isLoading, placeholderText, loadingText }) => {
  const placeholder = placeholderText || 'Your edited image will appear here';
  const loading = loadingText || 'Generating your image...';
  
  return (
    <div className="w-full aspect-video bg-gray-700/50 rounded-lg flex items-center justify-center relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/50 flex flex-col items-center justify-center z-10">
          <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg text-white">{loading}</p>
        </div>
      )}
      {imageSrc ? (
        <img src={imageSrc} alt="Generated result" className="max-w-full max-h-full object-contain" />
      ) : !isLoading && (
        <div className="text-center text-gray-500">
          <ImageIcon className="mx-auto h-16 w-16" />
          <p className="mt-4 text-lg">{placeholder}</p>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;
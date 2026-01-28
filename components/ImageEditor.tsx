import React, { useState } from 'react';
import type { ImageFile } from '../types';
import { editImage } from '../services/geminiService';
import ImageUploader from './ImageUploader';
import ResultDisplay from './ResultDisplay';
import { DownloadIcon } from './icons/DownloadIcon';

const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (imageFile: ImageFile) => {
    setOriginalImage(imageFile);
    setEditedImage(null);
    setError(null);
  };

  const handleGenerateClick = async () => {
    if (!originalImage || !prompt) {
      setError('Please upload an image and provide an editing prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const resultImage = await editImage(originalImage, prompt);
      setEditedImage(resultImage);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Generation failed: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveImage = () => {
    if (!editedImage || !originalImage) return;

    const link = document.createElement('a');
    link.href = editedImage;
    
    // Extract mime type from data URL to determine file extension
    const mimeType = editedImage.match(/^data:(.*);base64,/)?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';

    const originalName = originalImage.name;
    const nameWithoutExtension = originalName.includes('.') 
      ? originalName.substring(0, originalName.lastIndexOf('.'))
      : originalName;
    
    link.download = `${nameWithoutExtension}-edited.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
      {/* Controls Column */}
      <div className="flex flex-col space-y-8">
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">1. Upload Image</h2>
          <ImageUploader onImageUpload={handleImageUpload} image={originalImage} />
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">2. Describe Your Edit</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'make the sky a vibrant sunset', 'add a cat wearing sunglasses', 'turn this into a watercolor painting'"
            className="w-full h-32 p-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            disabled={isLoading}
            aria-label="Image editing prompt"
          />
        </div>
        
        <button
          onClick={handleGenerateClick}
          disabled={!originalImage || !prompt || isLoading}
          className="w-full flex justify-center items-center px-6 py-4 border border-transparent text-lg font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            'Generate Image'
          )}
        </button>
        {error && <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg" role="alert">{error}</div>}
      </div>

      {/* Result Column */}
      <div className="flex flex-col">
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg flex-grow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">3. Result</h2>
              {editedImage && !isLoading && (
                <button
                  onClick={handleSaveImage}
                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                  aria-label="Save edited image"
                >
                  <DownloadIcon className="h-5 w-5" />
                  <span>Save Image</span>
                </button>
              )}
            </div>
            <ResultDisplay
              imageSrc={editedImage}
              isLoading={isLoading}
              placeholderText="Your edited image will appear here"
              loadingText="Generating your image..."
            />
          </div>
      </div>
    </div>
  );
};

export default ImageEditor;

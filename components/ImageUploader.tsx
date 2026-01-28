import React, { useCallback, useRef } from 'react';
import type { ImageFile } from '../types';
import { UploadIcon } from './icons/UploadIcon';

interface ImageUploaderProps {
  onImageUpload: (imageFile: ImageFile) => void;
  image: ImageFile | null;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, image }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 1024;
        let { width, height } = img;

        // If the image is already small enough, resize it anyway to optimize format.
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            // Calculate new dimensions while maintaining aspect ratio
            if (width > height) {
              height = Math.round(height * (MAX_DIMENSION / width));
              width = MAX_DIMENSION;
            } else {
              width = Math.round(width * (MAX_DIMENSION / height));
              height = MAX_DIMENSION;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          // Fallback to original if canvas context cannot be created
          onImageUpload({ base64: dataUrl, mimeType: file.type, name: file.name });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // --- FIX ---
        // Force conversion to JPEG for size optimization. This is crucial for large
        // PNGs that can exceed API payload limits even after dimensional resizing.
        const outputMimeType = 'image/jpeg';
        const outputQuality = 0.9; // A good balance of quality and size.

        const resizedDataUrl = canvas.toDataURL(outputMimeType, outputQuality);

        onImageUpload({
          base64: resizedDataUrl,
          mimeType: outputMimeType, // IMPORTANT: Use the new, optimized mime type.
          name: file.name, // Keep the original name for display purposes.
        });
      };

      // Fallback to original if image fails to load (e.g., corrupted file)
      img.onerror = () => {
        onImageUpload({ base64: dataUrl, mimeType: file.type, name: file.name });
      };

      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };
  
  const handleClick = () => {
    inputRef.current?.click();
  }

  return (
    <div>
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
      />
      <div
        onClick={handleClick}
        className="w-full aspect-video bg-gray-700 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-600 hover:border-blue-500 transition-colors"
      >
        {image ? (
          <img src={image.base64} alt={image.name} className="max-w-full max-h-full object-contain rounded-md" />
        ) : (
          <div className="text-center text-gray-400">
            <UploadIcon className="mx-auto h-12 w-12" />
            <p className="mt-2 font-semibold">Click to upload an image</p>
            <p className="text-sm">PNG, JPG, or WEBP</p>
          </div>
        )}
      </div>
      {image && <p className="text-sm text-gray-400 mt-2 text-center truncate">Loaded: {image.name}</p>}
    </div>
  );
};

export default ImageUploader;
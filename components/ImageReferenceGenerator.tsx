import React, { useState, useRef, useCallback } from 'react';
import type { ImageFile } from '../types';
import { generateImageFromElements, restyleImage, generateImageFromText } from '../services/geminiService';
import ResultDisplay from './ResultDisplay';
import { PersonIcon } from './icons/PersonIcon';
import { LocationIcon } from './icons/LocationIcon';
import { StarIcon } from './icons/StarIcon';
import { ImageIcon } from './icons/ImageIcon';

// Helper to process and resize files
const processFile = (file: File): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return reject(new Error('Could not read file.'));
      resolve({ base64: dataUrl, mimeType: file.type, name: file.name });
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

interface ElementUploaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  images: ImageFile[];
  onImagesChange: (images: ImageFile[]) => void;
  maxFiles: number;
  isDisabled: boolean;
}

const ElementUploader: React.FC<ElementUploaderProps> = ({ icon, title, description, images, onImagesChange, maxFiles, isDisabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const newImages: ImageFile[] = [];
    for (const file of Array.from(files)) {
      try {
        if (file instanceof File) {
          const processed = await processFile(file);
          newImages.push(processed);
        }
      } catch (error) {
        console.error("Error processing file:", error);
      }
    }
    onImagesChange([...images, ...newImages].slice(0, maxFiles));
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };
  
  return (
    <div className="bg-gray-800 p-3 rounded-lg flex items-center gap-4">
      <div className="text-gray-400">{icon}</div>
      <div className="flex-grow">
        <input
            type="file"
            ref={inputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple={maxFiles > 1}
            className="hidden"
            disabled={isDisabled}
        />
        <button onClick={() => inputRef.current?.click()} className="text-left" disabled={isDisabled || images.length >= maxFiles}>
            <p className="font-semibold text-white">Click / Drop [{title}]</p>
            <p className="text-sm text-gray-500">{description}</p>
        </button>
      </div>
      <div className="flex gap-2">
        {images.map((image, index) => (
            <div key={index} className="relative w-16 h-16">
                <img src={image.base64} alt={image.name} className="w-full h-full object-cover rounded-md" />
                <button onClick={() => removeImage(index)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">&times;</button>
            </div>
        ))}
      </div>
    </div>
  );
};

type Mode = 'elements' | 'restyle' | 'text-to-image';

const ImageReferenceGenerator: React.FC = () => {
    const [mode, setMode] = useState<Mode>('elements');
    
    // State for 'elements' mode
    const [subjectImages, setSubjectImages] = useState<ImageFile[]>([]);
    const [sceneImages, setSceneImages] = useState<ImageFile[]>([]);
    const [styleImages, setStyleImages] = useState<ImageFile[]>([]);

    // State for 'restyle' mode
    const [restyleOriginalImage, setRestyleOriginalImage] = useState<ImageFile[]>([]);
    const [restyleStyleImage, setRestyleStyleImage] = useState<ImageFile[]>([]);

    // Shared state
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (subjectImages.length === 0 && sceneImages.length === 0 && styleImages.length === 0) {
            setError('Please upload at least one image element.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const result = await generateImageFromElements({
                subject: subjectImages,
                scene: sceneImages,
                style: styleImages,
                prompt: `${prompt} Ensure the final image has a ${aspectRatio} aspect ratio.`
            });
            setGeneratedImage(result);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Generation failed: ${errorMessage}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestyleGenerate = async () => {
        if (restyleOriginalImage.length === 0 || restyleStyleImage.length === 0) {
            setError('Please upload an original image and a style image.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const result = await restyleImage(
                restyleOriginalImage[0],
                restyleStyleImage[0],
                `${prompt} Ensure the final image has a ${aspectRatio} aspect ratio.`
            );
            setGeneratedImage(result);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Generation failed: ${errorMessage}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTextToImageGenerate = async () => {
        if (!prompt) {
            setError('Please enter a prompt to generate an image.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        // API Key check for high resolution image generation which uses the Pro model
        if (aspectRatio === '4096x832') {
            try {
                const win = window as any;
                if (win.aistudio && win.aistudio.hasSelectedApiKey) {
                    const hasKey = await win.aistudio.hasSelectedApiKey();
                    if (!hasKey) {
                        await win.aistudio.openSelectKey();
                    }
                }
            } catch (err) {
                console.warn('API Key selection check failed:', err);
            }
        }

        try {
            const result = await generateImageFromText(prompt, aspectRatio);
            setGeneratedImage(result);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Generation failed: ${errorMessage}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Controls Column */}
      <div className="flex flex-col space-y-6">
        <h1 className="text-2xl font-bold text-white">AI Image Generator</h1>
        <div className="flex border-b border-gray-700">
            <button onClick={() => setMode('text-to-image')} className={`py-2 px-4 text-sm font-medium transition-colors ${mode === 'text-to-image' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}>Text to Image</button>
            <button onClick={() => setMode('elements')} className={`py-2 px-4 text-sm font-medium transition-colors ${mode === 'elements' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}>Image Reference</button>
            <button onClick={() => setMode('restyle')} className={`py-2 px-4 text-sm font-medium transition-colors ${mode === 'restyle' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}>Restyle</button>
        </div>
        
        {mode === 'elements' && (
            <>
                <div className="flex gap-2">
                    <button className="py-1 px-3 text-sm rounded-md bg-gray-700 text-gray-300" disabled>Single Reference</button>
                    <button className="py-1 px-3 text-sm rounded-md bg-gray-600 text-white">Elements</button>
                </div>
                <p className="text-sm text-gray-400">Please upload at least 1 Element.</p>
                <div className="space-y-4">
                    <ElementUploader 
                        icon={<PersonIcon className="w-6 h-6" />}
                        title="Subject"
                        description="Select up to 4"
                        images={subjectImages}
                        onImagesChange={setSubjectImages}
                        maxFiles={4}
                        isDisabled={isLoading}
                    />
                    <ElementUploader 
                        icon={<LocationIcon className="w-6 h-6" />}
                        title="Scene"
                        description="Select up to 1"
                        images={sceneImages}
                        onImagesChange={setSceneImages}
                        maxFiles={1}
                        isDisabled={isLoading}
                    />
                    <ElementUploader 
                        icon={<StarIcon className="w-6 h-6" />}
                        title="Style"
                        description="Select up to 1"
                        images={styleImages}
                        onImagesChange={setStyleImages}
                        maxFiles={1}
                        isDisabled={isLoading}
                    />
                </div>
            </>
        )}

        {mode === 'restyle' && (
            <>
                <p className="text-sm text-gray-400">Upload an image and a style reference to combine them.</p>
                <div className="space-y-4">
                    <ElementUploader 
                        icon={<ImageIcon className="w-6 h-6" />}
                        title="Original Image"
                        description="Select 1 image to restyle"
                        images={restyleOriginalImage}
                        onImagesChange={setRestyleOriginalImage}
                        maxFiles={1}
                        isDisabled={isLoading}
                    />
                    <ElementUploader 
                        icon={<StarIcon className="w-6 h-6" />}
                        title="Style Image"
                        description="Select 1 style reference"
                        images={restyleStyleImage}
                        onImagesChange={setRestyleStyleImage}
                        maxFiles={1}
                        isDisabled={isLoading}
                    />
                </div>
            </>
        )}

        {mode === 'text-to-image' && (
            <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 flex flex-col items-center text-center space-y-4">
                <div className="bg-gray-700 p-3 rounded-full">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                    <h3 className="text-lg font-medium text-white">Create from Text</h3>
                    <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
                        Describe your imagination in detail below. Specify style, lighting, and composition for best results.
                    </p>
                </div>
            </div>
        )}
        
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{mode === 'text-to-image' ? 'Prompt' : 'Prompt (Optional)'}</label>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === 'text-to-image' ? "A futuristic city with neon lights at night..." : "Add more details about your desired image..."}
                className="w-full h-24 p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={isLoading}
            />
        </div>
        
        <div className="flex items-center gap-4">
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200"
              disabled={isLoading}
            >
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
              <option value="1:1">1:1</option>
              <option value="3:4">3:4</option>
              <option value="4:3">4:3</option>
              <option value="4096x832">Banner (4096x832)</option>
            </select>
            <button
                onClick={
                    mode === 'elements' ? handleGenerate : 
                    mode === 'restyle' ? handleRestyleGenerate :
                    handleTextToImageGenerate
                }
                disabled={isLoading}
                className="flex-grow px-6 py-3 border border-transparent text-lg font-medium rounded-md shadow-sm text-gray-900 bg-lime-500 hover:bg-lime-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-lime-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? 'Generating...' : 'Generate'}
            </button>
        </div>
        {error && <div className="text-center text-red-400 bg-red-900/50 p-3 rounded-lg" role="alert">{error}</div>}
      </div>

      {/* Result Column */}
      <div className="flex flex-col">
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg flex-grow">
            <h2 className="text-xl font-semibold text-white mb-4">Result</h2>
            <ResultDisplay
              imageSrc={generatedImage}
              isLoading={isLoading}
              placeholderText="Your generated image will appear here"
              loadingText={
                mode === 'elements' ? "Combining elements..." : 
                mode === 'restyle' ? "Restyling image..." :
                "Generating image..."
              }
            />
          </div>
      </div>
    </div>
  );
};

export default ImageReferenceGenerator;
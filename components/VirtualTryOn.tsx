import React, { useState, useRef } from 'react';
import type { ImageFile } from '../types';
import { virtualTryOn, virtualTryOnMultiple } from '../services/geminiService';
import ResultDisplay from './ResultDisplay';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { InfoIcon } from './icons/InfoIcon';
import { GarmentUploadIcon } from './icons/GarmentUploadIcon';
import { RefreshIcon } from './icons/RefreshIcon';

// --- Helper Functions ---
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

const urlToImageFile = async (url: string, filename: string): Promise<ImageFile> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}. Status: ${response.status}`);
    }
    const blob = await response.blob();
    const mimeType = blob.type;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve({ base64: reader.result, mimeType, name: filename });
            } else {
                reject(new Error('Failed to read blob as Data URL.'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};


const DEFAULT_MODELS = [
    { id: 'm1', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/model1.png', alt: 'Male model 1' },
    { id: 'm2', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/model2.png', alt: 'Male model 2' },
    { id: 'm3', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/model3.png', alt: 'Male model 3' },
    { id: 'm4', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/model4.png', alt: 'Male model 4' },
    { id: 'm5', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/model5.png', alt: 'Male model 5' },
    { id: 'm6', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/model6.png', alt: 'Male model 6' },
    { id: 'f1', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/model7.png', alt: 'Female model 1' },
    { id: 'f2', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/model8.png', alt: 'Female model 2' },
];

const DEFAULT_HINTS = [
    { id: 'g1', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/garment1.png', alt: 'Black dress' },
    { id: 'g2', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/garment2.png', alt: 'Pink sweater' },
    { id: 'g3', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/garment3.png', alt: 'Beige shirt' },
    { id: 'g4', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/garment4.png', alt: 'Grey hoodie' },
    { id: 'g5', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/garment5.png', alt: 'Blue jeans' },
    { id: 'g6', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/garment6.png', alt: 'Leather jacket' },
    { id: 'g7', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/garment7.png', alt: 'Summer dress' },
    { id: 'g8', url: 'https://storage.googleapis.com/aistudio-ux-team-public/sdk-samples/try-on/garment8.png', alt: 'T-shirt' },
];

// Shuffles an array and returns a new shuffled array.
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const VirtualTryOn: React.FC = () => {
    const [activeVtoTab, setActiveVtoTab] = useState<'virtualModel' | 'tryOn'>('tryOn');
    const [modelMode, setModelMode] = useState<'default' | 'upload'>('default');
    const [garmentMode, setGarmentMode] = useState<'single' | 'multiple'>('single');

    const [selectedModelUrl, setSelectedModelUrl] = useState<string>(DEFAULT_MODELS[0].url);
    const [uploadedModel, setUploadedModel] = useState<ImageFile | null>(null);

    const [garmentImage, setGarmentImage] = useState<ImageFile | null>(null);
    const [multipleGarments, setMultipleGarments] = useState<ImageFile[]>([]);

    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedHintId, setSelectedHintId] = useState<string | null>(null);

    // --- New State for UI interactivity ---
    const [activeFilter, setActiveFilter] = useState<'all' | 'images' | 'videos' | 'audio'>('all');
    const [showFavorites, setShowFavorites] = useState(false);
    const [displayHints, setDisplayHints] = useState(() => shuffleArray(DEFAULT_HINTS).slice(0, 4));

    const modelInputRef = useRef<HTMLInputElement>(null);
    const garmentInputRef = useRef<HTMLInputElement>(null);
    const multiGarmentInputRef = useRef<HTMLInputElement>(null);

    const handleModelFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const processed = await processFile(file);
                setUploadedModel(processed);
                setSelectedModelUrl(''); // Deselect default model
            } catch (err) {
                setError('Failed to process model image.');
                console.error(err);
            }
        }
    };

    const handleGarmentFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedHintId(null);
            try {
                const processed = await processFile(file);
                setGarmentImage(processed);
            } catch (err) {
                setError('Failed to process garment image.');
                console.error(err);
            }
        }
    };

    const handleMultiGarmentFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const processedFiles: ImageFile[] = [];
            for (const file of Array.from(files)) {
                try {
                    // FIX: Add a type guard to ensure the item from the FileList is a File object.
                    // This resolves a TypeScript error where `file` was inferred as `unknown`.
                    if (file instanceof File) {
                        processedFiles.push(await processFile(file));
                    }
                } catch (err) {
                    console.error('Failed to process one of the garment files:', err);
                }
            }
            setMultipleGarments(prev => [...prev, ...processedFiles]);
        }
    };

    const removeMultiGarment = (index: number) => {
        setMultipleGarments(prev => prev.filter((_, i) => i !== index));
    };

    const handleHintClick = async (hint: typeof DEFAULT_HINTS[0]) => {
        try {
            setSelectedHintId(hint.id);
            const imageFile = await urlToImageFile(hint.url, hint.alt);
            setGarmentImage(imageFile);
        } catch (err) {
            setError('Could not load hint image.');
            console.error(err);
            setSelectedHintId(null);
        }
    };

    const handleRefreshHints = () => {
        setDisplayHints(shuffleArray(DEFAULT_HINTS).slice(0, 4));
    };
    
    const handleGenerateClick = async () => {
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);
    
        try {
            const finalModelImageFile = modelMode === 'upload'
                ? uploadedModel
                : await urlToImageFile(selectedModelUrl, 'model.jpg');
    
            if (!finalModelImageFile) {
                setError('A model image is required.');
                setIsLoading(false);
                return;
            }
    
            let result: string;
            if (garmentMode === 'single') {
                if (!garmentImage) {
                    setError('Please upload a garment image.');
                    setIsLoading(false);
                    return;
                }
                result = await virtualTryOn(finalModelImageFile, garmentImage);
            } else { // multiple garments
                if (multipleGarments.length === 0) {
                    setError('Please upload at least one garment image for the outfit.');
                    setIsLoading(false);
                    return;
                }
                result = await virtualTryOnMultiple(finalModelImageFile, multipleGarments);
            }
            setGeneratedImage(result);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Generation failed: ${errorMessage}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const getFilterClass = (filter: typeof activeFilter) => {
        return activeFilter === filter
          ? 'bg-gray-700 text-white'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700';
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Controls */}
            <div className="flex flex-col space-y-6 bg-gray-900 text-gray-300">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-white">AI Virtual Try-On Generator</h1>
                    <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
                        <BookOpenIcon className="h-5 w-5" />
                        User Guide
                    </button>
                </div>

                <div className="border-b border-gray-700">
                    <button
                        onClick={() => setActiveVtoTab('virtualModel')}
                        className={`py-2 px-4 text-sm font-medium transition-colors ${activeVtoTab === 'virtualModel' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Virtual Model
                    </button>
                    <button
                        onClick={() => setActiveVtoTab('tryOn')}
                        className={`py-2 px-4 text-sm font-medium transition-colors ${activeVtoTab === 'tryOn' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        AI Virtual Try-On
                    </button>
                </div>
                
                {activeVtoTab === 'tryOn' ? (
                    <>
                        {/* Model Selection */}
                        <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-4">
                                    <h2 className="font-semibold text-white">Virtual Model</h2>
                                    <button onClick={() => setModelMode('default')} className={`px-3 py-1 text-sm rounded-md ${modelMode === 'default' ? 'bg-gray-600' : 'bg-gray-700 text-gray-400'}`}>Default</button>
                                    <button onClick={() => setModelMode('upload')} className={`px-3 py-1 text-sm rounded-md ${modelMode === 'upload' ? 'bg-gray-600' : 'bg-gray-700 text-gray-400'}`}>Upload</button>
                                </div>
                                <button className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                                    <InfoIcon className="h-4 w-4" />
                                    Guideline
                                </button>
                            </div>
                            {modelMode === 'default' ? (
                                <div className="grid grid-cols-4 gap-2">
                                    {DEFAULT_MODELS.map(model => (
                                        <button key={model.id} onClick={() => { setSelectedModelUrl(model.url); setUploadedModel(null); }} className={`rounded-md overflow-hidden aspect-[3/4] border-2 transition-colors ${selectedModelUrl === model.url ? 'border-lime-500' : 'border-transparent hover:border-gray-500'}`}>
                                            <img src={model.url} alt={model.alt} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div>
                                    <input type="file" ref={modelInputRef} onChange={handleModelFileChange} accept="image/*" className="hidden" />
                                    <div onClick={() => modelInputRef.current?.click()} className="w-full h-64 bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-600 hover:border-lime-500 transition-colors">
                                        {uploadedModel ? (
                                            <img src={uploadedModel.base64} alt="Uploaded model" className="max-w-full max-h-full object-contain p-2" />
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                <GarmentUploadIcon className="mx-auto h-10 w-10" />
                                                <p className="mt-2 font-semibold">Upload Model Image</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Garment Upload */}
                        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setGarmentMode('single')} className={`px-3 py-1 text-sm rounded-md ${garmentMode === 'single' ? 'bg-gray-600' : 'bg-gray-700 text-gray-400'}`}>Single Garment</button>
                                    <button onClick={() => setGarmentMode('multiple')} className={`px-3 py-1 text-sm rounded-md ${garmentMode === 'multiple' ? 'bg-gray-600' : 'bg-gray-700 text-gray-400'}`}>Multiple Garments</button>
                                </div>
                                <button className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                                    <InfoIcon className="h-4 w-4" />
                                    Guideline
                                </button>
                            </div>
                            {garmentMode === 'single' ? (
                                <>
                                    <input type="file" ref={garmentInputRef} onChange={handleGarmentFileChange} accept="image/*" className="hidden" />
                                    <div onClick={() => garmentInputRef.current?.click()} className="w-full h-40 bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-600 hover:border-lime-500 transition-colors">
                                        {garmentImage ? (
                                            <img src={garmentImage.base64} alt="Garment" className="max-w-full max-h-full object-contain p-2" />
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                <GarmentUploadIcon className="mx-auto h-10 w-10" />
                                                <p className="mt-2 font-semibold">Upload Single Garment</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-400">Hints:</span>
                                        <div className="flex-grow flex items-center gap-2">
                                            {displayHints.map(hint => (
                                                <button key={hint.id} onClick={() => handleHintClick(hint)} className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-colors ${selectedHintId === hint.id ? 'border-lime-500' : 'border-transparent hover:border-gray-500'} focus:outline-none focus:border-lime-500`}>
                                                    <img src={hint.url} alt={hint.alt} className="w-full h-full object-cover"/>
                                                </button>
                                            ))}
                                        </div>
                                        <button onClick={handleRefreshHints} className="p-1 rounded-full hover:bg-gray-700 transition-colors" aria-label="Refresh hints">
                                            <RefreshIcon className="h-5 w-5 text-gray-400" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div>
                                     <input type="file" ref={multiGarmentInputRef} onChange={handleMultiGarmentFileChange} accept="image/*" className="hidden" multiple />
                                     <div className="grid grid-cols-4 gap-2 min-h-[120px]">
                                        {multipleGarments.map((garment, index) => (
                                            <div key={index} className="relative w-full aspect-square">
                                                <img src={garment.base64} alt={`Garment ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                                                <button onClick={() => removeMultiGarment(index)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">&times;</button>
                                            </div>
                                        ))}
                                        <button onClick={() => multiGarmentInputRef.current?.click()} className="w-full aspect-square bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-600 hover:border-lime-500 transition-colors">
                                            <div className="text-center text-gray-400 text-2xl">+</div>
                                        </button>
                                     </div>
                                </div>
                            )}
                        </div>

                        {/* Generate Button */}
                        <div className="flex items-center gap-4 pt-4">
                            <select className="p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200" disabled={isLoading}>
                                <option>4 Outputs</option>
                            </select>
                            <button
                                onClick={handleGenerateClick}
                                disabled={isLoading}
                                className="flex-grow py-3 bg-lime-500 text-gray-900 font-bold rounded-lg hover:bg-lime-400 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoading ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                        {error && <div className="text-center text-red-400 bg-red-900/ ৫০ p-3 rounded-lg" role="alert">{error}</div>}
                    </>
                ) : (
                    <div className="flex-grow flex items-center justify-center bg-gray-800 rounded-lg p-4 mt-4">
                        <p className="text-gray-500 text-center">
                            The "Virtual Model" feature allows you to create new AI-generated models.<br/>This functionality is coming soon.
                        </p>
                    </div>
                )}
            </div>

            {/* Result */}
            <div className="flex flex-col">
                <div className="flex justify-end items-center mb-4 text-gray-400">
                    <button onClick={() => setActiveFilter('all')} className={`px-3 py-1 text-sm rounded-l-md transition-colors ${getFilterClass('all')}`}>All</button>
                    <button onClick={() => setActiveFilter('images')} className={`px-3 py-1 text-sm transition-colors ${getFilterClass('images')}`}>Images</button>
                    <button onClick={() => setActiveFilter('videos')} className={`px-3 py-1 text-sm transition-colors ${getFilterClass('videos')}`}>Videos</button>
                    <button onClick={() => setActiveFilter('audio')} className={`px-3 py-1 text-sm rounded-r-md transition-colors ${getFilterClass('audio')}`}>Audio</button>
                    <div className="ml-4 flex items-center">
                        <input 
                            type="checkbox" 
                            id="favorites"
                            checked={showFavorites}
                            onChange={(e) => setShowFavorites(e.target.checked)}
                            className="w-4 h-4 bg-gray-800 border-gray-600 rounded text-lime-500 focus:ring-lime-500" 
                        />
                        <label htmlFor="favorites" className="ml-2 text-sm select-none">Favorites</label>
                    </div>
                </div>
                 <div className="bg-gray-800 rounded-xl p-6 shadow-lg flex-grow">
                    <h2 className="text-xl font-semibold text-white mb-4">Result</h2>
                    <ResultDisplay
                        imageSrc={generatedImage}
                        isLoading={isLoading}
                        placeholderText="Your try-on result will appear here"
                        loadingText="Generating your virtual try-on..."
                    />
                </div>
            </div>
        </div>
    );
};

export default VirtualTryOn;
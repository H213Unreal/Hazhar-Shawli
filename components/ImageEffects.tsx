import React, { useState, useMemo, useRef } from 'react';
import type { ImageFile } from '../types';
import { editImage } from '../services/geminiService';
import { DownloadIcon } from './icons/DownloadIcon';

const EFFECTS = [
    { id: 'halloween', name: 'Halloween Look', category: 'Halloween', thumbnail: 'https://placehold.co/400x400/111827/9CA3AF/png?text=Halloween', prompt: 'Transform the person into a spooky character for Halloween, with dramatic makeup, costume, and a haunted background.' },
    { id: 'pet-vlogger', name: 'Pet Vlogger', category: 'Fun Flip', thumbnail: 'https://placehold.co/400x400/111827/9CA3AF/png?text=Pet+Vlogger', prompt: 'Reimagine the person as a cute pet vlogging in Paris, with the Eiffel Tower in the background. The pet should be wearing a beret.' },
    { id: 'guardian-spirit', name: 'Guardian Spirit', category: 'Chic Look', thumbnail: 'https://placehold.co/400x400/111827/9CA3AF/png?text=Guardian', prompt: 'Turn the person into a divine guardian spirit with large, glowing wings and ethereal armor, set in a mystical, heavenly landscape.' },
    { id: 'cosmic-view', name: 'Cosmic View', category: 'Shot Flow', thumbnail: 'https://placehold.co/400x400/111827/9CA3AF/png?text=Cosmic', prompt: 'Place the person in a futuristic astronaut suit, floating in space with a breathtaking view of planet Earth from orbit.' },
    { id: 'stadium-star', name: 'Stadium Star', category: 'Laugh Hype', thumbnail: 'https://placehold.co/400x400/111827/9CA3AF/png?text=Stadium', prompt: 'Place the person in a packed sports stadium, cheering enthusiastically as a dedicated fan. Add dynamic lighting and a sense of excitement.' },
    { id: 'retro-dancer', name: 'Retro Dancer', category: 'Move Groove', thumbnail: 'https://placehold.co/400x400/111827/9CA3AF/png?text=Retro', prompt: 'Transform the person into a 70s disco dancer with retro clothing, an afro hairstyle, and place them on a vibrant, flashing dance floor.' },
];

const CATEGORIES = ['All', ...Array.from(new Set(EFFECTS.map(e => e.category)))];

const ImageEffects: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEffect, setSelectedEffect] = useState<(typeof EFFECTS[0]) | null>(EFFECTS[0]);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredEffects = useMemo(() => {
        if (activeCategory === 'All') {
            return EFFECTS;
        }
        return EFFECTS.filter(effect => effect.category === activeCategory);
    }, [activeCategory]);
    
    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (!dataUrl) return;

            const img = new Image();
            img.onload = () => {
                const MAX_DIMENSION = 1024;
                let { width, height } = img;
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
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
                    setOriginalImage({ base64: dataUrl, mimeType: file.type, name: file.name });
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                const outputMimeType = 'image/jpeg';
                const resizedDataUrl = canvas.toDataURL(outputMimeType, 0.9);
                setOriginalImage({ base64: resizedDataUrl, mimeType: outputMimeType, name: file.name });
            };
            img.onerror = () => {
                setOriginalImage({ base64: dataUrl, mimeType: file.type, name: file.name });
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processFile(file);
            setGeneratedImage(null);
            setError(null);
        }
    };

    const handleGenerateClick = async () => {
        if (!originalImage || !selectedEffect) {
            setError('Please upload an image and select an effect.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);
        try {
            const resultImage = await editImage(originalImage, selectedEffect.prompt);
            setGeneratedImage(resultImage);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Generation failed: ${errorMessage}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveImage = () => {
        if (!generatedImage || !originalImage) return;
        const link = document.createElement('a');
        link.href = generatedImage;
        const mimeType = generatedImage.match(/^data:(.*);base64,/)?.[1] || 'image/png';
        const extension = mimeType.split('/')[1] || 'png';
        const originalName = originalImage.name;
        const nameWithoutExtension = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
        link.download = `${nameWithoutExtension}-${selectedEffect?.id || 'effect'}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Panel */}
            <div className="lg:col-span-1 flex flex-col space-y-6">
                <h2 className="text-2xl font-bold text-white">Effects</h2>
                
                <div className="bg-gray-800 rounded-xl p-4 space-y-4">
                    <h3 className="font-semibold text-white">Select an effect</h3>
                    {selectedEffect ? (
                        <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <img src={selectedEffect.thumbnail} alt={selectedEffect.name} className="h-12 w-12 rounded-md object-cover" />
                                <span className="font-medium text-white">{selectedEffect.name}</span>
                            </div>
                            <button className="text-2xl text-gray-400 hover:text-white transition-colors" aria-label="Change effect">⇄</button>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-6">
                            <p>Choose an effect from the gallery</p>
                        </div>
                    )}
                </div>

                {generatedImage ? (
                     <div className="bg-gray-800 rounded-xl p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-white">Result</h3>
                            <button onClick={handleSaveImage} className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"><DownloadIcon className="h-4 w-4" /><span>Save</span></button>
                        </div>
                        <div className="w-full aspect-square bg-gray-700/50 rounded-lg flex items-center justify-center relative overflow-hidden">
                            {isLoading ? (
                                <div className="absolute inset-0 bg-gray-900/50 flex flex-col items-center justify-center z-10">
                                    <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <p className="mt-3 text-white">Generating...</p>
                                </div>
                            ) : (
                                <img src={generatedImage} alt="Generated result" className="max-w-full max-h-full object-contain" />
                            )}
                        </div>
                        <button onClick={() => { setGeneratedImage(null); setOriginalImage(null); }} className="w-full text-center py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">Create New</button>
                    </div>
                ) : (
                    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
                        <div className="bg-gray-700/50 rounded-lg p-3 flex items-center gap-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6a4 4 0 1 1-8 0a4 4 0 0 1 8 0ZM12 14a6 6 0 0 0-6 6a1 1 0 1 0 2 0a4 4 0 0 1 4-4a4 4 0 0 1 4 4a1 1 0 1 0 2 0a6 6 0 0 0-6-6Z" /></svg>
                            <div>
                                <p className="font-semibold text-white">Please use a single-person image</p>
                                <p className="text-sm text-gray-400">Clear, unobstructed frontal shot</p>
                            </div>
                        </div>
                        
                        <input type="file" ref={inputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                        <div onClick={() => inputRef.current?.click()} className="w-full h-40 bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-600 hover:border-blue-500 transition-colors">
                            {originalImage ? (
                                <img src={originalImage.base64} alt={originalImage.name} className="max-w-full max-h-full object-contain rounded-md p-2" />
                            ) : (
                                <div className="text-center text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                    <p className="mt-2 text-sm font-semibold">Click / Drop / Paste</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                <button onClick={handleGenerateClick} disabled={!originalImage || !selectedEffect || isLoading} className="w-full py-3 bg-lime-500 text-gray-900 font-bold rounded-lg hover:bg-lime-400 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors">
                    {isLoading ? 'Generating...' : 'Generate'}
                </button>
                {error && <div className="text-center text-red-400 bg-red-900/50 p-3 rounded-lg" role="alert">{error}</div>}
            </div>

            {/* Right Panel */}
            <div className="lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Effects</h2>
                    <button className="text-2xl text-gray-500 hover:text-white transition-colors" aria-label="Close effects panel">✕</button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pb-4">
                    {CATEGORIES.map(category => (
                        <button key={category} onClick={() => setActiveCategory(category)} className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${activeCategory === category ? 'bg-gray-200 text-gray-900' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                            {category}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredEffects.map(effect => (
                        <div key={effect.id} onClick={() => setSelectedEffect(effect)} className="aspect-square rounded-xl overflow-hidden relative cursor-pointer group" role="button">
                             <img src={effect.thumbnail} alt={effect.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                             <div className={`absolute inset-0 border-4 ${selectedEffect?.id === effect.id ? 'border-lime-500' : 'border-transparent'} rounded-xl transition-all`}></div>
                             <p className="absolute bottom-3 left-3 font-bold text-white">{effect.name}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ImageEffects;

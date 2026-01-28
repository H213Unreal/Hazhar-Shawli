
import React, { useState, useEffect } from 'react';
import ImageEditor from './components/ImageEditor';
import TTS from './components/TTS';
import AudioTranscriber from './components/AudioTranscriber';
import ImageUpscaler from './components/ImageUpscaler';
import Conversation from './components/Conversation';
import ImageSizer from './components/ImageSizer';
import ImageEffects from './components/ImageEffects';
import ImageReferenceGenerator from './components/ImageReferenceGenerator';
import VirtualTryOn from './components/VirtualTryOn';
import FaceSwap from './components/FaceSwap';
import PromptExtractor from './components/PromptExtractor';
import { translations, Language } from './translations';

type Tab = 'imageEditor' | 'tts' | 'transcriber' | 'upscaler' | 'conversation' | 'imageSizer' | 'imageEffects' | 'imageReference' | 'virtualTryOn' | 'faceSwap' | 'promptExtractor';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('faceSwap');
  const [lang, setLang] = useState<Language>('fa');

  const t = translations[lang];

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tts': return <TTS />;
      case 'transcriber': return <AudioTranscriber />;
      case 'upscaler': return <ImageUpscaler />;
      case 'imageSizer': return <ImageSizer lang={lang} />;
      case 'promptExtractor': return <PromptExtractor lang={lang} />;
      case 'conversation': return <Conversation />;
      case 'imageEffects': return <ImageEffects />;
      case 'imageReference': return <ImageReferenceGenerator />;
      case 'virtualTryOn': return <VirtualTryOn />;
      case 'faceSwap': return <FaceSwap lang={lang} />;
      case 'imageEditor':
      default: return <ImageEditor />;
    }
  };

  const getTabClass = (tab: Tab) => {
    return activeTab === tab
      ? 'bg-blue-600 text-white shadow-lg scale-105'
      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans selection:bg-blue-500/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="flex flex-col items-center mb-12 relative">
          {/* Language Switcher */}
          <div className="absolute top-0 right-0 flex gap-2">
             {(['fa', 'en', 'ar', 'ku'] as Language[]).map((l) => (
               <button
                 key={l}
                 onClick={() => setLang(l)}
                 className={`px-3 py-1 rounded text-xs font-bold transition-all ${lang === l ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
               >
                 {l.toUpperCase()}
               </button>
             ))}
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-lime-400">
            {t.title}
          </h1>
          <p className="mt-4 max-w-2xl text-center text-lg text-gray-400 leading-relaxed">
            {t.subtitle}
          </p>
        </header>

        <nav className="mb-12 flex justify-center flex-wrap gap-3 sm:gap-4 border-b border-gray-800 pb-6">
          <button onClick={() => setActiveTab('faceSwap')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('faceSwap')}`}>
            {t.tabs.faceSwap}
          </button>
          <button onClick={() => setActiveTab('promptExtractor')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('promptExtractor')}`}>
            {t.tabs.promptExtractor}
          </button>
          <button onClick={() => setActiveTab('conversation')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('conversation')}`}>
            {t.tabs.conversation}
          </button>
          <button onClick={() => setActiveTab('virtualTryOn')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('virtualTryOn')}`}>
            {t.tabs.tryOn}
          </button>
          <button onClick={() => setActiveTab('imageReference')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('imageReference')}`}>
            {t.tabs.reference}
          </button>
          <button onClick={() => setActiveTab('imageEditor')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('imageEditor')}`}>
            {t.tabs.editor}
          </button>
          <button onClick={() => setActiveTab('imageEffects')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('imageEffects')}`}>
            {t.tabs.effects}
          </button>
          <button onClick={() => setActiveTab('upscaler')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('upscaler')}`}>
            {t.tabs.upscaler}
          </button>
          <button onClick={() => setActiveTab('imageSizer')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('imageSizer')}`}>
            {t.tabs.sizer}
          </button>
          <button onClick={() => setActiveTab('tts')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('tts')}`}>
            {t.tabs.tts}
          </button>
          <button onClick={() => setActiveTab('transcriber')} className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${getTabClass('transcriber')}`}>
            {t.tabs.transcriber}
          </button>
        </nav>

        <section className="bg-gray-800/20 backdrop-blur-sm rounded-3xl p-2 sm:p-6 border border-gray-800 shadow-2xl">
          {renderTabContent()}
        </section>
      </main>
    </div>
  );
};

export default App;


import { GoogleGenAI, GenerateContentResponse, Modality } from '@google/genai';
import type { ImageFile } from '../types';

export const extractPromptFromImage = async (image: ImageFile): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error('API_KEY environment variable not set.');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = image.base64.split(',')[1];

  const instruction = `CRITICAL VISION ANALYSIS TASK:
Analyze this image and provide a highly detailed, professional AI generative prompt that would recreate this exact image.
Your description MUST include:
1. SUBJECT: Physical attributes, clothing, expression, and posture.
2. STYLE: Artistic medium (e.g., photorealistic, digital art, oil painting, 3D render), and historical or modern influences.
3. COMPOSITION: Camera angle (e.g., close-up, wide shot), framing, and focus.
4. LIGHTING & COLOR: Source of light, shadows, color palette, and atmospheric effects.
5. BACKGROUND: Environment details, objects, and depth.
Output the final prompt in a clear, concise paragraph followed by a list of descriptive keywords.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: image.mimeType } },
        { text: instruction },
      ],
    },
  });

  return response.text || 'Could not extract prompt.';
};

export const generativeResize = async (image: ImageFile, width: number, height: number): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const ratio = width / height;
  let aspectRatio = "1:1";
  if (ratio > 1.5) aspectRatio = "16:9";
  else if (ratio > 1.2) aspectRatio = "4:3";
  else if (ratio < 0.6) aspectRatio = "9:16";
  else if (ratio < 0.8) aspectRatio = "3:4";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: image.base64.split(',')[1], mimeType: image.mimeType } },
        { text: `Outpaint and expand this image to ${aspectRatio} without stretching objects.` },
      ],
    },
    config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspectRatio as any } },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Resize failed.');
};

export const editImage = async (image: ImageFile, prompt: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: image.base64.split(',')[1], mimeType: image.mimeType } },
        { text: prompt },
      ],
    },
    config: { responseModalities: ['IMAGE'] },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Edit failed.');
};

export const faceSwap = async (sourceFace: ImageFile, targetImage: ImageFile): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        { text: "SOURCE IDENTITY (Use this face):" },
        { inlineData: { data: sourceFace.base64.split(',')[1], mimeType: sourceFace.mimeType } },
        { text: "TARGET BASE (Keep everything else):" },
        { inlineData: { data: targetImage.base64.split(',')[1], mimeType: targetImage.mimeType } },
        { text: "Replace target's face with source's face seamlessly." },
      ],
    },
    config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: "1:1" } },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Face swap failed.');
};

export const generateImageFromText = async (prompt: string, aspectRatio: string = '1:1'): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let model = 'gemini-2.5-flash-image';
  let imageConfig: any = { aspectRatio };
  if (aspectRatio === '4096x832') {
    model = 'gemini-3-pro-image-preview';
    imageConfig = { imageSize: '4K', aspectRatio: '16:9' };
  }
  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: { responseModalities: ['IMAGE'], imageConfig },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Generation failed.');
};

/* Updated generateSpeech to accept a language parameter to fix argument mismatch errors in TTS component */
export const generateSpeech = async (text: string, voice: string, language?: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use language in the prompt for better results if provided
  const prompt = language && language !== 'Auto' 
    ? `Speak the following text in ${language}: ${text}`
    : text;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
};

export const upscaleImage = async (image: ImageFile): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: image.base64.split(',')[1], mimeType: image.mimeType } },
        { text: "Upscale this image, enhancing resolution and details." },
      ],
    },
    config: { responseModalities: ['IMAGE'] },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Upscaling failed.');
};

export const generateImageFromElements = async (payload: any): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { subject, scene, style, prompt } = payload;
  const parts: any[] = [{ text: `Generate image combining subject, scene, style. ${prompt}` }];
  [...subject, ...scene, ...style].forEach(img => parts.push({ inlineData: { data: img.base64.split(',')[1], mimeType: img.mimeType } }));
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { responseModalities: ['IMAGE'] },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Generation failed.');
};

export const restyleImage = async (original: ImageFile, style: ImageFile, prompt: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: original.base64.split(',')[1], mimeType: original.mimeType } },
        { inlineData: { data: style.base64.split(',')[1], mimeType: style.mimeType } },
        { text: `Apply style to original. ${prompt}` },
      ],
    },
    config: { responseModalities: ['IMAGE'] },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Restyle failed.');
};

export const virtualTryOn = async (model: ImageFile, garment: ImageFile): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: model.base64.split(',')[1], mimeType: model.mimeType } },
        { inlineData: { data: garment.base64.split(',')[1], mimeType: garment.mimeType } },
        { text: "Place garment onto person in model image." },
      ],
    },
    config: { responseModalities: ['IMAGE'] },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Try-on failed.');
};

export const virtualTryOnMultiple = async (model: ImageFile, garments: ImageFile[]): Promise<string> => {
  if (!process.env.API_KEY) throw new Error('API_KEY not set.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [{ inlineData: { data: model.base64.split(',')[1], mimeType: model.mimeType } }];
  garments.forEach(g => parts.push({ inlineData: { data: g.base64.split(',')[1], mimeType: g.mimeType } }));
  parts.push({ text: "Place all garments as an outfit." });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { responseModalities: ['IMAGE'] },
  });
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  throw new Error('Multi try-on failed.');
};

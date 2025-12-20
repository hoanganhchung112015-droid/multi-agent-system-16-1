
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Subject, AgentType } from "../types";
import React from 'react';

// CẤU HÌNH MODEL - Tối ưu cho tốc độ và hiệu năng
const MODEL_CONFIG = {
  TEXT: 'gemini-3-flash-preview',
  TTS: 'gemini-2.5-flash-preview-tts',
  TIMEOUT: 15000 // 15s timeout
};

// CACHING LAYER - "Siêu Tốc Độ"
// Lưu trữ kết quả đã xử lý để không phải gọi lại API
const cache = new Map<string, string>();
const audioCache = new Map<string, string>();

const getCacheKey = (subject: string, agent: string, input: string, imageHash: string = '') => 
  `${subject}|${agent}|${input.trim()}|${imageHash}`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  [AgentType.SPEED]: `Bạn là chuyên gia giải đề thi THPT Quốc gia.
    NHIỆM VỤ: Trả về một đối tượng JSON với hai trường: "finalAnswer" và "casioSteps".
    1. finalAnswer (string): Chỉ đưa ra KẾT QUẢ CUỐI CÙNG (Ví dụ: "Đáp án: A. x = 2", "15 m/s", "$x^2+y^2=R^2$"). TUYỆT ĐỐI KHÔNG giải thích chi tiết các bước.
    2. casioSteps (string): Hướng dẫn NGẮN GỌN NHẤT cách bấm máy tính Casio fx-580VN X để giải quyết bài toán này. Mỗi bước trên một dòng mới, sử dụng ký tự xuống dòng (\\n) để phân tách các bước. Định dạng: [PHÍM] -> [PHÍM]. Không giải thích lý thuyết hay kết quả.
    YÊU CẦU CHUNG: Ngắn gọn, chính xác, chỉ sử dụng từ ngữ chuyên ngành. TUYỆT ĐỐI KHÔNG dùng câu dẫn, văn nói. Luôn sử dụng LaTeX cho công thức toán học và ký hiệu khoa học (ví dụ: $x^2$, $\frac{a}{b}$, $\vec{F}$, $\ce{H2O}$).
    Ví dụ JSON: {"finalAnswer": "Đáp án: A. $x=5$", "casioSteps": "MODE 5 1\\nNhập hệ số A, B, C\\n="}`,
  
  [AgentType.SOCRATIC]: `Bạn là giáo sư Socratic. Hãy giải chi tiết bài toán theo các bước logic chặt chẽ. Ngôn ngữ phải khoa học, cực kỳ ngắn gọn, đi thẳng vào trọng tâm kiến thức thi THPT Quốc gia. TUYỆT ĐỐI KHÔNG dùng câu dẫn, văn nói. Luôn sử dụng LaTeX cho công thức toán học và ký hiệu khoa học.`,
  
  [AgentType.NOTEBOOK]: `Bạn là NotebookLM. Tóm tắt các KIẾN THỨC TRỌNG TÂM liên quan đến bài toán này. Chỉ nêu các ĐỊNH NGHĨA, CÔNG THỨC then chốt. TUYỆT ĐỐI KHÔNG dùng câu dẫn, văn nói. Chỉ đưa ra TỐI ĐA 5 GẠCH ĐẦU DÒNG. Luôn sử dụng LaTeX cho công thức toán học và ký hiệu khoa học.`,
  
  [AgentType.PERPLEXITY]: `Bạn là Perplexity AI. Hãy tìm kiếm và liệt kê DẠNG BÀI TẬP NÂNG CAO (mức độ vận dụng cao) liên quan đến chủ đề bài toán này. Chỉ nêu ĐỀ BÀI, không đưa ra lời giải. TUYỆT ĐỐI KHÔNG dùng câu dẫn, văn nói. Chỉ liệt kê TỐI ĐA 2 DẠNG BÀI. Luôn sử dụng LaTeX cho công thức toán học và ký hiệu khoa học trong đề bài.`,
};

// ERROR HANDLING WRAPPER - "Siêu Chuẩn"
async function safeExecute<T>(fn: () => Promise<T>, fallbackValue: any = null): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    if (error.toString().includes('429')) {
      throw new Error("Hệ thống đang quá tải, vui lòng đợi giây lát.");
    }
    throw error;
  }
}

export const processTask = async (subject: Subject, agent: AgentType, input: string, image?: string) => {
  const cacheKey = getCacheKey(subject, agent, input, image ? 'has_img' : 'no_img');
  
  // Cache Hit - Return instantly (0ms latency)
  if (cache.has(cacheKey)) {
    console.log(`[Cache Hit] ${agent}`);
    return cache.get(cacheKey)!;
  }

  return safeExecute(async () => {
    let promptContent = `Môn: ${subject}. Chuyên gia: ${agent}. Yêu cầu: ${SYSTEM_PROMPTS[agent]}. \nNội dung: ${input}`;
    
    const parts: any[] = [{ text: promptContent }];
    if (image) {
      parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } });
    }

    let resultText = "";

    if (agent === AgentType.SPEED) {
      const response = await ai.models.generateContent({
        model: MODEL_CONFIG.TEXT,
        contents: { parts },
        config: { 
          temperature: 0.1, 
          topP: 0.5,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              finalAnswer: { type: Type.STRING, description: 'Kết quả cuối cùng.' },
              casioSteps: { type: Type.STRING, description: 'Hướng dẫn bấm máy Casio.' }
            },
            required: ["finalAnswer", "casioSteps"]
          }
        }
      });
      resultText = response.text || "";
    } else {
      const response = await ai.models.generateContent({
        model: MODEL_CONFIG.TEXT,
        contents: { parts },
        config: { temperature: 0.1, topP: 0.5 }
      });
      resultText = response.text || "";
    }

    // Save to Cache
    if (resultText) cache.set(cacheKey, resultText);
    return resultText;
  });
};

export const generateSummary = async (content: string) => {
  if (!content) return "";
  const cacheKey = `SUM|${content.substring(0, 50)}`; // Short key hash
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  return safeExecute(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_CONFIG.TEXT,
      contents: `Tóm tắt cực ngắn gọn 1 câu để đọc TTS: \n${content}`,
    });
    const text = response.text || "";
    if (text) cache.set(cacheKey, text);
    return text;
  });
};

export const generateSimilarQuiz = async (content: string): Promise<any> => {
  if (!content) return null;
  const cacheKey = `QUIZ|${content.substring(0, 50)}`;
  // Note: We might store quiz objects in a separate map if complex, but stringifying is fine for now
  
  return safeExecute(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_CONFIG.TEXT,
      contents: `Dựa vào: "${content}", tạo 1 câu trắc nghiệm tương tự thi THPTQG. Trả về JSON {question, options, answer}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING }
          },
          required: ["question", "options", "answer"]
        }
      }
    });
    const parsed = JSON.parse(response.text || '{}');
    if (parsed.options && Array.isArray(parsed.options) && parsed.options.length > 0 && parsed.answer) {
        return parsed;
    }
    return null;
  });
};

export const fetchTTSAudio = async (text: string) => {
  if (!text) return undefined;
  const cacheKey = `TTS|${text.substring(0, 100)}`; // Cache short phrases
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);

  return safeExecute(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_CONFIG.TTS,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (data) audioCache.set(cacheKey, data);
    return data;
  });
};

// Audio Player Manager - Singleton-like behavior for audio context
let globalAudioContext: AudioContext | null = null;
let globalSource: AudioBufferSourceNode | null = null;

export const playStoredAudio = async (base64Audio: string, audioSourceRef: React.MutableRefObject<AudioBufferSourceNode | null>) => {
  if (!base64Audio) return;

  // Cleanup existing global source if any (ensure only one audio plays at a time system-wide)
  if (globalSource) {
    try { globalSource.stop(); } catch(e) {}
    globalSource.disconnect();
    globalSource = null;
  }
  
  // Cleanup ref source
  if (audioSourceRef.current) {
    try { audioSourceRef.current.stop(); } catch(e) {}
    audioSourceRef.current.disconnect();
    audioSourceRef.current = null;
  }

  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  
  if (globalAudioContext.state === 'suspended') await globalAudioContext.resume();

  const audioData = atob(base64Audio);
  const bytes = new Uint8Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) bytes[i] = audioData.charCodeAt(i);
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = globalAudioContext.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

  const source = globalAudioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(globalAudioContext.destination);
  
  globalSource = source; // Track globally
  audioSourceRef.current = source; // Track locally for React ref

  return new Promise((resolve) => { 
    source.onended = () => {
      if (globalSource === source) globalSource = null;
      if (audioSourceRef.current === source) audioSourceRef.current = null;
      resolve(void 0);
    }; 
    source.start(); 
  });
};

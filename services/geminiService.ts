import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Subject, AgentType } from "../types";
import React from 'react';

// CẤU HÌNH MODEL - Nâng cấp lên bản ổn định nhất cho Multi-Agent
const MODEL_CONFIG = {
  TEXT: 'gemini-1.5-flash', // Bản Flash 1.5 cực nhanh và ổn định cho Multi-Agent
  TTS: 'gemini-1.5-flash', 
  TIMEOUT: 15000 
};

const cache = new Map<string, string>();
const audioCache = new Map<string, string>();

const getCacheKey = (subject: string, agent: string, input: string, imageHash: string = '') => 
  `${subject}|${agent}|${input.trim()}|${imageHash}`;

// Sử dụng biến môi trường chuẩn của Vite
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  [AgentType.SPEED]: `Bạn là chuyên gia giải đề thi THPT Quốc gia. Trả về JSON: {"finalAnswer": "...", "casioSteps": "..."}. Ngắn gọn, dùng LaTeX.`,
  [AgentType.SOCRATIC]: `Bạn là giáo sư Socratic. Giải chi tiết, khoa học, cực ngắn gọn, dùng LaTeX. Đi thẳng vào trọng tâm.`,
  [AgentType.NOTEBOOK]: `Bạn là NotebookLM. Tóm tắt 5 gạch đầu dòng kiến thức then chốt. Không văn hoa, dùng LaTeX.`,
  [AgentType.PERPLEXITY]: `Bạn là Perplexity AI. Liệt kê 2 dạng bài tập nâng cao liên quan. Chỉ nêu đề bài, dùng LaTeX.`,
};

async function safeExecute<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    if (error.toString().includes('429')) throw new Error("Hệ thống quá tải, vui lòng thử lại sau 5 giây.");
    throw error;
  }
}

/**
 * HÀM SIÊU TỐC ĐỘ: generateTaskStream
 * Cho phép hiển thị kết quả ngay khi AI vừa nghĩ ra (Streaming)
 */
export const processTaskStream = async (
  subject: Subject, 
  agent: AgentType, 
  input: string, 
  onChunk: (text: string) => void,
  image?: string
) => {
  const cacheKey = getCacheKey(subject, agent, input, image ? 'has_img' : 'no_img');
  
  if (cache.has(cacheKey)) {
    onChunk(cache.get(cacheKey)!);
    return cache.get(cacheKey)!;
  }

  return safeExecute(async () => {
    const promptContent = `Môn: ${subject}. Yêu cầu: ${SYSTEM_PROMPTS[agent]}. Nội dung: ${input}`;
    const parts: any[] = [{ text: promptContent }];
    
    if (image) {
      parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } });
    }

    // Kích hoạt chế độ Stream
    const result = await ai.models.generateContentStream({
      model: MODEL_CONFIG.TEXT,
      contents: { parts },
      config: { 
        temperature: 0.1,
        // Chỉ dùng JSON Mode cho Agent SPEED
        responseMimeType: agent === AgentType.SPEED ? "application/json" : "text/plain"
      }
    });

    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onChunk(fullText); // Trả về từng phần để hiển thị ngay lập tức
    }

    if (fullText) cache.set(cacheKey, fullText);
    return fullText;
  });
};

/**
 * ĐIỀU PHỐI MULTI-AGENT: Chạy song song tất cả AI cùng lúc
 */
export const executeMultiAgentParallel = async (
  subject: Subject,
  input: string,
  onUpdate: (agent: AgentType, content: string) => void,
  image?: string
) => {
  const agents = [AgentType.SPEED, AgentType.SOCRATIC, AgentType.NOTEBOOK, AgentType.PERPLEXITY];
  
  // Kích hoạt tất cả Agent cùng một lúc (Parallel)
  const tasks = agents.map(agent => 
    processTaskStream(subject, agent, input, (text) => onUpdate(agent, text), image)
  );

  return Promise.allSettled(tasks);
};

// --- GIỮ NGUYÊN CÁC HÀM TTS VÀ AUDIO NHƯNG TỐI ƯU HÓA ---

export const fetchTTSAudio = async (text: string) => {
  if (!text) return undefined;
  const cacheKey = `TTS|${text.substring(0, 100)}`;
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

// Các hàm chơi nhạc giữ nguyên như code cũ của bạn
let globalAudioContext: AudioContext | null = null;
let globalSource: AudioBufferSourceNode | null = null;

export const playStoredAudio = async (base64Audio: string, audioSourceRef: React.MutableRefObject<AudioBufferSourceNode | null>) => {
  if (!base64Audio) return;
  if (globalSource) { try { globalSource.stop(); } catch(e) {} globalSource.disconnect(); globalSource = null; }
  if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch(e) {} audioSourceRef.current.disconnect(); audioSourceRef.current = null; }
  if (!globalAudioContext) globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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
  globalSource = source;
  audioSourceRef.current = source;

  return new Promise((resolve) => { 
    source.onended = () => {
      if (globalSource === source) globalSource = null;
      if (audioSourceRef.current === source) audioSourceRef.current = null;
      resolve(void 0);
    }; 
    source.start(); 
  });
};
export const generateSimilarQuiz = async (content: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Dựa trên nội dung bài giải sau, hãy tạo 1 câu hỏi trắc nghiệm tương tự (kèm 4 đáp án A, B, C, D). 
    Trả về định dạng JSON: {"question": "...", "options": ["A...", "B...", "C...", "D..."], "correct": "A"}.
    Nội dung: ${content}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Lỗi tạo Quiz:", error);
    return null;
  }
};

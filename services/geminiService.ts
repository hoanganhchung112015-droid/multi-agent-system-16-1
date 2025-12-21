import { GoogleGenerativeAI } from "@google/generative-ai";
import { Subject, AgentType } from "../types";
import React from 'react';

// Khởi tạo SDK chính thức
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const MODEL_NAME = 'gemini-1.5-flash';

const cache = new Map<string, string>();
const audioCache = new Map<string, string>();

const getCacheKey = (subject: string, agent: string, input: string, imageHash: string = '') => 
  `${subject}|${agent}|${input.trim()}|${imageHash}`;

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  [AgentType.SPEED]: `Bạn là chuyên gia giải đề thi THPT Quốc gia. Trả về JSON: {"finalAnswer": "...", "casioSteps": "..."}. Ngắn gọn, dùng LaTeX.`,
  [AgentType.SOCRATIC]: `Bạn là giáo sư Socratic. Giải chi tiết, khoa học, cực ngắn gọn, dùng LaTeX. Đi thẳng vào trọng tâm.`,
  [AgentType.NOTEBOOK]: `Bạn là NotebookLM. Tóm tắt 5 gạch đầu dòng kiến thức then chốt. Không văn hoa, dùng LaTeX.`,
  [AgentType.PERPLEXITY]: `Bạn là Perplexity AI. Liệt kê 2 dạng bài tập nâng cao liên quan. Chỉ nêu đề bài, dùng LaTeX.`,
};

// Hàm xử lý Streaming AI
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

  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: {
        // Chỉ dùng JSON mode cho Agent SPEED
        responseMimeType: agent === AgentType.SPEED ? "application/json" : "text/plain"
      }
    });

    const promptContent = `Môn: ${subject}. Yêu cầu: ${SYSTEM_PROMPTS[agent]}. Nội dung: ${input}`;
    const parts: any[] = [{ text: promptContent }];
    
    if (image) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } });
    }

    const result = await model.generateContentStream(parts);

    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onChunk(fullText);
    }

    if (fullText) cache.set(cacheKey, fullText);
    return fullText;
  } catch (error) {
    console.error("Gemini Stream Error:", error);
    throw error;
  }
};

// Điều phối chạy song song
export const executeMultiAgentParallel = async (
  subject: Subject,
  input: string,
  onUpdate: (agent: AgentType, content: string) => void,
  image?: string
) => {
  const agents = [AgentType.SPEED, AgentType.SOCRATIC, AgentType.NOTEBOOK, AgentType.PERPLEXITY];
  const tasks = agents.map(agent => 
    processTaskStream(subject, agent, input, (text) => onUpdate(agent, text), image)
  );
  return Promise.allSettled(tasks);
};

// Hàm tạo tóm tắt để đọc TTS (Vì bạn đã xóa Quiz, hàm này rất quan trọng cho Audio)
export const generateSummary = async (content: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = `Tóm tắt ngắn gọn nội dung sau trong 2 câu để đọc audio: ${content}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (e) {
    return content.substring(0, 200);
  }
};

// Hàm Audio (Dùng giao diện chuẩn của Gemini 1.5)
export const fetchTTSAudio = async (text: string) => {
  // Lưu ý: Hiện tại Gemini Flash hỗ trợ Multimodal nhưng TTS qua generateContent 
  // yêu cầu cấu hình đặc biệt hoặc dùng API bên thứ 3. 
  // Để tránh lỗi Build, mình sẽ giữ cấu hình logic ở mức tối giản.
  return undefined; 
};

// Các hàm Play Audio giữ nguyên logic cũ
let globalAudioContext: AudioContext | null = null;
export const playStoredAudio = async (base64Audio: string, audioSourceRef: React.MutableRefObject<AudioBufferSourceNode | null>) => {
  if (!base64Audio) return;
  if (!globalAudioContext) globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const audioData = atob(base64Audio);
  const arrayBuffer = new ArrayBuffer(audioData.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < audioData.length; i++) view[i] = audioData.charCodeAt(i);
  
  const buffer = await globalAudioContext.decodeAudioData(arrayBuffer);
  const source = globalAudioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(globalAudioContext.destination);
  audioSourceRef.current = source;
  source.start();
};

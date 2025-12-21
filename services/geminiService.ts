import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-1.5-flash";

const SYSTEM_PROMPTS = {
  [AgentType.SPEED]: "Giải bài tập trắc nghiệm. Trả về định dạng JSON: {\"finalAnswer\": \"...\", \"casioSteps\": \"...\"}. Dùng LaTeX cho công thức.",
  [AgentType.SOCRATIC]: "Hãy đóng vai trò là Socratic, Giải chi tiết, giảng giải từng bước khoa học. Dùng LaTeX.",
  [AgentType.NOTEBOOK]: "Hãy đóng vai trò là NotebookLM, Tóm tắt 5 kiến thức trọng tâm cần nhớ của bài này. Dùng LaTeX.",
  [AgentType.PERPLEXITY]: "Đề xuất 2 bài tập nâng cao tương tự đề bài này. Dùng LaTeX."
};

import { AgentType } from "../types";

export const processTaskStream = async (
  subject: string,
  agent: AgentType,
  input: string,
  onChunk: (text: string) => void,
  image?: string
) => {
  try {
    const isSpeed = agent === AgentType.SPEED;
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: isSpeed ? "application/json" : "text/plain" }
    });

    const prompt = `Môn: ${subject}. Vai trò: ${SYSTEM_PROMPTS[agent]}. Nội dung: ${input}`;
    const parts: any[] = [{ text: prompt }];
    if (image) parts.push({ inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } });

    const result = await model.generateContentStream(parts);
    let fullText = "";
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      onChunk(fullText);
    }
    return fullText;
  } catch (error) {
    console.error("AI Error:", error);
    return "Đã có lỗi xảy ra khi kết nối AI.";
  }
};

export const executeMultiAgentParallel = async (
  subject: string,
  input: string,
  onUpdate: (agent: AgentType, content: string) => void,
  image?: string
) => {
  const agents = Object.values(AgentType);
  return Promise.allSettled(
    agents.map(agent => processTaskStream(subject, agent, input, (text) => onUpdate(agent, text), image))
  );
};

export const generateSummary = async (content: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent("Tóm tắt nội dung sau cực ngắn để đọc audio: " + content);
    return result.response.text();
  } catch { return ""; }
};

export const fetchTTSAudio = async (text: string) => undefined; // Tạm thời để trống để build mượt
export const playStoredAudio = async (base64: string, ref: any) => {};

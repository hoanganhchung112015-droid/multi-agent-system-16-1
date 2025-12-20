
export enum Subject {
  MATH = 'Toán học',
  PHYSICS = 'Vật lí',
  CHEMISTRY = 'Hóa học',
  DIARY = 'Nhật ký'
}

export enum AgentType {
  SPEED = 'Speed',
  SOCRATIC = 'Socratic',
  NOTEBOOK = 'NotebookLM',
  PERPLEXITY = 'Perplexity',
  // CASIO = 'Casio 580' // Đã bị xóa
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

export interface AnalysisResult {
  content: string;
  mindMap: string;
  quiz?: QuizQuestion[];
}

export type InputMode = 'CAMERA' | 'GALLERY' | 'VOICE';

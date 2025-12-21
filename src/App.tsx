import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from '../types';
import { Layout } from '../components/Layout';
import { 
  executeMultiAgentParallel, 
  generateSimilarQuiz, 
  fetchTTSAudio, 
  playStoredAudio, 
  generateSummary 
} from '../services/geminiService.ts';

// --- UI COMPONENT: Skeleton Loader cho cảm giác "Siêu tốc độ" ---
const SkeletonLoader = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-4 bg-slate-200 rounded-full w-3/4"></div>
    <div className="h-4 bg-slate-200 rounded-full w-full"></div>
    <div className="h-4 bg-slate-200 rounded-full w-5/6"></div>
    <div className="grid grid-cols-3 gap-2 mt-6">
      <div className="h-20 bg-blue-50 rounded-2xl"></div>
      <div className="h-20 bg-blue-50 rounded-2xl"></div>
      <div className="h-20 bg-blue-50 rounded-2xl"></div>
    </div>
  </div>
);

// --- CONTROLLER LAYER: Hook quản lý hệ thống Agent song song ---
const useAgentSystem = (selectedSubject: Subject | null) => {
  const [allResults, setAllResults] = useState<Partial<Record<AgentType, string>>>({});
  const [allAudios, setAllAudios] = useState<Partial<Record<AgentType, string>>>({});
  const [parsedSpeedResult, setParsedSpeedResult] = useState<{ finalAnswer: string, casioSteps: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  
  const resetResults = useCallback(() => {
    setAllResults({});
    setAllAudios({});
    setParsedSpeedResult(null);
    setQuiz(null);
    setLoading(false);
  }, []);

  const runAgents = useCallback(async (voiceText: string, image: string | null) => {
    if (!selectedSubject || (!image && !voiceText)) return;

    setLoading(true);
    resetResults();

    // Thực thi tất cả Agent song song với cơ chế Streaming
    await executeMultiAgentParallel(
      selectedSubject,
      voiceText,
      (agent, content) => {
        setAllResults(prev => ({ ...prev, [agent]: content }));
        
        // Nếu là Agent SPEED, thử parse JSON ngay khi stream xong (hoặc có đủ dữ liệu)
        if (agent === AgentType.SPEED) {
          try {
            const cleanContent = content.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            setParsedSpeedResult(parsed);
          } catch (e) { /* Đang stream JSON chưa hoàn chỉnh */ }
        }
      },
      image || undefined
    );

    setLoading(false);
    
    // Sau khi có kết quả, chạy ngầm các dịch vụ bổ trợ (Quiz, TTS) để tối ưu "Siêu bền"
    const finalSpeed = allResults[AgentType.SPEED];
    if (finalSpeed) {
        generateSimilarQuiz(finalSpeed).then(q => q && setQuiz(q));
        generateSummary(finalSpeed).then(sum => 
          sum && fetchTTSAudio(sum).then(aud => aud && setAllAudios(p => ({...p, [AgentType.SPEED]: aud})))
        );
    }
  }, [selectedSubject, allResults, resetResults]);

  return { allResults, allAudios, parsedSpeedResult, loading, quiz, resetResults, runAgents };
};

// --- VIEW LAYER ---
const App: React.FC = () => {
  const [screen, setScreen] = useState<'HOME' | 'INPUT' | 'ANALYSIS' | 'DIARY'>('HOME');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(AgentType.SPEED);
  const [image, setImage] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [quizAnswered, setQuizAnswered] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const { allResults, allAudios, parsedSpeedResult, loading, quiz, runAgents } = useAgentSystem(selectedSubject);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleRunAnalysis = useCallback(() => {
    setScreen('ANALYSIS');
    runAgents(voiceText, image);
  }, [voiceText, image, runAgents]);

  return (
    <Layout 
      onBack={() => setScreen(screen === 'ANALYSIS' ? 'INPUT' : 'HOME')}
      title={selectedSubject || "Hệ sinh thái AI"}
    >
      {screen === 'HOME' && (
        <div className="grid grid-cols-2 gap-4 p-4 animate-in slide-in-from-bottom-10 duration-700">
           {/* Nút bấm Subject giữ nguyên nhưng thêm hiệu ứng Hover Glow */}
           {[Subject.MATH, Subject.PHYSICS, Subject.CHEMISTRY, Subject.DIARY].map((sub) => (
             <button 
                key={sub} 
                onClick={() => { setSelectedSubject(sub as Subject); setScreen(sub === Subject.DIARY ? 'DIARY' : 'INPUT'); }}
                className="h-40 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all group"
             >
               <span className="text-4xl group-hover:bounce mb

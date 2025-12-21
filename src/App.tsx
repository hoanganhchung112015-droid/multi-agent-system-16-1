import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from '../types';
import { Layout } from '../components/Layout';
import { 
  executeMultiAgentParallel, 
  fetchTTSAudio, 
  playStoredAudio, 
  generateSummary 
} from '../services/geminiService';

// --- UI COMPONENT: Skeleton Loader ---
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

// --- CONTROLLER LAYER ---
const useAgentSystem = (selectedSubject: Subject | null) => {
  const [allResults, setAllResults] = useState<Partial<Record<AgentType, string>>>({});
  const [allAudios, setAllAudios] = useState<Partial<Record<AgentType, string>>>({});
  const [parsedSpeedResult, setParsedSpeedResult] = useState<{ finalAnswer: string, casioSteps: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const resetResults = useCallback(() => {
    setAllResults({});
    setAllAudios({});
    setParsedSpeedResult(null);
    setLoading(false);
  }, []);

  const runAgents = useCallback(async (voiceText: string, image: string | null) => {
    if (!selectedSubject || (!image && !voiceText)) return;

    setLoading(true);
    resetResults();

    await executeMultiAgentParallel(
      selectedSubject,
      voiceText,
      (agent, content) => {
        setAllResults(prev => ({ ...prev, [agent]: content }));
        if (agent === AgentType.SPEED) {
          try {
            const cleanContent = content.replace(/```json|```/g, '').trim();
            setParsedSpeedResult(JSON.parse(cleanContent));
          } catch (e) { /* Đang stream dở dang */ }
        }
      },
      image || undefined
    );

    setLoading(false);
  }, [selectedSubject, resetResults]);

  // SỬA LỖI TẠI ĐÂY: Xử lý hậu kỳ an toàn bằng async/await
  useEffect(() => {
    const handleExtraTasks = async () => {
      const finalSpeed = allResults[AgentType.SPEED];
      
      // Chỉ chạy khi đã giải xong và có kết quả Speed
      if (!loading && finalSpeed) {
        const summary = await generateSummary(finalSpeed);
        if (summary) {
          const audio = await fetchTTSAudio(summary);
          if (audio) {
            setAllAudios(prev => ({ ...prev, [AgentType.SPEED]: audio }));
          }
        }
      }
    };

    handleExtraTasks();
  }, [loading, allResults]);

  // Return nằm ngoài useEffect
  return { allResults, allAudios, parsedSpeedResult, loading, resetResults, runAgents };
};

// --- VIEW LAYER ---
const App: React.FC = () => {
  const [screen, setScreen] = useState<'HOME' | 'INPUT' | 'ANALYSIS' | 'DIARY'>('HOME');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(AgentType.SPEED);
  const [image] = useState<string | null>(null); // Giả định setImage chưa dùng ở đây
  const [voiceText, setVoiceText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const { allResults, allAudios, parsedSpeedResult, loading, runAgents } = useAgentSystem(selectedSubject);
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
        <div className="grid grid-cols-2 gap-4 p-4">
           {[Subject.MATH, Subject.PHYSICS, Subject.CHEMISTRY, Subject.DIARY].map((sub) => (
             <button 
                key={sub} 
                onClick={() => { setSelectedSubject(sub as Subject); setScreen(sub === Subject.DIARY ? 'DIARY' : 'INPUT'); }}
                className="h-40 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all group"
             >
               <span className="text-4xl mb-2">
                {sub === Subject.MATH ? '📐' : sub === Subject.PHYSICS ? '⚛️' : sub === Subject.CHEMISTRY ? '🧪' : '📔'}
               </span>
               <span className="font-black text-blue-900 uppercase tracking-tighter">{sub}</span>
             </button>
           ))}
        </div>
      )}

      {screen === 'INPUT' && (
        <div className="p-6 space-y-8 animate-in fade-in">
          <div className="relative group">
            <textarea

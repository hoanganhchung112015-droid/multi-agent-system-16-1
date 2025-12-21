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

    // 1. Hàm chạy AI: CHỈ làm nhiệm vụ lấy dữ liệu, KHÔNG xử lý hậu kỳ
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
          } catch (e) { /* Đang stream dở dang, bỏ qua */ }
        }
      },
      image || undefined
    );
    setLoading(false);
  }, [selectedSubject, resetResults]); // <--- TUYỆT ĐỐI KHÔNG để allResults ở đây

  // 2. Xử lý hậu kỳ: CHỈ chạy khi AI đã hoàn thành (loading = false)
  useEffect(() => {
    const finalSpeed = allResults[AgentType.SPEED];
    
    // Điều kiện: Đã xong loading, có kết quả, và chưa có Quiz (để tránh chạy lại)
    if (!loading && finalSpeed && !quiz) {
      generateSimilarQuiz(finalSpeed).then(q => q && setQuiz(q));
      
      generateSummary(finalSpeed).then(sum => {
        if (sum) {
          fetchTTSAudio(sum).then(aud => {
            if (aud) setAllAudios(p => ({...p, [AgentType.SPEED]: aud}));
          });
        }
      });
    }
  }, [loading, allResults, quiz]); // <--- Theo dõi loading để biết khi nào AI dừng lại


    
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
               <span className="text-4xl group-hover:bounce mb-2">
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
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder="Nhập đề bài hoặc dùng camera..."
              className="w-full h-48 p-6 bg-white rounded-[2rem] border-2 border-blue-50 focus:border-blue-400 outline-none shadow-inner text-lg font-medium resize-none transition-all"
            />
            <button 
              onClick={handleRunAnalysis}
              className="absolute bottom-4 right-4 bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
            >
              GIẢI NGAY 🚀
            </button>
          </div>
        </div>
      )}

      {screen === 'ANALYSIS' && (
        <div className="space-y-4 p-4">
          {/* Tabs chuyển đổi Agent siêu mượt */}
          <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
            {Object.values(AgentType).map((ag) => (
              <button 
                key={ag}
                onClick={() => setSelectedAgent(ag)}
                className={`px-6 py-2 rounded-full whitespace-nowrap font-black text-[10px] uppercase tracking-widest transition-all ${selectedAgent === ag ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400'}`}
              >
                {ag} {allResults[ag] && "✓"}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl min-h-[400px] relative overflow-hidden">
            {/* Hiển thị Skeleton nếu đang load mà chưa có chữ nào */}
            {loading && !allResults[selectedAgent] ? (
              <SkeletonLoader />
            ) : (
              <div className="prose prose-blue animate-in fade-in duration-1000">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {selectedAgent === AgentType.SPEED && parsedSpeedResult 
                    ? parsedSpeedResult.finalAnswer 
                    : allResults[selectedAgent] || "Đang phân tích dữ liệu..."}
                </ReactMarkdown>
                
                {/* Hiển thị Casio mượt mà */}
                {selectedAgent === AgentType.SPEED && parsedSpeedResult?.casioSteps && (
                  <div className="mt-6 p-5 bg-emerald-50 rounded-3xl border border-emerald-100 animate-in slide-in-from-right">
                    <h4 className="text-emerald-700 font-black text-xs uppercase mb-2">⌨️ Hướng dẫn Casio 580</h4>
                    <pre className="text-emerald-900 font-mono text-sm whitespace-pre-wrap">{parsedSpeedResult.casioSteps}</pre>
                  </div>
                )}
              </div>
            )}
            
            {/* Nút đọc âm thanh góc dưới */}
            {allAudios[selectedAgent] && (
              <button 
                onClick={async () => { setIsSpeaking(true); await playStoredAudio(allAudios[selectedAgent]!, audioSourceRef); setIsSpeaking(false); }}
                className={`absolute bottom-6 right-6 p-4 rounded-full shadow-lg transition-all ${isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:scale-110'}`}
              >
                {isSpeaking ? '⏹️' : '🔊'}
              </button>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;

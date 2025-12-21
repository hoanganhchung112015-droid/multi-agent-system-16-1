import React, { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from '../types';
import { Layout } from '../components/Layout';
import { executeMultiAgentParallel, generateSummary } from '../services/geminiService';

// --- UI: Skeleton ---
const Skeleton = () => (
  <div className="space-y-3 animate-pulse p-4">
    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 rounded w-full"></div>
    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
  </div>
);

// --- HOOK: Xử lý Logic ---
const useAgentSystem = (selectedSubject: Subject | null) => {
  const [results, setResults] = useState<Partial<Record<AgentType, string>>>({});
  const [parsedSpeed, setParsedSpeed] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runAgents = useCallback(async (input: string, image: string | null) => {
    if (!selectedSubject || !input) return;
    setLoading(true);
    setResults({});
    setParsedSpeed(null);

    await executeMultiAgentParallel(selectedSubject, input, (agent, content) => {
      setResults(prev => ({ ...prev, [agent]: content }));
      if (agent === AgentType.SPEED) {
        try {
          const clean = content.replace(/```json|```/g, '').trim();
          setParsedSpeed(JSON.parse(clean));
        } catch (e) {}
      }
    }, image || undefined);
    setLoading(false);
  }, [selectedSubject]);

  return { results, parsedSpeed, loading, runAgents };
};

// --- VIEW ---
const App: React.FC = () => {
  const [screen, setScreen] = useState<'HOME' | 'INPUT' | 'ANALYSIS'>('HOME');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [agent, setAgent] = useState<AgentType>(AgentType.SPEED);
  const [inputText, setInputText] = useState('');
  
  const { results, parsedSpeed, loading, runAgents } = useAgentSystem(subject);

  return (
    <Layout onBack={() => setScreen(screen === 'ANALYSIS' ? 'INPUT' : 'HOME')} title={subject || "Hệ sinh thái AI"}>
      {screen === 'HOME' && (
        <div className="grid grid-cols-2 gap-4 p-4">
          {Object.values(Subject).map(sub => (
            <button key={sub} onClick={() => { setSubject(sub); setScreen('INPUT'); }} 
                    className="h-32 bg-white/80 backdrop-blur-lg border border-white/20 rounded-[2rem] shadow-xl flex flex-col items-center justify-center hover:scale-105 transition-all">
              <span className="text-3xl mb-1">{sub === Subject.MATH ? '📐' : '⚛️'}</span>
              <span className="font-bold text-blue-900 text-sm uppercase">{sub}</span>
            </button>
          ))}
        </div>
      )}

      {screen === 'INPUT' && (
        <div className="p-6 space-y-4">
          <textarea value={inputText} onChange={e => setInputText(e.target.value)} 
                    className="w-full h-48 p-6 bg-white rounded-[2rem] border-none shadow-inner text-lg outline-none" placeholder="Nhập đề bài..." />
          <button onClick={() => { setScreen('ANALYSIS'); runAgents(inputText, null); }}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">GIẢI NGAY 🚀</button>
        </div>
      )}

      {screen === 'ANALYSIS' && (
        <div className="p-4 space-y-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {Object.values(AgentType).map(ag => (
              <button key={ag} onClick={() => setAgent(ag)} 
                      className={`px-6 py-2 rounded-full text-[10px] font-bold transition-all ${agent === ag ? 'bg-blue-600 text-white' : 'bg-white text-gray-400'}`}>
                {ag}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl min-h-[400px]">
            {loading && !results[agent] ? <Skeleton /> : (
              <div className="prose prose-blue">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {agent === AgentType.SPEED && parsedSpeed ? parsedSpeed.finalAnswer : (results[agent] || "Đang xử lý...")}
                </ReactMarkdown>
                {agent === AgentType.SPEED && parsedSpeed?.casioSteps && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-emerald-700 font-bold text-xs uppercase mb-1">⌨️ Hướng dẫn Casio</p>
                    <pre className="text-xs whitespace-pre-wrap">{parsedSpeed.casioSteps}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;

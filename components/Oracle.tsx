
import React, { useState, useRef, useEffect } from 'react';
import { GameState, OracleMessage } from '../types';
import { getDivineStrategy } from '../services/geminiService';

interface OracleProps {
  gameState: GameState;
}

const Oracle: React.FC<OracleProps> = ({ gameState }) => {
  const [messages, setMessages] = useState<OracleMessage[]>([
    { role: 'model', text: 'Seek the heavens, Shaman. What wisdom do you require for our tribe?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    const advice = await getDivineStrategy(userText, gameState);
    setMessages(prev => [...prev, { role: 'model', text: advice }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-black/60 backdrop-blur-md border-l border-white/10 text-white w-80 md:w-96 shadow-2xl">
      <div className="p-4 border-b border-white/20 flex items-center gap-2">
        <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
        <h2 className="text-xl font-bold tracking-widest uppercase text-yellow-500">Divine Oracle</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg text-sm leading-relaxed ${
              m.role === 'user' 
                ? 'bg-blue-600/40 border border-blue-500/50' 
                : 'bg-white/5 border border-white/10 italic text-gray-200'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 p-3 rounded-lg text-xs animate-pulse">Communicating with the Great Spirit...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/20 bg-black/40">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for divine guidance..."
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-yellow-500/50 transition-colors"
        />
      </form>
    </div>
  );
};

export default Oracle;

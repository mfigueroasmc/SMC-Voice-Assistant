import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface TranscriptProps {
  messages: ChatMessage[];
}

export const Transcript: React.FC<TranscriptProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col space-y-4 p-4 h-full overflow-y-auto scrollbar-hide">
      {messages.length === 0 && (
        <div className="text-center text-slate-500 mt-10 italic">
          La conversación aparecerá aquí...
        </div>
      )}
      
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-slate-700 text-slate-100 rounded-bl-none'
            }`}
          >
            <p className="text-sm leading-relaxed">{msg.text}</p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
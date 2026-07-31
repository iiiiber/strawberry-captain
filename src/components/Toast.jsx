import { useState, useCallback, useMemo } from 'react';

export default function Toast({ messages, onRemove }) {
  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-3 min-w-[240px] ${
            msg.type === 'error'
              ? 'bg-red-500 text-white'
              : msg.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-gray-800 text-white'
          }`}
        >
          <span>{msg.type === 'error' ? '✕' : msg.type === 'success' ? '✓' : 'ℹ'}</span>
          <span className="flex-1">{msg.message}</span>
          <button
            onClick={() => onRemove(msg.id)}
            className="opacity-70 hover:opacity-100 transition"
          >×</button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [messages, setMessages] = useState([]);

  const toast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    const newMsg = { id, message, type };
    setMessages(prev => [...prev, newMsg]);
    if (duration > 0) {
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== id));
      }, duration);
    }
  };

  const success = useCallback((msg) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg) => toast(msg, 'error'), [toast]);
  const info = useCallback((msg) => toast(msg, 'info'), [toast]);
  const remove = useCallback((id) => setMessages(prev => prev.filter(m => m.id !== id)), []);

  return useMemo(() => ({ messages, toast, success, error, info, remove }), [messages, toast, success, error, info, remove]);
}

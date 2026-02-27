import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Loader2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { chatWithGemini } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function ChatInterface() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hello! I'm your Mecer HR Assistant. I can help you analyze Google Form questionnaire findings or provide insights for your audit. Paste your data here to get started." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Convert messages to history format for Gemini API
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await chatWithGemini(userMessage, history);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I encountered an error analyzing your request. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-colors ${isOpen ? 'hidden' : 'flex'}`}
      >
        <MessageSquare className="w-6 h-6" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-[400px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-indigo-600 p-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-sm">HR Intelligence Assistant</h3>
                  <p className="text-[10px] text-indigo-200">Powered by Gemini 3.1 Pro</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.role === 'model' ? (
                      <div className="markdown-body">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                    <span className="text-xs text-slate-400">Analyzing data...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              {messages.length === 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  <button 
                    onClick={() => setInput("Here are the findings from the Employee Satisfaction Survey (Google Form): \n\n[Paste your data here]")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium whitespace-nowrap hover:bg-indigo-100 transition-colors border border-indigo-100"
                  >
                    <FileText className="w-3 h-3" /> Analyze Survey Data
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask a question or paste survey data..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none max-h-32 min-h-[44px]"
                  rows={1}
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 mt-2">
                Gemini can make mistakes. Verify important info.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

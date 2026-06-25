/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Send, 
  Sparkles, 
  MapPin, 
  BookOpen, 
  History, 
  Languages, 
  User, 
  Palmtree, 
  ArrowRight,
  ChevronLeft,
  Trash2
} from 'lucide-react';
import { cn } from './lib/utils';
import { generateThesisResponse, type OnboardingData } from './lib/gemini';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: number;
}

interface ChatSession {
  id: string;
  messages: Message[];
  title: string;
  updatedAt: number;
}

export default function App() {
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({
    language: 'id',
  });
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  // Load state from local storage
  useEffect(() => {
    const savedOnboarding = localStorage.getItem('skripsiMate_onboarding');
    const savedSessions = localStorage.getItem('skripsiMate_sessions');
    const lastSessionId = localStorage.getItem('skripsiMate_currentSessionId');
    
    if (savedOnboarding) setOnboarding(JSON.parse(savedOnboarding));
    
    if (savedSessions) {
      const parsedSessions = JSON.parse(savedSessions);
      setSessions(parsedSessions);
      if (lastSessionId && parsedSessions.some((s: ChatSession) => s.id === lastSessionId)) {
        setCurrentSessionId(lastSessionId);
      } else if (parsedSessions.length > 0) {
        setCurrentSessionId(parsedSessions[0].id);
      }
    }
  }, []);

  // Save sessions to local storage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('skripsiMate_sessions', JSON.stringify(sessions));
    }
    if (currentSessionId) {
      localStorage.setItem('skripsiMate_currentSessionId', currentSessionId);
    }
  }, [sessions, currentSessionId]);

  // Save onboarding
  useEffect(() => {
    if (onboarding) localStorage.setItem('skripsiMate_onboarding', JSON.stringify(onboarding));
  }, [onboarding]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleStartOnboarding = () => setStep(1);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const completeOnboarding = () => {
    if (formData.major && formData.year && formData.location && formData.hobbies) {
      const finalData = formData as OnboardingData;
      setOnboarding(finalData);
      // Start initial session
      createNewChat();
    }
  };

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      messages: [],
      title: onboarding?.language === 'id' || formData.language === 'id' ? 'Sesi Baru' : 'New Session',
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const handleSend = async () => {
    if (!input.trim() || !onboarding || isLoading) return;

    let targetSessionId = currentSessionId;
    
    // Auto-create session if none exists
    if (!targetSessionId) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        messages: [],
        title: input.substring(0, 30),
        updatedAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      targetSessionId = newSession.id;
    }

    const userMessage: Message = {
      role: 'user',
      parts: [{ text: input }],
      timestamp: Date.now()
    };

    const currentMessages = sessions.find(s => s.id === targetSessionId)?.messages || [];
    const newMessages = [...currentMessages, userMessage];

    // Update session with user message and title if it's the first message
    setSessions(prev => prev.map(s => {
      if (s.id === targetSessionId) {
        return {
          ...s,
          messages: newMessages,
          title: s.messages.length === 0 ? input.substring(0, 30) : s.title,
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    setInput('');
    setIsLoading(true);

    try {
      const history = newMessages.map(({ role, parts }) => ({ role, parts }));
      const response = await generateThesisResponse(history, onboarding);
      
      const modelMessage: Message = {
        role: 'model',
        parts: [{ text: response || (onboarding.language === 'id' ? 'Maaf, ada kesalahan.' : 'Sorry, something went wrong.') }],
        timestamp: Date.now()
      };
      
      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            messages: [...s.messages, modelMessage],
            updatedAt: Date.now()
          };
        }
        return s;
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setConfirmModal({
      show: true,
      title: onboarding?.language === 'id' ? 'Hapus Sesi?' : 'Delete Session?',
      message: onboarding?.language === 'id' 
        ? 'Conversasi ini akan dihapus secara permanen.' 
        : 'This conversation will be permanently deleted.',
      onConfirm: () => {
        const newSessions = sessions.filter(s => s.id !== currentSessionId);
        setSessions(newSessions);
        if (newSessions.length > 0) {
          setCurrentSessionId(newSessions[0].id);
        } else {
          setCurrentSessionId(null);
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const resetProfile = () => {
    setConfirmModal({
      show: true,
      title: onboarding?.language === 'id' ? 'Mulai Ulang Profil?' : 'Reset Profile?',
      message: onboarding?.language === 'id'
        ? 'Seluruh riwayat chat dan pengaturan profil akan dihapus.'
        : 'All chat history and profile settings will be cleared.',
      onConfirm: () => {
        setOnboarding(null);
        setStep(0);
        setSessions([]);
        setCurrentSessionId(null);
        localStorage.clear();
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const t = (idContent: string, enContent: string) => onboarding?.language === 'id' || formData.language === 'id' ? idContent : enContent;

  if (!onboarding) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center p-6 overflow-hidden">
        {/* Background Effects */}
        <div className="glow-light top-0 -left-20 animate-float" />
        <div className="glow-light -bottom-20 -right-20 animate-float" style={{ animationDelay: '2s' }} />
        
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card max-w-lg w-full text-center space-y-8"
            >
              <div className="w-20 h-20 bg-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
                <Sparkles className="w-10 h-10 text-indigo-400" />
              </div>
              <div className="space-y-4">
                <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
                  SkripsiMate
                </h1>
                <p className="text-zinc-400 text-lg">
                  Bantu buka ide skripsimu. Temukan judul yang pas, seru, dan bermanfaat.
                  <br />
                  <span className="text-sm opacity-60">Help unlock your thesis ideas. Find the perfect topic.</span>
                </p>
              </div>

              <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => { setFormData({ ...formData, language: 'id' }); handleStartOnboarding(); }}
                  className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-semibold rounded-2xl hover:bg-blue-600 transition-colors"
                >
                  Mulai Sekarang <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { setFormData({ ...formData, language: 'en' }); handleStartOnboarding(); }}
                  className="px-6 py-3 border border-white/20 text-white font-medium rounded-2xl hover:bg-white/5 transition-colors"
                >
                  Start in English
                </button>
              </div>
            </motion.div>
          )}

          {step > 0 && (
            <motion.div 
              key="form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card max-w-xl w-full"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={prevStep} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-accent-blue"
                    animate={{ width: `${(step / 4) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-zinc-500">{step}/4</span>
              </div>

              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t('Apa Jurusanmu?', 'What is your Major?')}</h2>
                    <p className="text-zinc-400">{t('Agar SkripsiMate bisa menyesuaikan konteks akademikmu.', 'So SkripsiMate can adjust to your academic context.')}</p>
                  </div>
                  <div className="relative">
                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input 
                      autoFocus
                      type="text"
                      className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      placeholder={t('Contoh: Teknik Informatika, Manajemen...', 'Example: Computer Science, Management...')}
                      value={formData.major || ''}
                      onChange={e => setFormData({ ...formData, major: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && formData.major && nextStep()}
                    />
                  </div>
                  <button 
                    disabled={!formData.major}
                    onClick={nextStep}
                    className="w-full py-4 bg-accent-blue disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20"
                  >
                    {t('Lanjut', 'Next')}
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t('Kapan & Di Mana?', 'When & Where?')}</h2>
                    <p className="text-zinc-400">{t('Tahun berapa sekarang dan lokasimu saat ini?', 'What year are you in and where are you located?')}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                      <input 
                        type="text"
                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                        placeholder={t('Tahun Ke- (Misal: 4)', 'Year (e.g. 4)')}
                        value={formData.year || ''}
                        onChange={e => setFormData({ ...formData, year: e.target.value })}
                      />
                    </div>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                      <input 
                        type="text"
                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                        placeholder={t('Kota/Provinsi', 'City/Province')}
                        value={formData.location || ''}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                      />
                    </div>
                  </div>
                  <button 
                    disabled={!formData.year || !formData.location}
                    onClick={nextStep}
                    className="w-full py-4 bg-accent-blue disabled:opacity-50 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all"
                  >
                    {t('Lanjut', 'Next')}
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t('Apa Hobimu?', 'What are your Hobbies?')}</h2>
                    <p className="text-zinc-400">{t('Kami ingin skripsimu terasa menyenangkan karena berkaitan dengan hal yang kamu suka.', 'We want your thesis to be fun because it relates to things you enjoy.')}</p>
                  </div>
                  <div className="relative">
                    <Palmtree className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input 
                      type="text"
                      className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder={t('Contoh: Gaming, Foto, Memasak...', 'Example: Gaming, Photography, Cooking...')}
                      value={formData.hobbies || ''}
                      onChange={e => setFormData({ ...formData, hobbies: e.target.value })}
                    />
                  </div>
                  <button 
                    disabled={!formData.hobbies}
                    onClick={nextStep}
                    className="w-full py-4 bg-accent-blue disabled:opacity-50 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all"
                  >
                    {t('Satu Langkah Lagi', 'One More Step')}
                  </button>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t('Ada Rencana Masa Depan?', 'Future Plans?')}</h2>
                    <p className="text-zinc-400">{t('Ingin lanjut S2 atau kerja di bidang tertentu? (Kosongkan jika belum tahu)', 'Planning for Master studies or specific jobs? (Leave blank if unsure)')}</p>
                  </div>
                  <div className="relative">
                    <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input 
                      type="text"
                      className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder={t('Contoh: Kerja di Startup, Lanjut S2 Luar Negeri...', 'Example: Work in Startup, Study Master Abroad...')}
                      value={formData.futurePlans || ''}
                      onChange={e => setFormData({ ...formData, futurePlans: e.target.value })}
                    />
                  </div>
                  <button 
                    onClick={completeOnboarding}
                    className="w-full py-4 bg-gradient-to-r from-accent-blue to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-500/20"
                  >
                    {t('Selesai & Mulai Chat', 'Complete & Start Chatting')}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-bg-dark overflow-hidden relative font-sans">
      {/* Sidebar - extracting sidebar layout as requested */}
      <aside className="sidebar-bg w-64 h-full flex flex-col p-6 hidden md:flex">
        <div className="text-xl font-bold tracking-tight mb-8 flex items-center gap-2">
          Skripsi<span className="text-accent-blue">Mate</span>
        </div>

        <button 
          onClick={createNewChat}
          className="w-full mb-8 flex items-center justify-center gap-2 py-4 bg-accent-blue/10 text-accent-blue border border-accent-blue/20 rounded-xl hover:bg-accent-blue/20 transition-all font-semibold text-xs active:scale-95 cursor-pointer shadow-sm"
        >
          <Plus className="w-5 h-5" /> {t('Chat Baru', 'New Chat')}
        </button>
        
        <div className="history-label text-[10px] uppercase tracking-wider text-text-dim mb-4">
          {t('Riwayat Chat', 'Previous Chats')}
        </div>
        
        <div className="space-y-1 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap transition-all border",
                currentSessionId === session.id 
                  ? "bg-accent-blue/10 text-accent-blue border-accent-blue/20" 
                  : "text-text-dim hover:bg-white/5 border-transparent"
              )}
            >
              {session.title || t('Sesi Baru', 'New Session')}
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="px-3 py-2 rounded-lg text-xs text-text-dim/50 italic">
              {t('Belum ada riwayat', 'No history yet')}
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 space-y-4">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetProfile();
            }}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-text-dim transition-all active:scale-95 cursor-pointer"
          >
            <History className="w-5 h-5" /> {t('Atur Ulang Profil', 'Reset Profile')}
          </button>
          
          <div className="text-[10px] text-center text-text-dim/40 font-mono tracking-tighter">
            build by funfayct
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative min-w-0">
        <div className="glow-light top-1/4 left-1/2 -translate-x-1/2 opacity-20 pointer-events-none" />
        
        {/* Header - matching Sleek Interface Header */}
        <header className="h-16 px-6 md:px-10 flex items-center justify-between border-b border-white/10 relative z-30 bg-bg-dark/50 backdrop-blur-md">
          <div className="text-sm font-medium text-text-dim flex items-center gap-2">
            <span className="hidden sm:inline">{onboarding.major} •</span> 
            <span>{t('Ideasi Terpandu', 'Guided Ideation')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={createNewChat}
              className="p-2.5 hover:bg-white/5 rounded-full text-text-dim hover:text-accent-blue transition-all active:scale-90"
              title={t('Chat Baru', 'New Chat')}
            >
              <Plus className="w-5 h-5" />
            </button>
            <div className="bg-white/5 border border-white/10 rounded-full px-3 py-1 flex gap-3 text-[10px]">
              <span className={cn(onboarding.language === 'en' ? "text-text-dim" : "text-accent-blue font-bold cursor-default")}>ID</span>
              <span className="opacity-20">|</span>
              <span className={cn(onboarding.language === 'en' ? "text-accent-blue font-bold cursor-default" : "text-text-dim")}>EN</span>
            </div>
            <button 
              onClick={clearChat}
              className="p-2.5 hover:bg-white/5 rounded-full text-text-dim hover:text-red-400 transition-all active:scale-90"
              title={t('Hapus Sesi', 'Delete Session')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button 
              onClick={resetProfile}
              className="p-2.5 hover:bg-white/5 rounded-full text-text-dim hover:text-white transition-all active:scale-90 md:hidden"
              title={t('Atur Ulang Profil', 'Reset Profile')}
            >
              <History className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Chat Messages - using bubble-ai and bubble-user classes */}
        <main 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-10 space-y-6 relative"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
              <Sparkles className="w-16 h-16 text-accent-blue" />
              <div className="space-y-1">
                <h2 className="text-xl font-medium">{t('Mulai Sekarang', 'Start Now')}</h2>
                <p className="text-sm max-w-xs">{t('Aku siap membantumu membedah ide skripsi yang paling seru.', 'I\'m ready to help you dissect the most exciting thesis ideas.')}</p>
              </div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[80%] text-[15px] px-5 py-4",
                msg.role === 'user' ? "bubble-user" : "bubble-ai"
              )}>
                <div 
                  className="prose prose-sm prose-invert"
                  dangerouslySetInnerHTML={{ 
                    __html: msg.parts[0].text
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br />') 
                  }}
                />
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bubble-ai flex gap-1 items-center px-4 py-3">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-text-dim rounded-full" />
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-text-dim rounded-full" />
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-text-dim rounded-full" />
              </div>
            </motion.div>
          )}
        </main>

        {/* Input Area - Sleek Interface Input Container */}
        <footer className="p-10 relative">
          <div className="max-w-4xl mx-auto relative group">
            <div className="chat-glow absolute -top-32 left-1/2 -translate-x-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <div className="text-[10px] text-accent-blue/80 font-semibold mb-2 ml-4">
              {t('Fase Ideasi: Eksplorasi Judul', 'Ideation Phase: Title Exploration')}
            </div>

            <div className="relative flex flex-col gap-3 p-5 glass rounded-3xl border border-white/10 group-focus-within:border-accent-blue/30 group-focus-within:bg-accent-blue/5 transition-all duration-500 shadow-2xl">
              <div className="flex flex-wrap gap-2">
                <div className="field-pill">{t('Jurusan', 'Major')}: {onboarding.major}</div>
                <div className="field-pill">{t('Tahun', 'Year')}: {onboarding.year}</div>
                <div className="field-pill">{t('Lokasi', 'Location')}: {onboarding.location}</div>
                <div className="field-pill border-accent-blue/30 text-text-main">{t('Hobi & Rencana...', 'Hobbies & Plans...')}</div>
              </div>

              <div className="flex items-center gap-3">
                <input 
                  type="text"
                  className="flex-1 bg-transparent px-2 py-1 outline-none text-sm placeholder:text-text-dim/50"
                  placeholder={t('Mulai cari judul, atau tambahkan info spesifik (misal: lokasi penelitian spesifik)', 'Start looking for titles, or add specific info (e.g., specific research location)')}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button 
                  disabled={!input.trim() || isLoading}
                  onClick={handleSend}
                  className="w-10 h-10 bg-accent-blue text-white rounded-full flex items-center justify-center hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-blue-500/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="text-[10px] text-text-dim text-center mt-4 opacity-50 font-medium">
              SkripsiMate v2.0 • {t('Didesain untuk membuka ide-idemu', 'Designed to open your ideas')}
            </div>
          </div>
        </footer>
      </div>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card max-w-sm w-full space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-bold">{confirmModal.title}</h3>
                <p className="text-text-dim text-sm">{confirmModal.message}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-colors"
                >
                  {t('Batal', 'Cancel')}
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20"
                >
                  {t('Ya, Lanjutkan', 'Yes, Continue')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

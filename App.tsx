import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { LiveVoiceChat } from './components/LiveVoiceChat';
import { Message, Attachment, ChatSession, UserProfile, AppSettings } from './types';
import { streamChat, generateTitle, generateSpeech, generateImage } from './services/geminiService';
import { GenixLogo } from './components/GenixLogo';
import { ThemeToggle } from './components/ThemeToggle';

const SUGGESTIONS = [
  { label: "AI Revolution", prompt: "How is Artificial Intelligence reshaping the job market and creative industries?" },
  { label: "Space Exploration", prompt: "What are the latest developments in the mission to colonize Mars?" },
  { label: "Health & Longevity", prompt: "What are the most promising scientific breakthroughs in extending human lifespan?" },
  { label: "Quantum Tech", prompt: "Explain the potential impact of quantum computing on cryptography and security." },
  { label: "Climate Solutions", prompt: "What are the most effective emerging technologies for combating climate change?" },
  { label: "Future of Work", prompt: "How will remote work and digital nomadism evolve in the next decade?" },
  { label: "Neuroscience", prompt: "Explain the concept of neuroplasticity and how to improve brain health." },
  { label: "Electric Vehicles", prompt: "What is the future of solid-state batteries in electric vehicles?" },
  { label: "Web3 & Crypto", prompt: "Explain the difference between Proof of Work and Proof of Stake in simple terms." },
  { label: "Sustainable Food", prompt: "What are the benefits and challenges of lab-grown meat and vertical farming?" },
  { label: "Cybersecurity", prompt: "What are the top cybersecurity threats facing individuals in 2024?" },
  { label: "Mental Wellness", prompt: "Suggest 5 evidence-based habits for improving mental resilience." }
];

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTemporaryMode, setIsTemporaryMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLiveChatOpen, setIsLiveChatOpen] = useState(false);
  const [randomSuggestions, setRandomSuggestions] = useState<typeof SUGGESTIONS>([]);
  
  // Animation state
  const [welcomeText, setWelcomeText] = useState("");
  
  // App Settings including Theme
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('genix_settings');
    return saved ? JSON.parse(saved) : {
        theme: 'light',
        language: 'Auto-detect',
        customInstructions: '',
        enableHistory: true,
        emailNotifications: true,
        mfaEnabled: false,
        autoPlayVoice: false
    };
  });
  
  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('genix_user_profile');
    return saved ? JSON.parse(saved) : { name: 'arafat ksa', email: 'arafat@example.com' };
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const stopStreamingRef = useRef<boolean>(false);

  // Update localStorage when settings change
  useEffect(() => {
    localStorage.setItem('genix_settings', JSON.stringify(settings));
  }, [settings]);

  // Save User Profile
  useEffect(() => {
    localStorage.setItem('genix_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  // Load History from Local Storage
  useEffect(() => {
    const saved = localStorage.getItem('gemini_chat_history');
    if (saved) {
        try {
            const parsedSessions = JSON.parse(saved);
            setSessions(parsedSessions);
        } catch (error) {
            console.error("Failed to load chat history:", error);
        }
    }
  }, []);

  // Save History to Local Storage (Filter out temporary sessions)
  // IMPORTANT: We strip out large base64 audio data to prevent hitting localStorage quotas
  useEffect(() => {
    if (settings.enableHistory) {
        const sessionsToSave = sessions
            .filter(s => !s.isTemporary)
            .map(session => ({
                ...session,
                messages: session.messages.map(msg => {
                    // Create a copy of the message without the heavy audioData
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { audioData, ...rest } = msg;
                    return rest;
                })
            }));

        try {
            localStorage.setItem('gemini_chat_history', JSON.stringify(sessionsToSave));
        } catch (error) {
            console.error("Failed to save chat history to localStorage:", error);
        }
    }
  }, [sessions, settings.enableHistory]);

  // Derive current messages
  const currentMessages = useMemo(() => {
      return sessions.find(s => s.id === currentSessionId)?.messages || [];
  }, [sessions, currentSessionId]);

  // Welcome Text Animation and Random Suggestions
  useEffect(() => {
    if (currentMessages.length === 0) {
      const messages = [
          "How can I help you today?",
          "What can I do for you?",
          "Let's explore new ideas.",
          "I can help write, plan, and learn.",
          "What's on your mind?"
      ];
      
      let msgIndex = 0;
      let charIndex = 0;
      let isDeleting = false;
      let timeoutId: any;

      const type = () => {
        const currentMsg = messages[msgIndex];
        
        if (isDeleting) {
            setWelcomeText(currentMsg.substring(0, charIndex - 1));
            charIndex--;
            if (charIndex === 0) {
                isDeleting = false;
                msgIndex = (msgIndex + 1) % messages.length;
                timeoutId = setTimeout(type, 500); // Wait before typing next
            } else {
                timeoutId = setTimeout(type, 30); // Deleting speed
            }
        } else {
            setWelcomeText(currentMsg.substring(0, charIndex + 1));
            charIndex++;
            if (charIndex === currentMsg.length) {
                isDeleting = true;
                timeoutId = setTimeout(type, 3000); // Wait before deleting
            } else {
                timeoutId = setTimeout(type, 50); // Typing speed
            }
        }
      };

      type();

      // Refresh suggestions when in "new chat" state
      if (!currentSessionId) {
         setRandomSuggestions([...SUGGESTIONS].sort(() => 0.5 - Math.random()).slice(0, 4));
      }

      return () => clearTimeout(timeoutId);
    }
  }, [currentMessages.length, currentSessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, currentMessages[currentMessages.length - 1]?.content]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
  };

  const handleToggleTemporaryMode = () => {
      const newMode = !isTemporaryMode;
      setIsTemporaryMode(newMode);
      setCurrentSessionId(null); // Clear current view to start fresh
      setIsSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
      setCurrentSessionId(id);
      setIsSidebarOpen(false);
      const session = sessions.find(s => s.id === id);
      if (session && !session.isTemporary) {
          setIsTemporaryMode(false);
      }
  };

  const handleDeleteSession = (id: string) => {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) {
          setCurrentSessionId(null);
      }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleClearAllSessions = () => {
      // Only clear saved sessions
      setSessions(prev => prev.filter(s => s.isTemporary));
      if (!isTemporaryMode) {
        setCurrentSessionId(null);
      }
  };

  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative' | undefined) => {
      setSessions(prev => prev.map(s => 
          s.id === currentSessionId
            ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, feedback } : m) }
            : s
      ));
  };

  const handleGenerateAudio = async (messageId: string, text: string) => {
      setSessions(prev => prev.map(s => 
          s.id === currentSessionId
            ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, isGeneratingAudio: true } : m) }
            : s
      ));

      const audioData = await generateSpeech(text);
      
      setSessions(prev => prev.map(s => 
          s.id === currentSessionId
            ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, audioData, isGeneratingAudio: false } : m) }
            : s
      ));
  };

  const handleGenerateImage = async (prompt: string) => {
      if (isLoading) return;
      
      const sessionId = currentSessionId || Date.now().toString();
      if (!currentSessionId) {
          const newSession: ChatSession = {
              id: sessionId,
              title: "Image Generation",
              messages: [],
              isTemporary: isTemporaryMode
          };
          setSessions(prev => [newSession, ...prev]);
          setCurrentSessionId(sessionId);
      }

      // Add user message
      const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: `Generate an image: ${prompt}`,
          timestamp: Date.now(),
      };

      setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, userMessage]
      } : s));

      setIsLoading(true);

      // Add placeholder bot message
      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
          id: botMessageId,
          role: 'model',
          content: 'Generating image...',
          timestamp: Date.now(),
          isStreaming: true
      };

      setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, botMessage]
      } : s));

      try {
          const base64Image = await generateImage(prompt);
          
          if (base64Image) {
              const imageUrl = `data:image/png;base64,${base64Image}`;
              
              // Update bot message with image attachment
              setSessions(prev => prev.map(s => s.id === sessionId ? {
                  ...s,
                  messages: s.messages.map(m => m.id === botMessageId ? {
                      ...m,
                      content: `Here is the image for: "${prompt}"`,
                      isStreaming: false,
                      attachments: [{
                          file: new File([], "generated-image.png", { type: "image/png" }), // Dummy file object
                          previewUrl: imageUrl,
                          mimeType: "image/png"
                      }]
                  } : m)
              } : s));
          } else {
              setSessions(prev => prev.map(s => s.id === sessionId ? {
                  ...s,
                  messages: s.messages.map(m => m.id === botMessageId ? {
                      ...m,
                      content: "Sorry, I couldn't generate an image at this time.",
                      isStreaming: false
                  } : m)
              } : s));
          }
      } catch (error) {
          console.error("Image generation error:", error);
          setSessions(prev => prev.map(s => s.id === sessionId ? {
              ...s,
              messages: s.messages.map(m => m.id === botMessageId ? {
                  ...m,
                  content: "Error generating image.",
                  isStreaming: false
              } : m)
          } : s));
      } finally {
          setIsLoading(false);
      }
  };

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    if (isLoading) return;
    
    stopStreamingRef.current = false;

    let sessionId = currentSessionId;
    let isNewChat = false;

    // 1. Create new session if needed
    if (!sessionId) {
        sessionId = Date.now().toString();
        const newSession: ChatSession = {
            id: sessionId,
            title: text.length > 30 ? text.substring(0, 30) + '...' : text,
            messages: [],
            isTemporary: isTemporaryMode
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(sessionId);
        isNewChat = true;
    }

    // 2. Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      attachments,
      timestamp: Date.now(),
    };

    setSessions((prev) => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: [...s.messages, userMessage]
    } : s));
    
    setIsLoading(true);

    // 3. Add placeholder AI message
    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      role: 'model',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setSessions((prev) => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: [...s.messages, botMessage]
    } : s));

    // 4. Prepare History for API
    const sessionHistory = isNewChat ? [] : (sessions.find(s => s.id === sessionId)?.messages || []);
    
    const history = sessionHistory.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
    }));

    try {
        // Pass customInstructions if available
        const stream = streamChat(history, text, attachments, settings.customInstructions);
        
        let fullContent = "";
        let lastUpdateTime = Date.now();

        for await (const chunk of stream) {
            if (stopStreamingRef.current) {
                break;
            }

            if (chunk.startsWith("__GENERATE_IMAGE__:")) {
                const prompt = chunk.replace("__GENERATE_IMAGE__:", "");
                handleGenerateImage(prompt);
                // Remove the placeholder model message since handleGenerateImage adds its own
                setSessions(prev => prev.map(s => s.id === sessionId ? {
                    ...s,
                    messages: s.messages.filter(m => m.id !== botMessageId)
                } : s));
                setIsLoading(false);
                return;
            }

            fullContent += chunk;
            const now = Date.now();
            
            // Batch DOM updates: Update state at most every 100ms
            if (now - lastUpdateTime > 100) {
                setSessions((prev) => 
                    prev.map((s) => 
                        s.id === sessionId 
                            ? { 
                                ...s, 
                                messages: s.messages.map(m => 
                                    m.id === botMessageId ? { ...m, content: fullContent } : m
                                ) 
                              } 
                            : s
                    )
                );
                lastUpdateTime = now;
            }
        }

        // Final update to set content and streaming status
        setSessions((prev) => 
            prev.map((s) => 
                s.id === sessionId 
                    ? { 
                        ...s, 
                        messages: s.messages.map(m => 
                            m.id === botMessageId ? { ...m, content: fullContent, isStreaming: false } : m
                        ) 
                      } 
                    : s
            )
        );

        // Generate Title if new chat (and wasn't stopped immediately)
        // Only generate title if NOT temporary
        if (isNewChat && fullContent.length > 0 && !isTemporaryMode) {
            generateTitle(text, fullContent).then((newTitle) => {
                if (newTitle) {
                     setSessions((prev) => 
                        prev.map((s) => 
                            s.id === sessionId ? { ...s, title: newTitle } : s
                        )
                    );
                }
            });
        }

        // Auto-play voice if enabled
        if (settings.autoPlayVoice && fullContent.length > 0) {
            // Strip HTML tags for TTS
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = fullContent;
            const textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
            handleGenerateAudio(botMessageId, textToSpeak);
        }

    } catch (error) {
        console.error("Stream error", error);
        setSessions((prev) => 
            prev.map((s) => 
                s.id === sessionId 
                    ? { 
                        ...s, 
                        messages: s.messages.map(m => 
                            m.id === botMessageId ? { ...m, content: "Error: Could not generate response.", isStreaming: false } : m
                        ) 
                      } 
                    : s
            )
        );
    } finally {
        setIsLoading(false);
    }
  };

  const handleStopResponse = () => {
     stopStreamingRef.current = true;
     setIsLoading(false);
  };

  const handleToggleSettings = (isOpen: boolean) => {
      setIsSettingsOpen(isOpen);
  };

  // Filter sessions passed to sidebar (hide temporary ones from history list)
  const sidebarSessions = sessions.filter(s => !s.isTemporary);

  return (
    <div className={`${settings.theme}`}>
        {/* Live Voice Chat Overlay */}
        <LiveVoiceChat 
            isOpen={isLiveChatOpen} 
            onClose={() => setIsLiveChatOpen(false)} 
            apiKey={process.env.API_KEY || ""}
        />

        <div className="flex h-screen overflow-hidden bg-white text-gray-900 dark:bg-[#212121] dark:text-white transition-colors duration-200">
        {/* Sidebar */}
        <Sidebar 
            isOpen={isSidebarOpen} 
            toggleSidebar={toggleSidebar} 
            onNewChat={handleNewChat}
            sessions={sidebarSessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onClearAllSessions={handleClearAllSessions}
            settings={settings}
            onUpdateSettings={setSettings}
            userProfile={userProfile}
            onUpdateProfile={setUserProfile}
            isSettingsOpen={isSettingsOpen}
            onToggleSettings={handleToggleSettings}
        />

        {/* Main Content */}
        <div className="flex flex-1 flex-col h-full relative bg-white dark:bg-[#212121] transition-colors duration-300">
            {/* Mobile Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-3 lg:hidden border-b bg-white dark:bg-[#212121] border-gray-200 dark:border-none transition-colors duration-300">
            <button 
                type="button" 
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                onClick={toggleSidebar}
            >
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <span className="font-medium text-gray-700 dark:text-gray-200">GENIX AI</span>
            
            <div className="flex items-center gap-3">
                {/* Live Voice Chat Button */}
                <button 
                    type="button" 
                    className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10"
                    onClick={() => setIsLiveChatOpen(true)}
                >
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                    Live
                </button>

                {/* Temporary Chat Toggle Icon */}
                <button 
                    type="button" 
                    className={`transition-colors ${isTemporaryMode ? 'text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                    onClick={handleToggleTemporaryMode} 
                    title={isTemporaryMode ? "Disable Temporary Chat" : "Enable Temporary Chat"}
                >
                    {isTemporaryMode ? (
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                    ) : (
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                            <path d="M15 9h.01"></path>
                            <path d="M15 15h.01"></path>
                        </svg>
                    )}
                </button>
            </div>
            </div>
            
            {/* Temporary Chat Banner */}
            {isTemporaryMode && (
                <div className="w-full bg-gray-800 dark:bg-gray-800/80 text-white text-xs font-medium text-center py-2 flex items-center justify-center gap-2 shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    Temporary Chat Enabled - History will not be saved
                </div>
            )}

            {/* Chat Scroll Area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto w-full scroll-smooth">
            {currentMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full shadow-sm dark:shadow-lg bg-gray-100 dark:bg-white text-black">
                    <GenixLogo className="h-10 w-10 text-gray-800 dark:text-black" />
                </div>
                <h2 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white min-h-[32px]">
                    {welcomeText}
                    <span className="inline-block w-2.5 h-6 ml-1 align-middle bg-gray-800 dark:bg-white animate-pulse" />
                </h2>
                {isTemporaryMode && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-8">
                        Messages vanish after you close this session.
                    </p>
                )}

                {/* Random Suggestions Grid */}
                <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                    {randomSuggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => handleSendMessage(s.prompt, [])}
                            className="flex flex-col items-start justify-center gap-1 rounded-xl border bg-transparent px-4 py-3 text-left transition-colors group border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#2f2f2f]"
                        >
                            <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 group-hover:text-black dark:group-hover:text-white">{s.label}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 opacity-80 group-hover:opacity-100">{s.prompt}</span>
                        </button>
                    ))}
                </div>

                </div>
            ) : (
                <div className="flex flex-col pt-4 md:pt-10 pb-4">
                {currentMessages.map((msg) => (
                    <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    onFeedback={handleFeedback} 
                    onGenerateAudio={handleGenerateAudio}
                    autoPlayVoice={settings.autoPlayVoice}
                    />
                ))}
                <div ref={messagesEndRef} className="h-4" />
                </div>
            )}
            </div>

            {/* Input Area (Sticky Bottom) */}
            <div className="relative transition-colors duration-200 bg-white dark:bg-[#212121]">
                {isLoading && (
                    <div className="absolute -top-14 left-0 w-full flex justify-center">
                        <button
                            onClick={handleStopResponse}
                            className="flex items-center gap-2 bg-white dark:bg-[#2f2f2f] text-gray-700 dark:text-white px-4 py-2 rounded-full border border-gray-200 dark:border-gray-600/50 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                            Stop generating
                        </button>
                    </div>
                )}
                <ChatInput 
                onSend={handleSendMessage} 
                isLoading={isLoading}
                onStop={handleStopResponse}
                onClear={handleClearAllSessions}
                onGenerateImage={handleGenerateImage}
                onToggleSettings={() => handleToggleSettings(!isSettingsOpen)}
                onLiveChat={() => setIsLiveChatOpen(true)}
                />
            </div>
        </div>
        </div>
    </div>
  );
};

export default App;
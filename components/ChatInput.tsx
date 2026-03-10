import React, { useRef, useState, useEffect } from 'react';
import { Attachment } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  onStop: () => void;
  isTemporary?: boolean;
  onClear?: () => void;
  onGenerateImage?: (prompt: string) => void;
  onToggleSettings?: () => void;
  onLiveChat?: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const COMMON_PROMPTS = [
  "How to use Gemini?",
  "What is Quantum Physics?",
  "Write a code for me",
  "Explain the theory of relativity",
  "Draft a professional email",
  "Give me a recipe for pasta",
  "Debug this JavaScript code",
  "Translate hello to Spanish",
  "Write a poem about nature",
  "Plan a 3-day trip to Paris"
];

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, onStop, isTemporary = false, onClear, onGenerateImage, onToggleSettings, onLiveChat }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Placeholder animation state
  const [placeholder, setPlaceholder] = useState("Message Genix AI...");

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleImageSubmit = () => {
      if (imagePrompt.trim() && onGenerateImage) {
          onGenerateImage(imagePrompt);
          setImagePrompt('');
          setIsImageModalOpen(false);
      }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          handleImageSubmit();
      }
      if (e.key === 'Escape') {
          setIsImageModalOpen(false);
      }
  };

  // Filter suggestions logic
  useEffect(() => {
    if (input.trim()) {
      const lowerInput = input.toLowerCase();
      const matches = COMMON_PROMPTS.filter(prompt => 
        prompt.toLowerCase().includes(lowerInput) && 
        prompt.toLowerCase() !== lowerInput
      );
      setFilteredSuggestions(matches);
    } else {
      setFilteredSuggestions([]);
    }
  }, [input]);
  
  // Placeholder typewriter animation
  useEffect(() => {
      const prompts = [
          "Message Genix AI...",
          "Brainstorm ideas for a startup...",
          "Explain quantum physics...",
          "Write a python script...",
          "Summarize this article...",
          "Help me plan a trip to Japan...",
          "Create a workout plan..."
      ];
      
      let currentPromptIndex = 0;
      let charIndex = 0;
      let isDeleting = false;
      let timeoutId: any;

      const type = () => {
          const currentPrompt = prompts[currentPromptIndex];
          
          if (isDeleting) {
              setPlaceholder(currentPrompt.substring(0, charIndex - 1));
              charIndex--;
              if (charIndex === 0) {
                  isDeleting = false;
                  currentPromptIndex = (currentPromptIndex + 1) % prompts.length;
                  timeoutId = setTimeout(type, 500); // Wait before typing next
              } else {
                  timeoutId = setTimeout(type, 30); // Deleting speed
              }
          } else {
              setPlaceholder(currentPrompt.substring(0, charIndex + 1));
              charIndex++;
              if (charIndex === currentPrompt.length) {
                  isDeleting = true;
                  timeoutId = setTimeout(type, 2000); // Wait before deleting
              } else {
                  timeoutId = setTimeout(type, 50); // Typing speed
              }
          }
      };

      timeoutId = setTimeout(type, 1000);

      return () => clearTimeout(timeoutId);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    onSend(input, attachments);
    setInput('');
    setAttachments([]);
    setFilteredSuggestions([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSend(suggestion, attachments);
    setInput('');
    setAttachments([]);
    setFilteredSuggestions([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAttachments: Attachment[] = [];
      Array.from(e.target.files).forEach((file: File) => {
        const url = URL.createObjectURL(file);
        newAttachments.push({
            file,
            previewUrl: url,
            mimeType: file.type
        });
      });
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support speech recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one sentence/pause
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const lowerTranscript = transcript.toLowerCase().trim();

      // Voice Commands
      if (lowerTranscript === 'send message' || lowerTranscript === 'send' || lowerTranscript === 'submit') {
          // We need to wait for state update if we just appended text, 
          // but here we are replacing logic. 
          // If the user said "send", we probably want to send what's in the buffer + "send"? 
          // No, usually "send" is a command.
          // However, since setInput is async, we might be sending empty string if we rely on 'input' state directly 
          // after setting it. 
          // A better approach for voice commands is to check if the transcript IS the command.
          
          // If input has text, send it.
          if (input.trim()) {
             handleSend();
          }
      } else if (lowerTranscript === 'clear chat' || lowerTranscript === 'clear history' || lowerTranscript === 'reset chat' || lowerTranscript === 'delete chat' || lowerTranscript === 'reset') {
          if (onClear) {
              onClear();
          } else {
              setInput('');
          }
      } else if (lowerTranscript === 'stop generating' || lowerTranscript === 'stop' || lowerTranscript === 'cancel' || lowerTranscript === 'halt') {
          onStop();
      } else if ((lowerTranscript === 'open settings' || lowerTranscript === 'toggle settings' || lowerTranscript === 'settings' || lowerTranscript === 'show settings' || lowerTranscript === 'preferences') && onToggleSettings) {
          onToggleSettings();
      } else if (lowerTranscript === 'generate image' || lowerTranscript === 'create image' || lowerTranscript === 'make an image' || lowerTranscript === 'open image generator') {
          setIsImageModalOpen(true);
      } else {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="w-full transition-colors duration-300 bg-white dark:bg-[#212121]">
      <div className="mx-auto max-w-3xl px-4 md:px-0 relative">
        
        {/* Search Suggestions */}
        {filteredSuggestions.length > 0 && (
            <ul className="absolute bottom-full left-4 right-4 md:left-0 md:right-0 mb-2 bg-white dark:bg-[#2f2f2f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-20 max-h-60 overflow-y-auto">
                {filteredSuggestions.map((suggestion, index) => (
                    <li key={index} className="border-b border-gray-100 dark:border-white/5 last:border-0">
                        <button
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3"
                            onClick={() => handleSuggestionClick(suggestion)}
                        >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <span className="truncate">{suggestion}</span>
                        </button>
                    </li>
                ))}
            </ul>
        )}

        {/* Attachment Previews */}
        {attachments.length > 0 && (
            <div className="flex gap-3 mb-2 overflow-x-auto py-2 px-2">
                {attachments.map((att, i) => (
                    <div key={i} className="relative group shrink-0">
                        {att.mimeType.startsWith('image/') ? (
                             <img src={att.previewUrl} alt="preview" className="h-14 w-14 object-cover rounded-xl border border-gray-200 dark:border-white/10" />
                        ) : (
                            <div className="h-14 w-14 flex items-center justify-center bg-gray-100 dark:bg-[#2f2f2f] rounded-xl border border-gray-200 dark:border-white/10 text-[10px] p-1 text-center text-gray-600 dark:text-gray-300 break-all">
                                {att.file.name.slice(0, 10)}...
                            </div>
                        )}
                        <button 
                            onClick={() => removeAttachment(i)}
                            className="absolute -top-1 -right-1 bg-black/50 hover:bg-black/80 rounded-full p-0.5 text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        )}

        {/* Input Bar */}
        <div className="relative flex w-full flex-col rounded-[26px] p-1.5 transition-colors focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-white/20 bg-gray-100 dark:bg-[#2f2f2f]">
          <input 
            type="file" 
            multiple 
            ref={fileInputRef}
            className="hidden" 
            onChange={handleFileSelect}
            accept="image/*, application/pdf, text/csv, text/plain"
          />
          
          <div className="flex items-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mb-1 rounded-full p-2 text-gray-500 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-black/20 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="Attach file"
              >
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              </button>
              
              {onGenerateImage && (
                  <button
                    onClick={() => setIsImageModalOpen(true)}
                    className="mb-1 rounded-full p-2 text-gray-500 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-black/20 hover:text-gray-900 dark:hover:text-white transition-colors"
                    title="Generate Image"
                  >
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  </button>
              )}
              
              <button
                onClick={toggleRecording}
                className={`mb-1 rounded-full p-2 transition-colors ${isRecording ? 'bg-red-500/10 text-red-500 animate-pulse' : 'text-gray-500 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-black/20 hover:text-gray-900 dark:hover:text-white'}`}
                title="Voice Input"
              >
                {isRecording ? (
                     <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path></svg>
                ) : (
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                )}
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent py-3 text-base text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none overflow-y-auto"
              ></textarea>

              <button
                onClick={isLoading ? onStop : handleSend}
                className={`mb-1 rounded-full p-2 transition-colors ${
                    (input.trim() || attachments.length > 0) || isLoading
                    ? 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90' 
                    : 'bg-[#e5e5e5] dark:bg-[#676767] text-gray-400 dark:text-[#2f2f2f] cursor-not-allowed opacity-50'
                }`}
                disabled={!isLoading && !input.trim() && attachments.length === 0}
              >
                {isLoading ? (
                    <div className="h-5 w-5 flex items-center justify-center">
                         <div className="h-3 w-3 bg-white dark:bg-black rounded-[2px]"></div>
                    </div>
                ) : (
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                )}
              </button>
          </div>
        </div>
        {/* Image Generation Modal */}
        <AnimatePresence>
            {isImageModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsImageModalOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
                        className="w-full max-w-md bg-white dark:bg-[#212121] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden z-10"
                    >
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Generate Image</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Describe what you want to see</p>
                            </div>
                            <button 
                                onClick={() => setIsImageModalOpen(false)} 
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={imagePrompt}
                                onChange={(e) => setImagePrompt(e.target.value)}
                                onKeyDown={handleModalKeyDown}
                                placeholder="A futuristic city with neon lights and flying cars, digital art style..."
                                className="w-full h-40 p-4 rounded-2xl bg-gray-50 dark:bg-[#2f2f2f] border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none resize-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                autoFocus
                            />
                            <div className="mt-2 flex justify-between items-center">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
                                    Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">Enter</kbd> to generate
                                </span>
                                <span className="text-xs text-gray-400">{imagePrompt.length} characters</span>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 dark:bg-[#2f2f2f]/50 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsImageModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleImageSubmit}
                                disabled={!imagePrompt.trim()}
                                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-500/20"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                Generate
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <div className="px-2 py-3 text-center text-[11px] text-gray-500 dark:text-gray-500">
            Genix AI can make mistakes. Check important info.
        </div>
      </div>
    </div>
  );
};
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { GenixLogo } from './GenixLogo';
import { motion } from 'motion/react';
import { useVoice } from '../src/contexts/VoiceContext';

interface ChatMessageProps {
  message: Message;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative' | undefined) => void;
  onGenerateAudio?: (messageId: string, text: string) => Promise<void>;
  autoPlayVoice?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onFeedback, onGenerateAudio, autoPlayVoice }) => {
  const isUser = message.role === 'user';
  const [isCopied, setIsCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const { visualizerData, setVisualizerData, isAiSpeaking, setIsAiSpeaking } = useVoice();
  
  // Auto-play when audioData becomes available if autoPlayVoice is enabled
  useEffect(() => {
    if (autoPlayVoice && message.audioData && !isPlaying && pausedTimeRef.current === 0) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        setShowControls(true);
        playAudio(message.audioData!, false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [message.audioData, autoPlayVoice]);

  // Sync loading state with message.isGeneratingAudio
  useEffect(() => {
    if (message.isGeneratingAudio) {
      setIsLoadingAudio(true);
    } else {
      setIsLoadingAudio(false);
    }
  }, [message.isGeneratingAudio]);

  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const handleCopy = () => {
    if (!message.content) return;
    
    // For copying, we might want to strip HTML tags if it's the model message, 
    // or copy the raw text. Let's try to copy the visible text content.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message.content;
    const textToCopy = isUser ? message.content : (tempDiv.textContent || tempDiv.innerText || "");
    
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const stopAudio = () => {
      if (sourceRef.current) {
          try {
              sourceRef.current.stop();
          } catch (e) {
              // Ignore errors if already stopped
          }
          sourceRef.current = null;
      }
      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
      }
      setIsPlaying(false);
      setIsAiSpeaking(false);
      pausedTimeRef.current = 0;
      setCurrentTime(0);
  };

  const pauseAudio = () => {
      if (sourceRef.current && audioContextRef.current) {
          try {
              sourceRef.current.stop();
              pausedTimeRef.current += audioContextRef.current.currentTime - startTimeRef.current;
          } catch (e) {
              // Ignore
          }
          sourceRef.current = null;
      }
      if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
      }
      setIsPlaying(false);
      setIsAiSpeaking(false);
  };

  const decodeAudioData = async (base64Data: string, context: AudioContext): Promise<AudioBuffer> => {
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      try {
          // Try decoding as WAV/MP3 first
          const bufferCopy = bytes.buffer.slice(0);
          return await context.decodeAudioData(bufferCopy);
      } catch (e) {
          // Fallback to Raw PCM (16-bit, 24kHz, Mono)
          const int16Data = new Int16Array(bytes.buffer);
          const float32Data = new Float32Array(int16Data.length);
          
          for (let i = 0; i < int16Data.length; i++) {
              float32Data[i] = int16Data[i] / 32768.0;
          }

          const buffer = context.createBuffer(1, float32Data.length, 24000);
          buffer.getChannelData(0).set(float32Data);
          return buffer;
      }
  };

  // Pre-load duration when audioData is available
  useEffect(() => {
      if (message.audioData && !duration) {
          const loadDuration = async () => {
              try {
                  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                  const tempContext = new AudioContextClass();
                  const buffer = await decodeAudioData(message.audioData!, tempContext);
                  setDuration(buffer.duration);
                  audioBufferRef.current = buffer; // Cache it
                  tempContext.close();
              } catch (e) {
                  console.error("Failed to load audio duration", e);
              }
          };
          loadDuration();
      }
  }, [message.audioData, duration]);

  const playAudio = async (base64Data: string, resume: boolean = false) => {
    try {
      if (!resume) {
          stopAudio(); // Stop any current playback if starting fresh
      }

      // Create AudioContext if needed
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
      }
      const audioContext = audioContextRef.current;

      // Use cached buffer or decode
      let audioBuffer = audioBufferRef.current;
      if (!audioBuffer) {
          audioBuffer = await decodeAudioData(base64Data, audioContext);
          audioBufferRef.current = audioBuffer;
          setDuration(audioBuffer.duration);
      }

      if (audioContext && audioBuffer) {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          
          const gainNode = audioContext.createGain();
          gainNode.gain.value = volume;
          
          // Create analyzer for TTS visualizer
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          source.connect(analyser);
          analyser.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          sourceRef.current = source;
          gainNodeRef.current = gainNode;
          
          const startOffset = resume ? pausedTimeRef.current : 0;
          startTimeRef.current = audioContext.currentTime;
          
          source.start(0, startOffset);
          
          const updatePlayback = () => {
              if (sourceRef.current && isPlaying) {
                  setIsAiSpeaking(true);
                  // Update Visualizer
                  analyser.getByteFrequencyData(dataArray);
                  const sum = dataArray.reduce((a, b) => a + b, 0);
                  const avg = sum / dataArray.length;
                  
                  setVisualizerData(prev => {
                      const newData = [...prev.slice(1), (avg / 255) * 100];
                      return newData;
                  });

                  // Update Progress (Seeker)
                  if (!isDragging) {
                      const elapsed = audioContext.currentTime - startTimeRef.current + pausedTimeRef.current;
                      const newTime = Math.min(elapsed, duration);
                      setCurrentTime(newTime);
                      
                      if (elapsed >= duration) {
                          setIsPlaying(false);
                          setIsAiSpeaking(false);
                          pausedTimeRef.current = 0;
                          setCurrentTime(0);
                          return; // Stop the loop
                      }
                  }
                  
                  animationFrameRef.current = requestAnimationFrame(updatePlayback);
              }
          };

          setIsPlaying(true);
          updatePlayback();
      }

    } catch (error) {
      console.error("Audio playback error:", error);
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      pauseAudio();
      return;
    }

    if (message.audioData) {
      setShowControls(true);
      playAudio(message.audioData, pausedTimeRef.current > 0);
    } else if (onGenerateAudio) {
      setIsLoadingAudio(true);
      // Don't show controls yet, show placeholder instead
      // Strip HTML tags for TTS
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = message.content;
      const textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
      
      await onGenerateAudio(message.id, textToSpeak);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = newVolume;
      }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentTime(parseFloat(e.target.value));
  };

  const handleSeekStart = () => {
      setIsDragging(true);
  };

  const handleSeekEnd = () => {
      setIsDragging(false);
      pausedTimeRef.current = currentTime;
      if (isPlaying && message.audioData) {
           // Restart at new position
           playAudio(message.audioData, true);
      }
  };

  const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (message.audioData && isLoadingAudio) {
        setShowControls(true);
        playAudio(message.audioData);
        setIsLoadingAudio(false);
    }
  }, [message.audioData, isLoadingAudio]);

  // Cleanup audio on unmount
  useEffect(() => {
      return () => {
          stopAudio();
          if (audioContextRef.current) {
              audioContextRef.current.close();
          }
      };
  }, []);

  return (
    <div className={`w-full py-2 group ${isUser ? '' : ''}`} role="article" aria-label={`${isUser ? 'User' : 'AI'} message`}>
      <div className="m-auto flex px-4 md:max-w-3xl md:px-0 relative">
        
        {/* User Message Layout */}
        {isUser ? (
            <div className="flex w-full justify-end pl-10">
                <div className="bg-gray-100 dark:bg-[#2f2f2f] text-gray-900 dark:text-white px-5 py-2.5 rounded-[24px] max-w-full md:max-w-[70%] break-words relative group/bubble">
                    {/* Copy Button for User */}
                    <button
                        onClick={handleCopy}
                        className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover/bubble:opacity-100 transition-opacity"
                        title="Copy"
                        aria-label="Copy message content"
                    >
                         {isCopied ? (
                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        )}
                    </button>
                    
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="flex gap-2 mb-2 flex-wrap justify-end">
                            {message.attachments.map((att, idx) => (
                                <div key={idx} className="relative group/attachment">
                                    {att.mimeType.startsWith('image/') ? (
                                        <div className="relative">
                                            <img src={att.previewUrl} alt="Attachment" className="h-24 w-auto rounded-md object-cover border border-gray-300 dark:border-white/10" />
                                            <a 
                                                href={att.previewUrl} 
                                                download={att.file.name}
                                                className="absolute bottom-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover/attachment:opacity-100 transition-opacity"
                                                title="Download"
                                            >
                                                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            </a>
                                        </div>
                                    ) : (
                                        <a 
                                            href={att.previewUrl} 
                                            download={att.file.name}
                                            className="h-12 px-3 flex items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer relative group/file shadow-sm"
                                            title="Click to download"
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                <span className="max-w-[120px] truncate font-medium">{att.file.name}</span>
                                             </div>
                                             <div className="p-1.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 group-hover/file:text-blue-600 dark:group-hover/file:text-blue-400 transition-colors">
                                                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                             </div>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 whitespace-pre-wrap text-[15px]">
                        {message.content}
                    </div>
                </div>
            </div>
        ) : (
            /* Model Message Layout */
            <div className="flex w-full gap-4 pr-10">
                 <div className="relative flex h-8 w-8 flex-col items-center justify-center rounded-full border border-gray-200 dark:border-white/10 bg-white text-black shrink-0">
                    <GenixLogo className="h-5 w-5 text-gray-800 dark:text-black" />
                </div>
                <div className="flex-1 overflow-hidden relative group/bubble">
                    <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-gray-800 dark:prose-pre:bg-[#0d0d0d] prose-pre:rounded-lg prose-pre:p-4 max-w-none text-[15px] leading-7 text-gray-900 dark:text-gray-100">
                        {message.content ? (
                             <div dangerouslySetInnerHTML={{ 
                                 __html: message.isStreaming 
                                    ? message.content + '<span class="inline-block w-2.5 h-5 ml-1 align-bottom bg-gradient-to-t from-blue-600 to-cyan-400 dark:from-blue-400 dark:to-cyan-300 animate-pulse rounded-sm shadow-[0_0_10px_rgba(59,130,246,0.6)]"></span>' 
                                    : message.content 
                             }} />
                        ) : (
                             /* Loading Dots Animation */
                             <div className="flex items-center gap-1 h-6 mt-1">
                                <div className="h-1.5 w-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="h-1.5 w-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="h-1.5 w-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce"></div>
                             </div>
                        )}
                        
                        {/* Subtle Visualizer when AI is speaking (Live or TTS) */}
                        {((!isUser && isAiSpeaking && message.isStreaming) || isPlaying) && (
                            <div className="mt-2 flex items-center gap-0.5 h-6 overflow-hidden opacity-60">
                                {visualizerData.slice(-15).map((val, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ height: Math.max(2, val / 4) }}
                                        className="w-1 bg-blue-500 dark:bg-blue-400 rounded-full"
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Action Buttons for AI */}
                    {message.content && !message.isStreaming && (
                         <div className="flex items-center gap-2 mt-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                             {/* Copy */}
                             <button
                                onClick={handleCopy}
                                className="p-1 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2f2f2f] transition-colors"
                                title="Copy"
                                aria-label="Copy message content"
                            >
                                {isCopied ? (
                                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                ) : (
                                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                )}
                            </button>

                            {/* Thumbs Up */}
                            <button
                                onClick={() => onFeedback?.(message.id, message.feedback === 'positive' ? undefined : 'positive')}
                                className={`p-1 rounded-md transition-colors ${message.feedback === 'positive' ? 'text-gray-900 dark:text-gray-200 bg-gray-200 dark:bg-gray-700' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2f2f2f]'}`}
                                title="Good response"
                             >
                                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                             </button>

                             {/* Thumbs Down */}
                             <button
                                onClick={() => onFeedback?.(message.id, message.feedback === 'negative' ? undefined : 'negative')}
                                className={`p-1 rounded-md transition-colors ${message.feedback === 'negative' ? 'text-gray-900 dark:text-gray-200 bg-gray-200 dark:bg-gray-700' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2f2f2f]'}`}
                                title="Bad response"
                                aria-label="Mark as bad response"
                                aria-pressed={message.feedback === 'negative'}
                             >
                                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                             </button>

                             {/* Play Audio */}
                             {onGenerateAudio && (
                                 <div className="flex items-center gap-2">
                                     <button
                                         onClick={handlePlayPause}
                                         className={`p-1 rounded-md transition-all duration-200 ${
                                             isPlaying 
                                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-700 shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                                                : showControls 
                                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                                                    : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2f2f2f]'
                                         }`}
                                         title={isPlaying ? "Pause" : "Read aloud"}
                                         aria-label={isPlaying ? "Pause audio" : "Read message aloud"}
                                         disabled={isLoadingAudio}
                                     >
                                         {isLoadingAudio ? (
                                             <div className="flex items-center gap-0.5 h-4 px-0.5">
                                                 {[0, 1, 2].map((i) => (
                                                     <motion.div
                                                         key={i}
                                                         animate={{ height: [4, 12, 4] }}
                                                         transition={{ 
                                                             repeat: Infinity, 
                                                             duration: 0.6, 
                                                             delay: i * 0.1,
                                                             ease: "easeInOut"
                                                         }}
                                                         className="w-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                                                     />
                                                 ))}
                                             </div>
                                         ) : isPlaying ? (
                                             <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                         ) : (
                                             <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                         )}
                                     </button>

                                     {isLoadingAudio && !message.audioData && (
                                         <motion.div 
                                             initial={{ opacity: 0, x: -5 }}
                                             animate={{ opacity: 1, x: 0 }}
                                             className="flex items-center gap-2 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50"
                                         >
                                             <div className="flex items-center gap-0.5 h-3 w-4 justify-center">
                                                 {[0, 1, 2].map((i) => (
                                                     <motion.div
                                                         key={i}
                                                         animate={{ opacity: [0.3, 1, 0.3] }}
                                                         transition={{ 
                                                             repeat: Infinity, 
                                                             duration: 1, 
                                                             delay: i * 0.2
                                                         }}
                                                         className="w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full"
                                                     />
                                                 ))}
                                             </div>
                                             <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">Generating audio...</span>
                                         </motion.div>
                                     )}

                                     {/* Audio Controls (Visible when audio data exists or loading) */}
                                     {(message.audioData || showControls) && (
                                         <motion.div 
                                            animate={isLoadingAudio ? { 
                                                boxShadow: ["0 0 0px rgba(59,130,246,0)", "0 0 15px rgba(59,130,246,0.2)", "0 0 0px rgba(59,130,246,0)"] 
                                            } : {}}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className={`flex items-center gap-3 bg-gray-100 dark:bg-[#2f2f2f] rounded-full px-4 py-2 animate-in fade-in slide-in-from-left-2 duration-300 border border-transparent ${isPlaying ? 'border-blue-200 dark:border-blue-900/50 shadow-md' : 'shadow-sm'} max-w-full sm:max-w-xs`}
                                            role="region"
                                            aria-label="Audio playback controls"
                                         >
                                             {isPlaying ? (
                                                 <div className="flex items-center gap-0.5 h-3 w-6 justify-center" aria-hidden="true">
                                                     {[0, 1, 2, 3].map((i) => (
                                                         <motion.div
                                                             key={i}
                                                             animate={{ height: [2, 10, 2] }}
                                                             transition={{ 
                                                                 repeat: Infinity, 
                                                                 duration: 0.5 + (i * 0.1), 
                                                                 delay: i * 0.05,
                                                                 ease: "easeInOut"
                                                             }}
                                                             className="w-0.5 bg-blue-500 dark:bg-blue-400 rounded-full"
                                                         />
                                                     ))}
                                                 </div>
                                             ) : isLoadingAudio ? (
                                                 <div className="flex items-center gap-2" role="status" aria-live="polite">
                                                     <div className="flex items-center gap-0.5 h-3 w-6 justify-center">
                                                         {[0, 1, 2].map((i) => (
                                                             <motion.div
                                                                 key={i}
                                                                 animate={{ opacity: [0.3, 1, 0.3] }}
                                                                 transition={{ 
                                                                     repeat: Infinity, 
                                                                     duration: 1, 
                                                                     delay: i * 0.2
                                                                 }}
                                                                 className="w-1 h-1 bg-blue-400 rounded-full"
                                                             />
                                                         ))}
                                                     </div>
                                                     <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">Generating audio...</span>
                                                 </div>
                                             ) : null}
                                             
                                             {!isLoadingAudio && (
                                                 <>
                                                     <span className="text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 min-w-[32px] text-right" aria-label="Current time">
                                                         {formatTime(currentTime)}
                                                     </span>
                                                     
                                                     <div className="relative flex-1 h-1.5 group/slider">
                                                         <div className="absolute inset-0 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                                                             <motion.div 
                                                                 animate={isPlaying ? { 
                                                                     opacity: [0.8, 1, 0.8],
                                                                 } : {}}
                                                                 transition={{ repeat: Infinity, duration: 1.5 }}
                                                                 className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-100 ease-linear relative"
                                                                 style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                                             >
                                                                 {isPlaying && (
                                                                     <motion.div 
                                                                         animate={{ x: ['-100%', '200%'] }}
                                                                         transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                                         className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-1/2"
                                                                     />
                                                                 )}
                                                             </motion.div>
                                                         </div>
                                                         <input
                                                             type="range"
                                                             min="0"
                                                             max={duration || 100}
                                                             value={currentTime}
                                                             onChange={handleSeekChange}
                                                             onMouseDown={handleSeekStart}
                                                             onTouchStart={handleSeekStart}
                                                             onMouseUp={handleSeekEnd}
                                                             onTouchEnd={handleSeekEnd}
                                                             disabled={!duration}
                                                             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                             aria-label="Seek audio"
                                                             aria-valuemin={0}
                                                             aria-valuemax={duration || 100}
                                                             aria-valuenow={currentTime}
                                                         />
                                                         {/* Thumb indicator (visual only) */}
                                                         <div 
                                                             className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-gray-200 rounded-full shadow-md border border-gray-200 dark:border-gray-600 pointer-events-none transition-all duration-200 ${isDragging ? 'scale-125 ring-2 ring-blue-500/30' : 'scale-0 group-hover/slider:scale-100'}`}
                                                             style={{ left: `${(currentTime / (duration || 1)) * 100}%`, marginLeft: '-6px' }}
                                                         />
                                                     </div>
                                                     
                                                     <span className="text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400 min-w-[32px]" aria-label="Total duration">
                                                         {formatTime(duration)}
                                                     </span>

                                                     {/* Volume Control */}
                                                     <div className="group/volume relative flex items-center justify-center w-6 h-6">
                                                         <button 
                                                            className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                                            aria-label={`Volume: ${Math.round(volume * 100)}%`}
                                                         >
                                                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                                                                {volume === 0 ? (
                                                                    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/>
                                                                ) : volume < 0.5 ? (
                                                                    <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07"/>
                                                                ) : (
                                                                    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                                                                )}
                                                            </svg>
                                                         </button>
                                                         
                                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover/volume:block bg-white dark:bg-[#1e1e1e] p-3 rounded-xl shadow-xl border border-gray-100 dark:border-white/10 z-20 animate-in fade-in zoom-in-95 duration-200">
                                                             <div className="h-24 w-6 relative flex justify-center">
                                                                 <input
                                                                     type="range"
                                                                     min="0"
                                                                     max="1"
                                                                     step="0.05"
                                                                     value={volume}
                                                                     onChange={handleVolumeChange}
                                                                     className="absolute w-24 h-6 origin-center -rotate-90 top-9 -left-9 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-runnable-track]:bg-gray-200 [&::-webkit-slider-runnable-track]:dark:bg-gray-700 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:shadow-sm"
                                                                     aria-label="Adjust volume"
                                                                     aria-valuemin={0}
                                                                     aria-valuemax={1}
                                                                     aria-valuenow={volume}
                                                                 />
                                                             </div>
                                                         </div>
                                                         {/* Invisible bridge to prevent hover loss */}
                                                         <div className="absolute bottom-full left-0 w-full h-3 bg-transparent"></div>
                                                     </div>
                                                 </>
                                             )}
                                         </motion.div>
                                     )}
                                 </div>
                             )}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
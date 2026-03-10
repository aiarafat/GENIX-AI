import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, X, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import { useVoice } from '../src/contexts/VoiceContext';

interface LiveVoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
}

export const LiveVoiceChat: React.FC<LiveVoiceChatProps> = ({ isOpen, onClose, apiKey }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [aiTranscription, setAiTranscription] = useState<string>("");
  const { visualizerData, setVisualizerData, setIsAiSpeaking } = useVoice();

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsAiSpeaking(false);
  }, [setIsAiSpeaking]);

  const connect = async () => {
    if (isConnecting || isConnected) return;
    setIsConnecting(true);

    try {
      // Start microphone first to ensure user gesture context is used
      const micStarted = await startMic();
      if (!micStarted) {
        setIsConnecting(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData) {
                  const base64Audio = part.inlineData.data;
                  if (base64Audio) {
                    const binaryString = window.atob(base64Audio);
                    const len = binaryString.length;
                    const bytes = new Int16Array(len / 2);
                    const view = new DataView(new Uint8Array(Array.from(binaryString, c => c.charCodeAt(0))).buffer);
                    for (let i = 0; i < bytes.length; i++) {
                      bytes[i] = view.getInt16(i * 2, true);
                    }
                    audioQueueRef.current.push(bytes);
                    if (!isPlayingRef.current) {
                      playNextInQueue();
                    }
                  }
                }
              }
            }

            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }

            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
                setAiTranscription(prev => prev + " " + message.serverContent?.modelTurn?.parts?.[0]?.text);
            }
          },
          onclose: () => {
            cleanup();
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a helpful AI voice assistant. Keep your responses concise and conversational.",
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (error) {
      console.error("Failed to connect to Live API:", error);
      setIsConnecting(false);
    }
  };

  const startMic = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support microphone access or is not in a secure context (HTTPS).");
      }

      // Check for available devices first to provide better error messages
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(device => device.kind === 'audioinput');
      
      if (!hasMic) {
        throw new Error("No microphone detected. Please plug in a microphone and try again.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error("Microphone stream was created but contains no audio tracks.");
      }

      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Your browser does not support the Web Audio API.");
      }

      // Some browsers/hardware fail if we force 16000Hz in the constructor
      // We'll create it with default settings and check the rate
      const audioContext = new AudioContextClass();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      // Use a standard buffer size
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted || !sessionRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }

        // Send to Gemini
        const bytes = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = window.btoa(binary);
        
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: `audio/pcm;rate=${audioContext.sampleRate}` }
        });

        // Update visualizer
        const sum = inputData.reduce((a, b) => a + Math.abs(b), 0);
        const avg = sum / inputData.length;
        setVisualizerData(prev => {
            const newData = [...prev.slice(1), avg * 100];
            return newData;
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      return true;
    } catch (error: any) {
      console.error("Detailed Microphone Error:", error);
      
      let friendlyMessage = error.message || "Could not access microphone";
      
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' || error.message?.includes('found here')) {
        friendlyMessage = "No microphone found. Please ensure your microphone is connected and not being used by another app.";
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        friendlyMessage = "Microphone access was denied. Please check your browser's site permissions.";
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        friendlyMessage = "Microphone is already in use by another application or tab.";
      }

      setTranscription(`Error: ${friendlyMessage}`);
      alert(`Microphone Error: ${friendlyMessage}`);
      return false;
    }
  };

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0 || isSpeakerMuted) {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsAiSpeaking(true);
    const pcmData = audioQueueRef.current.shift()!;
    
    if (!audioContextRef.current) return;

    const buffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768.0;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    
    // Create analyzer for AI voice
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    source.connect(analyser);
    analyser.connect(audioContextRef.current.destination);
    
    const updateAiVisualizer = () => {
        if (!isPlayingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        
        setVisualizerData(prev => {
            const newData = [...prev.slice(1), (avg / 255) * 100];
            return newData;
        });
        
        requestAnimationFrame(updateAiVisualizer);
    };
    
    updateAiVisualizer();

    source.onended = () => {
      playNextInQueue();
    };
    source.start();
  };

  useEffect(() => {
    if (isOpen) {
      connect();
    } else {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-[#2f2f2f] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <h3 className="font-semibold text-gray-900 dark:text-white">Live Voice Chat</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-8 flex flex-col items-center justify-center gap-8">
            {/* Visualizer */}
            <div className="flex items-end gap-1 h-32 w-full justify-center">
              {visualizerData.map((val, i) => (
                <motion.div
                  key={i}
                  animate={{ height: Math.max(4, val * 2) }}
                  className="w-2 bg-blue-500 rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              ))}
            </div>

            {/* Status Text */}
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {isConnecting ? "Connecting..." : isConnected ? (isMuted ? "Microphone Muted" : "Listening...") : "Disconnected"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isConnected ? "Speak naturally with Genix AI" : "Please wait while we establish a secure connection"}
              </p>
            </div>

            {/* Transcription (Optional/Hidden) */}
            {aiTranscription && (
                <div className="w-full max-h-24 overflow-y-auto bg-gray-50 dark:bg-white/5 p-3 rounded-xl text-sm text-gray-600 dark:text-gray-300 italic">
                    {aiTranscription.slice(-150)}
                </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-8 bg-gray-50 dark:bg-white/5 flex items-center justify-center gap-6">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white dark:bg-[#3f3f3f] text-gray-700 dark:text-white shadow-md'}`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            <button
              onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
              className={`p-4 rounded-full transition-all ${isSpeakerMuted ? 'bg-gray-400 text-white' : 'bg-white dark:bg-[#3f3f3f] text-gray-700 dark:text-white shadow-md'}`}
              title={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}
            >
              {isSpeakerMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

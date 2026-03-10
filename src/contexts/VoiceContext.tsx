import React, { createContext, useContext, useState, ReactNode } from 'react';

interface VoiceContextType {
  visualizerData: number[];
  setVisualizerData: (data: number[]) => void;
  isAiSpeaking: boolean;
  setIsAiSpeaking: (isSpeaking: boolean) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(20).fill(0));
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  return (
    <VoiceContext.Provider value={{ visualizerData, setVisualizerData, isAiSpeaking, setIsAiSpeaking }}>
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

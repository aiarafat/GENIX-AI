export interface Attachment {
  file: File;
  previewUrl: string;
  mimeType: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  attachments?: Attachment[];
  isStreaming?: boolean;
  timestamp: number;
  feedback?: 'positive' | 'negative';
  audioData?: string; // Base64 encoded audio
  isGeneratingAudio?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  isTemporary?: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  language: string;
  customInstructions: string;
  enableHistory: boolean;
  emailNotifications: boolean;
  mfaEnabled: boolean;
  autoPlayVoice: boolean;
}

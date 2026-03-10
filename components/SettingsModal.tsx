import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AppSettings } from '../types';
import { jsPDF } from 'jspdf';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClearAllChats: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  initialTab?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearAllChats,
  userProfile,
  onUpdateProfile,
  initialTab = 'general'
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [hasHistory, setHasHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      // Check for history
      const data = localStorage.getItem('gemini_chat_history');
      if (data) {
          try {
              const parsed = JSON.parse(data);
              setHasHistory(Array.isArray(parsed) && parsed.length > 0);
          } catch {
              setHasHistory(false);
          }
      } else {
          setHasHistory(false);
      }
    }
  }, [isOpen, initialTab]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            alert("Image size should be less than 2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            onUpdateProfile({ ...userProfile, avatar: reader.result as string });
        };
        reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    onUpdateProfile({ ...userProfile, avatar: undefined });
  };

  const handleExportData = () => {
      if (!hasHistory) {
          alert("No chat history to export.");
          return;
      }
      const data = localStorage.getItem('gemini_chat_history');
      if (data) {
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `genix-export-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      }
  };

  const handleExportPDF = () => {
      if (!hasHistory) {
          alert("No chat history to export.");
          return;
      }
      const data = localStorage.getItem('gemini_chat_history');
      if (data) {
          try {
            const sessions = JSON.parse(data);
            const doc = new jsPDF();
            
            let y = 15;
            const leftMargin = 15;
            const contentWidth = 180;
            const pageHeight = doc.internal.pageSize.height;

            doc.setFontSize(20);
            doc.text("Genix AI Chat History", leftMargin, y);
            y += 15;

            sessions.forEach((session: any, index: number) => {
                // Check page break for title
                if (y > pageHeight - 20) {
                    doc.addPage();
                    y = 15;
                }

                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text(`${index + 1}. ${session.title}`, leftMargin, y);
                y += 10;
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");

                session.messages.forEach((msg: any) => {
                    const role = msg.role === 'user' ? 'You' : 'Genix';
                    const content = msg.content || '[Attachment/No Content]';
                    
                    // Simple text wrapping
                    const prefix = `${role}: `;
                    const splitContent = doc.splitTextToSize(prefix + content, contentWidth);
                    
                    if (y + (splitContent.length * 5) > pageHeight - 15) {
                        doc.addPage();
                        y = 15;
                    }

                    doc.text(splitContent, leftMargin, y);
                    y += (splitContent.length * 5) + 3;
                });
                
                y += 5;
                if (y > pageHeight - 20) {
                    doc.addPage();
                    y = 15;
                }
                doc.setDrawColor(200, 200, 200);
                doc.line(leftMargin, y, leftMargin + contentWidth, y);
                y += 10;
            });
            
            doc.save(`genix-history-${new Date().toISOString().slice(0,10)}.pdf`);

          } catch (error) {
              console.error("Export PDF error:", error);
              alert("Could not generate PDF. Please try again.");
          }
      }
  };

  const handleDeleteAccount = () => {
      if (confirm("Are you sure you want to delete your account? This will wipe all data locally and reset the app.")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'General', icon: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.29 1.52 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> },
    { id: 'notifications', label: 'Notifications', icon: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> },
    { id: 'personalization', label: 'Personalization', icon: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> },
    { id: 'apps', label: 'Apps', icon: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> },
    { id: 'data', label: 'Data controls', icon: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg> },
    { id: 'security', label: 'Security', icon: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> },
    { id: 'parental', label: 'Parental controls', icon: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
    { id: 'account', label: 'Account', icon: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> },
  ];

  const Switch = ({ checked, onChange }: { checked: boolean, onChange: (val: boolean) => void }) => (
      <button 
        role="switch" 
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 ${checked ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}
      >
        <span className="sr-only">Use setting</span>
        <span
            aria-hidden="true"
            className={`${checked ? 'translate-x-4' : 'translate-x-0'}
            pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
        />
      </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-0 md:p-4">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      ></div>
      
      {/* Modal Container */}
      <div className="relative w-full h-full md:h-[520px] md:max-w-[720px] bg-white dark:bg-[#212121] rounded-none md:rounded-2xl shadow-none md:shadow-2xl overflow-hidden flex flex-col md:flex-row z-10 text-gray-900 dark:text-white">
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#212121]">
            <h2 className="text-lg font-medium">Settings</h2>
            <button onClick={onClose} className="p-1">
                 <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-[220px] bg-gray-50/80 md:bg-white dark:bg-[#171717] md:dark:bg-[#171717] p-2 flex flex-row md:flex-col gap-1 border-b md:border-b-0 md:border-r border-gray-100 dark:border-white/5 overflow-x-auto md:overflow-visible shrink-0">
             <div className="mb-2 pt-2 px-2 md:block hidden">
                 <button 
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#2f2f2f] text-gray-500 transition-colors"
                >
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
             </div>
             
             <div className="flex md:flex-col gap-1 px-1 min-w-max md:min-w-0">
                 {tabs.map((tab) => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2.5 px-3 py-2 md:px-2.5 md:py-2 text-sm font-medium rounded-full md:rounded-lg text-left transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                            ? 'bg-white md:bg-gray-100 shadow-sm md:shadow-none dark:bg-[#2f2f2f] text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 md:hover:bg-gray-50 dark:hover:bg-[#2f2f2f]/50'
                        }`}
                     >
                         {tab.icon}
                         {tab.label}
                     </button>
                 ))}
             </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#212121]">
            <div className="px-6 py-4 border-b border-transparent md:block hidden">
                 <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                     {tabs.find(t => t.id === activeTab)?.label}
                 </h2>
            </div>
            {/* Mobile Tab Title */}
             <div className="px-4 py-3 border-b border-gray-50 dark:border-white/5 md:hidden">
                 <h3 className="text-base font-medium text-gray-900 dark:text-white">
                     {tabs.find(t => t.id === activeTab)?.label}
                 </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
                {activeTab === 'general' && (
                    <div className="max-w-xl">
                        {/* MFA Card */}
                        <div className="relative mb-6 rounded-xl bg-gray-50 dark:bg-[#171717] p-4 border border-gray-100 dark:border-white/5">
                             <div className="flex items-start gap-4">
                                 <div className="mt-1 p-1">
                                     <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-5 h-5 text-gray-900 dark:text-white" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
                                 </div>
                                 <div className="flex-1">
                                     <h3 className="font-medium text-gray-900 dark:text-white text-sm">Secure your account</h3>
                                     <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                         Add multi-factor authentication (MFA) to help protect your account when logging in.
                                     </p>
                                     <button 
                                         onClick={() => onUpdateSettings({...settings, mfaEnabled: !settings.mfaEnabled})}
                                         className={`mt-3 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${settings.mfaEnabled ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-[#2f2f2f]'}`}
                                     >
                                         {settings.mfaEnabled ? "MFA Enabled" : "Set up MFA"}
                                     </button>
                                 </div>
                             </div>
                        </div>

                        {/* Settings Rows */}
                        <div className="space-y-1">
                            {/* Appearance / Theme */}
                            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5">
                                <span className="text-sm text-gray-900 dark:text-white">Appearance</span>
                                <div className="relative">
                                     <select 
                                        value={settings.theme}
                                        onChange={(e) => onUpdateSettings({...settings, theme: e.target.value as 'light' | 'dark'})}
                                        className="appearance-none bg-transparent pl-3 pr-8 py-1 text-sm text-gray-600 dark:text-gray-300 focus:outline-none cursor-pointer hover:text-gray-900 dark:hover:text-white text-right"
                                     >
                                         <option value="light">Light</option>
                                         <option value="dark">Dark</option>
                                     </select>
                                </div>
                            </div>

                            {/* Language */}
                            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5">
                                <span className="text-sm text-gray-900 dark:text-white">Language</span>
                                <div className="relative">
                                     <select 
                                        value={settings.language}
                                        onChange={(e) => onUpdateSettings({...settings, language: e.target.value})}
                                        className="appearance-none bg-transparent pl-3 pr-8 py-1 text-sm text-gray-600 dark:text-gray-300 focus:outline-none cursor-pointer hover:text-gray-900 dark:hover:text-white text-right"
                                     >
                                         <option value="Auto-detect">Auto-detect</option>
                                         <option value="English">English</option>
                                         <option value="Spanish">Spanish</option>
                                         <option value="French">French</option>
                                         <option value="German">German</option>
                                         <option value="Chinese">Chinese</option>
                                         <option value="Japanese">Japanese</option>
                                     </select>
                                </div>
                            </div>

                            {/* Auto-play Voice */}
                            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5">
                                <div>
                                    <div className="text-sm text-gray-900 dark:text-white">Auto-play Voice</div>
                                    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">Automatically read AI responses aloud.</div>
                                </div>
                                <Switch 
                                    checked={settings.autoPlayVoice} 
                                    onChange={(val) => onUpdateSettings({...settings, autoPlayVoice: val})} 
                                />
                            </div>

                            {/* Clear All Chats */}
                             <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5">
                                <span className="text-sm text-gray-900 dark:text-white">Delete all chats</span>
                                <button
                                    onClick={onClearAllChats}
                                    className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                                >
                                    Delete all
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'personalization' && (
                    <div className="max-w-xl space-y-4">
                        <div>
                             <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Custom Instructions</h3>
                             <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                 What would you like Genix to know about you to provide better responses?
                             </p>
                             <textarea 
                                value={settings.customInstructions}
                                onChange={(e) => onUpdateSettings({...settings, customInstructions: e.target.value})}
                                placeholder="e.g. I am a software engineer, prefer concise code snippets. I live in California..."
                                className="w-full h-32 p-3 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#171717] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 resize-none"
                             />
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="max-w-xl space-y-4">
                         <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5">
                             <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">Email notifications</div>
                                <div className="mt-1 text-xs text-gray-500">Receive emails about new features and announcements.</div>
                            </div>
                            <Switch 
                                checked={settings.emailNotifications} 
                                onChange={(val) => onUpdateSettings({...settings, emailNotifications: val})} 
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="max-w-xl space-y-4">
                         <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5">
                             <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">Chat History & Training</div>
                                <div className="mt-1 text-xs text-gray-500">Save new chats to your history and allow them to be used to improve our models.</div>
                            </div>
                            <Switch 
                                checked={settings.enableHistory} 
                                onChange={(val) => onUpdateSettings({...settings, enableHistory: val})} 
                            />
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5">
                             <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">Export data</div>
                                <div className="mt-1 text-xs text-gray-500">Export your conversation history.</div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExportData}
                                    disabled={!hasHistory}
                                    className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                                        !hasHistory 
                                        ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-50 dark:bg-transparent'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2f2f2f]'
                                    }`}
                                    title="Export as JSON"
                                >
                                    JSON
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    disabled={!hasHistory}
                                    className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                                        !hasHistory 
                                        ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-50 dark:bg-transparent'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2f2f2f]'
                                    }`}
                                    title="Export as PDF"
                                >
                                    PDF
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5">
                             <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">Delete account</div>
                                <div className="mt-1 text-xs text-gray-500">Permanently delete your account and all data.</div>
                            </div>
                            <button
                                onClick={handleDeleteAccount}
                                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="max-w-xl space-y-6 animate-in fade-in duration-300">
                        {/* Avatar Section */}
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4">
                            <label className="text-sm font-medium text-gray-900 dark:text-white">Profile Picture</label>
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-full bg-green-500 text-white flex items-center justify-center text-lg font-medium overflow-hidden border-2 border-white dark:border-[#2f2f2f] shadow-sm">
                                    {userProfile.avatar ? (
                                        <img src={userProfile.avatar} alt="Avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        userProfile.name.slice(0, 2).toUpperCase()
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors border border-gray-200 dark:border-transparent"
                                    >
                                        Upload new picture
                                    </button>
                                    {userProfile.avatar && (
                                        <button 
                                            onClick={handleRemoveAvatar}
                                            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                                        >
                                            Remove picture
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                             {/* Name Input */}
                             <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">Display Name</label>
                                <input 
                                    type="text" 
                                    value={userProfile.name}
                                    onChange={(e) => onUpdateProfile({ ...userProfile, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#171717] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-sm"
                                    placeholder="Enter your name"
                                />
                             </div>
                             
                             {/* Email Input */}
                             <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">Email Address</label>
                                <input 
                                    type="email" 
                                    value={userProfile.email}
                                    onChange={(e) => onUpdateProfile({ ...userProfile, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#171717] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-sm"
                                    placeholder="Enter your email"
                                />
                             </div>
                        </div>
                    </div>
                )}
                
                {['apps', 'security', 'parental'].includes(activeTab) && (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Feature coming soon
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
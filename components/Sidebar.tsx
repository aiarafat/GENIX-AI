import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, UserProfile, AppSettings } from '../types';
import { GenixLogo } from './GenixLogo';
import { SettingsModal } from './SettingsModal';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onNewChat: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onClearAllSessions: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  isSettingsOpen: boolean;
  onToggleSettings: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  toggleSidebar, 
  onNewChat,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onClearAllSessions,
  settings,
  onUpdateSettings,
  userProfile,
  onUpdateProfile,
  isSettingsOpen,
  onToggleSettings
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  // User Menu & Settings State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'help'>('main');
  const [settingsTab, setSettingsTab] = useState('general');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
        searchInputRef.current.focus();
    }
  }, [isSearchActive]);

  // Handle clicking outside user menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset menu view when closed
  useEffect(() => {
    if (!isUserMenuOpen) {
        setMenuView('main');
    }
  }, [isUserMenuOpen]);

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat?')) {
        onDeleteSession(id);
    }
  };
  
  const confirmClearAll = () => {
      onClearAllSessions();
      setShowClearConfirm(false);
  }

  const handleSearchClick = () => {
      setIsSearchActive(true);
  }

  const handleSearchBlur = () => {
      if (!searchQuery) {
          setIsSearchActive(false);
      }
  }

  const handleImagesClick = () => {
      alert("Image generation feature coming soon!");
  }

  const handleExploreGPTsClick = () => {
      alert("GPT Store exploration coming soon!");
  }

  const filteredSessions = sessions.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const MenuItem = ({ icon, label, onClick, isActive = false, badge }: { icon: React.ReactNode, label: string, onClick?: () => void, isActive?: boolean, badge?: string }) => (
    <button 
        onClick={onClick} 
        className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg w-full text-left transition-colors ${
            isActive 
            ? 'bg-gray-200 dark:bg-[#212121] text-gray-900 dark:text-white' 
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#212121]'
        }`}
    >
        {icon}
        <span className="flex-1">{label}</span>
        {badge && (
             <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                {badge}
             </span>
        )}
    </button>
  );

  // SVG Icons for User Menu
  const Icons = {
      Sparkles: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>,
      User: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      Settings: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
      Help: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>,
      LogOut: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
      ChevronRight: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg"><path d="m9 18 6-6-6-6"/></svg>,
      ArrowLeft: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>,
      HelpCenter: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>,
      ReleaseNotes: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
      Terms: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
      Bug: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><rect width="8" height="14" x="8" y="6" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/><path d="m10 4 1 2"/><path d="m14 4-1 2"/></svg>,
      Download: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
      Keyboard: <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M6 12h.001"/><path d="M10 12h.001"/><path d="M14 12h.001"/><path d="M18 12h.001"/><path d="M6 16h12"/></svg>
  };

  const MenuListItem = ({ icon, label, onClick, hasSubmenu = false }: { icon: React.ReactNode, label: string, onClick?: () => void, hasSubmenu?: boolean }) => (
      <button 
          onClick={onClick}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 text-left transition-colors"
      >
          <div className="flex items-center gap-3">
              {icon}
              <span>{label}</span>
          </div>
          {hasSubmenu && Icons.ChevronRight}
      </button>
  );

  return (
    <>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => onToggleSettings(false)}
        initialTab={settingsTab}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        onClearAllChats={() => {
            if (sessions.length > 0) {
                setShowClearConfirm(true);
            }
        }}
        userProfile={userProfile}
        onUpdateProfile={onUpdateProfile}
      />

      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 z-20 bg-black/50 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      ></div>

      {/* Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#2f2f2f] p-6 shadow-2xl border border-gray-200 dark:border-white/10 scale-100 opacity-100">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clear all chats?</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    This will delete all your conversation history from this device. This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmClearAll}
                        className="rounded-lg bg-red-500/10 dark:bg-red-500/20 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/30 transition-colors"
                    >
                        Clear all
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar Content */}
      <div className={`fixed inset-y-0 left-0 z-30 w-[260px] transform bg-[#f9f9f9] dark:bg-[#171717] transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-gray-200 dark:border-white/5`}>
        
        {/* Header / Top Navigation */}
        <div className="flex flex-col px-3 pt-3 pb-2">
             <div className="flex items-center justify-between mb-2 px-2">
                 {/* Logo/Brand */}
                 <div className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-transparent">
                    <GenixLogo className="h-5 w-5 text-gray-800 dark:text-gray-200" />
                 </div>
                 
                 {/* Close Sidebar Icon */}
                 <div className="flex items-center gap-1">
                    <ThemeToggle 
                        theme={settings.theme} 
                        onChange={(theme) => onUpdateSettings({ ...settings, theme })} 
                        className="mr-1"
                    />
                    <button onClick={toggleSidebar} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-200 dark:hover:bg-[#212121]">
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                    </button>
                 </div>
             </div>

             <div className="flex flex-col gap-0.5">
                <button onClick={onNewChat} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#212121] rounded-lg group text-left">
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    <span className="flex-1">New chat</span>
                    <span className="opacity-0 group-hover:opacity-100 text-gray-400">
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14"/></svg>
                    </span>
                </button>

                {isSearchActive ? (
                    <div className="px-3 py-2">
                         <div className="relative flex items-center">
                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="absolute left-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input 
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onBlur={handleSearchBlur}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-transparent py-1.5 pl-8 pr-2 text-sm text-gray-900 dark:text-white focus:border-gray-400 dark:focus:border-gray-500 focus:outline-none"
                            />
                         </div>
                    </div>
                ) : (
                    <MenuItem 
                        icon={<svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>} 
                        label="Search chats"
                        onClick={handleSearchClick}
                    />
                )}
                
                <MenuItem 
                    icon={<svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>} 
                    label="Images" 
                    onClick={handleImagesClick}
                    badge="Soon"
                />
             </div>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-3">
           
           {/* GPTs Section */}
           <div className="py-4">
              <div className="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">GPTs</div>
              <button 
                onClick={handleExploreGPTsClick}
                className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#212121] rounded-lg w-full text-left transition-colors"
              >
                  <div className="h-6 w-6 rounded-full bg-white border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0 text-black">
                     <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
                  </div>
                  <span className="truncate">Explore GPTs</span>
              </button>
           </div>

           {/* History List */}
           <div className="pb-2">
             <div className="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Your Recent Chat</div>
             <div className="flex flex-col gap-1">
                {filteredSessions.length === 0 && searchQuery && (
                    <div className="px-3 text-xs text-gray-400 italic">No chats found</div>
                )}
                {filteredSessions.map(session => (
                     <div key={session.id} className="relative group">
                     {editingId === session.id ? (
                         <div className="flex items-center gap-2 rounded-lg bg-gray-200 dark:bg-[#212121] px-3 py-2">
                              <input 
                                 ref={inputRef}
                                 type="text" 
                                 value={editTitle} 
                                 onChange={(e) => setEditTitle(e.target.value)}
                                 onKeyDown={handleKeyDown}
                                 onBlur={saveEdit}
                                 className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none"
                              />
                         </div>
                     ) : (
                         <button 
                             onClick={() => {
                                 onSelectSession(session.id);
                                 if (window.innerWidth < 1024) toggleSidebar();
                             }}
                             className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors overflow-hidden text-left ${
                                 currentSessionId === session.id ? 'bg-gray-200 dark:bg-[#212121] text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#212121]'
                             }`}
                         >
                             <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                                 {session.title}
                             </div>
                             
                             {/* Action Buttons */}
                             {(currentSessionId === session.id) && (
                                 <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                     <div 
                                         role="button"
                                         onClick={(e) => startEditing(e, session)}
                                         className="p-1 hover:text-gray-900 dark:hover:text-white text-gray-500 dark:text-gray-400"
                                         title="Rename"
                                     >
                                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                     </div>
                                     <div 
                                         role="button"
                                         onClick={(e) => handleDelete(e, session.id)}
                                         className="p-1 hover:text-gray-900 dark:hover:text-white text-gray-500 dark:text-gray-400"
                                         title="Delete"
                                     >
                                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                     </div>
                                 </div>
                             )}
                         </button>
                     )}
                 </div>
                ))}
             </div>
           </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-white/5 relative" ref={userMenuRef}>
            {/* User Menu Popover */}
            {isUserMenuOpen && (
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-[#2f2f2f] rounded-xl shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden py-1.5 z-40 animate-in slide-in-from-bottom-2 duration-200 w-[calc(100%-1.5rem)]">
                    {menuView === 'main' ? (
                        <>
                           {/* User Info Header */}
                           <div className="px-3 py-2 mb-1 border-b border-gray-100 dark:border-white/5">
                               <div className="text-sm font-medium text-gray-900 dark:text-white">{userProfile.name}</div>
                               <div className="text-xs text-gray-500 dark:text-gray-400">@{userProfile.name.toLowerCase().replace(/\s+/g, '.')}</div>
                           </div>

                           <MenuListItem icon={Icons.Sparkles} label="Upgrade plan" onClick={() => alert("Coming soon")} />
                           <MenuListItem icon={Icons.User} label="Personalization" onClick={() => { onToggleSettings(true); setSettingsTab('personalization'); setIsUserMenuOpen(false); }} />
                           <MenuListItem icon={Icons.Settings} label="Settings" onClick={() => { onToggleSettings(true); setSettingsTab('general'); setIsUserMenuOpen(false); }} />
                           
                           <MenuListItem 
                              icon={Icons.Help} 
                              label="Help" 
                              onClick={() => setMenuView('help')}
                              hasSubmenu
                           />

                           <div className="h-px bg-gray-200 dark:bg-white/10 my-1"></div>
                           <MenuListItem icon={Icons.LogOut} label="Log out" onClick={() => alert("Logout")} />
                        </>
                    ) : (
                        <>
                           <div className="px-2 py-1 mb-1 border-b border-gray-100 dark:border-white/5 flex items-center">
                               <button 
                                  onClick={() => setMenuView('main')} 
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md text-gray-500"
                               >
                                   {Icons.ArrowLeft}
                               </button>
                               <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">Help</span>
                           </div>
                           
                           <MenuListItem icon={Icons.HelpCenter} label="Help center" onClick={() => alert("Help Center")} />
                           <MenuListItem icon={Icons.ReleaseNotes} label="Release notes" onClick={() => alert("Release Notes")} />
                           <MenuListItem icon={Icons.Terms} label="Terms & policies" onClick={() => alert("Terms & policies")} />
                           <MenuListItem icon={Icons.Bug} label="Report Bug" onClick={() => alert("Report Bug")} />
                           <MenuListItem icon={Icons.Download} label="Download apps" onClick={() => alert("Download apps")} />
                           <MenuListItem icon={Icons.Keyboard} label="Keyboard shortcuts" onClick={() => alert("Shortcuts")} />
                        </>
                    )}
                </div>
            )}

            {/* User Profile Trigger */}
            <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-3 w-full p-2 rounded-xl transition-colors text-left group ${isUserMenuOpen ? 'bg-gray-200 dark:bg-[#212121]' : 'hover:bg-gray-200 dark:hover:bg-[#212121]'}`}
            >
                 <div className="h-9 w-9 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium shrink-0 overflow-hidden">
                    {userProfile.avatar ? (
                        <img src={userProfile.avatar} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                        userProfile.name.slice(0, 2).toUpperCase()
                    )}
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{userProfile.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Free Plan</div>
                 </div>
            </button>
        </div>
      </div>
    </>
  );
};
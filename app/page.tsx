"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Newspaper, Search, Plus, Sparkles, Mic, Trash2, Calendar as CalendarIcon, Folder as FolderIcon, Edit3, CheckSquare, MessageSquare, X, Bell, Clock, GitMerge, Lock, Tag, Users, LogOut, ArrowRight, Send, AlertCircle, Filter, Pencil, Image, Copy, Check, ArrowDown, FolderPlus, Settings, Sun, Moon } from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { NoteCard } from '@/components/NoteCard';
import { NoteEditor } from '@/components/NoteEditor';
import { NewsSection } from '@/components/NewsSection';
import { GlowButton } from '@/components/ui/GlowButton';
import { Calendar } from '@/components/Calendar';
import { WhatsappChat } from '@/components/WhatsappChat';
import { VoiceAssistant } from '@/components/VoiceAssistant';
import { InteractiveMerge } from '@/components/InteractiveMerge';
import styles from './page.module.css';
import { supabase } from '@/lib/supabase';
import { formatForWhatsApp } from '@/lib/whatsappFormatter';



interface Note {
  id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  todo_list: { text: string; completed: boolean }[] | string[];
  created_at: string;
  folder_id?: string | null;
}

interface Folder {
  id: string;
  name: string;
  created_at: string;
  parentId?: string | null;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
  summary: string;
  category: string;
  time: string;
}

interface Reminder {
  id: string;
  title: string;
  description?: string;
  dateTime: string;
  notify1Day: boolean;
  notify1Hour: boolean;
  notifyExact: boolean;
  sent1Day: boolean;
  sent1Hour: boolean;
  sentExact: boolean;
  whatsappNumber?: string | null;
  created_at: string;
}


function getValidDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) {
    if (typeof dateVal === 'string') {
      const normalized = dateVal.replace(' ', 'T');
      const fallbackDate = new Date(normalized);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate;
      }
    }
    return null;
  }
  return date;
}

function formatTime(dateVal: any): string {
  const date = getValidDate(dateVal);
  if (!date) return '';
  try {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e2) {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  }
}

function formatDateLong(dateVal: any): string {
  const date = getValidDate(dateVal);
  if (!date) return '';
  try {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    try {
      return date.toLocaleDateString([], {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e2) {
      return date.toDateString();
    }
  }
}

function formatDateShort(dateVal: any): string {
  const date = getValidDate(dateVal);
  if (!date) return '';
  try {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch (e) {
    try {
      return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch (e2) {
      return `${date.getDate()}/${date.getMonth() + 1}`;
    }
  }
}

function formatDateTime(dateVal: any): string {
  const date = getValidDate(dateVal);
  if (!date) return '';
  try {
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    try {
      return date.toLocaleDateString([], {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e2) {
      return date.toLocaleString();
    }
  }
}

const renderFormattedMenuList = (text: string) => {
  if (!text) return null;

  const hasLineBreaks = text.includes('\n');
  let formattedLines: string[] = [];

  if (hasLineBreaks) {
    formattedLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  } else {
    let normalized = text
      .replace(/(REKAP PESANAN MAKANAN\s*\&\s*MINUMAN|REKAP PESANAN)/gi, '\nHEAD:$1\n')
      .replace(/(?<!HEAD:)\b(MAKANAN|MINUMAN|SNACK|DESSERT|CATATAN)\b/gi, '\nCAT:$1\n')
      .replace(/([A-Z0-9][A-Za-z0-9\s\+\-\/\&\.\(\)]+:\s*\d+(?:\s*porsi|\s*pcs|\s*orang|\s*pack)?(?:\s*\([^)]+\))?)/g, '\nITEM:$1');

    formattedLines = normalized.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  }

  return (
    <div className={styles.resMenuRecapWrapper}>
      {formattedLines.map((line, idx) => {
        const isHead = line.startsWith('HEAD:') || /^REKAP PESANAN/i.test(line);
        const isCat = line.startsWith('CAT:') || /^(MAKANAN|MINUMAN|SNACK|DESSERT|CATATAN)$/i.test(line);

        let cleanText = line.replace(/^(HEAD:|CAT:|ITEM:)\s*/, '').trim();

        if (isHead) {
          return (
            <div key={idx} className={styles.resMenuMainHeader}>
              <span style={{ fontSize: '0.85rem' }}>📋</span>
              <span>{cleanText}</span>
            </div>
          );
        }

        if (isCat) {
          const isFood = /MAKANAN/i.test(cleanText);
          const isDrink = /MINUMAN/i.test(cleanText);
          return (
            <div key={idx} className={`${styles.resMenuCatHeader} ${isFood ? styles.resCatFood : isDrink ? styles.resCatDrink : ''}`}>
              <span>{isFood ? '🍽️' : isDrink ? '🥤' : '🏷️'}</span>
              <span>{cleanText}</span>
            </div>
          );
        }

        if (!cleanText.startsWith('•') && !cleanText.startsWith('-')) {
          cleanText = `• ${cleanText}`;
        }

        return (
          <div key={idx} className={styles.resMenuItemRow}>
            <span>{cleanText}</span>
          </div>
        );
      })}
    </div>
  );
};

const getGroupedNotes = (notesList: Note[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: { [key: string]: Note[] } = {
    'Hari Ini': [],
    'Kemarin': [],
    'Minggu Ini': [],
    'Lebih Lama': []
  };

  notesList.forEach(note => {
    const noteDate = new Date(note.created_at);
    noteDate.setHours(0, 0, 0, 0);

    if (noteDate.getTime() === today.getTime()) {
      groups['Hari Ini'].push(note);
    } else if (noteDate.getTime() === yesterday.getTime()) {
      groups['Kemarin'].push(note);
    } else if (noteDate.getTime() >= sevenDaysAgo.getTime()) {
      groups['Minggu Ini'].push(note);
    } else {
      groups['Lebih Lama'].push(note);
    }
  });

  return groups;
};

const getSortedFolderTree = (foldersList: Folder[]) => {
  const rootFolders = foldersList.filter(f => !f.parentId);
  const result: (Folder & { depth: number; parentName?: string })[] = [];

  rootFolders.forEach(root => {
    result.push({ ...root, depth: 0 });
    const children = foldersList.filter(f => f.parentId === root.id);
    children.forEach(child => {
      result.push({ ...child, depth: 1, parentName: root.name });
    });
  });

  // Include orphans if any
  foldersList.forEach(folder => {
    if (folder.parentId && !result.find(r => r.id === folder.id)) {
      result.push({ ...folder, depth: 1 });
    }
  });

  return result;
};

export default function Home({ hideManifest = false }: { hideManifest?: boolean }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    }>
      {!hideManifest && <link rel="manifest" href="/manifest.json?v=2" />}
      <HomeContentWrapper />
    </Suspense>
  );
}

function formatBoldText(text: string) {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<'notes' | 'news' | 'whatsapp' | 'calendar' | 'recorder' | 'reminders' | 'chat' | 'reservations'>('notes');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load and apply initial theme preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('smart_voice_notes_theme') as 'dark' | 'light';
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      localStorage.setItem('smart_voice_notes_theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    } catch (e) {}
  };

  // Dispatch pause-voice-recording event whenever activeTab changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pause-voice-recording'));
    }
  }, [activeTab]);

  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(true);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Admin Reservation States
  const [adminReservations, setAdminReservations] = useState<any[]>([]);
  const [adminResLoading, setAdminResLoading] = useState(false);
  const [adminResFilter, setAdminResFilter] = useState('all');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [adminSelectedDate, setAdminSelectedDate] = useState<string | null>(null);
  const [isAdminCalOpenMobile, setIsAdminCalOpenMobile] = useState(false);
  const [showReservationsModalAdmin, setShowReservationsModalAdmin] = useState(false);
  const [resListFilterAdmin, setResListFilterAdmin] = useState('upcoming');
  const [editingReservation, setEditingReservation] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editDateTime, setEditDateTime] = useState('');
  const [editTable, setEditTable] = useState('');
  const [editSize, setEditSize] = useState(4);
  const [editDp, setEditDp] = useState('');
  const [editMenu, setEditMenu] = useState('');
  const [editStatus, setEditStatus] = useState('pending');
  const [editIsSaving, setEditIsSaving] = useState(false);

  const getChatAttributeColor = (attr: string | null) => {
    if (!attr) return '#64748b';
    switch (attr.toLowerCase()) {
      case 'sales':
        return '#10b981';
      case 'progres':
        return '#06b6d4';
      case 'urgent':
        return '#ef4444';
      case 'umum':
        return '#6366f1';
      default:
        return '#d946ef';
    }
  };

  // Chat Room States
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatAttributes, setChatAttributes] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [selectedChatAttribute, setSelectedChatAttribute] = useState('Umum');
  const [chatFilterAttribute, setChatFilterAttribute] = useState('Semua');
  const [filterAttrSearchQuery, setFilterAttrSearchQuery] = useState('');
  const [selectAttrSearchQuery, setSelectAttrSearchQuery] = useState('');
  const [manageAttrSearchQuery, setManageAttrSearchQuery] = useState('');
  const [showFilterSearch, setShowFilterSearch] = useState(false);
  const [showSelectSearch, setShowSelectSearch] = useState(false);
  const [managedQuickText, setManagedQuickText] = useState('');
  const [editingChatMessage, setEditingChatMessage] = useState<any | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSubmitting, setChatSubmitting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const adminChatAreaRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatPollingRef = useRef<NodeJS.Timeout | null>(null);
  const adminChatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const adminIsAtBottomRef = useRef<boolean>(true);
  const adminIsInitialLoadRef = useRef<boolean>(true);
  const [adminShowScrollBottomBtn, setAdminShowScrollBottomBtn] = useState(false);
  const [adminHasNewMessages, setAdminHasNewMessages] = useState(false);
  const [adminHasMoreOlder, setAdminHasMoreOlder] = useState(true);
  const [adminLoadingOlder, setAdminLoadingOlder] = useState(false);
  const adminIsLoadingOlderRef = useRef<boolean>(false);

  const handleAdminChatScroll = () => {
    if (!adminChatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = adminChatAreaRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceFromBottom <= 120;

    adminIsAtBottomRef.current = isNearBottom;
    setAdminShowScrollBottomBtn(!isNearBottom);
    if (isNearBottom) {
      setAdminHasNewMessages(false);
    }
  };

  const scrollToAdminChatBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior });
    } else if (adminChatAreaRef.current) {
      adminChatAreaRef.current.scrollTop = adminChatAreaRef.current.scrollHeight;
    }
    adminIsAtBottomRef.current = true;
    setAdminShowScrollBottomBtn(false);
    setAdminHasNewMessages(false);
  };

  // Admin Chat Upload State & Refs
  const adminFileInputRef = useRef<HTMLInputElement | null>(null);
  const [adminSelectedFile, setAdminSelectedFile] = useState<File | null>(null);
  const [adminImagePreview, setAdminImagePreview] = useState<string | null>(null);
  const [adminIsUploading, setAdminIsUploading] = useState(false);
  const [adminActiveLightboxImage, setAdminActiveLightboxImage] = useState<string | null>(null);

  // Admin Message Copying States & Refs
  const [adminCopiedMessageId, setAdminCopiedMessageId] = useState<string | null>(null);
  const [adminActiveContextMenu, setAdminActiveContextMenu] = useState<{ x: number, y: number, messageId: string, text: string } | null>(null);
  const adminLongPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const [newAttributeInput, setNewAttributeInput] = useState('');
  const [newAttributeIsGroup, setNewAttributeIsGroup] = useState(false);
  const [newAttributeGroupMembers, setNewAttributeGroupMembers] = useState<string[]>([]);
  const [managedGroupMembers, setManagedGroupMembers] = useState<string[]>([]);

  // Manage Attribute options / chatbot state
  const [editingAttributeForOptions, setEditingAttributeForOptions] = useState<any | null>(null);
  const [managedOptions, setManagedOptions] = useState<any[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [newOptionHasTimeframe, setNewOptionHasTimeframe] = useState(false);
  const [newOptionDuration, setNewOptionDuration] = useState('1 hari');
  const [newOptionHasLateLimit, setNewOptionHasLateLimit] = useState(false);
  const [newOptionMaxArrivalTime, setNewOptionMaxArrivalTime] = useState('09:00');
  const [managedChatbotEnabled, setManagedChatbotEnabled] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionText, setEditingOptionText] = useState('');
  const [editingOptionHasLateLimit, setEditingOptionHasLateLimit] = useState(false);
  const [editingOptionMaxArrivalTime, setEditingOptionMaxArrivalTime] = useState('09:00');
  const [editingOptionHasTimeframe, setEditingOptionHasTimeframe] = useState(false);
  const [editingOptionDuration, setEditingOptionDuration] = useState('1 hari');
  const [showMobileAttributesModal, setShowMobileAttributesModal] = useState(false);

  // Attribute Calendar State
  const [showAttributeCalendarModal, setShowAttributeCalendarModal] = useState(false);
  const [attributeHistory, setAttributeHistory] = useState<any[]>([]);
  const [selectedAttrCalDate, setSelectedAttrCalDate] = useState<string | null>(null);
  const [attrCalMonth, setAttrCalMonth] = useState(new Date().getMonth());
  const [attrCalYear, setAttrCalYear] = useState(new Date().getFullYear());

  const fetchAttributeHistory = async () => {
    try {
      const res = await fetch('/api/chat/attributes/history');
      if (res.ok) {
        const data = await res.json();
        setAttributeHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch attribute history:', err);
    }
  };


  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Employee Contacts and Jobdesk Reminders State
  interface EmployeeContact {
    id: string;
    name: string;
    number: string;
  }
  interface JobdeskReminder {
    id: string;
    title: string;
    description: string | null;
    intervalMinutes: number;
    isActive: boolean;
    lastRun: string;
    whatsappNumber: string | null;
    employeeNames: string | null;
    created_at: string;
  }

  const [reminderActiveSubTab, setReminderActiveSubTab] = useState<'general' | 'jobdesk' | 'contacts'>('general');
  const [employeeContacts, setEmployeeContacts] = useState<EmployeeContact[]>([]);
  const [jobdeskReminders, setJobdeskReminders] = useState<JobdeskReminder[]>([]);

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // Jobdesk Form State
  const [jobdeskTitle, setJobdeskTitle] = useState('Isi Biji Kopi Espresso');
  const [jobdeskDescription, setJobdeskDescription] = useState('Setiap 1 jam sekali harus dilakukan pengisian biji espresso agar tidak rusak.');
  const [jobdeskInterval, setJobdeskInterval] = useState('60');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [manualJobdeskNumber, setManualJobdeskNumber] = useState('');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<NotificationPermission>('default');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [opt1Day, setOpt1Day] = useState(true);
  const [opt1Hour, setOpt1Hour] = useState(true);
  const [optExact, setOptExact] = useState(true);
  const [enableWaReminder, setEnableWaReminder] = useState(false);
  const [waReminderNumber, setWaReminderNumber] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'editor' | 'recorder' | 'merge'>('editor');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [assistantSelectedFolderIds, setAssistantSelectedFolderIds] = useState<string[]>([]);
  const [timeframeFilter, setTimeframeFilter] = useState<number | null>(null);
  const [folderAiSummary, setFolderAiSummary] = useState<{
    folderName: string;
    timeframeText: string;
    summaryText: string;
    notesCount: number;
  } | null>(null);

  // Reset timeframe filter and AI summary when folder filter changes
  useEffect(() => {
    setTimeframeFilter(null);
    setFolderAiSummary(null);
  }, [selectedFolderId]);

  const activeParentFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : null;
  const activeParentId = activeParentFolder ? (activeParentFolder.parentId || activeParentFolder.id) : null;

  const [autoStartRecorder, setAutoStartRecorder] = useState(false);
  const [pendingNoteData, setPendingNoteData] = useState<any | null>(null);
  const [pendingWhatsApp, setPendingWhatsApp] = useState<{ recipient: string; message: string } | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingFolderParentId, setEditingFolderParentId] = useState<string>('');
  const [isFoldersListOpen, setIsFoldersListOpen] = useState(true);

  const [isMobileCalendarOpen, setIsMobileCalendarOpen] = useState(false);
  const [isMobileFoldersOpen, setIsMobileFoldersOpen] = useState(false);

  // Save Notification state
  const [saveResultNotification, setSaveResultNotification] = useState<{
    notes: Array<{ title: string; folderName: string }>;
  } | null>(null);

  // Auto-dismiss notification after 10 seconds
  useEffect(() => {
    if (saveResultNotification) {
      const timer = setTimeout(() => {
        setSaveResultNotification(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [saveResultNotification]);

  // Spoken feedback helper for voice recorder completions
  const speakFeedback = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('ID'));
      if (idVoice) {
        utterance.voice = idVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  // Custom Confirm Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      const launchTarget = localStorage.getItem('pwa_launch_target');
      if (isStandalone && launchTarget === '/chat') {
        window.location.href = '/chat';
        return;
      }
    }
    setIsCalendarOpen(window.innerWidth > 768);
    setIsFoldersListOpen(window.innerWidth > 768);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // PWA Install Event Handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Helper for fetching with automatic retries to handle database cold-starts
  const fetchWithRetry = async (url: string, options?: RequestInit, retries = 3, delay = 2500): Promise<Response> => {
    try {
      const res = await fetch(url, options);
      if (!res.ok && retries > 0) {
        console.warn(`Fetch to ${url} failed with status ${res.status}. Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay);
      }
      return res;
    } catch (err) {
      if (retries > 0) {
        console.warn(`Fetch to ${url} threw an error. Retrying in ${delay}ms... (${retries} retries left)`, err);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay);
      }
      throw err;
    }
  };

  // Load notes from database
  const loadNotes = async () => {
    setIsLoadingNotes(true);
    try {
      const res = await fetchWithRetry('/api/notes');
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      setNotes(data);
      // Automatically select the first note if none is selected
      if (data.length > 0 && !selectedNote) {
        setSelectedNote(data[0]);
      }
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Load Folders
  const loadFolders = async () => {
    try {
      const res = await fetchWithRetry('/api/folders');
      if (!res.ok) throw new Error('Failed to fetch folders');
      const data = await res.json();
      setFolders(data);
    } catch (err) {
      console.error('Error loading folders:', err);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        setEmployeeContacts(data);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const loadJobdeskReminders = async () => {
    try {
      const res = await fetch('/api/jobdesk-reminders');
      if (res.ok) {
        const data = await res.json();
        setJobdeskReminders(data);
      }
    } catch (err) {
      console.error('Failed to load jobdesk reminders:', err);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactNumber.trim()) {
      alert('Nama dan nomor telepon wajib diisi!');
      return;
    }

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contactName, number: contactNumber })
      });

      if (res.ok) {
        const data = await res.json();
        setEmployeeContacts(prev => [data, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
        setContactName('');
        setContactNumber('');
        alert('Kontak berhasil disimpan!');
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Gagal menambahkan kontak.');
      }
    } catch (err) {
      console.error('Failed to create contact:', err);
      alert('Gagal membuat kontak.');
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus kontak ini?')) {
      try {
        const res = await fetch(`/api/contacts?id=${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setEmployeeContacts(prev => prev.filter(c => c.id !== id));
        } else {
          alert('Gagal menghapus kontak.');
        }
      } catch (err) {
        console.error('Failed to delete contact:', err);
      }
    }
  };

  const handleCreateJobdeskReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobdeskTitle.trim() || !jobdeskInterval.trim()) {
      alert('Judul dan interval wajib diisi!');
      return;
    }

    // Get selected contacts details
    const selectedContacts = employeeContacts.filter(c => selectedContactIds.includes(c.id));
    const selectedNames = selectedContacts.map(c => c.name).join(', ');
    const selectedNumbers = selectedContacts.map(c => c.number).join(', ');

    // Combine with manual number if any
    let finalNumbers = selectedNumbers;
    if (manualJobdeskNumber.trim()) {
      const cleanManual = manualJobdeskNumber.replace(/[^0-9]/g, '');
      finalNumbers = finalNumbers ? `${finalNumbers},${cleanManual}` : cleanManual;
    }

    try {
      const res = await fetch('/api/jobdesk-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jobdeskTitle,
          description: jobdeskDescription,
          intervalMinutes: jobdeskInterval,
          whatsappNumber: finalNumbers || null,
          employeeNames: selectedNames || (manualJobdeskNumber.trim() ? 'Nomor Manual' : 'Umum')
        })
      });

      if (res.ok) {
        const data = await res.json();
        setJobdeskReminders(prev => [data, ...prev]);
        setJobdeskTitle('Isi Biji Kopi Espresso');
        setJobdeskDescription('Setiap 1 jam sekali harus dilakukan pengisian biji espresso agar tidak rusak.');
        setJobdeskInterval('60');
        setSelectedContactIds([]);
        setManualJobdeskNumber('');
        alert('Pengingat Jobdesk berhasil dibuat!');
        fetch('/api/cron').catch(console.error); // Trigger cron once to register and update
      } else {
        alert('Gagal membuat pengingat jobdesk.');
      }
    } catch (err) {
      console.error('Failed to create jobdesk reminder:', err);
      alert('Gagal membuat pengingat jobdesk.');
    }
  };

  const handleDeleteJobdeskReminder = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus pengingat jobdesk ini?')) {
      try {
        const res = await fetch(`/api/jobdesk-reminders?id=${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setJobdeskReminders(prev => prev.filter(r => r.id !== id));
        } else {
          alert('Gagal menghapus pengingat jobdesk.');
        }
      } catch (err) {
        console.error('Failed to delete jobdesk reminder:', err);
      }
    }
  };

  const loadReminders = async () => {
    try {
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data);
      }
    } catch (err) {
      console.error('Failed to load reminders:', err);
    }
  };

  const handleCreateReminder = async (
    title: string,
    description: string,
    dateTime: string,
    notify1Day?: boolean,
    notify1Hour?: boolean,
    notifyExact?: boolean,
    whatsappNumber?: string
  ) => {
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          dateTime,
          notify1Day: notify1Day !== undefined ? notify1Day : true,
          notify1Hour: notify1Hour !== undefined ? notify1Hour : true,
          notifyExact: notifyExact !== undefined ? notifyExact : true,
          whatsappNumber: whatsappNumber || null
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReminders(prev => [data, ...prev]);
        fetch('/api/cron').catch(console.error);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to create reminder:', err);
      return false;
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus pengingat ini?')) {
      try {
        const res = await fetch(`/api/reminders?id=${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setReminders(prev => prev.filter(r => r.id !== id));
        }
      } catch (err) {
        console.error('Failed to delete reminder:', err);
      }
    }
  };

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('admin_authorized', 'true');
        setIsAdminAuthorized(true);
      } else {
        setPasscodeError(data.error || 'Passcode salah!');
      }
    } catch (err) {
      setPasscodeError('Gagal memverifikasi passcode.');
    }
  };

  const handleAdminLogout = () => {
    if (confirm('Apakah Anda yakin ingin keluar dari Panel Admin?')) {
      localStorage.removeItem('admin_authorized');
      setIsAdminAuthorized(false);
      setPasscodeInput('');
      window.location.href = '/chat';
    }
  };

  const loadChatMessages = async (isSilent = false) => {
    if (!isSilent) setChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch(`/api/chat?limit=150&_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const msgs = Array.isArray(data) ? data : (data.messages || []);
        setChatMessages(prev => {
          const pendingTempMsgs = prev.filter((m: any) => m.id && typeof m.id === 'string' && m.id.startsWith('temp-'));

          const msgMap = new Map(prev.map((m: any) => [m.id, m]));
          msgs.forEach((m: any) => {
            msgMap.set(m.id, m);
          });
          pendingTempMsgs.forEach((t: any) => {
            if (!msgMap.has(t.id)) {
              msgMap.set(t.id, t);
            }
          });

          const sorted = Array.from(msgMap.values()).sort((a: any, b: any) => {
            const dateA = getValidDate(a.createdAt);
            const dateB = getValidDate(b.createdAt);
            const timeA = dateA ? dateA.getTime() : 0;
            const timeB = dateB ? dateB.getTime() : 0;
            return timeA - timeB;
          });
          return sorted;
        });
      } else {
        const errText = await res.text();
        setChatError(`Server HTTP ${res.status}: ${errText}`);
      }
    } catch (err: any) {
      console.error('Failed to load chat messages:', err);
      setChatError(err.message || String(err));
    } finally {
      if (!isSilent) setChatLoading(false);
      adminIsLoadingOlderRef.current = false;
    }
  };

  const loadOlderMessages = async () => {
    if (chatMessages.length === 0 || adminLoadingOlder || !adminHasMoreOlder) return;
    setAdminLoadingOlder(true);
    adminIsLoadingOlderRef.current = true;

    const chatArea = adminChatAreaRef.current;
    const oldScrollHeight = chatArea ? chatArea.scrollHeight : 0;
    const oldScrollTop = chatArea ? chatArea.scrollTop : 0;

    try {
      const oldestMsg = chatMessages[0];
      const res = await fetch(`/api/chat?limit=150&before=${encodeURIComponent(oldestMsg.createdAt)}&_t=${Date.now()}`);
      if (res.ok) {
        const newOlderMsgs = await res.json();
        if (newOlderMsgs.length < 150) {
          setAdminHasMoreOlder(false);
        }
        setChatMessages(prev => {
          const existingIds = new Set(prev.map((m: any) => m.id));
          const uniqueOlder = newOlderMsgs.filter((m: any) => !existingIds.has(m.id));
          return [...uniqueOlder, ...prev];
        });

        if (chatArea) {
          setTimeout(() => {
            const newScrollHeight = chatArea.scrollHeight;
            chatArea.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
          }, 0);
        }
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setAdminLoadingOlder(false);
    }
  };

  const loadChatAttributes = async (isSilent = false) => {
    try {
      const res = await fetch('/api/chat/attributes', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const attrs = Array.isArray(data) ? data : (data.attributes || []);
        setChatAttributes(attrs);
        if (!isSilent) {
          setSelectedChatAttribute(prev => {
            const exists = attrs.some((a: any) => a.name === prev);
            if (exists && prev) return prev;
            const hasUmum = attrs.some((a: any) => a.name === 'Umum');
            return hasUmum ? 'Umum' : (attrs[0]?.name || '');
          });
          // Load history logs as well
          fetchAttributeHistory();
        }
      }
    } catch (err) {
      console.error('Failed to load chat attributes:', err);
    }
  };

  const sortOptions = (opts: any[]) => {
    if (!Array.isArray(opts)) return [];
    return [...opts].sort((a, b) => {
      const textA = (typeof a === 'string' ? a : (a?.text || '')).toLowerCase();
      const textB = (typeof b === 'string' ? b : (b?.text || '')).toLowerCase();
      return textA.localeCompare(textB);
    });
  };

  const handleSaveOptionRename = (id: string) => {
    if (!editingOptionText.trim()) return;
    setManagedOptions(prev =>
      sortOptions(
        prev.map(o => {
          if (o.id === id) {
            const now = new Date();
            let expiry = o.expiryDate;
            if (editingOptionHasTimeframe && !o.hasTimeframe) {
              const expiryDate = new Date(now);
              const dur = (editingOptionDuration || '1 hari').toLowerCase();
              if (dur.includes('1 hari')) {
                expiryDate.setDate(expiryDate.getDate() + 1);
              } else if (dur.includes('3 hari')) {
                expiryDate.setDate(expiryDate.getDate() + 3);
              } else if (dur.includes('7 hari')) {
                expiryDate.setDate(expiryDate.getDate() + 7);
              } else if (dur.includes('2 minggu')) {
                expiryDate.setDate(expiryDate.getDate() + 14);
              } else if (dur.includes('1 bulan')) {
                expiryDate.setMonth(expiryDate.getMonth() + 1);
              } else {
                expiryDate.setDate(expiryDate.getDate() + 1);
              }
              expiry = expiryDate.toISOString();
            }
            return {
              ...o,
              text: editingOptionText.trim(),
              hasLateLimit: editingOptionHasLateLimit,
              maxArrivalTime: editingOptionHasLateLimit ? editingOptionMaxArrivalTime : null,
              hasTimeframe: editingOptionHasTimeframe,
              duration: editingOptionHasTimeframe ? editingOptionDuration : null,
              expiryDate: editingOptionHasTimeframe ? expiry : null,
              startDate: editingOptionHasTimeframe ? (o.startDate || now.toISOString()) : null
            };
          }
          return o;
        })
      )
    );
    setEditingOptionId(null);
  };

  const handleSaveAttributeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttributeForOptions) return;
    try {
      const payload: any = {
        id: editingAttributeForOptions.id,
      };

      if (editingAttributeForOptions.isGroup) {
        payload.isGroup = true;
        payload.groupAttributes = managedGroupMembers;
      } else {
        payload.options = managedOptions;
        payload.chatbotEnabled = managedChatbotEnabled;
        payload.quickText = managedQuickText;
      }

      const res = await fetch('/api/chat/attributes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingAttributeForOptions(null);
        loadChatAttributes();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal memperbarui konfigurasi atribut');
      }
    } catch (err) {
      console.error('Failed to save attribute config:', err);
    }
  };

  const handleEditAdminChatClick = (msg: any) => {
    setEditingChatMessage(msg);
    setNewChatMessage(msg.message);
    setSelectedChatAttribute(msg.attribute || 'Umum');
  };

  const handleCancelAdminChatEdit = () => {
    setEditingChatMessage(null);
    setNewChatMessage('');
    setSelectedChatAttribute('Umum');
  };

  const handleDeleteAdminChatMessage = async (msgId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pesan ini?')) return;

    try {
      const res = await fetch(`/api/chat?id=${msgId}&senderName=Admin&senderRole=admin`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus pesan');
      }

      setChatMessages(prev => prev.filter(m => m.id !== msgId));
      if (editingChatMessage?.id === msgId) {
        handleCancelAdminChatEdit();
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menghapus pesan');
    }
  };

  const handleAdminFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if Supabase credentials are placeholder or missing
    const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') ||
      (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === 'placeholder-key' ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'placeholder-key';

    if (isPlaceholder) {
      alert('PERINGATAN: Konfigurasi Supabase Storage belum diset di file .env atau .env.local Anda. Silakan tambahkan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY agar pengunggahan gambar berfungsi.');
      e.target.value = '';
      return;
    }

    // Validate type with file extension fallback
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const ext = file.name ? (file.name.split('.').pop() || '').toLowerCase() : '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      alert('Format file tidak didukung. Harap pilih gambar (JPEG, PNG, GIF, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB.');
      return;
    }

    setAdminSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAdminImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAdminCopyMessage = (msgId: string, text: string) => {
    if (!text) return;
    const formattedText = formatForWhatsApp(text);
    navigator.clipboard.writeText(formattedText).then(() => {
      setAdminCopiedMessageId(msgId);
      setTimeout(() => setAdminCopiedMessageId(null), 1500);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleAdminTouchStart = (e: React.TouchEvent, msg: any) => {
    if (!msg.message) return; // Only allow long-press on text messages
    if (adminLongPressTimeout.current) clearTimeout(adminLongPressTimeout.current);

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    adminLongPressTimeout.current = setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setAdminActiveContextMenu({
        x,
        y,
        messageId: msg.id,
        text: msg.message
      });
    }, 600); // 600ms threshold
  };

  const handleAdminTouchEnd = () => {
    if (adminLongPressTimeout.current) {
      clearTimeout(adminLongPressTimeout.current);
      adminLongPressTimeout.current = null;
    }
  };

  const toggleAdminSimpleOption = (optText: string) => {
    const currentText = newChatMessage.trim();
    const items = currentText ? currentText.split('\n').map(item => item.trim()).filter(Boolean) : [];
    const index = items.findIndex(item => item.toLowerCase() === optText.toLowerCase());
    if (index !== -1) {
      items.splice(index, 1);
    } else {
      items.push(optText);
    }
    setNewChatMessage(items.join('\n'));
    adminChatInputRef.current?.focus();
  };

  const handleAdminRemovePreview = () => {
    setAdminSelectedFile(null);
    setAdminImagePreview(null);
    if (adminFileInputRef.current) {
      adminFileInputRef.current.value = '';
    }
  };

  const handleSendAdminChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = newChatMessage.trim();
    if ((!textToSend && !adminSelectedFile) || chatSubmitting) return;

    const isAbsen = selectedChatAttribute.toLowerCase().includes('absen');

    // 1. Enforce photo for Absen
    if (isAbsen && !adminSelectedFile) {
      alert('Untuk melakukan absensi, silakan lampirkan foto selfie terlebih dahulu menggunakan tombol kamera/gambar di samping kolom teks.');
      return;
    }

    // 2. Identify shift option for Absen
    let matchedOption: any = null;
    let absenAttr: any = null;
    if (isAbsen) {
      absenAttr = chatAttributes.find((a: any) => a.name.toLowerCase().includes('absen'));
      if (absenAttr) {
        const opts = Array.isArray(absenAttr.options) ? absenAttr.options : [];
        matchedOption = opts.find((o: any) => 
          textToSend.toLowerCase().includes((o.text || o).toLowerCase())
        );
      }
      
      if (!matchedOption) {
        alert('Tentukan shift absensi Anda di kolom pesan (contoh: tulis "Pagi", "Siang", "Malam") atau klik tombol shift di bawah.');
        return;
      }
    }

    const proceedWithSendAdminChatMessage = async (lat: number | null = null, lon: number | null = null) => {
      setChatSubmitting(true);
      setAdminIsUploading(!!adminSelectedFile);

      try {
        let uploadedImageUrl = null;

        // Compress and upload file to Supabase Storage if selected
        if (adminSelectedFile) {
          const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                                process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') || 
                                (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
                                process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === 'placeholder-key' || 
                                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'placeholder-key';

          if (isPlaceholder) {
            // Mock upload by converting to Base64 data URL for local testing
            uploadedImageUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
              reader.readAsDataURL(adminSelectedFile);
            });
          } else {
            try {
              const compressedBlob = await compressImageToBlob(adminSelectedFile);
              const fileExt = adminSelectedFile.name.split('.').pop() || 'jpg';
              const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
              const filePath = `${fileName}`;

              const { data, error } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, compressedBlob, {
                  contentType: 'image/jpeg',
                  cacheControl: '3600',
                  upsert: false
                });

              if (error) {
                throw new Error(`Gagal mengunggah gambar ke storage: ${error.message}`);
              }

              const { data: urlData } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

              uploadedImageUrl = urlData.publicUrl;
            } catch (err: any) {
              throw new Error(err.message || 'Gagal memproses gambar');
            }
          }
        }

        const isEditing = !!editingChatMessage;
        const url = '/api/chat';
        const method = isEditing ? 'PUT' : 'POST';
        const bodyPayload = isEditing 
          ? {
              id: editingChatMessage.id,
              message: textToSend,
              attribute: selectedChatAttribute || null,
              senderName: 'Admin',
              senderRole: 'admin',
              imageUrl: editingChatMessage.imageUrl
            }
          : {
              senderName: 'Admin',
              senderRole: 'admin',
              message: textToSend,
              imageUrl: uploadedImageUrl,
              attribute: selectedChatAttribute || null,
              latitude: lat,
              longitude: lon
            };

        const res = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        if (res.ok) {
          const resultMsg = await res.json();
          if (isEditing) {
            setChatMessages(prev => prev.map(m => m.id === resultMsg.id ? resultMsg : m));
            setEditingChatMessage(null);
          } else {
            setChatMessages(prev => [...prev, resultMsg]);
          }
          setNewChatMessage('');
          setAdminSelectedFile(null);
          setAdminImagePreview(null);
          if (adminFileInputRef.current) {
            adminFileInputRef.current.value = '';
          }

          // Register check-in in the database history if it's Absen
          if (isAbsen && absenAttr && matchedOption && !isEditing) {
            const checkInRes = await fetch('/api/chat/attributes', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: absenAttr.id,
                action: 'take',
                optionId: matchedOption.id,
                assignedTo: 'Admin'
              })
            });
            
            if (checkInRes.ok) {
              loadChatAttributes(true);
            }
          }
        } else {
          let errorMessage = `Gagal ${isEditing ? 'mengedit' : 'mengirim'} pesan`;
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            if (res.status === 413) {
              errorMessage = 'Ukuran gambar terlalu besar untuk diunggah ke Vercel (Maksimal 3MB).';
            } else {
              errorMessage = `Terjadi kesalahan server (Kode status: ${res.status})`;
            }
          }
          throw new Error(errorMessage);
        }
      } catch (err: any) {
        alert(err.message || 'Terjadi kesalahan saat memproses pesan');
      } finally {
        setChatSubmitting(false);
        setAdminIsUploading(false);
      }
    };

    if (isAbsen) {
      if (!navigator.geolocation) {
        alert('Browser Anda tidak mendukung deteksi lokasi (Geolocation).');
        return;
      }

      setChatSubmitting(true);
      setAdminIsUploading(true);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          // Haversine distance to Burjo Level Up (-7.1538944, 110.4047934)
          const R = 6371e3; // metres
          const phi1 = lat * Math.PI/180;
          const phi2 = -7.1538944 * Math.PI/180;
          const deltaPhi = (-7.1538944 - lat) * Math.PI/180;
          const deltaLambda = (110.4047934 - lon) * Math.PI/180;

          const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
                    Math.cos(phi1) * Math.cos(phi2) *
                    Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          if (distance > 100) {
            alert(`Absen gagal! Anda berada di luar radius toko. Jarak Anda saat ini: ${Math.round(distance)} meter dari toko (Maksimal radius 100 meter).`);
            setChatSubmitting(false);
            setAdminIsUploading(false);
            return;
          }
          
          await proceedWithSendAdminChatMessage(lat, lon);
        },
        async (error) => {
          let errorMessage = 'Gagal mendeteksi lokasi perangkat. ';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Izin akses lokasi ditolak. Harap izinkan akses lokasi (GPS) pada pengaturan browser Anda.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Informasi lokasi tidak dapat ditemukan.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Waktu tunggu deteksi lokasi habis.';
              break;
            default:
              errorMessage += 'Terjadi kesalahan jaringan atau sensor GPS.';
              break;
          }
          alert(errorMessage);
          setChatSubmitting(false);
          setAdminIsUploading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      await proceedWithSendAdminChatMessage();
    }
  };

  const handleAddChatAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttributeInput.trim()) return;
    try {
      const res = await fetch('/api/chat/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAttributeInput.trim(),
          isGroup: newAttributeIsGroup,
          groupAttributes: newAttributeGroupMembers
        }),
      });
      if (res.ok) {
        const newAttr = await res.json();
        setChatAttributes(prev => [...prev, newAttr].sort((a, b) => a.name.localeCompare(b.name)));
        setNewAttributeInput('');
        setNewAttributeIsGroup(false);
        setNewAttributeGroupMembers([]);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Gagal menambahkan atribut');
      }
    } catch (err) {
      alert('Gagal menambahkan atribut');
    }
  };

  const handleDeleteChatAttribute = async (id: string, name: string) => {
    if (name === 'Umum') {
      alert('Atribut "Umum" adalah atribut sistem bawaan dan tidak dapat dihapus.');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus atribut "${name}"?`)) {
      try {
        const res = await fetch(`/api/chat/attributes?id=${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setChatAttributes(prev => prev.filter(a => a.id !== id));
          if (selectedChatAttribute === name) {
            setSelectedChatAttribute('Umum');
          }
        } else {
          const errData = await res.json();
          alert(errData.error || 'Gagal menghapus atribut');
        }
      } catch (err) {
        alert('Gagal menghapus atribut');
      }
    }
  };

  const handleRenameChatAttribute = async (id: string, oldName: string) => {
    if (oldName === 'Umum') {
      alert('Atribut "Umum" adalah atribut sistem bawaan dan tidak dapat diubah namanya.');
      return;
    }
    const newName = prompt(`Masukkan nama baru untuk atribut "${oldName}":`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    try {
      const res = await fetch('/api/chat/attributes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setChatAttributes(prev => prev.map(a => a.id === id ? { ...a, name: updated.name } : a).sort((a, b) => a.name.localeCompare(b.name)));
        if (selectedChatAttribute === oldName) {
          setSelectedChatAttribute(updated.name);
        }
        alert('Atribut berhasil diubah namanya.');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Gagal mengubah nama atribut');
      }
    } catch (err) {
      alert('Gagal mengubah nama atribut');
    }
  };


  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleSubscribePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Browser Anda tidak mendukung notifikasi.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermissionStatus(permission);

      if (permission !== 'granted') {
        alert('Izin notifikasi ditolak. Aktifkan secara manual di pengaturan browser.');
        return;
      }

      if (!('serviceWorker' in navigator)) {
        alert('Service worker tidak didukung di browser ini.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      if (!registration || !registration.pushManager) {
        alert('Fitur notifikasi push tidak didukung atau dibatasi oleh browser Anda (misalnya di iOS Safari, fitur notifikasi hanya aktif jika aplikasi ditambahkan ke layar utama / Home Screen terlebih dahulu).');
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing');
        alert('Kunci publik VAPID belum dikonfigurasi di server.');
        return;
      }

      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      };

      const subscription = await registration.pushManager.subscribe(subscribeOptions);

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });

      if (res.ok) {
        setIsPushSubscribed(true);
        alert('Push notifikasi berhasil diaktifkan!');
      } else {
        throw new Error('Gagal menyimpan subscription di server');
      }
    } catch (err: any) {
      console.error('Push subscription failed:', err);
      alert('Gagal mengaktifkan push notifikasi: ' + err.message);
    }
  };

  // Create Folder
  const handleCreateFolder = async (name: string, parentId?: string | null) => {
    if (!name || name.trim() === '') return null;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: parentId || null }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create folder');
      }
      const newFolder = await res.json();
      setFolders((prev) => [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name)));
      return newFolder;
    } catch (err: any) {
      alert(err.message || 'Gagal membuat folder baru.');
      return null;
    }
  };

  // Rename Folder
  const handleRenameFolder = async (id: string, name: string, parentId?: string | null) => {
    if (!name || name.trim() === '') return;
    try {
      const res = await fetch('/api/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, parentId: parentId || null }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to rename folder');
      }
      const updatedFolder = await res.json();
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? updatedFolder : f)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingFolderId(null);
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah nama folder.');
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (id: string) => {
    showConfirm(
      'Hapus Folder',
      'Apakah Anda yakin ingin menghapus folder ini? Catatan di dalamnya tidak akan terhapus, melainkan dipindahkan ke "Tanpa Folder".',
      async () => {
        try {
          const res = await fetch(`/api/folders?id=${id}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Failed to delete folder');

          setFolders((prev) => prev.filter((f) => f.id !== id));
          if (selectedFolderId === id) {
            setSelectedFolderId(null);
          }

          loadNotes();
        } catch (err: any) {
          alert(err.message || 'Gagal menghapus folder.');
        }
      }
    );
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isAdminParam = urlParams.get('admin') === 'true';
      const isAssistantPath = window.location.pathname === '/assistant';
      const auth = localStorage.getItem('admin_authorized') === 'true';

      if (auth) {
        setIsAdminAuthorized(true);
        setAuthChecking(false);
      } else if (isAdminParam || isAssistantPath) {
        setIsAdminAuthorized(false);
        setAuthChecking(false);
      } else {
        localStorage.removeItem('admin_authorized');
        setIsAdminAuthorized(false);
        window.location.href = '/chat';
      }
    }
  }, []);

  useEffect(() => {
    if (isAdminAuthorized) {
      loadNotes();
      loadFolders();
      loadReminders();
      loadContacts();
      loadJobdeskReminders();

      if (typeof window !== 'undefined') {
        const savedWaNum = localStorage.getItem('default_wa_reminder_number');
        if (savedWaNum) {
          setWaReminderNumber(savedWaNum);
          setEnableWaReminder(true);
        }
      }

      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPushPermissionStatus(Notification.permission);

        if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            if (registration && registration.pushManager) {
              registration.pushManager.getSubscription().then((subscription) => {
                setIsPushSubscribed(!!subscription);
              }).catch((e) => {
                console.warn('Failed to get push subscription:', e);
              });
            }
          });
        }
      }
    }
  }, [isAdminAuthorized]);

  // Handle actions redirected from the standalone Voice Assistant page
  useEffect(() => {
    if (!isAdminAuthorized || isLoadingNotes) return;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action) {
        console.log('Processing standalone assistant redirect action:', action);
        if (action === 'SHOW_NEWS') {
          setActiveTab('news');
        } else if (action === 'CREATE_REMINDER') {
          setActiveTab('reminders');
          loadReminders();
        } else if (action === 'CREATE_NOTE') {
          const folderIdsStr = params.get('folderIds');
          if (folderIdsStr) {
            try {
              setAssistantSelectedFolderIds(JSON.parse(folderIdsStr));
            } catch (e) {
              console.error('Failed to parse folderIds', e);
            }
          }
          setAutoStartRecorder(true);
          if (window.innerWidth <= 768) {
            setActiveTab('recorder');
          } else {
            setActiveTab('notes');
            setWorkspaceView('recorder');
          }
        } else if (action === 'VIEW_NOTE') {
          const noteId = params.get('noteId');
          if (noteId) {
            const noteToView = notes.find(n => n.id === noteId);
            if (noteToView) {
              setSelectedNote(noteToView);
              setActiveTab('notes');
              setWorkspaceView('editor');
              if (window.innerWidth <= 768) {
                setMobileView('editor');
              }
            }
          }
        } else if (action === 'CATEGORIZE_NOTE') {
          const noteId = params.get('noteId');
          const folderName = params.get('folderName');
          if (noteId && folderName) {
            const handleCategorizeFromParam = async () => {
              const existingFolder = folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
              let targetFolderId = existingFolder?.id;
              if (!targetFolderId) {
                const newF = await handleCreateFolder(folderName);
                if (newF) targetFolderId = newF.id;
              }
              if (targetFolderId) {
                try {
                  const res = await fetch('/api/notes', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: noteId,
                      folder_id: targetFolderId
                    })
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setNotes(prev => prev.map(n => n.id === data.id ? data : n));
                    if (selectedNote?.id === data.id) {
                      setSelectedNote(data);
                    }
                    setSelectedFolderId(targetFolderId);
                    setActiveTab('notes');
                    setWorkspaceView('editor');
                  }
                } catch (err) {
                  console.error('Failed to move note via param:', err);
                }
              }
            };
            handleCategorizeFromParam();
          }
        } else if (action === 'SUMMARIZE_AI') {
          const noteId = params.get('noteId');
          if (noteId) {
            const noteToSummarize = notes.find(n => n.id === noteId);
            if (noteToSummarize) {
              setSelectedNote(noteToSummarize);
              setActiveTab('notes');
              setWorkspaceView('editor');
            }
          }
        } else if (action === 'SUMMARIZE_FOLDER') {
          const folderId = params.get('folderId');
          const folderName = params.get('folderName');
          if (folderId) {
            setSelectedFolderId(folderId);
            setActiveTab('notes');
          } else if (folderName) {
            const matchedFolder = folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
            if (matchedFolder) {
              setSelectedFolderId(matchedFolder.id);
              setActiveTab('notes');
            }
          }
        }

        // Clean URL params to avoid repeating on page refresh
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [isAdminAuthorized, isLoadingNotes, notes, folders]);


  // Supabase Realtime Subscription for Admin Chat (Instant WebSocket updates, 0 GB bandwidth short-polling)
  useEffect(() => {
    if (isAdminAuthorized && activeTab === 'chat') {
      loadChatMessages();
      loadChatAttributes();

      // Subscribe to postgres changes on chat_messages and chat_attributes tables
      const channel = supabase
        .channel('admin_chat_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_messages' },
          () => {
            loadChatMessages(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_attributes' },
          () => {
            loadChatAttributes(true);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdminAuthorized, activeTab]);

  // Smart scroll chat messages to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      if (chatMessages.length === 0) return;

      if (adminIsInitialLoadRef.current) {
        scrollToAdminChatBottom('auto');
        adminIsInitialLoadRef.current = false;
      } else if (adminIsAtBottomRef.current) {
        scrollToAdminChatBottom('smooth');
      } else if (!adminIsLoadingOlderRef.current) {
        setAdminHasNewMessages(true);
        setAdminShowScrollBottomBtn(true);
      }
    }
  }, [chatMessages, activeTab]);


  useEffect(() => {
    if (activeTab === 'chat' && chatMessages.length > 0) {
      scrollToAdminChatBottom('auto');
    }
  }, [chatFilterAttribute]);


  // Background cron executor (polls /api/cron only when page is visible)
  useEffect(() => {
    if (typeof document !== 'undefined' && document.hidden) return;

    // Run initial check
    fetch('/api/cron').catch(console.error);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetch('/api/cron')
        .then(res => res.json())
        .then(data => {
          const hasJobs = data.results && data.results.length > 0;
          const hasReminders = data.reminders && data.reminders.length > 0;
          const hasJobdesks = data.jobdeskReminders && data.jobdeskReminders.length > 0;
          if (hasJobs || hasReminders || hasJobdesks) {
            console.log('Cron completed some jobs:', data);
            if (hasJobs) loadNotes();
            if (hasReminders) loadReminders();
            if (hasJobdesks) loadJobdeskReminders();
          }
        })
        .catch(console.error);
    }, 120000); // Check every 2 minutes (120s) to save resources

    return () => clearInterval(interval);
  }, []);

  // Save default WhatsApp number to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (waReminderNumber.trim() !== '') {
        localStorage.setItem('default_wa_reminder_number', waReminderNumber.trim());
      } else {
        localStorage.removeItem('default_wa_reminder_number');
      }
    }
  }, [waReminderNumber]);

  // Handle actions sent from Voice Assistant
  useEffect(() => {
    const handleAssistantAction = async (e: Event) => {
      const { action, payload } = (e as CustomEvent).detail;
      console.log('Assistant Action received:', action, payload);

      if (action === 'SHOW_NEWS') {
        setActiveTab('news');
      } else if (action === 'CREATE_REMINDER') {
        try {
          let waNum = payload.whatsappNumber;
          if (!waNum || waNum === 'default') {
            waNum = localStorage.getItem('default_wa_reminder_number') || '';
          }
          const res = await fetch('/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: payload.title || 'Pengingat Suara',
              description: payload.description || 'Dibuat via Asisten Suara.',
              dateTime: payload.dateTime,
              notify1Day: payload.notify1Day,
              notify1Hour: payload.notify1Hour,
              notifyExact: payload.notifyExact,
              whatsappNumber: waNum || null
            })
          });
          if (res.ok) {
            const data = await res.json();
            setReminders(prev => [data, ...prev]);
            setActiveTab('reminders');
            fetch('/api/cron').catch(console.error);
          }
        } catch (err) {
          console.error('Failed to create reminder via assistant:', err);
        }
      } else if (action === 'CREATE_NOTE') {
        if (payload && payload.folderIds && Array.isArray(payload.folderIds)) {
          setAssistantSelectedFolderIds(payload.folderIds);
        } else if (payload && payload.folderId) {
          setAssistantSelectedFolderIds([payload.folderId]);
        } else {
          setAssistantSelectedFolderIds([]);
        }
        setAutoStartRecorder(true);
        if (window.innerWidth <= 768) {
          setActiveTab('recorder');
        } else {
          setActiveTab('notes');
          setWorkspaceView('recorder');
        }
      } else if (action === 'CREATE_NOTE_DIRECT') {
        if (payload) {
          try {
            const parsedTodos = payload.todo_list ? payload.todo_list.map((task: string) => ({
              text: task,
              completed: false,
            })) : [];

            const res = await fetch('/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: payload.title,
                content: payload.content,
                summary: payload.summary,
                tags: payload.tags || ['Draft Rapat'],
                todo_list: parsedTodos,
                folder_id: payload.folderId || null,
              })
            });
            if (res.ok) {
              const data = await res.json();
              setNotes(prev => [data, ...prev]);
              setSelectedNote(data);
              loadFolders(); // Refresh folders to ensure new subfolders are displayed
              setActiveTab('notes');
              setWorkspaceView('editor');
              if (window.innerWidth <= 768) {
                setMobileView('editor');
              }
            }
          } catch (err) {
            console.error('Failed to create note directly via assistant:', err);
          }
        }
      } else if (action === 'UPDATE_NOTE') {
        if (payload.noteId) {
          try {
            const parsedTodos = payload.todo_list ? payload.todo_list.map((task: string) => ({
              text: task,
              completed: false,
            })) : undefined;

            const res = await fetch('/api/notes', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: payload.noteId,
                title: payload.title,
                content: payload.content,
                summary: payload.summary,
                tags: payload.tags,
                todo_list: parsedTodos
              })
            });
            if (res.ok) {
              const data = await res.json();
              setNotes(prev => prev.map(n => n.id === data.id ? data : n));
              setSelectedNote(data);
              setActiveTab('notes');
              setWorkspaceView('editor');
              if (window.innerWidth <= 768) {
                setMobileView('editor');
              }
            }
          } catch (err) {
            console.error('Failed to update note via assistant:', err);
          }
        }
      } else if (action === 'VIEW_NOTE') {
        // Open the matched note
        if (payload.noteId) {
          const noteToView = notes.find(n => n.id === payload.noteId);
          if (noteToView) {
            setSelectedNote(noteToView);
            setActiveTab('notes');
            setWorkspaceView('editor');
            if (window.innerWidth <= 768) {
              setMobileView('editor');
            }
          }
        }
      } else if (action === 'CATEGORIZE_NOTE') {
        // Move note to folder
        if (payload.noteId) {
          let targetFolderId = payload.folderId;

          // If folderId is null, check if folderName matches an existing folder, or create it
          if (!targetFolderId && payload.folderName) {
            const existingFolder = folders.find(f => f.name.toLowerCase() === payload.folderName.toLowerCase());
            if (existingFolder) {
              targetFolderId = existingFolder.id;
            } else {
              // Create folder
              const newF = await handleCreateFolder(payload.folderName);
              if (newF) targetFolderId = newF.id;
            }
          }

          // Call API to update folder
          try {
            const res = await fetch('/api/notes', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: payload.noteId,
                folder_id: targetFolderId
              })
            });
            if (res.ok) {
              const data = await res.json();
              setNotes(prev => prev.map(n => n.id === data.id ? data : n));
              if (selectedNote?.id === data.id) {
                setSelectedNote(data);
              }
              // Set the active folder filter
              setSelectedFolderId(targetFolderId);
            }
          } catch (err) {
            console.error('Failed to move note via assistant:', err);
          }
        }
      } else if (action === 'SUMMARIZE_AI') {
        // Summarize note
        if (payload.noteId) {
          const noteToSummarize = notes.find(n => n.id === payload.noteId);
          if (noteToSummarize) {
            setSelectedNote(noteToSummarize);
            setActiveTab('notes');
            setWorkspaceView('editor');
          }
        }
      } else if (action === 'SUMMARIZE_FOLDER') {
        let targetFolderId = payload.folderId;
        let targetFolderName = payload.folderName;

        if (!targetFolderId && targetFolderName) {
          const matchedFolder = folders.find(f => f.name.toLowerCase() === targetFolderName.toLowerCase());
          if (matchedFolder) {
            targetFolderId = matchedFolder.id;
            targetFolderName = matchedFolder.name;
          }
        }

        setSelectedFolderId(targetFolderId);
        if (payload.timeframeDays !== undefined) {
          setTimeframeFilter(payload.timeframeDays);
        }
        if (payload.summary) {
          setFolderAiSummary({
            folderName: targetFolderName || (targetFolderId ? 'Folder' : 'Semua Catatan'),
            timeframeText: payload.timeframeDays ? `${payload.timeframeDays} Hari Terakhir` : 'Semua Waktu',
            summaryText: payload.summary,
            notesCount: payload.notesSummarized ? payload.notesSummarized.length : 0
          });
        }
        setWorkspaceView('merge');
        setActiveTab('notes');
        if (window.innerWidth <= 768) {
          setMobileView('editor');
        }
      } else if (action === 'SEND_WHATSAPP') {
        if (payload.recipient && payload.message) {
          setPendingWhatsApp({ recipient: payload.recipient, message: payload.message });
        }
        setActiveTab('whatsapp');
      } else if (action === 'SCHEDULE_JOB') {
        // Trigger check
        fetch('/api/cron').catch(console.error);
      }
    };

    window.addEventListener('assistant-action', handleAssistantAction);
    return () => {
      window.removeEventListener('assistant-action', handleAssistantAction);
    };
  }, [notes, folders, selectedNote]);

  // Helper to format date as YYYY-MM-DD in local time
  const getLocalDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFormattedFilterDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Filter notes based on search query, selected date, selected folder, and timeframe duration
  const filteredNotes = notes.filter((note) => {
    // 1. Filter by date if selected
    if (selectedDate) {
      const noteLocalDate = getLocalDateString(note.created_at);
      if (noteLocalDate !== selectedDate) return false;
    }

    // 2. Filter by folder if selected
    if (selectedFolderId) {
      const childFolderIds = folders
        .filter((f) => f.parentId === selectedFolderId)
        .map((f) => f.id);
      const allowedFolderIds = [selectedFolderId, ...childFolderIds];
      if (!note.folder_id || !allowedFolderIds.includes(note.folder_id)) return false;
    }

    // 3. Filter by timeframe if selected
    if (timeframeFilter !== null) {
      const noteDate = new Date(note.created_at);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeframeFilter);
      if (noteDate < cutoffDate) return false;
    }

    // 4. Filter by search query
    const q = searchQuery.toLowerCase();
    const matchesTitle = (note.title || '').toLowerCase().includes(q);
    const matchesContent = (note.content || '').toLowerCase().includes(q);
    const matchesTags = (note.tags || []).some((tag) => tag.toLowerCase().includes(q));
    return matchesTitle || matchesContent || matchesTags;
  });

  // Handle formatted notes from voice recorder - processes array, resolves folders, and auto-saves
  const handleFormattedNote = async (
    formattedData: {
      notes?: Array<{
        title: string;
        content: string;
        summary: string;
        tags: string[];
        todo_list: string[];
        folderId: string | null;
        folderName: string | null;
        parentFolderName?: string | null;
      }>;
    },
    targetFolderIds?: string[]
  ) => {
    if (!formattedData.notes || !Array.isArray(formattedData.notes)) return;

    try {
      const savedNotesList: any[] = [];
      let lastSavedNote: any = null;
      const localFolders = [...folders];
      const notificationNotes: Array<{ title: string; folderName: string }> = [];

      // Pre-process notes to duplicate the "Utuh" Master note for each checked folder
      const notesToSave: any[] = [];
      for (const note of formattedData.notes) {
        const isUtuh = note.folderName?.trim().toLowerCase() === 'utuh' ||
          note.title?.toLowerCase().includes('utuh') ||
          note.title?.toLowerCase().includes('master');
        if (isUtuh && targetFolderIds && targetFolderIds.length > 0) {
          for (const targetFolderId of targetFolderIds) {
            notesToSave.push({
              ...note,
              folderId: null,
              folderName: 'Utuh',
              parentFolderId: targetFolderId,
            });
          }
        } else {
          notesToSave.push(note);
        }
      }

      for (const note of notesToSave) {
        let folderId = note.folderId;
        let finalFolderName = note.folderName || 'Tanpa Folder';
        const isUtuh = note.folderName?.trim().toLowerCase() === 'utuh' ||
          note.title?.toLowerCase().includes('utuh') ||
          note.title?.toLowerCase().includes('master');

        // Override classification if user checked target folder(s) and this note is not classified in one of them or its subfolders.
        if (targetFolderIds && targetFolderIds.length > 0) {
          if (isUtuh) {
            // "Utuh" note will be resolved in the folder resolve block using its parentFolderId!
          } else {
            const resolvedFolder = folderId ? localFolders.find(f => f.id === folderId) : null;
            const isValidTarget = resolvedFolder && (
              targetFolderIds.includes(resolvedFolder.id) ||
              (resolvedFolder.parentId && targetFolderIds.includes(resolvedFolder.parentId))
            );

            if (!isValidTarget) {
              // Try to find if there is a matching folder (either parent or subfolder under target parents)
              // matching the note's suggested folderName
              const matchedFolder = localFolders.find(
                (f) => (targetFolderIds.includes(f.id) || (f.parentId && targetFolderIds.includes(f.parentId))) &&
                  (note.folderName && f.name.toLowerCase() === note.folderName.toLowerCase())
              );
              if (matchedFolder) {
                folderId = matchedFolder.id;
                finalFolderName = matchedFolder.name;
              } else {
                // Otherwise fallback to the first target folder ID (the parent folder itself)
                const fallbackFolder = localFolders.find((f) => f.id === targetFolderIds[0]);
                if (fallbackFolder) {
                  folderId = fallbackFolder.id;
                  finalFolderName = fallbackFolder.name;
                }
              }
            }
          }
        }

        // Resolve folderId if folderName is suggested but folderId is null
        if (!folderId && note.folderName) {
          let parentFolderId: string | null = null;

          if (isUtuh && note.parentFolderId) {
            parentFolderId = note.parentFolderId;
          } else if (note.parentFolderName) {
            const existingParent = localFolders.find(
              (f) => !f.parentId && f.name.toLowerCase() === note.parentFolderName!.toLowerCase()
            );
            if (existingParent) {
              parentFolderId = existingParent.id;
            } else {
              const newParent = await handleCreateFolder(note.parentFolderName, null);
              if (newParent) {
                parentFolderId = newParent.id;
                localFolders.push(newParent);
              }
            }
          }

          const targetFolderName = isUtuh ? 'Utuh' : note.folderName;
          const existingFolder = localFolders.find(
            (f) => f.name.toLowerCase() === targetFolderName.toLowerCase() && f.parentId === parentFolderId
          );
          if (existingFolder) {
            folderId = existingFolder.id;
            finalFolderName = existingFolder.name;
          } else {
            const newFolder = await handleCreateFolder(targetFolderName, parentFolderId);
            if (newFolder) {
              folderId = newFolder.id;
              finalFolderName = newFolder.name;
              localFolders.push(newFolder);
            }
          }
        } else if (folderId) {
          const folderObj = localFolders.find(f => f.id === folderId);
          if (folderObj) {
            finalFolderName = folderObj.name;
          }
        }

        const parsedTodos = note.todo_list.map((task: string) => ({
          text: task,
          completed: false,
        }));

        const newNotePayload = {
          title: note.title,
          content: note.content,
          summary: note.summary,
          tags: note.tags,
          todo_list: parsedTodos,
          folder_id: folderId,
        };

        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newNotePayload),
        });

        if (res.ok) {
          const data = await res.json();
          savedNotesList.push(data);
          lastSavedNote = data;
          notificationNotes.push({
            title: note.title,
            folderName: finalFolderName
          });
        }
      }

      if (savedNotesList.length > 0) {
        // Clear active date filter so new notes are visible
        setSelectedDate(null);

        // Add new notes to local state
        setNotes((prev) => [...savedNotesList, ...prev]);

        // Select the last saved note and focus it
        if (lastSavedNote) {
          setSelectedNote(lastSavedNote);
          // Set active folder selection to show this note
          setSelectedFolderId(lastSavedNote.folder_id);
        }

        setActiveTab('notes');
        setWorkspaceView('editor');

        if (window.innerWidth <= 768) {
          setMobileView('editor');
        }

        // Show notification toast and trigger voice feedback
        setSaveResultNotification({ notes: notificationNotes });

        const speakText = `Berhasil membuat ${savedNotesList.length} catatan baru. ` +
          notificationNotes.map(n => `Catatan ${n.title} dimasukkan ke folder ${n.folderName}`).join('. ');
        speakFeedback(speakText);
      }
    } catch (err) {
      console.error('Failed to auto-save split notes:', err);
    }
  };


  // Perform saving note with the selected folder
  const saveNoteWithFolder = async (folderId: string | null) => {
    if (!pendingNoteData) return;
    try {
      // Clear date filter so new note is visible
      setSelectedDate(null);
      // Map string todo list to objects
      const parsedTodos = pendingNoteData.todo_list.map((task: string) => ({
        text: task,
        completed: false,
      }));

      const newNote = {
        title: pendingNoteData.title,
        content: pendingNoteData.content,
        summary: pendingNoteData.summary,
        tags: pendingNoteData.tags,
        todo_list: parsedTodos,
        folder_id: folderId,
      };

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      });

      if (!res.ok) throw new Error('Failed to save note');
      const data = await res.json();

      setNotes((prev) => [data, ...prev]);
      setSelectedNote(data);
      setActiveTab('notes');
      setWorkspaceView('editor');

      // Update selected folder filter if saved in one
      if (folderId) {
        setSelectedFolderId(folderId);
      } else {
        setSelectedFolderId(null);
      }

      if (window.innerWidth <= 768) {
        setMobileView('editor');
      }
    } catch (err) {
      console.error('Error saving new AI note:', err);
      alert('Gagal menyimpan catatan baru ke database.');
    } finally {
      setPendingNoteData(null);
      setIsFolderModalOpen(false);
    }
  };

  // Handle saving edits on a note
  const handleSaveNote = async (updatedFields: Partial<Note>) => {
    if (!updatedFields.id) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });

      if (!res.ok) throw new Error('Failed to update note');
      const data = await res.json();

      setNotes((prev) =>
        prev.map((n) => (n.id === data.id ? data : n))
      );
      setSelectedNote(data);
    } catch (err) {
      console.error('Error updating note:', err);
      alert('Gagal menyimpan perubahan ke database.');
    }
  };

  // Handle deleting a note
  const handleDeleteNote = async (noteId: string) => {
    showConfirm(
      'Hapus Catatan',
      'Apakah Anda yakin ingin menghapus catatan ini secara permanen?',
      async () => {
        try {
          const res = await fetch(`/api/notes?id=${noteId}`, {
            method: 'DELETE',
          });

          if (!res.ok) throw new Error('Failed to delete note');

          setNotes((prev) => prev.filter((n) => n.id !== noteId));
          if (selectedNote && selectedNote.id === noteId) {
            const remaining = notes.filter((n) => n.id !== noteId);
            setSelectedNote(remaining.length > 0 ? remaining[0] : null);
            if (window.innerWidth <= 768) {
              setMobileView('list');
            }
          }
        } catch (err) {
          console.error('Error deleting note:', err);
          alert('Gagal menghapus catatan dari database.');
        }
      }
    );
  };

  // Handle duplicating/copying a note
  const handleCopyNote = async (noteId: string) => {
    const originalNote = notes.find((n) => n.id === noteId);
    if (!originalNote) return;

    try {
      // Clean up todo_list from original format (which is JSON)
      const parsedTodos = originalNote.todo_list
        ? (originalNote.todo_list as any[]).map((item) => {
          if (typeof item === 'string') {
            return { text: item, completed: false };
          }
          return { text: item.text || '', completed: !!item.completed };
        })
        : [];

      const copyPayload = {
        title: `${originalNote.title} (Salinan)`,
        content: originalNote.content,
        summary: originalNote.summary,
        tags: originalNote.tags || [],
        todo_list: parsedTodos,
        folder_id: originalNote.folder_id || null,
      };

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copyPayload),
      });

      if (!res.ok) throw new Error('Failed to copy note');
      const data = await res.json();

      setNotes((prev) => [data, ...prev]);
      setSelectedNote(data);
      setWorkspaceView('editor');
      if (window.innerWidth <= 768) {
        setMobileView('editor');
      }
    } catch (err) {
      console.error('Error copying note:', err);
      alert('Gagal menyalin catatan.');
    }
  };

  // Handle moving a note to a different folder
  const handleMoveNote = async (noteId: string, targetFolderId: string | null) => {
    try {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: noteId,
          folder_id: targetFolderId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to move note');
      const data = await res.json();

      setNotes((prev) =>
        prev.map((n) => (n.id === data.id ? data : n))
      );
      setSelectedNote(data);
    } catch (err) {
      console.error('Error moving note:', err);
      alert('Gagal memindahkan catatan.');
    }
  };

  // Create a new blank note
  const handleCreateNewNote = async () => {
    try {
      // Clear date filter so new note is visible
      setSelectedDate(null);
      const blankNote = {
        title: 'Catatan Baru',
        content: '',
        summary: '',
        tags: ['Pribadi'],
        todo_list: [],
        folder_id: selectedFolderId,
      };

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blankNote),
      });

      if (!res.ok) throw new Error('Failed to create note');
      const data = await res.json();

      setNotes((prev) => [data, ...prev]);
      setSelectedNote(data);
      setActiveTab('notes');
      setWorkspaceView('editor');
      if (window.innerWidth <= 768) {
        setMobileView('editor');
      }
    } catch (err) {
      console.error('Error creating blank note:', err);
    }
  };

  // WOW Feature: Summarize news and insert it as an AI note
  const handleCreateNoteFromNews = async (newsItem: NewsItem) => {
    try {
      // Clear date filter so new note is visible
      setSelectedDate(null);
      const newsContextText = `Berita Utama: ${newsItem.title}
Sumber Media: ${newsItem.source}
Kategori: ${newsItem.category}
Link Berita: ${newsItem.url}

Ringkasan Berita Awal: ${newsItem.summary}

Buatlah sebuah catatan berisi ringkasan mendalam tentang berita ini. Cantumkan tautan sumber berita asli secara rapi di bagian bawah konten catatan.`;

      // Call our format route
      const res = await fetch('/api/notes/format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newsContextText }),
      });

      if (!res.ok) {
        throw new Error(`AI summary failed with status ${res.status}`);
      }

      const formattedNote = await res.json();

      // Force append tags
      const currentTags = formattedNote.tags || [];
      if (!currentTags.includes('Berita')) currentTags.push('Berita');
      if (newsItem.category && !currentTags.includes(newsItem.category)) {
        currentTags.push(newsItem.category);
      }

      // Add a source link element in the content
      const enrichedContent = `${formattedNote.content}\n\n---\n> **Sumber Berita Asli**: [Baca selengkapnya di ${newsItem.source}](${newsItem.url})`;

      const parsedTodos = (formattedNote.todo_list || []).map((task: string) => ({
        text: task,
        completed: false,
      }));

      const newNote = {
        title: formattedNote.title || newsItem.title,
        content: enrichedContent,
        summary: formattedNote.summary || newsItem.summary,
        tags: currentTags,
        todo_list: parsedTodos,
      };

      const resInsert = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      });

      if (!resInsert.ok) throw new Error('Failed to create note from news');
      const data = await resInsert.json();

      setNotes((prev) => [data, ...prev]);
      setSelectedNote(data);
      setActiveTab('notes');
      setWorkspaceView('editor');
      if (window.innerWidth <= 768) {
        setMobileView('editor');
      }
    } catch (err) {
      console.error('Failed to create note from news:', err);
      alert('Gagal merangkum berita menjadi catatan.');
    }
  };

  const renderRemindersTab = () => {
    const formatDateTime = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        return d.toLocaleString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (err) {
        return dateStr;
      }
    };

    const handleSubmitReminder = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reminderTitle.trim() || !reminderDate || !reminderTime) {
        alert('Judul, tanggal, dan waktu pengingat wajib diisi!');
        return;
      }
      if (enableWaReminder && !waReminderNumber.trim()) {
        alert('Nomor WhatsApp wajib diisi jika notifikasi WhatsApp diaktifkan!');
        return;
      }

      // Parse date and time components locally to ensure timezone offset is included
      const [year, month, day] = reminderDate.split('-').map(Number);
      const [hour, minute] = reminderTime.split(':').map(Number);
      const localDateTime = new Date(year, month - 1, day, hour, minute);

      if (isNaN(localDateTime.getTime())) {
        alert('Format tanggal atau waktu tidak valid!');
        return;
      }

      const dateTimeStr = localDateTime.toISOString();

      const success = await handleCreateReminder(
        reminderTitle,
        reminderDescription,
        dateTimeStr,
        opt1Day,
        opt1Hour,
        optExact,
        enableWaReminder ? waReminderNumber.trim() : undefined
      );

      if (success) {
        if (enableWaReminder) {
          localStorage.setItem('default_wa_reminder_number', waReminderNumber.trim());
        }
        setReminderTitle('');
        setReminderDescription('');
        setReminderDate('');
        setReminderTime('');
        setOpt1Day(true);
        setOpt1Hour(true);
        setOptExact(true);
        alert('Pengingat berhasil dibuat!');
      } else {
        alert('Gagal membuat pengingat.');
      }
    };

    return (
      <div className={styles.remindersDashboard}>
        <div className={styles.remindersHeader}>
          <div>
            <h2>⏰ Pengingat & Alarm AI</h2>
            <p className={styles.remindersSub}>Atur pengingat suara Anda melalui Asisten AI, buat pengingat umum, atau kelola jobdesk karyawan.</p>
          </div>

          <div className={styles.pushPermissionWidget}>
            {pushPermissionStatus === 'granted' && isPushSubscribed ? (
              <span className={`${styles.statusBadge} ${styles.statusActive}`}>
                🔔 Push Notifikasi Aktif
              </span>
            ) : (
              <div className={styles.permissionActionArea}>
                <span className={`${styles.statusBadge} ${styles.statusInactive}`}>
                  🔕 Notifikasi Belum Aktif
                </span>
                <button
                  type="button"
                  onClick={handleSubscribePush}
                  className={styles.activatePushBtn}
                >
                  Aktifkan Push Notifikasi
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className={styles.reminderSubTabNav}>
          <button
            type="button"
            className={`${styles.reminderSubTabBtn} ${reminderActiveSubTab === 'general' ? styles.reminderSubTabBtnActive : ''}`}
            onClick={() => setReminderActiveSubTab('general')}
          >
            ⏰ Pengingat Umum
          </button>
          <button
            type="button"
            className={`${styles.reminderSubTabBtn} ${reminderActiveSubTab === 'jobdesk' ? styles.reminderSubTabBtnActive : ''}`}
            onClick={() => setReminderActiveSubTab('jobdesk')}
          >
            📋 Jobdesk Karyawan
          </button>
          <button
            type="button"
            className={`${styles.reminderSubTabBtn} ${reminderActiveSubTab === 'contacts' ? styles.reminderSubTabBtnActive : ''}`}
            onClick={() => setReminderActiveSubTab('contacts')}
          >
            👤 Daftar Kontak
          </button>
        </div>

        {reminderActiveSubTab === 'general' && (
          <div className={styles.remindersContentGrid}>
            <div className={`${styles.reminderFormCard} glass-panel`}>
              <h3>Buat Pengingat Baru</h3>
              <form onSubmit={handleSubmitReminder} className={styles.reminderForm}>
                <div className={styles.formGroup}>
                  <label htmlFor="reminder-title">Judul Pengingat</label>
                  <input
                    id="reminder-title"
                    type="text"
                    placeholder="Contoh: Rapat Evaluasi Proyek"
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="reminder-desc">Keterangan (Opsional)</label>
                  <textarea
                    id="reminder-desc"
                    placeholder="Tambahkan detail pengingat di sini..."
                    value={reminderDescription}
                    onChange={(e) => setReminderDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Date and Time split inputs */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="reminder-date">📅 Tanggal Pelaksanaan</label>
                    <input
                      id="reminder-date"
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) { }
                      }}
                      onFocus={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) { }
                      }}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="reminder-time">⏰ Jam Pelaksanaan</label>
                    <input
                      id="reminder-time"
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) { }
                      }}
                      onFocus={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) { }
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Toggle switch controls */}
                <div className={styles.formGroup}>
                  <label style={{ marginBottom: '8px', display: 'block' }}>Pemberitahuan Alarm</label>
                  <div className={styles.togglesList}>
                    <div className={styles.toggleItem}>
                      <span>H-1 Hari Sebelum Acara</span>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={opt1Day}
                          onChange={(e) => setOpt1Day(e.target.checked)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>

                    <div className={styles.toggleItem}>
                      <span>H-60 Menit Sebelum Acara</span>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={opt1Hour}
                          onChange={(e) => setOpt1Hour(e.target.checked)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>

                    <div className={styles.toggleItem}>
                      <span>Tepat Waktu (D-Day)</span>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={optExact}
                          onChange={(e) => setOptExact(e.target.checked)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>

                    <div className={styles.toggleItem}>
                      <span>Kirim Notifikasi via WhatsApp</span>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={enableWaReminder}
                          onChange={(e) => setEnableWaReminder(e.target.checked)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  </div>
                </div>

                {enableWaReminder && (
                  <div className={styles.formGroup}>
                    <label htmlFor="wa-reminder-number">📲 Nomor WhatsApp Penerima</label>
                    {employeeContacts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <select
                          className={styles.contactSelectDropdown}
                          value={employeeContacts.some(c => c.number === waReminderNumber) ? employeeContacts.find(c => c.number === waReminderNumber)?.id : 'manual'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'manual') {
                              setWaReminderNumber('');
                            } else {
                              const contact = employeeContacts.find(c => c.id === val);
                              if (contact) {
                                setWaReminderNumber(contact.number);
                              }
                            }
                          }}
                        >
                          <option value="manual">-- Ketik Nomor Manual --</option>
                          {employeeContacts.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.number})</option>
                          ))}
                        </select>

                        {(!employeeContacts.some(c => c.number === waReminderNumber) || waReminderNumber === '') && (
                          <input
                            id="wa-reminder-number"
                            type="text"
                            placeholder="Contoh: 08123456789"
                            value={waReminderNumber}
                            onChange={(e) => setWaReminderNumber(e.target.value)}
                            required={enableWaReminder}
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        id="wa-reminder-number"
                        type="text"
                        placeholder="Contoh: 08123456789"
                        value={waReminderNumber}
                        onChange={(e) => setWaReminderNumber(e.target.value)}
                        required={enableWaReminder}
                      />
                    )}
                    <small style={{ color: '#10b981', opacity: 0.9, fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      ✓ Nomor disimpan otomatis sebagai default pengingat & asisten suara.
                    </small>
                  </div>
                )}

                <GlowButton type="submit" variant="primary" style={{ width: '100%', marginTop: '8px' }}>
                  🔔 Simpan Pengingat
                </GlowButton>
              </form>
            </div>

            <div className={styles.reminderListArea}>
              <h3>Daftar Pengingat Terjadwal</h3>
              {reminders.length === 0 ? (
                <div className={`${styles.emptyReminders} glass-panel`}>
                  <Clock size={48} className={styles.emptyIcon} />
                  <p>Belum ada pengingat terjadwal.</p>
                  <p className={styles.emptyHint}>Katakan "Ingatkan saya [tugas] besok jam 8 pagi" pada AI Voice Assistant untuk membuat pengingat secara otomatis!</p>
                </div>
              ) : (
                <div className={styles.remindersScrollContainer}>
                  {reminders.map((reminder) => {
                    const isPast = new Date(reminder.dateTime).getTime() < Date.now();
                    return (
                      <div key={reminder.id} className={`${styles.reminderCard} glass-panel ${isPast ? styles.pastReminder : ''}`}>
                        <div className={reminder.notifyExact && !reminder.sentExact && !isPast ? styles.alarmGlowWrapper : undefined}>
                          <div className={styles.reminderCardHeader}>
                            <div>
                              <h4>{reminder.title}</h4>
                              {reminder.description && <p className={styles.reminderCardDesc}>{reminder.description}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteReminder(reminder.id)}
                              className={styles.deleteReminderBtn}
                              title="Hapus Pengingat"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className={styles.reminderCardTime}>
                            <Clock size={14} />
                            <span>{formatDateTime(reminder.dateTime)}</span>
                            {isPast && <span className={styles.pastLabel}>Selesai</span>}
                          </div>

                          {reminder.whatsappNumber && (
                            <div className={styles.reminderWaInfo}>
                              <span>📲 WhatsApp: <strong>{reminder.whatsappNumber}</strong></span>
                            </div>
                          )}

                          <div className={styles.reminderStages}>
                            {reminder.notify1Day ? (
                              <span className={`${styles.stageBadge} ${reminder.sent1Day ? styles.stageSent : styles.stagePending}`}>
                                {reminder.sent1Day ? '✓ 1 Hari' : '⏳ 1 Hari'}
                              </span>
                            ) : (
                              <span className={`${styles.stageBadge} ${styles.stageDisabled}`}>
                                ✖ 1 Hari (Nonaktif)
                              </span>
                            )}

                            {reminder.notify1Hour ? (
                              <span className={`${styles.stageBadge} ${reminder.sent1Hour ? styles.stageSent : styles.stagePending}`}>
                                {reminder.sent1Hour ? '✓ 1 Jam' : '⏳ 1 Jam'}
                              </span>
                            ) : (
                              <span className={`${styles.stageBadge} ${styles.stageDisabled}`}>
                                ✖ 1 Jam (Nonaktif)
                              </span>
                            )}

                            {reminder.notifyExact ? (
                              <span className={`${styles.stageBadge} ${reminder.sentExact ? styles.stageSent : styles.stagePending}`}>
                                {reminder.sentExact ? '✓ Tepat Waktu' : '⏳ Tepat Waktu'}
                              </span>
                            ) : (
                              <span className={`${styles.stageBadge} ${styles.stageDisabled}`}>
                                ✖ Tepat Waktu (Nonaktif)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {reminderActiveSubTab === 'jobdesk' && (
          <div className={styles.remindersContentGrid}>
            <div className={`${styles.reminderFormCard} glass-panel`}>
              <h3>Buat Pengingat Jobdesk Baru</h3>
              <form onSubmit={handleCreateJobdeskReminder} className={styles.reminderForm}>
                <div className={styles.formGroup}>
                  <label htmlFor="jobdesk-title">Tugas / Jobdesk</label>
                  <input
                    id="jobdesk-title"
                    type="text"
                    placeholder="Contoh: Isi Biji Kopi Espresso"
                    value={jobdeskTitle}
                    onChange={(e) => setJobdeskTitle(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="jobdesk-desc">Keterangan / SOP Kerja</label>
                  <textarea
                    id="jobdesk-desc"
                    placeholder="Contoh: Setiap 1 jam sekali harus dilakukan pengisian biji espresso agar tidak rusak."
                    value={jobdeskDescription}
                    onChange={(e) => setJobdeskDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="jobdesk-interval">⏰ Ulangi Setiap (Interval Waktu)</label>
                  <select
                    id="jobdesk-interval"
                    className={styles.contactSelectDropdown}
                    value={jobdeskInterval}
                    onChange={(e) => setJobdeskInterval(e.target.value)}
                    required
                  >
                    <option value="1">Setiap 1 Menit</option>
                    <option value="60">Setiap 1 Jam</option>
                    <option value="120">Setiap 2 Jam</option>
                    <option value="240">Setiap 4 Jam</option>
                    <option value="480">Setiap 8 Jam</option>
                    <option value="720">Setiap 12 Jam</option>
                    <option value="1440">Setiap 24 Jam (Harian)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label style={{ marginBottom: '8px', display: 'block' }}>👥 Tugaskan Karyawan (Kontak WhatsApp)</label>
                  {employeeContacts.length > 0 ? (
                    <div className={styles.contactsCheckboxGrid}>
                      {employeeContacts.map(c => (
                        <label key={c.id} className={styles.contactCheckboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedContactIds.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContactIds(prev => [...prev, c.id]);
                              } else {
                                setSelectedContactIds(prev => prev.filter(id => id !== c.id));
                              }
                            }}
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Belum ada kontak tersimpan. Silakan tambahkan di tab "Daftar Kontak".
                    </p>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="jobdesk-manual-phone">📲 Nomor WhatsApp Tambahan (Manual)</label>
                  <input
                    id="jobdesk-manual-phone"
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={manualJobdeskNumber}
                    onChange={(e) => setManualJobdeskNumber(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    Opsional jika ingin mengirim ke nomor luar daftar kontak karyawan.
                  </small>
                </div>

                <GlowButton type="submit" variant="primary" style={{ width: '100%', marginTop: '8px' }}>
                  🔔 Simpan Pengingat Jobdesk
                </GlowButton>
              </form>
            </div>

            <div className={styles.reminderListArea}>
              <h3>Daftar Pengingat Jobdesk Karyawan</h3>
              {jobdeskReminders.length === 0 ? (
                <div className={`${styles.emptyReminders} glass-panel`}>
                  <Clock size={48} className={styles.emptyIcon} />
                  <p>Belum ada pengingat jobdesk karyawan berulang.</p>
                </div>
              ) : (
                <div className={styles.remindersScrollContainer}>
                  {jobdeskReminders.map((reminder) => {
                    return (
                      <div key={reminder.id} className={`${styles.reminderCard} glass-panel`}>
                        <div>
                          <div className={styles.reminderCardHeader}>
                            <div>
                              <h4>{reminder.title}</h4>
                              {reminder.description && <p className={styles.reminderCardDesc}>{reminder.description}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteJobdeskReminder(reminder.id)}
                              className={styles.deleteReminderBtn}
                              title="Hapus Jobdesk"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className={styles.reminderCardTime} style={{ marginTop: '8px' }}>
                            <Clock size={14} style={{ color: 'var(--secondary)' }} />
                            <span>Interval: <strong>Setiap {reminder.intervalMinutes < 60 ? `${reminder.intervalMinutes} Menit` : `${reminder.intervalMinutes / 60} Jam`}</strong></span>
                          </div>

                          <div className={styles.reminderCardTime} style={{ marginTop: '4px' }}>
                            <Users size={14} style={{ color: 'var(--primary)' }} />
                            <span>Penerima: <strong>{reminder.employeeNames || '-'}</strong></span>
                          </div>

                          {reminder.whatsappNumber && (
                            <div className={styles.reminderWaInfo} style={{ marginTop: '4px', background: 'rgba(255, 255, 255, 0.02)' }}>
                              <span style={{ fontSize: '0.8rem' }}>📲 WhatsApp: <strong>{reminder.whatsappNumber}</strong></span>
                            </div>
                          )}

                          <div className={styles.reminderStages} style={{ marginTop: '12px' }}>
                            <span className={`${styles.stageBadge} ${styles.stageSent}`} style={{ fontSize: '0.75rem' }}>
                              Terakhir Terkirim: {new Date(reminder.lastRun).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {reminderActiveSubTab === 'contacts' && (
          <div className={styles.remindersContentGrid}>
            <div className={`${styles.reminderFormCard} glass-panel`}>
              <h3>Tambah Kontak Baru</h3>
              <form onSubmit={handleCreateContact} className={styles.reminderForm}>
                <div className={styles.formGroup}>
                  <label htmlFor="contact-name">Nama Karyawan</label>
                  <input
                    id="contact-name"
                    type="text"
                    placeholder="Contoh: Yogi"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="contact-number">Nomor WhatsApp</label>
                  <input
                    id="contact-number"
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    required
                  />
                </div>

                <GlowButton type="submit" variant="primary" style={{ width: '100%', marginTop: '8px' }}>
                  👤 Simpan Kontak
                </GlowButton>
              </form>
            </div>

            <div className={styles.reminderListArea}>
              <h3>Daftar Kontak Tersimpan</h3>
              {employeeContacts.length === 0 ? (
                <div className={styles.emptyContacts}>
                  <Users size={48} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p>Belum ada kontak tersimpan.</p>
                </div>
              ) : (
                <div className={styles.contactsGrid}>
                  {employeeContacts.map((contact) => (
                    <div key={contact.id} className={styles.contactCard}>
                      <div className={styles.contactInfo}>
                        <h4>{contact.name}</h4>
                        <p>{contact.number}</p>
                      </div>
                      <button
                        type="button"
                        className={styles.contactDeleteBtn}
                        onClick={() => handleDeleteContact(contact.id)}
                        title="Hapus Kontak"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const fetchAdminReservations = async () => {
    setAdminResLoading(true);
    try {
      const res = await fetch('/api/reservations');
      if (res.ok) {
        const data = await res.json();
        setAdminReservations(data);
      }
    } catch (err) {
      console.error('Failed to load reservations:', err);
    } finally {
      setAdminResLoading(false);
    }
  };

  const handleStartEdit = (r: any) => {
    setEditingReservation(r);
    setEditName(r.name);
    const date = new Date(r.dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    setEditDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    setEditTable(r.tableInfo);
    setEditSize(r.partySize);
    setEditDp(r.dpAmount.toLocaleString('id-ID'));
    setEditMenu(r.menuList);
    setEditStatus(r.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditIsSaving(true);
    try {
      const res = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingReservation.id,
          name: editName,
          dateTime: editDateTime,
          tableInfo: editTable,
          partySize: editSize,
          dpAmount: parseFloat(editDp.replace(/\./g, '')) || 0,
          menuList: editMenu,
          status: editStatus,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAdminReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setEditingReservation(null);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Gagal menyimpan perubahan');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan');
    } finally {
      setEditIsSaving(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthorized && activeTab === 'reservations') {
      fetchAdminReservations();
    }
  }, [isAdminAuthorized, activeTab]);

  if (isMobile) {
    return (
      <div className={styles.mobileLayout}>
        {showInstallBanner && (
          <div className={styles.installBanner}>
            <div className={styles.installBannerContent}>
              <span>💡 Pasang <strong>CatatanPintar</strong> di layar utama HP Anda untuk akses offline cepat!</span>
              <div className={styles.installBannerActions}>
                <button className={styles.installBtn} onClick={handleInstallClick}>Instal</button>
                <button className={styles.closeInstallBtn} onClick={() => setShowInstallBanner(false)}>Tutup</button>
              </div>
            </div>
          </div>
        )}
        {/* Top Header Bar */}
        <header className={styles.mobileHeader}>
          <div className={styles.mobileLogo}>SMART NOTES</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              className={styles.themeToggleBtn}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {activeTab === 'notes' && mobileView === 'list' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {filteredNotes.length > 1 && (
                <button
                  onClick={() => {
                    setWorkspaceView('merge');
                    setMobileView('editor');
                  }}
                  title="Gabungkan Catatan"
                  className={styles.mobileHeaderBtn}
                >
                  <GitMerge size={18} />
                </button>
              )}
              <button className={styles.mobileNewNoteBtn} onClick={handleCreateNewNote}>
                <Plus size={18} />
              </button>
            </div>
          )}
          </div>
        </header>

        {/* Content Area */}
        <div className={styles.mobileContent}>
          {activeTab === 'notes' && (
            mobileView === 'list' ? (
              <div className={styles.mobileNotesListContainer}>
                {/* Search Bar & Calendar Trigger */}
                <div className={styles.mobileSearchRow}>
                  <div className={styles.mobileSearchBar}>
                    <Search size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Cari catatan..."
                      className={styles.searchInput}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={`${styles.mobileCalendarTriggerBtn} ${selectedDate ? styles.mobileCalendarTriggerActive : ''}`}
                    onClick={() => setIsMobileCalendarOpen(true)}
                    title="Filter Kalender"
                  >
                    <CalendarIcon size={18} />
                    {selectedDate && <span className={styles.activeDot} />}
                  </button>
                </div>

                {/* Horizontal Folder Category Pills Wrapper */}
                <div className={styles.mobileFolderRowWrapper}>
                  <div className={styles.mobileFolderScrollContainer}>
                    <button
                      type="button"
                      className={`${styles.mobileFolderChip} ${selectedFolderId === null ? styles.mobileFolderChipActive : ''}`}
                      onClick={() => setSelectedFolderId(null)}
                    >
                      📂 Semua
                    </button>

                    {/* Render Root/Parent Folders */}
                    {folders.filter(f => !f.parentId).map((parentFolder) => {
                      const isParentActive = activeParentId === parentFolder.id;
                      return (
                        <button
                          key={parentFolder.id}
                          type="button"
                          className={`${styles.mobileFolderChip} ${isParentActive ? styles.mobileFolderChipActive : ''}`}
                          onClick={() => setSelectedFolderId(parentFolder.id)}
                        >
                          📁 {parentFolder.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.mobileFolderActions}>
                    <button
                      type="button"
                      className={`${styles.mobileFolderActionButton} ${styles.mobileFolderActionAdd}`}
                      onClick={async () => {
                        const name = prompt('Masukkan nama folder baru:');
                        if (name && name.trim()) {
                          const newF = await handleCreateFolder(name.trim());
                          if (newF) {
                            setSelectedFolderId(newF.id);
                          }
                        }
                      }}
                      title="Tambah Folder Baru"
                    >
                      <FolderPlus size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.mobileFolderActionButton} ${styles.mobileFolderActionManage}`}
                      onClick={() => setIsMobileFoldersOpen(true)}
                      title="Kelola Folder"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </div>

                {/* Subfolder Sub-tier Row */}
                {activeParentId && folders.some(f => f.parentId === activeParentId) && (
                  <div className={styles.mobileSubfolderScrollContainer}>
                    <button
                      type="button"
                      className={`${styles.mobileSubfolderChip} ${selectedFolderId === activeParentId ? styles.mobileSubfolderChipActive : ''}`}
                      onClick={() => setSelectedFolderId(activeParentId)}
                    >
                      ↳ Semua
                    </button>
                    {folders.filter(f => f.parentId === activeParentId).map((subfolder) => (
                      <button
                        key={subfolder.id}
                        type="button"
                        className={`${styles.mobileSubfolderChip} ${selectedFolderId === subfolder.id ? styles.mobileSubfolderChipActive : ''}`}
                        onClick={() => setSelectedFolderId(subfolder.id)}
                      >
                        📁 {subfolder.name}
                      </button>
                    ))}
                  </div>
                )}


                {/* Mobile Folder AI Summary Card */}
                {folderAiSummary && (
                  <div className={`${styles.folderAiSummaryCard} glass-panel`} style={{ margin: '0 0 12px 0' }}>
                    <div className={styles.folderAiSummaryHeader}>
                      <div className={styles.folderAiSummaryTitle}>
                        <Sparkles size={14} className="text-amber-400 animate-pulse" style={{ color: '#fbbf24' }} />
                        <span>Rangkuman AI: {folderAiSummary.folderName} ({folderAiSummary.timeframeText})</span>
                      </div>
                      <button type="button" onClick={() => setFolderAiSummary(null)} className={styles.closeFolderSummaryBtn}>
                        <X size={12} />
                      </button>
                    </div>
                    <p className={styles.folderAiSummaryBody} style={{ fontSize: '0.75rem' }}>{folderAiSummary.summaryText}</p>
                    <div className={styles.folderAiSummaryFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                      <span>Mengidentifikasi {folderAiSummary.notesCount} catatan</span>
                      <button
                        type="button"
                        onClick={() => {
                          setWorkspaceView('merge');
                          setMobileView('editor');
                        }}
                        style={{
                          background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
                          border: 'none',
                          color: '#fff',
                          padding: '6px 12px',
                          borderRadius: 'var(--border-radius-sm)',
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <GitMerge size={12} />
                        Gabung
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile Calendar Bottom Sheet Modal */}
                {isMobileCalendarOpen && (
                  <div className={styles.mobileBottomSheetOverlay} onClick={() => setIsMobileCalendarOpen(false)}>
                    <div className={styles.mobileBottomSheet} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.mobileBottomSheetHeader}>
                        <h3>Pilih Tanggal</h3>
                        <button
                          className={styles.mobileBottomSheetClose}
                          onClick={() => setIsMobileCalendarOpen(false)}
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className={styles.mobileBottomSheetBody}>
                        <Calendar
                          notes={notes}
                          selectedDate={selectedDate}
                          onSelectDate={(dateStr) => {
                            setSelectedDate(dateStr);
                            setIsMobileCalendarOpen(false); // auto-close on select
                          }}
                        />
                        {selectedDate && (
                          <GlowButton
                            variant="outline"
                            onClick={() => {
                              setSelectedDate(null);
                              setIsMobileCalendarOpen(false);
                            }}
                            style={{ marginTop: '12px', width: '100%' }}
                          >
                            Hapus Filter Tanggal
                          </GlowButton>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile Folders Management Bottom Sheet Modal */}
                {isMobileFoldersOpen && (
                  <div className={styles.mobileBottomSheetOverlay} onClick={() => setIsMobileFoldersOpen(false)}>
                    <div className={styles.mobileBottomSheet} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.mobileBottomSheetHeader}>
                        <h3>Kelola Folder</h3>
                        <button
                          className={styles.mobileBottomSheetClose}
                          onClick={() => setIsMobileFoldersOpen(false)}
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className={styles.mobileBottomSheetBody}>
                        <div className={styles.mobileFolderManagerWrapper}>
                          {folders.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '16px' }}>
                              Belum ada folder. Buat folder baru di bawah.
                            </p>
                          ) : (
                            <div className={styles.mobileFoldersEditList}>
                              {getSortedFolderTree(folders).map((folder) => (
                                <div key={folder.id} className={`${styles.mobileFolderEditRow} ${folder.depth > 0 ? styles.subfolderEditRow : ''}`}>
                                  {editingFolderId === folder.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                      <input
                                        type="text"
                                        className={styles.folderRenameInput}
                                        value={editingFolderName}
                                        onChange={(e) => setEditingFolderName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleRenameFolder(folder.id, editingFolderName, editingFolderParentId || null);
                                          if (e.key === 'Escape') setEditingFolderId(null);
                                        }}
                                        autoFocus
                                      />
                                      <select
                                        className={styles.folderParentEditSelect}
                                        value={editingFolderParentId}
                                        onChange={(e) => setEditingFolderParentId(e.target.value)}
                                        style={{ fontSize: '0.75rem', padding: '6px 8px', width: '100%' }}
                                      >
                                        <option value="">— Induk (Root) —</option>
                                        {folders.filter(f => !f.parentId && f.id !== folder.id).map(f => (
                                          <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                      </select>
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                        <button
                                          style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                          onClick={() => handleRenameFolder(folder.id, editingFolderName, editingFolderParentId || null)}
                                        >
                                          Simpan
                                        </button>
                                        <button
                                          style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                          onClick={() => setEditingFolderId(null)}
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className={styles.folderNameText}>
                                      {folder.depth > 0 ? `↳ ${folder.name}` : folder.name}
                                    </span>
                                  )}

                                  {editingFolderId !== folder.id && (
                                    <div className={styles.folderActions}>
                                      <button
                                        title="Ubah"
                                        onClick={() => {
                                          setEditingFolderId(folder.id);
                                          setEditingFolderName(folder.name);
                                          setEditingFolderParentId(folder.parentId || '');
                                        }}
                                      >
                                        <Edit3 size={14} />
                                      </button>
                                      <button
                                        title="Hapus"
                                        onClick={() => handleDeleteFolder(folder.id)}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className={styles.mobileAddFolderForm} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="Nama folder baru..."
                                className={styles.addFolderInput}
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const select = document.getElementById('mobile-add-folder-parent-select') as HTMLSelectElement;
                                    handleCreateFolder(newFolderName, select?.value || null);
                                    setNewFolderName('');
                                    if (select) select.value = '';
                                  }
                                }}
                              />
                              <button
                                className={styles.addFolderBtn}
                                onClick={() => {
                                  const select = document.getElementById('mobile-add-folder-parent-select') as HTMLSelectElement;
                                  handleCreateFolder(newFolderName, select?.value || null);
                                  setNewFolderName('');
                                  if (select) select.value = '';
                                }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <select
                              id="mobile-add-folder-parent-select"
                              className={styles.addFolderParentSelect}
                              style={{ width: '100%', fontSize: '0.75rem', padding: '6px 8px' }}
                              defaultValue=""
                            >
                              <option value="">— Folder Induk (Root) —</option>
                              {folders.filter(f => !f.parentId).map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scrollable list of notes */}
                <div className={styles.mobileNotesList}>
                  {isLoadingNotes ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.8rem', padding: '20px' }}>
                      Memuat catatan...
                    </div>
                  ) : filteredNotes.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.8rem', padding: '20px' }}>
                      Tidak ada catatan ditemukan.
                    </div>
                  ) : (
                    (() => {
                      const grouped = getGroupedNotes(filteredNotes);
                      return Object.entries(grouped).map(([groupName, groupNotes]) => {
                        if (groupNotes.length === 0) return null;
                        return (
                          <div key={groupName} className={styles.mobileNoteGroup}>
                            <h4 className={styles.mobileGroupHeader}>{groupName}</h4>
                            <div className={styles.mobileGroupList}>
                              {groupNotes.map((note) => {
                                // Count todos progress
                                let totalTodos = 0;
                                let completedTodos = 0;
                                if (note.todo_list && Array.isArray(note.todo_list)) {
                                  totalTodos = note.todo_list.length;
                                  completedTodos = note.todo_list.filter((t: any) => typeof t === 'object' ? t.completed : false).length;
                                }

                                // Check note type
                                const isVoiceNote = !!note.summary && (note.tags?.some(tag => tag.toLowerCase().includes('voice') || tag.toLowerCase().includes('suara')) || note.content.toLowerCase().includes('transkrip'));
                                const isNewsNote = note.tags?.some(tag => tag.toLowerCase().includes('berita') || tag.toLowerCase().includes('news'));

                                return (
                                  <button
                                    key={note.id}
                                    className={`${styles.mobileNoteCard} ${selectedNote?.id === note.id ? styles.activeMobileNoteCard : ''}`}
                                    onClick={() => {
                                      setSelectedNote(note);
                                      setMobileView('editor');
                                    }}
                                  >
                                    <div className={styles.mobileNoteCardHeader}>
                                      <div className={styles.mobileNoteTitle}>
                                        {note.title || 'Catatan Tanpa Judul'}
                                      </div>
                                      <span className={styles.mobileNoteDate}>
                                        {formatDateShort(note.created_at)}
                                      </span>
                                    </div>

                                    {note.summary && (
                                      <div className={styles.mobileNoteSummary}>
                                        {note.summary}
                                      </div>
                                    )}

                                    <div className={styles.mobileNoteFooter}>
                                      <div className={styles.mobileNoteMeta}>
                                        {/* Display source icon */}
                                        {isNewsNote ? (
                                          <span className={styles.sourceIndicator} title="Sumber Berita">
                                            <Newspaper size={12} style={{ color: 'var(--accent)' }} />
                                          </span>
                                        ) : isVoiceNote ? (
                                          <span className={styles.sourceIndicator} title="Sumber Suara">
                                            <Mic size={12} style={{ color: 'var(--secondary)' }} />
                                          </span>
                                        ) : (
                                          <span className={styles.sourceIndicator} title="Manual">
                                            <FileText size={12} style={{ color: 'var(--text-dark)' }} />
                                          </span>
                                        )}

                                        {/* Display folder name if folder exists */}
                                        {note.folder_id && folders.find(f => f.id === note.folder_id) && (
                                          <span className={styles.folderBadgeSmall}>
                                            📂 {folders.find(f => f.id === note.folder_id)?.name}
                                          </span>
                                        )}

                                        {/* Render tags */}
                                        {note.tags?.slice(0, 2).map((tag, idx) => {
                                          const t = tag.toLowerCase();
                                          let tagClass = 'default';
                                          if (t.includes('rapat') || t.includes('meet')) tagClass = 'rapat';
                                          else if (t.includes('ide') || t.includes('kreatif') || t.includes('concept')) tagClass = 'ide';
                                          else if (t.includes('tugas') || t.includes('todo') || t.includes('kerja')) tagClass = 'tugas';
                                          else if (t.includes('uang') || t.includes('keuangan') || t.includes('finansial')) tagClass = 'keuangan';
                                          else if (t.includes('pribadi') || t.includes('personal')) tagClass = 'pribadi';

                                          return (
                                            <span key={idx} className={`tag-badge ${tagClass}`} style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
                                              {tag}
                                            </span>
                                          );
                                        })}
                                      </div>

                                      {/* Todo progress count */}
                                      {totalTodos > 0 && (
                                        <div className={styles.todoProgressIndicator} title="Progress Tugas">
                                          <CheckSquare size={11} />
                                          <span>
                                            {completedTodos}/{totalTodos}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.mobileEditorContainer}>
                {workspaceView === 'merge' ? (
                  <InteractiveMerge
                    filteredNotes={filteredNotes}
                    folders={folders}
                    currentFolderId={selectedFolderId}
                    currentTimeframe={timeframeFilter}
                    onCancel={() => {
                      setWorkspaceView('editor');
                      setMobileView('list');
                    }}
                    onSelectNote={(note) => {
                      setSelectedNote(note);
                      setWorkspaceView('editor');
                      setMobileView('editor');
                    }}
                  />
                ) : (
                  <NoteEditor
                    note={selectedNote}
                    onSave={handleSaveNote}
                    onDelete={handleDeleteNote}
                    onBack={() => setMobileView('list')}
                    folders={folders}
                    onCreateFolder={handleCreateFolder}
                    onCopy={handleCopyNote}
                    onMove={handleMoveNote}
                  />
                )}
              </div>
            )
          )}

          {activeTab === 'recorder' && (
            <div className={styles.mobileRecorderContainer}>
              <VoiceRecorder
                folders={folders}
                initialCheckedFolderIds={assistantSelectedFolderIds}
                onFormatted={handleFormattedNote}
                autoStart={autoStartRecorder}
                onAutoStartTriggered={() => setAutoStartRecorder(false)}
              />
            </div>
          )}

          {activeTab === 'news' && (
            <div className={styles.mobileNewsContainer}>
              <NewsSection onCreateNoteFromNews={handleCreateNoteFromNews} />
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className={styles.mobileNewsContainer}>
              {renderRemindersTab()}
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className={styles.mobileNewsContainer}>
              <WhatsappChat
                pendingWhatsApp={pendingWhatsApp}
                clearPendingWhatsApp={() => setPendingWhatsApp(null)}
              />
            </div>
          )}
          {activeTab === 'chat' && (
            <div className={styles.mobileNewsContainer}>
              {renderAdminChatRoom()}
            </div>
          )}

          {activeTab === 'reservations' && (
            <div className={styles.mobileNewsContainer}>
              {renderAdminReservations()}
            </div>
          )}
        </div>

        {/* Bottom Tab Bar Navigation */}
        <nav className={styles.bottomNav}>
          <button
            className={`${styles.bottomNavItem} ${activeTab === 'notes' ? styles.activeBottomNavItem : ''}`}
            onClick={() => {
              setActiveTab('notes');
              setMobileView('list');
            }}
          >
            <FileText size={20} />
            <span>Catatan</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${activeTab === 'recorder' ? styles.activeBottomNavItem : ''}`}
            onClick={() => setActiveTab('recorder')}
          >
            <Mic size={20} />
            <span>Rekam</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${activeTab === 'news' ? styles.activeBottomNavItem : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <Newspaper size={20} />
            <span>Berita</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${activeTab === 'reminders' ? styles.activeBottomNavItem : ''}`}
            onClick={() => setActiveTab('reminders')}
          >
            <Bell size={20} />
            <span>Pengingat</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${activeTab === 'whatsapp' ? styles.activeBottomNavItem : ''}`}
            onClick={() => setActiveTab('whatsapp')}
          >
            <MessageSquare size={20} />
            <span>Pesan</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${activeTab === 'chat' ? styles.activeBottomNavItem : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <Users size={20} />
            <span>Obrolan</span>
          </button>
          <button
            className={`${styles.bottomNavItem} ${activeTab === 'reservations' ? styles.activeBottomNavItem : ''}`}
            onClick={() => setActiveTab('reservations')}
          >
            <CalendarIcon size={20} />
            <span>Reservasi</span>
          </button>

        </nav>

        {/* Folder Selection Modal (Mobile) */}
        {isFolderModalOpen && pendingNoteData && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} glass-panel`}>
              <h3>Simpan Catatan ke Folder</h3>
              <p>Silakan pilih folder penyimpanan untuk catatan cerdas baru Anda:</p>

              <div className={styles.modalForm}>
                <select
                  className={styles.folderSelectDropdown}
                  id="folder-select-mobile"
                  defaultValue={selectedFolderId || ""}
                >
                  <option value="">Tanpa Folder (Umum)</option>
                  {getSortedFolderTree(folders).map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.depth > 0 ? `↳ ${folder.name}` : folder.name}
                    </option>
                  ))}
                </select>

                <div className={styles.modalInlineAddFolder}>
                  <input
                    type="text"
                    placeholder="Atau buat folder baru..."
                    id="new-folder-inline-input-mobile"
                    className={styles.modalFolderInput}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget;
                        const name = input.value.trim();
                        if (name) {
                          const newF = await handleCreateFolder(name);
                          if (newF) {
                            const select = document.getElementById('folder-select-mobile') as HTMLSelectElement;
                            if (select) {
                              setTimeout(() => {
                                select.value = newF.id;
                              }, 50);
                            }
                            input.value = '';
                          }
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.modalFolderBtn}
                    onClick={async () => {
                      const input = document.getElementById('new-folder-inline-input-mobile') as HTMLInputElement;
                      const name = input?.value.trim();
                      if (name) {
                        const newF = await handleCreateFolder(name);
                        if (newF) {
                          const select = document.getElementById('folder-select-mobile') as HTMLSelectElement;
                          if (select) {
                            setTimeout(() => {
                              select.value = newF.id;
                            }, 50);
                          }
                          input.value = '';
                        }
                      }
                    }}
                  >
                    Buat
                  </button>
                </div>
              </div>

              <div className={styles.modalActions}>
                <GlowButton
                  variant="outline"
                  onClick={() => {
                    setIsFolderModalOpen(false);
                    setPendingNoteData(null);
                  }}
                >
                  Batal
                </GlowButton>
                <GlowButton
                  variant="primary"
                  onClick={() => {
                    const select = document.getElementById('folder-select-mobile') as HTMLSelectElement;
                    saveNoteWithFolder(select?.value || null);
                  }}
                >
                  Simpan Catatan
                </GlowButton>
              </div>
            </div>
          </div>
        )}
        <VoiceAssistant selectedNote={selectedNote} />

        {confirmDialog.isOpen && (
          <div className={styles.confirmOverlay} onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
            <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.confirmTitle}>{confirmDialog.title}</h3>
              <p className={styles.confirmMessage}>{confirmDialog.message}</p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.confirmCancelBtn}
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className={styles.confirmConfirmBtn}
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }}
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        {saveResultNotification && (
          <div className={styles.notificationToast}>
            <div className={styles.notificationHeader}>
              <div className={styles.notificationTitle}>
                <Sparkles size={16} style={{ color: 'var(--secondary)', marginRight: '8px' }} />
                Catatan Pintar Berhasil Dibuat
              </div>
              <button
                className={styles.notificationCloseBtn}
                onClick={() => setSaveResultNotification(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.notificationBody}>
              <p className={styles.notificationSubtitle}>
                Catatan hasil rekaman Anda telah dianalisis dan dikelompokkan ke folder yang sesuai:
              </p>
              <div className={styles.notificationList}>
                {saveResultNotification.notes.map((n, idx) => (
                  <div key={idx} className={styles.notificationItem}>
                    <span className={styles.notificationNoteTitle} title={n.title}>📝 {n.title}</span>
                    <span className={styles.notificationFolderBadge}>📁 {n.folderName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {showReservationsModalAdmin && (
          <div
            onClick={() => setShowReservationsModalAdmin(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '650px',
                width: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(10, 10, 22, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                backdropFilter: 'blur(10px)',
                color: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarIcon size={20} style={{ color: '#6366f1' }} />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#fff' }}>Daftar Reservasi Pelanggan</h3>
                </div>
                <button
                  onClick={() => setShowReservationsModalAdmin(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Filter Pills */}
              <div className={styles.reservationFilterPillsRow}>
                {[
                  { id: 'upcoming', label: 'Mendatang' },
                  { id: 'all', label: 'Semua' },
                  { id: 'pending', label: 'Menunggu' },
                  { id: 'confirmed', label: 'Dikonfirmasi' },
                  { id: 'completed', label: 'Selesai' },
                  { id: 'cancelled', label: 'Dibatalkan' }
                ].map((pill) => {
                  const isActive = resListFilterAdmin === pill.id;
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setResListFilterAdmin(pill.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        border: '1px solid',
                        borderColor: isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
                        background: isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.03)',
                        color: isActive ? '#fff' : '#94a3b8',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                        flexShrink: 0
                      }}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>

              {/* Content list */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: '200px', paddingRight: '4px' }}>
                {adminResLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Memuat data reservasi...</span>
                  </div>
                ) : (() => {
                  const filtered = adminReservations.filter(r => {
                    if (resListFilterAdmin === 'upcoming') {
                      return r.status === 'pending' || r.status === 'confirmed';
                    }
                    if (resListFilterAdmin !== 'all' && r.status !== resListFilterAdmin) {
                      return false;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: '#64748b' }}>
                        <CalendarIcon size={32} style={{ opacity: 0.4 }} />
                        <span style={{ fontSize: '0.85rem' }}>Tidak ada data reservasi ditemukan.</span>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {filtered.map((res: any) => {
                        const date = getValidDate(res.dateTime) || new Date();
                        const formattedDate = formatDateTime(res.dateTime);

                        const statusColors: Record<string, string> = {
                          pending: 'rgba(245, 158, 11, 0.15)',
                          confirmed: 'rgba(16, 185, 129, 0.15)',
                          completed: 'rgba(99, 102, 241, 0.15)',
                          cancelled: 'rgba(239, 68, 68, 0.15)'
                        };
                        const statusBorderColors: Record<string, string> = {
                          pending: 'rgba(245, 158, 11, 0.3)',
                          confirmed: 'rgba(16, 185, 129, 0.3)',
                          completed: 'rgba(99, 102, 241, 0.3)',
                          cancelled: 'rgba(239, 68, 68, 0.3)'
                        };
                        const statusTextColors: Record<string, string> = {
                          pending: '#f59e0b',
                          confirmed: '#10b981',
                          completed: '#6366f1',
                          cancelled: '#ef4444'
                        };
                        const statusLabels: Record<string, string> = {
                          pending: 'Menunggu',
                          confirmed: 'Dikonfirmasi',
                          completed: 'Selesai',
                          cancelled: 'Dibatalkan'
                        };

                        return (
                          <div
                            key={res.id}
                            style={{
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '10px',
                              padding: '14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>{res.name}</h4>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formattedDate}</span>
                              </div>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  background: statusColors[res.status] || 'rgba(255, 255, 255, 0.1)',
                                  border: `1px solid ${statusBorderColors[res.status] || 'rgba(255, 255, 255, 0.2)'}`,
                                  color: statusTextColors[res.status] || '#94a3b8',
                                  fontWeight: 600
                                }}
                              >
                                {statusLabels[res.status] || res.status}
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.8rem', padding: '8px 0', borderTop: '1px solid rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Meja/Tempat:</span>
                                <span style={{ fontWeight: 600, color: '#fff' }}>{res.tableInfo}</span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Jumlah Orang:</span>
                                <span style={{ fontWeight: 600, color: '#fff' }}>{res.partySize} orang</span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>DP Pembayaran:</span>
                                <span style={{ fontWeight: 600, color: '#10b981' }}>Rp {res.dpAmount.toLocaleString('id-ID')}</span>
                              </div>
                            </div>

                            {res.menuList && (
                              <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                                <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>Menu Pesanan:</span>
                                {renderFormattedMenuList(res.menuList)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => fetchAdminReservations()}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  Segarkan 🔄
                </button>
                <button
                  onClick={() => setShowReservationsModalAdmin(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    border: 'none',
                    background: '#6366f1',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderAdminChatRoom() {
    const filteredChatMessages = (() => {
      if (chatFilterAttribute === 'Semua') return chatMessages;
      const filterAttrObj = chatAttributes.find(a => a.name === chatFilterAttribute);
      if (filterAttrObj?.isGroup) {
        const groupAttrs = Array.isArray(filterAttrObj.groupAttributes)
          ? (filterAttrObj.groupAttributes as string[])
          : [];
        return chatMessages.filter((msg: any) => msg.attribute === chatFilterAttribute || (msg.attribute && groupAttrs.includes(msg.attribute)));
      }
      return chatMessages.filter((msg: any) => msg.attribute === chatFilterAttribute);
    })();

    return (
      <div className={styles.adminChatContainer}>
        <div className={styles.adminChatLayout}>
          {/* Left panel: Chat Room */}
          <div className={styles.adminChatRoomPanel}>
            <div className={styles.adminChatHeader}>
              <div className={styles.adminChatHeaderTitle}>
                <Users className={styles.adminChatHeaderIcon} />
                <div>
                  <h3>Grup Koordinasi Burjolevelup</h3>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Pesan: {chatMessages.length} {chatLoading ? ' (Memuat...)' : ''}
                  </p>
                </div>
              </div>
              <div className={styles.adminHeaderControls}>
                <button
                  onClick={() => {
                    fetchAdminReservations();
                    setShowReservationsModalAdmin(true);
                  }}
                  className={`${styles.adminHeaderBtn} ${styles.adminHeaderBtnReservasi}`}
                  title="Daftar Reservasi"
                >
                  <CalendarIcon size={14} />
                  <span className={styles.adminChatResBtnText}>Reservasi</span>
                </button>
                <button
                  onClick={() => setShowMobileAttributesModal(true)}
                  className={`${styles.adminHeaderBtn} ${styles.adminHeaderBtnAtribut}`}
                  title="Kelola Atribut"
                >
                  <Tag size={14} />
                  <span className={styles.adminChatAttrBtnText}>Kelola Atribut</span>
                </button>
                <button
                  onClick={() => {
                    fetchAttributeHistory();
                    setShowAttributeCalendarModal(true);
                  }}
                  className={`${styles.adminHeaderBtn} ${styles.adminHeaderBtnKalender}`}
                  title="Kalender Atribut"
                >
                  <CalendarIcon size={14} />
                  <span className={styles.adminChatAttrCalBtnText}>Kalender Atribut</span>
                </button>
                <button onClick={handleAdminLogout} className={styles.adminLogoutBtn}>
                  <LogOut size={16} />
                  <span>Keluar Admin</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterContainer}>
              <span className={styles.filterLabel}>
                <Filter size={12} style={{ marginRight: '4px' }} /> Filter:
              </span>

              {!showFilterSearch ? (
                <button
                  type="button"
                  onClick={() => setShowFilterSearch(true)}
                  className={styles.filterSearchToggleBtn}
                  title="Cari filter"
                >
                  <Search size={12} />
                </button>
              ) : (
                <div className={styles.attrSearchWrapper}>
                  <Search size={11} className={styles.attrSearchIcon} />
                  <input
                    type="text"
                    placeholder="Cari filter..."
                    className={styles.attrSearchInput}
                    value={filterAttrSearchQuery}
                    onChange={(e) => setFilterAttrSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.attrSearchClearBtn}
                    onClick={() => {
                      setFilterAttrSearchQuery('');
                      setShowFilterSearch(false);
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              )}

              {['Semua', ...chatAttributes.map(a => a.name)]
                .filter(name => name === 'Semua' || name.toLowerCase().includes(filterAttrSearchQuery.toLowerCase()))
                .map((attrName) => {
                  const isActive = chatFilterAttribute === attrName;
                  const color = attrName === 'Semua' ? '#6366f1' : getChatAttributeColor(attrName);
                  return (
                    <button
                      key={attrName}
                      type="button"
                      className={`${styles.filterChip} ${isActive ? styles.filterChipActive : ''}`}
                      onClick={() => setChatFilterAttribute(attrName)}
                      style={{
                        borderColor: isActive ? color : 'var(--glass-border)',
                        color: isActive ? '#fff' : 'var(--text-muted)',
                        background: isActive ? color : 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      {attrName}
                    </button>
                  );
                })}
            </div>

            <div className={styles.adminChatArea} ref={adminChatAreaRef} onScroll={handleAdminChatScroll}>
              {chatLoading && chatMessages.length === 0 ? (
                <div className={styles.chatLoader}>
                  <div className="spinner" />
                  <p>Memuat percakapan...</p>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className={styles.chatEmpty}>
                  <MessageSquare size={40} />
                  <p>Belum ada pesan di chat room ini.</p>
                  {chatError && (
                    <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '8px', padding: '0 20px', textAlign: 'center' }}>
                      Error: {chatError}
                    </p>
                  )}
                  <button
                    onClick={() => loadChatMessages(false)}
                    style={{
                      marginTop: '12px',
                      padding: '6px 16px',
                      background: 'var(--primary)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Refresh Obrolan
                  </button>
                </div>
              ) : filteredChatMessages.length === 0 ? (
                <div className={styles.chatEmpty}>
                  <Tag size={40} style={{ color: getChatAttributeColor(chatFilterAttribute) }} />
                  <p>Tidak ada chat dengan atribut "{chatFilterAttribute}"</p>
                </div>
              ) : (
                <div className={styles.chatMessagesList}>
                  {chatMessages.length >= 150 && adminHasMoreOlder && (
                    <button
                      type="button"
                      disabled={adminLoadingOlder}
                      onClick={loadOlderMessages}
                      style={{
                        display: 'block',
                        margin: '10px auto 20px auto',
                        padding: '8px 16px',
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: adminLoadingOlder ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        outline: 'none',
                        textAlign: 'center',
                        opacity: adminLoadingOlder ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!adminLoadingOlder) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        if (!adminLoadingOlder) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      {adminLoadingOlder ? 'Memuat...' : 'Muat Chat Lebih Lama...'}
                    </button>
                  )}
                  {filteredChatMessages.map((msg, index) => {
                    const isMe = msg.senderRole === 'admin';
                    const date = getValidDate(msg.createdAt) || new Date();
                    const timeStr = formatTime(msg.createdAt);

                    let showDivider = false;
                    let dividerText = '';

                    const currentDateKey = date.toDateString();
                    const prevMsg = index > 0 ? filteredChatMessages[index - 1] : null;
                    const prevDate = prevMsg ? getValidDate(prevMsg.createdAt) : null;
                    const prevDateKey = prevDate ? prevDate.toDateString() : null;

                    if (currentDateKey !== prevDateKey) {
                      showDivider = true;

                      const today = new Date();
                      today.setHours(0, 0, 0, 0);

                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);

                      const compareDate = new Date(date);
                      compareDate.setHours(0, 0, 0, 0);

                      if (compareDate.getTime() === today.getTime()) {
                        dividerText = 'Hari Ini';
                      } else if (compareDate.getTime() === yesterday.getTime()) {
                        dividerText = 'Kemarin';
                      } else {
                        dividerText = formatDateLong(date);
                      }
                    }

                    return (
                      <React.Fragment key={msg.id}>
                        {showDivider && (
                          <div className={styles.chatDateDivider}>
                            <span className={styles.chatDateDividerText}>{dividerText}</span>
                          </div>
                        )}
                        <div className={`${styles.chatRow} ${isMe ? styles.chatMyRow : styles.chatOtherRow}`}>
                          <div
                            className={`${styles.chatBubble} ${isMe ? styles.chatMyBubble : styles.chatOtherBubble} ${adminCopiedMessageId === msg.id ? styles.bubbleCopied : ''}`}
                            onTouchStart={(e) => handleAdminTouchStart(e, msg)}
                            onTouchEnd={handleAdminTouchEnd}
                            onTouchMove={handleAdminTouchEnd}
                            onTouchCancel={handleAdminTouchEnd}
                          >
                            <div className={styles.chatBubbleHeader}>
                              <div className={styles.chatBubbleUserBox}>
                                <span className={styles.chatSenderName}>{msg.senderName}</span>
                                <span className={`${styles.chatRoleIndicator} ${isMe ? styles.chatRoleAdmin : styles.chatRoleEmployee}`}>
                                  {msg.senderRole === 'admin' ? 'Admin' : 'Karyawan'}
                                </span>
                              </div>
                              <div className={styles.messageActions}>
                                {isMe && (
                                  <button
                                    onClick={() => handleEditAdminChatClick(msg)}
                                    className={styles.actionBtn}
                                    title="Edit Pesan"
                                    type="button"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteAdminChatMessage(msg.id)}
                                  className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                                  title="Hapus Pesan"
                                  type="button"
                                >
                                  <Trash2 size={11} />
                                </button>
                                {msg.message && (
                                  <button
                                    onClick={() => handleAdminCopyMessage(msg.id, msg.message)}
                                    className={styles.actionBtn}
                                    title="Salin Pesan"
                                    type="button"
                                  >
                                    {adminCopiedMessageId === msg.id ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                  </button>
                                )}
                              </div>
                            </div>

                            {msg.attribute && (
                              <span className={styles.chatBubbleAttribute} style={{
                                borderColor: msg.attribute.toLowerCase() === 'sales' ? '#10b981' :
                                  msg.attribute.toLowerCase() === 'progres' ? '#06b6d4' :
                                    msg.attribute.toLowerCase() === 'urgent' ? '#ef4444' :
                                      msg.attribute.toLowerCase() === 'umum' ? '#6366f1' : '#d946ef',
                                color: msg.attribute.toLowerCase() === 'sales' ? '#10b981' :
                                  msg.attribute.toLowerCase() === 'progres' ? '#06b6d4' :
                                    msg.attribute.toLowerCase() === 'urgent' ? '#ef4444' :
                                      msg.attribute.toLowerCase() === 'umum' ? '#6366f1' : '#d946ef'
                              }}>
                                <Tag size={10} style={{ marginRight: '4px' }} />
                                {msg.attribute}
                              </span>
                            )}

                            {msg.imageUrl && (
                              <div
                                className={styles.adminMessageImageWrapper}
                                onClick={() => setAdminActiveLightboxImage(msg.imageUrl || null)}
                              >
                                <img src={msg.imageUrl} alt="Lampiran foto" className={styles.adminMessageImage} />
                              </div>
                            )}

                            {msg.message && (
                              <p className={styles.chatMessageText}>{formatBoldText(msg.message)}</p>
                            )}

                            {/* Location Link if present */}
                            {msg.latitude && msg.longitude && (
                              <div style={{ marginTop: '6px', marginBottom: '4px' }}>
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${msg.latitude},${msg.longitude}`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#60a5fa',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 500,
                                    textDecoration: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  📍 Lihat Lokasi (GMaps)
                                </a>
                              </div>
                            )}
                            <span className={styles.chatTimeText}>{timeStr}</span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  <div ref={chatMessagesEndRef} />
                </div>
              )}
            </div>

            {adminShowScrollBottomBtn && (
              <button
                type="button"
                onClick={() => scrollToAdminChatBottom('smooth')}
                className={styles.scrollToBottomBtn}
                title="Ke Pesan Terbaru"
              >
                <ArrowDown size={18} />
                {adminHasNewMessages && <span className={styles.unreadDot} />}
              </button>
            )}

            <div className={styles.adminChatFooter}>
              {editingChatMessage && (
                <div className={styles.editBanner}>
                  <span className={styles.editText}>
                    <Pencil size={12} style={{ marginRight: '6px' }} /> Sedang mengedit pesan...
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelAdminChatEdit}
                    className={styles.editCancelBtn}
                  >
                    Batal
                  </button>
                </div>
              )}

              <div className={styles.attributeSelectRow}>
                {!showSelectSearch ? (
                  <button
                    type="button"
                    onClick={() => setShowSelectSearch(true)}
                    className={styles.attributeSearchToggleBtn}
                    title="Cari kategori"
                  >
                    <Search size={12} />
                  </button>
                ) : (
                  <div className={`${styles.attrSearchWrapper} ${styles.attrSearchWrapperSelect}`}>
                    <Search size={11} className={styles.attrSearchIcon} />
                    <input
                      type="text"
                      placeholder="Cari..."
                      className={styles.attrSearchInput}
                      value={selectAttrSearchQuery}
                      onChange={(e) => setSelectAttrSearchQuery(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles.attrSearchClearBtn}
                      onClick={() => {
                        setSelectAttrSearchQuery('');
                        setShowSelectSearch(false);
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}

                <div className={styles.attributeChipsContainer}>
                  {chatAttributes
                    .filter(attr => !attr.isGroup)
                    .filter(attr => !showSelectSearch || attr.name.toLowerCase().includes(selectAttrSearchQuery.toLowerCase()))
                    .map((attr) => {
                      const isActive = selectedChatAttribute === attr.name;
                      const color = getChatAttributeColor(attr.name);
                      return (
                        <button
                          key={attr.id}
                          type="button"
                          className={`${styles.attributeChip} ${isActive ? styles.attributeChipActive : ''}`}
                          onClick={() => {
                            setSelectedChatAttribute(attr.name);
                            if (attr.quickText && attr.quickText.trim()) {
                              setNewChatMessage(prev => {
                                if (!prev.trim()) return attr.quickText;
                                return prev + '\n\n' + attr.quickText;
                              });
                              if (adminChatInputRef.current) {
                                adminChatInputRef.current.focus();
                              }
                            }
                          }}
                          style={{
                            borderColor: isActive ? color : 'var(--glass-border)',
                            color: isActive ? '#fff' : 'var(--text-muted)',
                            background: isActive ? color : 'rgba(255, 255, 255, 0.03)',
                          }}
                        >
                          <Tag size={10} style={{ marginRight: '4px' }} />
                          {attr.name}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Quick Options for Admin (Pesan Cepat / Pilihan Ganda) */}
              {(() => {
                const currentAttr = chatAttributes.find(a => a.name === selectedChatAttribute);
                const allOptions = Array.isArray(currentAttr?.options) ? (currentAttr.options as any[]) : [];
                if (allOptions.length === 0) return null;

                const simpleOptions = allOptions.filter(o => !o.hasTimeframe);
                const taskOptions = allOptions.filter(o => o.hasTimeframe);

                return (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '10px 14px',
                      background: 'var(--bg-secondary)',
                      borderTop: '1px solid var(--glass-border)',
                      borderBottom: '1px solid var(--glass-border)',
                      marginBottom: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    {/* Simple Quick Replies */}
                    {simpleOptions.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '2px' }}>
                        {simpleOptions.map((opt) => {
                          const isSelected = newChatMessage
                            ? newChatMessage.split('\n').map(item => item.trim().toLowerCase()).includes(opt.text.toLowerCase())
                            : false;

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleAdminSimpleOption(opt.text)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '16px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                border: isSelected
                                  ? '1.5px solid var(--primary)'
                                  : '1.5px solid var(--glass-border)',
                                background: isSelected
                                  ? 'var(--primary)'
                                  : 'var(--glass-bg)',
                                color: isSelected ? '#ffffff' : 'var(--foreground)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                                boxShadow: isSelected
                                  ? '0 4px 12px rgba(67, 56, 202, 0.25)'
                                  : '0 1px 3px rgba(0, 0, 0, 0.04)'
                              }}
                            >
                              {opt.text}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Task / Timeframe Options */}
                    {taskOptions.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '4px' }}>
                        {taskOptions.map((task) => {
                          const isTaken = task.status === 'taken';
                          let expiryStr = '';
                          if (task.expiryDate) {
                            expiryStr = formatTime(task.expiryDate) + ' ' + formatDateShort(task.expiryDate);
                          }

                          return (
                            <div
                              key={task.id}
                              style={{
                                background: isTaken ? 'rgba(16, 185, 129, 0.1)' : 'var(--glass-bg)',
                                border: isTaken ? '1.5px solid #10b981' : '1.5px solid var(--glass-border)',
                                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--foreground)' }}>{task.text}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {isTaken ? `Diambil: ${task.assignedTo} (${expiryStr})` : `Durasi: ${task.duration}`}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  background: isTaken ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                  color: isTaken ? '#34d399' : 'var(--text-muted)'
                                }}
                              >
                                {isTaken ? 'Berjalan' : 'Ready'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Admin Image Upload Preview */}
              {adminImagePreview && (
                <div className={styles.adminImagePreviewContainer}>
                  <img src={adminImagePreview} alt="Upload preview" className={styles.adminImagePreview} />
                  <button
                    type="button"
                    onClick={handleAdminRemovePreview}
                    className={styles.adminRemovePreviewBtn}
                    title="Hapus gambar"
                  >
                    <X size={14} />
                  </button>
                  {adminIsUploading && (
                    <div className={styles.adminUploadOverlay}>
                      <div className="spinner" style={{ width: '20px', height: '20px' }} />
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSendAdminChatMessage} className={styles.adminChatInputForm}>
                {/* Attachment Button */}
                <label
                  className={`${styles.adminAttachBtn} ${chatSubmitting ? styles.disabledAttachBtn : ''}`}
                  style={{ cursor: chatSubmitting ? 'not-allowed' : 'pointer' }}
                  title="Lampirkan foto"
                >
                  <Image size={20} />
                  <input
                    type="file"
                    ref={adminFileInputRef}
                    onChange={handleAdminFileChange}
                    style={{ display: 'none' }}
                    accept="image/*"
                    disabled={chatSubmitting}
                  />
                </label>

                <textarea
                  ref={adminChatInputRef}
                  placeholder="Tulis balasan..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className={styles.adminChatTextInput}
                  disabled={chatSubmitting}
                  required={!adminSelectedFile}
                  rows={2}
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />

                <button
                  type="submit"
                  className={styles.adminChatSendBtn}
                  disabled={(!newChatMessage.trim() && !adminSelectedFile) || chatSubmitting}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* Right panel: Attribute classification management */}
          <div className={styles.adminAttributeManagementPanel}>
            <div className={styles.attrPanelHeader}>
              <Tag size={18} style={{ color: 'var(--primary)' }} />
              <h4>Kelola Atribut Klasifikasi</h4>
            </div>

            <p className={styles.attrPanelHelp}>
              Atribut klasifikasi laporan koordinasi karyawan (e.g. Sales, Progres, dll).
            </p>

            <form onSubmit={handleAddChatAttribute} className={styles.addAttrForm} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Nama atribut baru..."
                  value={newAttributeInput}
                  onChange={(e) => setNewAttributeInput(e.target.value)}
                  className={styles.attrInput}
                  style={{ flex: 1 }}
                  maxLength={20}
                  required
                />
                <button type="submit" className={styles.attrAddBtn}>
                  <Plus size={16} />
                  <span>Tambah</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  id="attr-is-group"
                  checked={newAttributeIsGroup}
                  onChange={(e) => {
                    setNewAttributeIsGroup(e.target.checked);
                    setNewAttributeGroupMembers([]);
                  }}
                  style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                />
                <label htmlFor="attr-is-group" style={{ cursor: 'pointer', userSelect: 'none' }}>Jadikan Kumpulan Atribut (Grup)</label>
              </div>

              {newAttributeIsGroup && (
                <div style={{
                  padding: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '4px'
                }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Pilih Atribut Anggota:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {chatAttributes.filter(a => !a.isGroup && a.name !== 'Umum').map(a => (
                      <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#cbd5e1', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newAttributeGroupMembers.includes(a.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAttributeGroupMembers(prev => [...prev, a.name]);
                            } else {
                              setNewAttributeGroupMembers(prev => prev.filter(name => name !== a.name));
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        {a.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {/* Search Input for Attribute Management */}
            <div className={styles.attrsListSearchContainer} style={{ marginBottom: '4px' }}>
              <div className={styles.attrSearchWrapper} style={{ width: '100%' }}>
                <Search size={11} className={styles.attrSearchIcon} />
                <input
                  type="text"
                  placeholder="Cari atribut..."
                  className={styles.attrSearchInput}
                  value={manageAttrSearchQuery}
                  onChange={(e) => setManageAttrSearchQuery(e.target.value)}
                />
                {manageAttrSearchQuery && (
                  <button
                    type="button"
                    className={styles.attrSearchClearBtn}
                    onClick={() => setManageAttrSearchQuery('')}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            <div className={styles.attrsList}>
              {chatAttributes
                .filter(attr => attr.name.toLowerCase().includes(manageAttrSearchQuery.toLowerCase()))
                .map((attr) => (
                  <div
                    key={attr.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      boxShadow: 'var(--glass-shadow)',
                      borderRadius: '8px',
                      padding: '10px',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={styles.attrItemName} style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '0.9rem' }}>
                        {attr.isGroup ? '📁' : '🏷️'} {attr.name}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAttributeForOptions(attr);
                            if (attr.isGroup) {
                              setManagedGroupMembers(Array.isArray(attr.groupAttributes) ? attr.groupAttributes : []);
                            } else {
                              const parsedOpts = Array.isArray(attr.options)
                                ? attr.options.map((opt: any, idx: number) => {
                                  return typeof opt === 'string' ? { id: 'opt_' + idx, text: opt, hasTimeframe: false } : opt;
                                })
                                : [];
                              setManagedOptions(sortOptions(parsedOpts));
                              setManagedChatbotEnabled(attr.chatbotEnabled || false);
                              setManagedQuickText(attr.quickText || '');
                              setNewOptionInput('');
                              setNewOptionHasTimeframe(false);
                              setEditingOptionId(null);
                            }
                          }}
                          style={{
                            background: 'var(--primary)',
                            border: '1px solid var(--primary)',
                            color: '#ffffff',
                            padding: '3px 10px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Kelola
                        </button>
                        {attr.name !== 'Umum' && (
                          <button
                            type="button"
                            onClick={() => handleRenameChatAttribute(attr.id, attr.name)}
                            style={{
                              background: 'rgba(234, 179, 8, 0.15)',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                              color: '#facc15',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                            }}
                            title="Ubah Nama Atribut"
                          >
                            Ubah Nama
                          </button>
                        )}
                        {attr.name !== 'Umum' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteChatAttribute(attr.id, attr.name)}
                            className={styles.attrDeleteBtn}
                            title="Hapus Atribut"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {attr.isGroup ? (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Kumpulan: <strong style={{ color: '#818cf8' }}>
                          {Array.isArray(attr.groupAttributes) && attr.groupAttributes.length > 0
                            ? attr.groupAttributes.join(', ')
                            : 'Kosong'}
                        </strong>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <span>Pilihan Ganda: <strong>{Array.isArray(attr.options) ? attr.options.length : 0} opsi</strong></span>
                        <span>AI Chatbot: <strong style={{ color: attr.chatbotEnabled ? '#10b981' : '#ef4444' }}>{attr.chatbotEnabled ? 'Aktif' : 'Nonaktif'}</strong></span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Modal Kelola Atribut (Pilihan Ganda & Chatbot) */}
          {editingAttributeForOptions && (
            <div
              onClick={() => setEditingAttributeForOptions(null)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '16px'
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: '500px',
                  width: '100%',
                  backgroundColor: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: 'var(--glass-shadow)',
                  backdropFilter: 'blur(10px)',
                  color: 'var(--foreground)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag size={20} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                      {editingAttributeForOptions.isGroup ? 'Kelola Kumpulan:' : 'Kelola Atribut:'} {editingAttributeForOptions.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setEditingAttributeForOptions(null)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {editingAttributeForOptions.isGroup ? (
                  <form onSubmit={handleSaveAttributeConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Anggota Atribut</label>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        padding: '12px',
                        borderRadius: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {chatAttributes.filter(a => !a.isGroup && a.name !== 'Umum' && a.name !== editingAttributeForOptions.name).map(a => (
                          <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--foreground)' }}>
                            <input
                              type="checkbox"
                              checked={managedGroupMembers.includes(a.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setManagedGroupMembers(prev => [...prev, a.name]);
                                } else {
                                  setManagedGroupMembers(prev => prev.filter(name => name !== a.name));
                                }
                              }}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            {a.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Form buttons */}
                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setEditingAttributeForOptions(null)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          border: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          border: 'none',
                          background: 'var(--primary)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Simpan Anggota
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleSaveAttributeConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* AI Chatbot configuration */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Chatbot</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px' }}>
                        <input
                          type="checkbox"
                          id="enable-chatbot"
                          checked={managedChatbotEnabled}
                          onChange={(e) => setManagedChatbotEnabled(e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label htmlFor="enable-chatbot" style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--foreground)' }}>
                          Aktifkan AI Chatbot untuk Atribut ini
                        </label>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', margin: '2px 0 0 0' }}>
                        Jika aktif, AI akan otomatis membalas pertanyaan karyawan di kategori ini (misalnya list progres yang tersedia).
                      </p>
                    </div>

                    {/* Quick Text configuration */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Teks Cepat (Quick Text)</label>
                      <textarea
                        placeholder="Masukkan template teks cepat yang otomatis muncul di kotak pesan saat atribut diklik..."
                        value={managedQuickText}
                        onChange={(e) => setManagedQuickText(e.target.value)}
                        rows={3}
                        style={{
                          background: 'var(--glass-bg)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--foreground)',
                          fontSize: '0.85rem',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          outline: 'none',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', margin: '2px 0 0 0' }}>
                        Teks template di atas akan otomatis mengisi kotak pesan chat saat chip atribut ini diklik.
                      </p>
                    </div>

                    {/* Quick Options configuration */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pesan Cepat / Opsi Pilihan Ganda</label>

                      {/* Options List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', marginBottom: '8px', scrollbarWidth: 'none' }}>
                        {managedOptions.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontStyle: 'italic', padding: '4px' }}>Belum ada opsi pesan cepat.</div>
                        ) : (
                          managedOptions.map((opt, idx) => {
                            const isEditing = editingOptionId === opt.id;
                            return (
                              <div key={opt.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '6px 10px', borderRadius: '6px' }}>
                                {isEditing ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', padding: '4px' }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                                      <input
                                        type="text"
                                        value={editingOptionText}
                                        onChange={(e) => setEditingOptionText(e.target.value)}
                                        style={{
                                          background: 'var(--glass-bg)',
                                          border: '1px solid var(--primary)',
                                          color: 'var(--foreground)',
                                          fontSize: '0.8rem',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          outline: 'none',
                                          flex: 1
                                        }}
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveOptionRename(opt.id);
                                          } else if (e.key === 'Escape') {
                                            setEditingOptionId(null);
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveOptionRename(opt.id)}
                                        style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                                        title="Simpan"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingOptionId(null)}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                                        title="Batal"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                    
                                    {/* Inline Lateness Limits editing */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', paddingLeft: '4px' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                                        <input
                                          type="checkbox"
                                          checked={editingOptionHasLateLimit}
                                          onChange={(e) => setEditingOptionHasLateLimit(e.target.checked)}
                                          style={{ cursor: 'pointer', width: '12px', height: '12px' }}
                                        />
                                        Batasi Jam Kedatangan
                                      </label>
                                      
                                      {editingOptionHasLateLimit && (
                                        <input
                                          type="time"
                                          value={editingOptionMaxArrivalTime}
                                          onChange={(e) => setEditingOptionMaxArrivalTime(e.target.value)}
                                          style={{
                                            background: 'var(--glass-bg)',
                                            border: '1px solid var(--glass-border)',
                                            color: 'var(--foreground)',
                                            fontSize: '0.72rem',
                                            padding: '2px 4px',
                                            borderRadius: '4px',
                                            outline: 'none',
                                            cursor: 'pointer'
                                          }}
                                        />
                                      )}
                                    </div>

                                    {/* Inline Timeframe editing */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', paddingLeft: '4px', borderTop: '1px solid var(--glass-border)', paddingTop: '6px' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                                        <input
                                          type="checkbox"
                                          checked={editingOptionHasTimeframe}
                                          onChange={(e) => setEditingOptionHasTimeframe(e.target.checked)}
                                          style={{ cursor: 'pointer', width: '12px', height: '12px' }}
                                        />
                                        Aktifkan Jangka Waktu
                                      </label>
                                      
                                      {editingOptionHasTimeframe && (
                                        <select
                                          value={editingOptionDuration}
                                          onChange={(e) => setEditingOptionDuration(e.target.value)}
                                          style={{
                                            background: 'var(--glass-bg)',
                                            border: '1px solid var(--glass-border)',
                                            color: 'var(--foreground)',
                                            fontSize: '0.72rem',
                                            padding: '2px 4px',
                                            borderRadius: '4px',
                                            outline: 'none',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <option value="1 hari">1 Hari</option>
                                          <option value="3 hari">3 Hari</option>
                                          <option value="7 hari">7 Hari</option>
                                          <option value="2 minggu">2 Minggu</option>
                                          <option value="1 bulan">1 Bulan</option>
                                        </select>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: '0.8rem', color: 'var(--foreground)', fontWeight: 600 }}>{opt.text || opt}</span>
                                      {opt.hasTimeframe && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                          ⏱️ Jangka Waktu: {opt.duration} ({opt.status === 'taken' ? `Diambil: ${opt.assignedTo}` : 'Tersedia'})
                                        </span>
                                      )}
                                      {opt.hasLateLimit && (
                                        <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>
                                          ⏰ Batas Kedatangan: {opt.maxArrivalTime} WIB
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingOptionId(opt.id);
                                          setEditingOptionText(opt.text || opt);
                                          setEditingOptionHasLateLimit(!!opt.hasLateLimit);
                                          setEditingOptionMaxArrivalTime(opt.maxArrivalTime || '09:00');
                                          setEditingOptionHasTimeframe(!!opt.hasTimeframe);
                                          setEditingOptionDuration(opt.duration || '1 hari');
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                                        title="Ubah Nama"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setManagedOptions(prev => prev.filter((_, i) => i !== idx))}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                                        title="Hapus"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add option form */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px' }}>
                        <input
                          type="text"
                          placeholder="Tulis opsi pesan baru..."
                          value={newOptionInput}
                          onChange={(e) => setNewOptionInput(e.target.value)}
                          style={{
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--foreground)',
                            fontSize: '0.85rem',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            outline: 'none'
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            id="enable-option-timeframe"
                            checked={newOptionHasTimeframe}
                            onChange={(e) => setNewOptionHasTimeframe(e.target.checked)}
                            style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                          />
                          <label htmlFor="enable-option-timeframe" style={{ fontSize: '0.78rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                            Aktifkan Jangka Waktu (Tugas Progres)
                          </label>
                        </div>

                        {newOptionHasTimeframe && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pilih Durasi Jangka Waktu:</label>
                            <select
                              value={newOptionDuration}
                              onChange={(e) => setNewOptionDuration(e.target.value)}
                              style={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid var(--glass-border)',
                                color: '#ffffff',
                                fontSize: '0.85rem',
                                padding: '8px',
                                borderRadius: '6px',
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="1 hari" style={{ background: '#0f172a' }}>1 Hari</option>
                              <option value="3 hari" style={{ background: '#0f172a' }}>3 Hari</option>
                              <option value="7 hari" style={{ background: '#0f172a' }}>7 Hari</option>
                              <option value="2 minggu" style={{ background: '#0f172a' }}>2 Minggu</option>
                              <option value="1 bulan" style={{ background: '#0f172a' }}>1 Bulan</option>
                            </select>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <input
                            type="checkbox"
                            id="enable-option-latelimit"
                            checked={newOptionHasLateLimit}
                            onChange={(e) => setNewOptionHasLateLimit(e.target.checked)}
                            style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                          />
                          <label htmlFor="enable-option-latelimit" style={{ fontSize: '0.78rem', color: '#cbd5e1', cursor: 'pointer' }}>
                            Batasi Jam Kedatangan (Deteksi Terlambat)
                          </label>
                        </div>

                        {newOptionHasLateLimit && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Maksimal Jam Kedatangan:</label>
                            <input
                              type="time"
                              value={newOptionMaxArrivalTime}
                              onChange={(e) => setNewOptionMaxArrivalTime(e.target.value)}
                              style={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid var(--glass-border)',
                                color: '#ffffff',
                                fontSize: '0.85rem',
                                padding: '8px',
                                borderRadius: '6px',
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (newOptionInput.trim()) {
                              const now = new Date();
                              let expiry = null;
                              if (newOptionHasTimeframe) {
                                const expiryDate = new Date(now);
                                const dur = (newOptionDuration || '1 hari').toLowerCase();
                                if (dur.includes('1 hari')) {
                                  expiryDate.setDate(expiryDate.getDate() + 1);
                                } else if (dur.includes('3 hari')) {
                                  expiryDate.setDate(expiryDate.getDate() + 3);
                                } else if (dur.includes('7 hari')) {
                                  expiryDate.setDate(expiryDate.getDate() + 7);
                                } else if (dur.includes('2 minggu')) {
                                  expiryDate.setDate(expiryDate.getDate() + 14);
                                } else if (dur.includes('1 bulan')) {
                                  expiryDate.setMonth(expiryDate.getMonth() + 1);
                                } else {
                                  expiryDate.setDate(expiryDate.getDate() + 1);
                                }
                                expiry = expiryDate.toISOString();
                              }

                              const newOptObj = {
                                id: 'opt_' + Math.random().toString(36).substr(2, 9),
                                text: newOptionInput.trim(),
                                hasTimeframe: newOptionHasTimeframe,
                                duration: newOptionHasTimeframe ? newOptionDuration : null,
                                status: 'ready',
                                assignedTo: null,
                                startDate: newOptionHasTimeframe ? now.toISOString() : null,
                                expiryDate: expiry,
                                hasLateLimit: newOptionHasLateLimit,
                                maxArrivalTime: newOptionHasLateLimit ? newOptionMaxArrivalTime : null
                              };
                              setManagedOptions(prev => sortOptions([...prev, newOptObj]));
                              setNewOptionInput('');
                              setNewOptionHasTimeframe(false);
                              setNewOptionHasLateLimit(false);
                            }
                          }}
                          style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#818cf8',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            alignSelf: 'flex-end',
                            fontWeight: 600
                          }}
                        >
                          Tambah Opsi
                        </button>
                      </div>
                    </div>

                    {/* Form buttons */}
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setEditingAttributeForOptions(null)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          color: '#94a3b8',
                          cursor: 'pointer'
                        }}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          border: 'none',
                          background: '#6366f1',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Simpan Konfigurasi
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Mobile attributes modal */}
          {showMobileAttributesModal && (
            <div
              onClick={() => setShowMobileAttributesModal(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9998,
                padding: '16px'
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: '500px',
                  width: '100%',
                  backgroundColor: 'rgba(10, 10, 22, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                  backdropFilter: 'blur(10px)',
                  color: '#f8fafc',
                  position: 'relative',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
              >
                <button
                  onClick={() => setShowMobileAttributesModal(false)}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    zIndex: 10
                  }}
                >
                  <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
                  <Tag size={18} style={{ color: 'var(--primary)' }} />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Kelola Atribut Klasifikasi</h4>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Atribut klasifikasi laporan koordinasi karyawan (e.g. Sales, Progres, dll).
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddChatAttribute(e);
                  }}
                  className={styles.addAttrForm}
                  style={{ marginBottom: '20px' }}
                >
                  <input
                    type="text"
                    placeholder="Nama atribut baru..."
                    value={newAttributeInput}
                    onChange={(e) => setNewAttributeInput(e.target.value)}
                    className={styles.attrInput}
                    maxLength={20}
                    required
                  />
                  <button type="submit" className={styles.attrAddBtn}>
                    <Plus size={16} />
                    <span>Tambah</span>
                  </button>
                </form>

                {/* Search Input for Mobile Attribute Management */}
                <div className={styles.attrsListSearchContainer} style={{ marginBottom: '10px' }}>
                  <div className={styles.attrSearchWrapper} style={{ width: '100%' }}>
                    <Search size={11} className={styles.attrSearchIcon} />
                    <input
                      type="text"
                      placeholder="Cari atribut..."
                      className={styles.attrSearchInput}
                      value={manageAttrSearchQuery}
                      onChange={(e) => setManageAttrSearchQuery(e.target.value)}
                    />
                    {manageAttrSearchQuery && (
                      <button
                        type="button"
                        className={styles.attrSearchClearBtn}
                        onClick={() => setManageAttrSearchQuery('')}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.attrsList}>
                  {chatAttributes
                    .filter(attr => attr.name.toLowerCase().includes(manageAttrSearchQuery.toLowerCase()))
                    .map((attr) => (
                      <div
                        key={attr.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '8px',
                          padding: '10px',
                          marginBottom: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={styles.attrItemName} style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>🏷️ {attr.name}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAttributeForOptions(attr);
                                const parsedOpts = Array.isArray(attr.options)
                                  ? attr.options.map((opt: any, idx: number) => {
                                    return typeof opt === 'string' ? { id: 'opt_' + idx, text: opt, hasTimeframe: false } : opt;
                                  })
                                  : [];
                                setManagedOptions(sortOptions(parsedOpts));
                                setManagedChatbotEnabled(attr.chatbotEnabled || false);
                                setManagedQuickText(attr.quickText || '');
                                setNewOptionInput('');
                                setNewOptionHasTimeframe(false);
                                setEditingOptionId(null);
                              }}
                              style={{
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                color: '#818cf8',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                            >
                              Kelola
                            </button>
                            {attr.name !== 'Umum' && (
                              <button
                                type="button"
                                onClick={() => handleRenameChatAttribute(attr.id, attr.name)}
                                style={{
                                  background: 'rgba(234, 179, 8, 0.15)',
                                  border: '1px solid rgba(234, 179, 8, 0.3)',
                                  color: '#facc15',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                }}
                                title="Ubah Nama Atribut"
                              >
                                Ubah Nama
                              </button>
                            )}
                            {attr.name !== 'Umum' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteChatAttribute(attr.id, attr.name)}
                                className={styles.attrDeleteBtn}
                                title="Hapus Atribut"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          <span>Pilihan Ganda: <strong>{Array.isArray(attr.options) ? attr.options.length : 0} opsi</strong></span>
                          <span>AI Chatbot: <strong style={{ color: attr.chatbotEnabled ? '#10b981' : '#ef4444' }}>{attr.chatbotEnabled ? 'Aktif' : 'Nonaktif'}</strong></span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Attribute Calendar Modal */}
          {renderAttributeCalendarModal()}
        </div>

        {/* Admin Lightbox Modal */}
        {adminActiveLightboxImage && (
          <div
            className={styles.adminLightbox}
            onClick={() => setAdminActiveLightboxImage(null)}
          >
            <button
              className={styles.adminLightboxCloseBtn}
              onClick={() => setAdminActiveLightboxImage(null)}
              type="button"
            >
              <X size={24} />
            </button>
            <div className={styles.adminLightboxContent} onClick={(e) => e.stopPropagation()}>
              <img src={adminActiveLightboxImage} alt="Fullscreen Attachment" className={styles.adminLightboxImage} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper to render Attribute Calendar Modal
  function renderAttributeCalendarModal() {
    if (!showAttributeCalendarModal) return null;

    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const getDaysInMonth = (month: number, year: number) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month: number, year: number) => {
      let firstDay = new Date(year, month, 1).getDay();
      return (firstDay + 6) % 7; // Monday = 0
    };

    const daysInMonth = getDaysInMonth(attrCalMonth, attrCalYear);
    const firstDayIndex = getFirstDayOfMonth(attrCalMonth, attrCalYear);

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`attr-empty-${i}`} className={styles.attrCalDayEmpty} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${attrCalYear}-${String(attrCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const dayLogs = attributeHistory.filter((log) => {
        const logDate = new Date(log.recordedAt);
        const y = logDate.getFullYear();
        const m = String(logDate.getMonth() + 1).padStart(2, '0');
        const d = String(logDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === dateStr;
      });

      const isSelected = selectedAttrCalDate === dateStr;
      const isToday = (() => {
        const today = new Date();
        return today.getDate() === day && today.getMonth() === attrCalMonth && today.getFullYear() === attrCalYear;
      })();

      const checkInCount = dayLogs.filter(log => log.status === 'check-in').length;
      const checkOutCount = dayLogs.filter(log => log.status === 'check-out' || log.status === 'taken').length;
      const expiredCount = dayLogs.filter(log => log.status === 'expired').length;

      days.push(
        <button
          key={`attr-day-${day}`}
          type="button"
          className={`${styles.attrCalDayBtn} ${isSelected ? styles.attrCalDaySelected : ''} ${isToday ? styles.attrCalDayToday : ''} ${dayLogs.length > 0 ? styles.attrCalDayHasLogs : ''}`}
          onClick={() => {
            if (isSelected) {
              setSelectedAttrCalDate(null);
            } else {
              setSelectedAttrCalDate(dateStr);
            }
          }}
        >
          <span className={styles.attrCalDayNum}>{day}</span>
          <div className={styles.attrCalDayBadges}>
            {checkInCount > 0 && (
              <span className={styles.attrCalBadgeCheckIn} title={`${checkInCount} Tugas Diambil (Check In)`}>
                {checkInCount}
              </span>
            )}
            {checkOutCount > 0 && (
              <span className={styles.attrCalBadgeTaken} title={`${checkOutCount} Tugas Selesai (Check Out)`}>
                {checkOutCount}
              </span>
            )}
            {expiredCount > 0 && (
              <span className={styles.attrCalBadgeExpired} title={`${expiredCount} Tugas Hangus`}>
                {expiredCount}
              </span>
            )}
          </div>
        </button>
      );
    }

    const prevMonth = () => {
      if (attrCalMonth === 0) {
        setAttrCalMonth(11);
        setAttrCalYear(prev => prev - 1);
      } else {
        setAttrCalMonth(prev => prev - 1);
      }
    };

    const nextMonth = () => {
      if (attrCalMonth === 11) {
        setAttrCalMonth(0);
        setAttrCalYear(prev => prev + 1);
      } else {
        setAttrCalMonth(prev => prev + 1);
      }
    };

    const selectedLogs = selectedAttrCalDate
      ? attributeHistory.filter((log) => {
        const logDate = new Date(log.recordedAt);
        const y = logDate.getFullYear();
        const m = String(logDate.getMonth() + 1).padStart(2, '0');
        const d = String(logDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === selectedAttrCalDate;
      })
      : [];

    return (
      <div
        onClick={() => setShowAttributeCalendarModal(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '650px',
            width: '100%',
            backgroundColor: 'rgba(10, 10, 22, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(10px)',
            color: '#f8fafc',
            position: 'relative',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <button
            onClick={() => setShowAttributeCalendarModal(false)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            <X size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
            <CalendarIcon size={18} style={{ color: '#34d399' }} />
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Kalender Monitoring Atribut</h3>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexDirection: 'column', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>

            {/* Calendar Widget */}
            <div className={styles.attrCalendarWidget}>
              <div className={styles.attrCalHeader}>
                <button type="button" onClick={prevMonth} className={styles.attrCalNavBtn}>&larr;</button>
                <span className={styles.attrCalMonthLabel}>{months[attrCalMonth]} {attrCalYear}</span>
                <button type="button" onClick={nextMonth} className={styles.attrCalNavBtn}>&rarr;</button>
              </div>
              <div className={styles.attrCalWeekdays}>
                {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map(w => (
                  <div key={w} className={styles.attrCalWeekday}>{w}</div>
                ))}
              </div>
              <div className={styles.attrCalGrid}>
                {days}
              </div>
            </div>

            {/* Selected Date Details */}
            <div className={styles.attrCalDetailsContainer}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                {selectedAttrCalDate ? `Detail Aktivitas: ${formatDateLong(selectedAttrCalDate)}` : 'Pilih tanggal di atas untuk melihat detail'}
              </h4>

              {selectedAttrCalDate ? (
                selectedLogs.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '10px 0' }}>Tidak ada riwayat aktivitas atribut pada tanggal ini.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                    {selectedLogs.map((log: any) => {
                      const logTime = formatTime(log.recordedAt);
                      const sDate = formatDateShort(log.startDate);
                      const eDate = formatDateShort(log.expiryDate);

                      let statusText = 'Hangus/Tidak Diambil';
                      let statusClass = styles.attrCalLogStatusExpired;
                      if (log.status === 'check-in') {
                        statusText = 'Ambil (Check In)';
                        statusClass = styles.attrCalLogStatusCheckIn;
                      } else if (log.status === 'check-out' || log.status === 'taken') {
                        statusText = 'Selesai (Check Out)';
                        statusClass = styles.attrCalLogStatusTaken;
                      }

                      return (
                        <div key={log.id} className={styles.attrCalLogItem}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span className={styles.attrCalLogTime}>{logTime} WIB</span>
                            <span className={statusClass}>
                              {statusText}
                            </span>
                          </div>
                          <div className={styles.attrCalLogText}>
                            <strong>[{log.attributeName}]</strong> {log.optionText}
                          </div>
                          {(log.status === 'check-in' || log.status === 'check-out' || log.status === 'taken') && (
                            <div className={styles.attrCalLogUser}>
                              Oleh: <strong>{log.assignedTo || '-'}</strong>
                            </div>
                          )}
                          <div className={styles.attrCalLogPeriod}>
                            Periode: {sDate} s/d {eDate}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <span>Silakan klik salah satu tanggal untuk melihat log monitoring.</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  };



  function renderAdminReservations() {
    const getDaysInMonth = (month: number, year: number) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month: number, year: number) => {
      let firstDay = new Date(year, month, 1).getDay();
      return (firstDay + 6) % 7; // Monday = 0
    };

    const filtered = adminReservations.filter((r) => {
      if (adminResFilter !== 'all' && r.status !== adminResFilter) return false;
      if (adminSelectedDate) {
        const bDate = new Date(r.dateTime);
        const y = bDate.getFullYear();
        const m = String(bDate.getMonth() + 1).padStart(2, '0');
        const d = String(bDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        if (dateStr !== adminSelectedDate) return false;
      }
      return true;
    });

    const handleUpdateStatus = async (id: string, status: string) => {
      try {
        const res = await fetch('/api/reservations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status }),
        });
        if (res.ok) {
          const updated = await res.json();
          setAdminReservations((prev) => prev.map((r) => (r.id === id ? updated : r)));
        } else {
          alert('Gagal mengupdate status');
        }
      } catch (err) {
        alert('Terjadi kesalahan');
      }
    };

    const handleDeleteRes = async (id: string) => {
      if (!confirm('Apakah Anda yakin ingin menghapus reservasi ini?')) return;
      try {
        const res = await fetch(`/api/reservations?id=${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setAdminReservations((prev) => prev.filter((r) => r.id !== id));
        } else {
          alert('Gagal menghapus reservasi');
        }
      } catch (err) {
        alert('Terjadi kesalahan');
      }
    };

    const renderMiniCalendar = () => {
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const daysInMonth = getDaysInMonth(calMonth, calYear);
      const firstDayIndex = getFirstDayOfMonth(calMonth, calYear);

      const days = [];
      for (let i = 0; i < firstDayIndex; i++) {
        days.push(<div key={`empty-${i}`} className={styles.calDayEmpty} />);
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayBookings = adminReservations.filter((r) => {
          const bDate = new Date(r.dateTime);
          const y = bDate.getFullYear();
          const m = String(bDate.getMonth() + 1).padStart(2, '0');
          const d = String(bDate.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}` === dateStr;
        });

        const isSelected = adminSelectedDate === dateStr;
        const isToday = (() => {
          const today = new Date();
          return today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear;
        })();

        days.push(
          <button
            key={`day-${day}`}
            type="button"
            className={`${styles.calDayBtn} ${isSelected ? styles.calDaySelected : ''} ${isToday ? styles.calDayToday : ''}`}
            onClick={() => {
              if (isSelected) {
                setAdminSelectedDate(null);
              } else {
                setAdminSelectedDate(dateStr);
              }
            }}
          >
            <span className={styles.calDayNum}>{day}</span>
            {dayBookings.length > 0 && (
              <span
                className={`${styles.calDayDot} ${dayBookings.some(b => b.status === 'pending') ? styles.calDotPending :
                    dayBookings.some(b => b.status === 'confirmed') ? styles.calDotConfirmed : styles.calDotDone
                  }`}
              >
                {dayBookings.length}
              </span>
            )}
          </button>
        );
      }

      const prevMonth = () => {
        if (calMonth === 0) {
          setCalMonth(11);
          setCalYear(prev => prev - 1);
        } else {
          setCalMonth(prev => prev - 1);
        }
      };

      const nextMonth = () => {
        if (calMonth === 11) {
          setCalMonth(0);
          setCalYear(prev => prev + 1);
        } else {
          setCalMonth(prev => prev + 1);
        }
      };

      return (
        <div className={`${styles.miniCalendarCard} glass-panel`}>
          <div className={styles.calHeader}>
            <button type="button" onClick={prevMonth} className={styles.calNavBtn}>&larr;</button>
            <span className={styles.calMonthLabel}>{months[calMonth]} {calYear}</span>
            <button type="button" onClick={nextMonth} className={styles.calNavBtn}>&rarr;</button>
          </div>
          <div className={styles.calWeekdays}>
            {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map(w => (
              <div key={w} className={styles.calWeekday}>{w}</div>
            ))}
          </div>
          <div className={styles.calGrid}>
            {days}
          </div>
          {adminSelectedDate && (
            <button
              type="button"
              className={styles.clearCalFilterBtn}
              onClick={() => setAdminSelectedDate(null)}
            >
              Tampilkan Semua Tanggal
            </button>
          )}
        </div>
      );
    };

    if (isMobile) {
      return (
        <div className={styles.adminResContainerMobile}>
          <div className={styles.adminResHeaderMobile}>
            <h3>Reservasi Pelanggan</h3>
            <button type="button" onClick={fetchAdminReservations} className={styles.refreshBtnMobile}>
              🔄 Segarkan
            </button>
          </div>

          <div className={styles.adminMobileFilterSection}>
            <button
              type="button"
              className={`${styles.adminMobileCalBtn} ${adminSelectedDate ? styles.adminMobileCalBtnActive : ''}`}
              onClick={() => setIsAdminCalOpenMobile(true)}
            >
              📅 {adminSelectedDate ? formatDateLong(adminSelectedDate) : 'Semua Tanggal'}
            </button>

            <div className={styles.adminMobileStatusRow}>
              {['all', 'pending', 'confirmed', 'cancelled', 'completed'].map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  onClick={() => setAdminResFilter(statusOption)}
                  className={`${styles.adminMobileStatusPill} ${adminResFilter === statusOption ? styles.adminMobileStatusPillActive : ''}`}
                >
                  {statusOption === 'all' ? 'Semua' :
                    statusOption === 'pending' ? 'Menunggu' :
                      statusOption === 'confirmed' ? 'Dikonfirmasi' :
                        statusOption === 'cancelled' ? 'Dibatalkan' : 'Selesai'}
                </button>
              ))}
            </div>
          </div>

          {adminSelectedDate && (
            <div className={styles.selectedDateInfoBannerMobile}>
              <span>Tanggal: <strong>{formatDateShort(adminSelectedDate)}</strong></span>
              <button type="button" className={styles.bannerClearFilterBtnMobile} onClick={() => setAdminSelectedDate(null)}>
                Hapus
              </button>
            </div>
          )}

          <div className={styles.resMobileCardList}>
            {adminResLoading ? (
              <div className={styles.resLoaderMobile}>
                <div className="spinner" />
                <p>Memuat reservasi...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.resEmptyMobile}>
                <p>Tidak ada reservasi ditemukan.</p>
              </div>
            ) : (
              filtered.map((r) => {
                const date = getValidDate(r.dateTime) || new Date();
                const formattedDate = formatDateTime(r.dateTime);
                return (
                  <div key={r.id} className={`${styles.resMobileCard} glass-panel`}>
                    <div className={styles.resMobileCardHeader}>
                      <div>
                        <h4 className={styles.resMobileClientName}>{r.name}</h4>
                        <span className={styles.resMobileDate}>{formattedDate}</span>
                      </div>
                      <span className={`${styles.statusBadge} ${styles['status_' + r.status]}`}>
                        {r.status === 'pending' ? 'Menunggu' :
                          r.status === 'confirmed' ? 'Dikonfirmasi' :
                            r.status === 'cancelled' ? 'Dibatalkan' : 'Selesai'}
                      </span>
                    </div>

                    <div className={styles.resMobileCardBody}>
                      <div className={styles.resMobileMetaGrid}>
                        <div>
                          <span className={styles.resMobileLabel}>Meja:</span>
                          <span className={styles.tableBadge}>{r.tableInfo}</span>
                        </div>
                        <div>
                          <span className={styles.resMobileLabel}>Orang:</span>
                          <span>{r.partySize} orang</span>
                        </div>
                        <div>
                          <span className={styles.resMobileLabel}>DP:</span>
                          <strong style={{ color: '#10b981' }}>Rp {r.dpAmount.toLocaleString('id-ID')}</strong>
                        </div>
                      </div>

                      {r.menuList && (
                        <div className={styles.resMobileMenuSection}>
                          <span className={styles.resMobileLabel}>MENU PESANAN:</span>
                          {renderFormattedMenuList(r.menuList)}
                        </div>
                      )}
                    </div>

                    <div className={styles.resMobileCardActions}>
                      {r.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(r.id, 'confirmed')}
                          className={`${styles.resMobileActionBtn} ${styles.resMobileConfirmBtn}`}
                        >
                          ✓ Konfirmasi
                        </button>
                      )}
                      {r.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(r.id, 'completed')}
                          className={`${styles.resMobileActionBtn} ${styles.resMobileConfirmBtn}`}
                          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                        >
                          ★ Selesai
                        </button>
                      )}
                      {r.status !== 'cancelled' && r.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(r.id, 'cancelled')}
                          className={`${styles.resMobileActionBtn} ${styles.resMobileCancelBtn}`}
                        >
                          ✗ Batalkan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(r)}
                        className={`${styles.resMobileActionBtn} ${styles.resMobileEditBtn}`}
                      >
                        ✎ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRes(r.id)}
                        className={`${styles.resMobileActionBtn} ${styles.resMobileDeleteBtn}`}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Sheet Calendar Modal for Admin Mobile */}
          {isAdminCalOpenMobile && (
            <div className={styles.mobileBottomSheetOverlay} onClick={() => setIsAdminCalOpenMobile(false)}>
              <div className={styles.mobileBottomSheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.mobileBottomSheetHeader}>
                  <h3>Pilih Tanggal Reservasi</h3>
                  <button className={styles.mobileBottomSheetClose} onClick={() => setIsAdminCalOpenMobile(false)}>
                    <X size={20} />
                  </button>
                </div>
                <div className={styles.mobileBottomSheetBody}>
                  {renderMiniCalendar()}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={styles.adminResContainer}>
        <div className={styles.adminResHeader}>
          <h3>Manajemen Reservasi Meja Pelanggan</h3>
          <p>Konfirmasi boking, pantau pembayaran DP, dan kelola meja reservasi customer menggunakan kalender filter</p>
        </div>

        <div className={styles.adminResLayoutGrid}>
          {/* Calendar Panel */}
          <div className={styles.adminResCalendarPanel}>
            {renderMiniCalendar()}
          </div>

          {/* List Panel */}
          <div className={styles.adminResListPanel}>
            {/* Filter bar */}
            <div className={styles.adminResFilterBar}>
              {['all', 'pending', 'confirmed', 'cancelled', 'completed'].map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  onClick={() => setAdminResFilter(statusOption)}
                  className={`${styles.filterTab} ${adminResFilter === statusOption ? styles.filterTabActive : ''}`}
                >
                  {statusOption === 'all' ? 'Semua' :
                    statusOption === 'pending' ? 'Menunggu' :
                      statusOption === 'confirmed' ? 'Dikonfirmasi' :
                        statusOption === 'cancelled' ? 'Dibatalkan' : 'Selesai'}
                </button>
              ))}
              <button type="button" onClick={fetchAdminReservations} className={styles.refreshBtn}>
                🔄 Segarkan
              </button>
            </div>

            {adminSelectedDate && (
              <div className={styles.selectedDateInfoBanner}>
                <span>Menampilkan reservasi tanggal: <strong>{
                  formatDateLong(adminSelectedDate)
                }</strong></span>
                <button type="button" className={styles.bannerClearFilterBtn} onClick={() => setAdminSelectedDate(null)}>
                  Tampilkan Semua
                </button>
              </div>
            )}

            {/* Table */}
            <div className={styles.tableWrapper}>
              {adminResLoading ? (
                <div className={styles.resLoader}>
                  <div className="spinner" />
                  <p>Memuat daftar reservasi...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.resEmpty}>
                  <CalendarIcon size={48} style={{ opacity: 0.5, color: 'var(--text-dark)' }} />
                  <p>Tidak ada reservasi ditemukan.</p>
                </div>
              ) : (
                <table className={styles.resTable}>
                  <thead>
                    <tr>
                      <th>Nama Pelanggan</th>
                      <th>Tanggal & Jam</th>
                      <th>Meja / Tempat</th>
                      <th>Orang</th>
                      <th>DP (Down Payment)</th>
                      <th>Daftar Menu</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const date = getValidDate(r.dateTime) || new Date();
                      const formattedDate = formatDateLong(r.dateTime) + ' ' + formatTime(r.dateTime);
                      return (
                        <tr key={r.id}>
                          <td className={styles.resClientName}>{r.name}</td>
                          <td>{formattedDate}</td>
                          <td><span className={styles.tableBadge}>{r.tableInfo}</span></td>
                          <td>{r.partySize} orang</td>
                          <td>Rp {r.dpAmount.toLocaleString('id-ID')}</td>
                          <td className={styles.resMenuListCell} title={r.menuList}>{r.menuList}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${styles['status_' + r.status]}`}>
                              {r.status === 'pending' ? 'Menunggu' :
                                r.status === 'confirmed' ? 'Dikonfirmasi' :
                                  r.status === 'cancelled' ? 'Dibatalkan' : 'Selesai'}
                            </span>
                          </td>
                          <td>
                            <div className={styles.actionRow}>
                              {r.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(r.id, 'confirmed')}
                                  className={`${styles.actionBtn} ${styles.actionBtnConfirm}`}
                                  title="Konfirmasi"
                                >
                                  ✓
                                </button>
                              )}
                              {r.status !== 'cancelled' && r.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(r.id, 'cancelled')}
                                  className={`${styles.actionBtn} ${styles.actionBtnCancel}`}
                                  title="Batalkan"
                                >
                                  ✗
                                </button>
                              )}
                              {r.status === 'confirmed' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(r.id, 'completed')}
                                  className={`${styles.actionBtn} ${styles.actionBtnDone}`}
                                  title="Tandai Selesai"
                                >
                                  ★
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStartEdit(r)}
                                className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                                title="Edit Reservasi"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRes(r.id)}
                                className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                                title="Hapus"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authChecking) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <div className="spinner" />
        <p style={{ marginTop: '12px' }}>Memuat sistem otorisasi...</p>
      </div>
    );
  }

  if (!isAdminAuthorized) {
    return (
      <div className={styles.authContainer}>
        <div className={`${styles.authCard} glass-panel`}>
          <div className={styles.authHeader}>
            <div className={styles.lockIconWrapper}>
              <Lock className={styles.lockIcon} />
            </div>
            <h1 className={styles.authTitle}>Panel Admin Catatan Pintar</h1>
            <p className={styles.authSubtitle}>
              Masukkan passcode untuk masuk ke dashboard utama
            </p>
          </div>

          <form onSubmit={handleVerifyPasscode} className={styles.authForm}>
            <div className={styles.inputGroup}>
              <label htmlFor="admin-passcode" className={styles.inputLabel}>
                Passcode Admin
              </label>
              <div className={styles.inputWithIcon}>
                <Lock className={styles.fieldIcon} size={16} />
                <input
                  id="admin-passcode"
                  type="password"
                  placeholder="Masukkan passcode"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  className={styles.textInput}
                  required
                  autoFocus
                />
              </div>
              {passcodeError && (
                <div style={{ color: 'var(--error)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', marginTop: '6px', gap: '4px' }}>
                  <AlertCircle size={14} />
                  <span>{passcodeError}</span>
                </div>
              )}
            </div>

            <button type="submit" className={styles.submitBtn}>
              <span>Verifikasi & Masuk</span>
              <ArrowRight className={styles.btnIcon} />
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <a href="/chat" style={{ fontSize: '0.85rem', color: 'var(--secondary)', textDecoration: 'underline' }}>
              Buka Halaman Chat Room Karyawan &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>

      {showInstallBanner && (
        <div className={styles.installBanner}>
          <div className={styles.installBannerContent}>
            <span>💡 Pasang <strong>CatatanPintar</strong> di komputer Anda agar lebih cepat diakses & mendukung offline!</span>
            <div className={styles.installBannerActions}>
              <button className={styles.installBtn} onClick={handleInstallClick}>Instal Sekarang</button>
              <button className={styles.closeInstallBtn} onClick={() => setShowInstallBanner(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.brand} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className={styles.logo}>CATATAN PINTAR</div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
            className={styles.themeToggleBtn}
            style={{ width: '32px', height: '32px' }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <nav className={styles.navSection}>
          <button
            className={`${styles.navItem} ${activeTab === 'notes' ? styles.activeNavItem : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <FileText size={18} />
            Catatan Saya
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'calendar' ? styles.activeNavItem : ''}`}
            onClick={() => {
              setActiveTab('calendar');
              // Default to select today's date if none is selected
              if (!selectedDate) {
                const today = new Date();
                const y = today.getFullYear();
                const m = String(today.getMonth() + 1).padStart(2, '0');
                const d = String(today.getDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${d}`);
              }
            }}
          >
            <CalendarIcon size={18} />
            Kalender Harian
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'news' ? styles.activeNavItem : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <Newspaper size={18} />
            Berita Terkini
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'reminders' ? styles.activeNavItem : ''}`}
            onClick={() => setActiveTab('reminders')}
          >
            <Bell size={18} />
            Pengingat & Alarm
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'whatsapp' ? styles.activeNavItem : ''}`}
            onClick={() => setActiveTab('whatsapp')}
          >
            <MessageSquare size={18} />
            Pesan Darurat
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'chat' ? styles.activeNavItem : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <Users size={18} />
            Chat Room
          </button>
          <button
            className={`${styles.navItem} ${activeTab === 'reservations' ? styles.activeNavItem : ''}`}
            onClick={() => setActiveTab('reservations')}
          >
            <CalendarIcon size={18} />
            Reservasi Meja
          </button>

        </nav>

        {/* Collapsible Folders Section */}
        {activeTab === 'notes' && (
          <div className={styles.foldersSidebarSection}>
            <button
              className={styles.foldersToggleBtn}
              onClick={() => setIsFoldersListOpen(!isFoldersListOpen)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderIcon size={15} />
                <span>Folder Catatan</span>
              </span>
              <span className={`${styles.toggleArrow} ${isFoldersListOpen ? styles.arrowUp : ''}`}>▼</span>
            </button>

            {isFoldersListOpen && (
              <div className={styles.foldersListWrapper}>
                <button
                  className={`${styles.folderItem} ${selectedFolderId === null ? styles.activeFolderItem : ''}`}
                  onClick={() => setSelectedFolderId(null)}
                >
                  <FolderIcon size={14} />
                  <span>Semua Catatan</span>
                </button>

                {/* Render folders in tree structure */}
                {folders.filter(f => !f.parentId).map((parentFolder) => {
                  const subfolders = folders.filter(f => f.parentId === parentFolder.id);
                  const isParentSelected = selectedFolderId === parentFolder.id;

                  return (
                    <div key={parentFolder.id} className={styles.folderGroup}>
                      <div className={`${styles.folderItemContainer} ${isParentSelected ? styles.activeFolderItemContainer : ''}`}>
                        {editingFolderId === parentFolder.id ? (
                          <div className={styles.folderEditRow}>
                            <input
                              type="text"
                              className={styles.folderRenameInput}
                              value={editingFolderName}
                              onChange={(e) => setEditingFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameFolder(parentFolder.id, editingFolderName, editingFolderParentId || null);
                                if (e.key === 'Escape') setEditingFolderId(null);
                              }}
                              autoFocus
                            />
                            <select
                              className={styles.folderParentEditSelect}
                              value={editingFolderParentId}
                              onChange={(e) => setEditingFolderParentId(e.target.value)}
                            >
                              <option value="">— Induk (Root) —</option>
                              {folders.filter(f => !f.parentId && f.id !== parentFolder.id).map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                            <div className={styles.editRowBtns}>
                              <button
                                className={styles.editSaveBtn}
                                onClick={() => handleRenameFolder(parentFolder.id, editingFolderName, editingFolderParentId || null)}
                              >
                                Simpan
                              </button>
                              <button
                                className={styles.editCancelBtn}
                                onClick={() => setEditingFolderId(null)}
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              className={styles.folderItemBtn}
                              onClick={() => setSelectedFolderId(parentFolder.id)}
                            >
                              <FolderIcon size={14} />
                              <span className={styles.folderNameText}>{parentFolder.name}</span>
                            </button>
                            <div className={styles.folderActions}>
                              <button
                                title="Tambah Subfolder"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const name = prompt(`Buat subfolder di bawah ${parentFolder.name}:`);
                                  if (name && name.trim()) {
                                    handleCreateFolder(name.trim(), parentFolder.id);
                                  }
                                }}
                              >
                                <Plus size={12} />
                              </button>
                              <button
                                title="Ubah"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFolderId(parentFolder.id);
                                  setEditingFolderName(parentFolder.name);
                                  setEditingFolderParentId(parentFolder.parentId || '');
                                }}
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                title="Hapus"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(parentFolder.id);
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Render Subfolders */}
                      {subfolders.length > 0 && (
                        <div className={styles.subfoldersList}>
                          {subfolders.map((subfolder) => {
                            const isSubSelected = selectedFolderId === subfolder.id;
                            return (
                              <div key={subfolder.id} className={`${styles.folderItemContainer} ${styles.subfolderItemContainer} ${isSubSelected ? styles.activeFolderItemContainer : ''}`}>
                                {editingFolderId === subfolder.id ? (
                                  <div className={styles.folderEditRow}>
                                    <input
                                      type="text"
                                      className={styles.folderRenameInput}
                                      value={editingFolderName}
                                      onChange={(e) => setEditingFolderName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRenameFolder(subfolder.id, editingFolderName, editingFolderParentId || null);
                                        if (e.key === 'Escape') setEditingFolderId(null);
                                      }}
                                      autoFocus
                                    />
                                    <select
                                      className={styles.folderParentEditSelect}
                                      value={editingFolderParentId}
                                      onChange={(e) => setEditingFolderParentId(e.target.value)}
                                    >
                                      <option value="">— Induk (Root) —</option>
                                      {folders.filter(f => !f.parentId && f.id !== subfolder.id).map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                      ))}
                                    </select>
                                    <div className={styles.editRowBtns}>
                                      <button
                                        className={styles.editSaveBtn}
                                        onClick={() => handleRenameFolder(subfolder.id, editingFolderName, editingFolderParentId || null)}
                                      >
                                        Simpan
                                      </button>
                                      <button
                                        className={styles.editCancelBtn}
                                        onClick={() => setEditingFolderId(null)}
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      className={styles.folderItemBtn}
                                      onClick={() => setSelectedFolderId(subfolder.id)}
                                    >
                                      <FolderIcon size={14} />
                                      <span className={styles.folderNameText}>{subfolder.name}</span>
                                    </button>
                                    <div className={styles.folderActions}>
                                      <button
                                        title="Ubah"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingFolderId(subfolder.id);
                                          setEditingFolderName(subfolder.name);
                                          setEditingFolderParentId(subfolder.parentId || '');
                                        }}
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                      <button
                                        title="Hapus"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteFolder(subfolder.id);
                                        }}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className={styles.addFolderWrapper}>
                  <div className={styles.addFolderContainer}>
                    <input
                      type="text"
                      placeholder="Folder Baru..."
                      className={styles.addFolderInput}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const select = document.getElementById('add-folder-parent-select') as HTMLSelectElement;
                          handleCreateFolder(newFolderName, select?.value || null);
                          setNewFolderName('');
                          if (select) select.value = '';
                        }
                      }}
                    />
                    <button
                      className={styles.addFolderBtn}
                      onClick={() => {
                        const select = document.getElementById('add-folder-parent-select') as HTMLSelectElement;
                        handleCreateFolder(newFolderName, select?.value || null);
                        setNewFolderName('');
                        if (select) select.value = '';
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <select
                    id="add-folder-parent-select"
                    className={styles.addFolderParentSelect}
                    defaultValue=""
                  >
                    <option value="">— Folder Induk (Root) —</option>
                    {folders.filter(f => !f.parentId).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* 3-Pane desktop layout logic */}
      {activeTab === 'notes' ? (
        <>
          {/* Middle Column: Notes List Column */}
          <div className={styles.notesListColumn}>
            <div className={styles.notesListHeader}>
              <div className={styles.searchBar}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Cari catatan..."
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className={styles.notesListActions}>
                <button
                  className={styles.tulisCatatanBtn}
                  onClick={handleCreateNewNote}
                >
                  <Plus size={14} />
                  Tulis
                </button>
                <button
                  className={styles.rekamAiBtn}
                  onClick={() => {
                    setSelectedNote(null);
                    setWorkspaceView('recorder');
                  }}
                >
                  <Mic size={14} />
                  Rekam
                </button>
                {filteredNotes.length > 1 && (
                  <button
                    className={styles.mergeBtn}
                    onClick={() => {
                      setWorkspaceView('merge');
                    }}
                    title="Gabungkan catatan terpilih"
                  >
                    <GitMerge size={14} />
                    Gabung
                  </button>
                )}
              </div>
            </div>

            {/* Filter Chips Bar */}
            {(selectedFolderId || selectedDate || searchQuery || timeframeFilter !== null) && (
              <div className={styles.filterChipsRow}>
                {selectedFolderId && (
                  <div className={styles.filterChip}>
                    <span>📂 {folders.find(f => f.id === selectedFolderId)?.name || 'Folder'}</span>
                    <button onClick={() => setSelectedFolderId(null)} title="Hapus Filter Folder">×</button>
                  </div>
                )}
                {timeframeFilter !== null && (
                  <div className={styles.filterChip}>
                    <span>⏱️ {timeframeFilter === 30 ? '1 Bulan' : `${timeframeFilter} Hari`}</span>
                    <button onClick={() => setTimeframeFilter(null)} title="Hapus Filter Waktu">×</button>
                  </div>
                )}
                {selectedDate && (
                  <div className={styles.filterChip}>
                    <span>📅 {getFormattedFilterDate(selectedDate)}</span>
                    <button onClick={() => setSelectedDate(null)} title="Hapus Filter Tanggal">×</button>
                  </div>
                )}
                {searchQuery && (
                  <div className={styles.filterChip}>
                    <span>🔍 "{searchQuery.slice(0, 10)}{searchQuery.length > 10 ? '...' : ''}"</span>
                    <button onClick={() => setSearchQuery('')} title="Hapus Filter Pencarian">×</button>
                  </div>
                )}
              </div>
            )}


            {/* Folder AI Summary Card */}
            {folderAiSummary && (
              <div className={`${styles.folderAiSummaryCard} glass-panel`}>
                <div className={styles.folderAiSummaryHeader}>
                  <div className={styles.folderAiSummaryTitle}>
                    <Sparkles size={14} className="text-amber-400 animate-pulse" style={{ color: '#fbbf24' }} />
                    <span>Rangkuman AI Folder: {folderAiSummary.folderName} ({folderAiSummary.timeframeText})</span>
                  </div>
                  <button type="button" onClick={() => setFolderAiSummary(null)} className={styles.closeFolderSummaryBtn}>
                    <X size={12} />
                  </button>
                </div>
                <p className={styles.folderAiSummaryBody}>{folderAiSummary.summaryText}</p>
                <div className={styles.folderAiSummaryFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <span>Mengidentifikasi {folderAiSummary.notesCount} catatan</span>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceView('merge');
                    }}
                    style={{
                      background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
                      border: 'none',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: 'var(--border-radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <GitMerge size={12} />
                    Gabungkan
                  </button>
                </div>
              </div>
            )}

            {/* Grouped Notes List */}
            <div className={styles.notesListBody}>
              {isLoadingNotes ? (
                <div className={styles.loadingState}>
                  Memuat catatan...
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className={styles.emptyState}>
                  Tidak ada catatan.
                </div>
              ) : (
                (() => {
                  const grouped = getGroupedNotes(filteredNotes);
                  return Object.entries(grouped).map(([groupName, groupNotes]) => {
                    if (groupNotes.length === 0) return null;
                    return (
                      <div key={groupName} className={styles.noteGroup}>
                        <h4 className={styles.groupHeader}>{groupName}</h4>
                        <div className={styles.groupList}>
                          {groupNotes.map((note) => {
                            // Count todos progress
                            let totalTodos = 0;
                            let completedTodos = 0;
                            if (note.todo_list && Array.isArray(note.todo_list)) {
                              totalTodos = note.todo_list.length;
                              completedTodos = note.todo_list.filter((t: any) => typeof t === 'object' ? t.completed : false).length;
                            }

                            // Check note type
                            const isVoiceNote = !!note.summary && (note.tags?.some(tag => tag.toLowerCase().includes('voice') || tag.toLowerCase().includes('suara')) || note.content.toLowerCase().includes('transkrip'));
                            const isNewsNote = note.tags?.some(tag => tag.toLowerCase().includes('berita') || tag.toLowerCase().includes('news'));

                            return (
                              <button
                                key={note.id}
                                className={`${styles.noteCard} ${selectedNote?.id === note.id ? styles.activeNoteCard : ''}`}
                                onClick={() => {
                                  setSelectedNote(note);
                                  setWorkspaceView('editor');
                                }}
                              >
                                <div className={styles.noteCardHeader}>
                                  <span className={styles.noteCardTitle}>{note.title || 'Catatan Tanpa Judul'}</span>
                                  <span className={styles.noteCardDate}>
                                    {formatDateShort(note.created_at)}
                                  </span>
                                </div>

                                {note.summary && (
                                  <div className={styles.noteCardSummary}>
                                    {note.summary}
                                  </div>
                                )}

                                <div className={styles.noteCardFooter}>
                                  <div className={styles.noteCardMeta}>
                                    {isNewsNote ? (
                                      <span className={styles.sourceIndicator} title="Sumber Berita">
                                        <Newspaper size={12} style={{ color: 'var(--accent)' }} />
                                      </span>
                                    ) : isVoiceNote ? (
                                      <span className={styles.sourceIndicator} title="Sumber Suara">
                                        <Mic size={12} style={{ color: 'var(--secondary)' }} />
                                      </span>
                                    ) : (
                                      <span className={styles.sourceIndicator} title="Manual">
                                        <FileText size={12} style={{ color: 'var(--text-dark)' }} />
                                      </span>
                                    )}

                                    {note.folder_id && folders.find(f => f.id === note.folder_id) && (
                                      <span className={styles.folderBadgeSmall}>
                                        📂 {folders.find(f => f.id === note.folder_id)?.name}
                                      </span>
                                    )}

                                    {note.tags?.slice(0, 1).map((tag, idx) => {
                                      const t = tag.toLowerCase();
                                      let tagClass = 'default';
                                      if (t.includes('rapat') || t.includes('meet')) tagClass = 'rapat';
                                      else if (t.includes('ide') || t.includes('kreatif') || t.includes('concept')) tagClass = 'ide';
                                      else if (t.includes('tugas') || t.includes('todo') || t.includes('kerja')) tagClass = 'tugas';
                                      else if (t.includes('uang') || t.includes('keuangan') || t.includes('finansial')) tagClass = 'keuangan';
                                      else if (t.includes('pribadi') || t.includes('personal')) tagClass = 'pribadi';

                                      return (
                                        <span key={idx} className={`tag-badge ${tagClass}`} style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
                                          {tag}
                                        </span>
                                      );
                                    })}
                                  </div>

                                  {totalTodos > 0 && (
                                    <div className={styles.todoProgressIndicator} title="Progress Tugas">
                                      <CheckSquare size={11} />
                                      <span>
                                        {completedTodos}/{totalTodos}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>

          {/* Right Column: Workspace Column */}
          <div className={styles.workspace}>
            {workspaceView === 'recorder' ? (
              <div className={styles.workspaceRecorderWrapper}>
                <div className={styles.workspaceRecorderHeader}>
                  <button
                    className={styles.closeRecorderBtn}
                    onClick={() => {
                      setWorkspaceView('editor');
                      // Load back first note if selectedNote is null
                      if (!selectedNote && notes.length > 0) {
                        setSelectedNote(notes[0]);
                      }
                    }}
                  >
                    ← Kembali ke Catatan
                  </button>
                </div>
                <VoiceRecorder
                  folders={folders}
                  initialCheckedFolderIds={assistantSelectedFolderIds}
                  onFormatted={handleFormattedNote}
                  autoStart={autoStartRecorder}
                  onAutoStartTriggered={() => setAutoStartRecorder(false)}
                />
              </div>
            ) : workspaceView === 'merge' ? (
              <InteractiveMerge
                filteredNotes={filteredNotes}
                folders={folders}
                currentFolderId={selectedFolderId}
                currentTimeframe={timeframeFilter}
                onCancel={() => {
                  setWorkspaceView('editor');
                  if (!selectedNote && notes.length > 0) {
                    setSelectedNote(notes[0]);
                  }
                }}
                onSelectNote={(note) => {
                  setSelectedNote(note);
                  setWorkspaceView('editor');
                }}
              />
            ) : selectedNote ? (
              <NoteEditor
                note={selectedNote}
                onSave={handleSaveNote}
                onDelete={handleDeleteNote}
                folders={folders}
                onToggleRecorder={() => setWorkspaceView('recorder')}
                onCreateFolder={handleCreateFolder}
                onCopy={handleCopyNote}
                onMove={handleMoveNote}
              />
            ) : (
              <div className={styles.welcomeState}>
                <FileText size={64} style={{ color: 'var(--text-dark)' }} />
                <h3>Selamat Datang di Catatan Pintar</h3>
                <p>Pilih catatan dari daftar di tengah untuk mengedit, atau rekam suara baru menggunakan kecerdasan AI.</p>
                <div className={styles.welcomeActions}>
                  <button className={styles.welcomeTulisBtn} onClick={handleCreateNewNote}>
                    📝 Tulis Catatan Baru
                  </button>
                  <button className={styles.welcomeRekamBtn} onClick={() => setWorkspaceView('recorder')}>
                    🎙️ Input Suara AI
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'calendar' ? (
        <div className={styles.calendarDashboardGrid}>
          {/* Left: Monthly Calendar Widget */}
          <div className={styles.calendarDashboardLeft}>
            <div className={styles.calendarDashboardHeader}>
              <h3>Kalender Harian</h3>
              <p>Pilih tanggal pada kalender di bawah untuk melihat atau membuat catatan khusus hari tersebut.</p>
            </div>
            <div className={styles.calendarDashboardWidget}>
              <Calendar
                notes={notes}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          </div>
          {/* Right: Notes List for Selected Date */}
          <div className={styles.calendarDashboardRight}>
            <div className={styles.calendarNotesHeader}>
              <span>Catatan pada Tanggal:</span>
              <span className={styles.calendarNotesDateStr}>
                {selectedDate ? getFormattedFilterDate(selectedDate) : 'Pilih Tanggal'}
              </span>
            </div>
            <div className={styles.calendarNotesBody}>
              {filteredNotes.length === 0 ? (
                <div className={styles.emptyState}>
                  <CalendarIcon size={48} style={{ color: 'var(--text-dark)', opacity: 0.5, marginBottom: '8px' }} />
                  <p>Tidak ada catatan untuk tanggal ini.</p>
                  <GlowButton
                    variant="primary"
                    onClick={handleCreateNewNote}
                    style={{ marginTop: '12px', fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    📝 Tulis Catatan Baru
                  </GlowButton>
                </div>
              ) : (
                <div className={styles.calendarNotesScrollList}>
                  {filteredNotes.map((note) => {
                    const isVoiceNote = !!note.summary && (note.tags?.some(tag => tag.toLowerCase().includes('voice') || tag.toLowerCase().includes('suara')) || note.content.toLowerCase().includes('transkrip'));
                    const isNewsNote = note.tags?.some(tag => tag.toLowerCase().includes('berita') || tag.toLowerCase().includes('news'));

                    return (
                      <div key={note.id} className={styles.calendarNoteItem}>
                        <button
                          type="button"
                          className={styles.calendarNoteSelectBtn}
                          onClick={() => {
                            setSelectedNote(note);
                            setActiveTab('notes');
                            setWorkspaceView('editor');
                          }}
                        >
                          <div className={styles.calendarNoteTitleArea}>
                            <span className={styles.calendarNoteTitle}>{note.title || 'Catatan Tanpa Judul'}</span>
                            {isNewsNote ? (
                              <Newspaper size={12} style={{ color: 'var(--accent)' }} />
                            ) : isVoiceNote ? (
                              <Mic size={12} style={{ color: 'var(--secondary)' }} />
                            ) : (
                              <FileText size={12} style={{ color: 'var(--text-dark)' }} />
                            )}
                          </div>
                          {note.summary && <div className={styles.calendarNoteSummary}>{note.summary}</div>}
                          <div className={styles.calendarNoteMeta}>
                            {note.folder_id && folders.find(f => f.id === note.folder_id) && (
                              <span className={styles.folderBadgeSmall}>
                                📂 {folders.find(f => f.id === note.folder_id)?.name}
                              </span>
                            )}
                            {note.tags?.slice(0, 1).map((tag, idx) => (
                              <span key={idx} className={`tag-badge default`} style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'news' ? (
        <div className={styles.fullWidthNewsArea}>
          <NewsSection onCreateNoteFromNews={handleCreateNoteFromNews} />
        </div>
      ) : activeTab === 'reminders' ? (
        <div className={styles.fullWidthNewsArea}>
          {renderRemindersTab()}
        </div>
      ) : activeTab === 'chat' ? (
        <div className={styles.fullWidthChatArea}>
          {renderAdminChatRoom()}
        </div>
      ) : activeTab === 'reservations' ? (
        <div className={styles.fullWidthNewsArea}>
          {renderAdminReservations()}
        </div>
      ) : (
        <div className={styles.fullWidthNewsArea}>
          <WhatsappChat
            pendingWhatsApp={pendingWhatsApp}
            clearPendingWhatsApp={() => setPendingWhatsApp(null)}
          />
        </div>
      )}

      {/* Folder Selection Modal */}
      {isFolderModalOpen && pendingNoteData && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-panel`}>
            <h3>Simpan Catatan ke Folder</h3>
            <p>Silakan pilih folder penyimpanan untuk catatan cerdas baru Anda:</p>

            <div className={styles.modalForm}>
              <select
                className={styles.folderSelectDropdown}
                id="folder-select"
                defaultValue={selectedFolderId || ""}
              >
                <option value="">Tanpa Folder (Umum)</option>
                {getSortedFolderTree(folders).map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.depth > 0 ? `↳ ${folder.name}` : folder.name}
                  </option>
                ))}
              </select>

              <div className={styles.modalInlineAddFolder}>
                <input
                  type="text"
                  placeholder="Atau buat folder baru..."
                  id="new-folder-inline-input"
                  className={styles.modalFolderInput}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const input = e.currentTarget;
                      const name = input.value.trim();
                      if (name) {
                        const newF = await handleCreateFolder(name);
                        if (newF) {
                          const select = document.getElementById('folder-select') as HTMLSelectElement;
                          if (select) {
                            setTimeout(() => {
                              select.value = newF.id;
                            }, 50);
                          }
                          input.value = '';
                        }
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.modalFolderBtn}
                  onClick={async () => {
                    const input = document.getElementById('new-folder-inline-input') as HTMLInputElement;
                    const name = input?.value.trim();
                    if (name) {
                      const newF = await handleCreateFolder(name);
                      if (newF) {
                        const select = document.getElementById('folder-select') as HTMLSelectElement;
                        if (select) {
                          setTimeout(() => {
                            select.value = newF.id;
                          }, 50);
                        }
                        input.value = '';
                      }
                    }
                  }}
                >
                  Buat
                </button>
              </div>
            </div>

            <div className={styles.modalActions}>
              <GlowButton
                variant="outline"
                onClick={() => {
                  setIsFolderModalOpen(false);
                  setPendingNoteData(null);
                }}
              >
                Batal
              </GlowButton>
              <GlowButton
                variant="primary"
                onClick={() => {
                  const select = document.getElementById('folder-select') as HTMLSelectElement;
                  saveNoteWithFolder(select?.value || null);
                }}
              >
                Simpan Catatan
              </GlowButton>
            </div>
          </div>
        </div>
      )}
      <VoiceAssistant selectedNote={selectedNote} />

      {confirmDialog.isOpen && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>{confirmDialog.title}</h3>
            <p className={styles.confirmMessage}>{confirmDialog.message}</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelBtn}
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.confirmConfirmBtn}
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {adminActiveContextMenu && (
        <div
          className={styles.contextMenuOverlay}
          onClick={() => setAdminActiveContextMenu(null)}
          onTouchStart={() => setAdminActiveContextMenu(null)}
        >
          <div
            className={`${styles.contextMenu} glass-panel`}
            style={{
              top: `${Math.min(adminActiveContextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 80 : 300)}px`,
              left: `${Math.min(adminActiveContextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 150 : 150)}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.contextMenuItem}
              onClick={() => {
                handleAdminCopyMessage(adminActiveContextMenu.messageId, adminActiveContextMenu.text);
                setAdminActiveContextMenu(null);
              }}
            >
              <Copy size={14} style={{ marginRight: '8px' }} />
              <span>Salin Teks</span>
            </button>
          </div>
        </div>
      )}

      {editingReservation && (
        <div className={styles.modalOverlay} onClick={() => setEditingReservation(null)}>
          <div className={`${styles.modalContent} glass-panel`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>Edit Reservasi</h3>
              <button
                type="button"
                onClick={() => setEditingReservation(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className={styles.modalForm}>
              <div className={styles.custInputGroup}>
                <label htmlFor="edit-res-name">Nama Pelanggan</label>
                <input
                  id="edit-res-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className={styles.custInputRow}>
                <div className={styles.custInputGroup} style={{ flex: 1 }}>
                  <label htmlFor="edit-res-datetime">Tanggal & Waktu</label>
                  <input
                    id="edit-res-datetime"
                    type="datetime-local"
                    required
                    value={editDateTime}
                    onChange={(e) => setEditDateTime(e.target.value)}
                  />
                </div>

                <div className={styles.custInputGroup} style={{ width: '120px' }}>
                  <label htmlFor="edit-res-size">Orang</label>
                  <input
                    id="edit-res-size"
                    type="number"
                    min="1"
                    required
                    value={editSize}
                    onChange={(e) => setEditSize(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className={styles.custInputRow}>
                <div className={styles.custInputGroup} style={{ flex: 1 }}>
                  <label htmlFor="edit-res-table">Tempat / Meja</label>
                  <input
                    id="edit-res-table"
                    type="text"
                    required
                    value={editTable}
                    onChange={(e) => setEditTable(e.target.value)}
                  />
                </div>

                <div className={styles.custInputGroup} style={{ flex: 1 }}>
                  <label htmlFor="edit-res-dp">DP (Rp)</label>
                  <input
                    id="edit-res-dp"
                    type="text"
                    value={editDp}
                    onChange={(e) => {
                      const cleanValue = e.target.value.replace(/\D/g, '');
                      if (!cleanValue) {
                        setEditDp('');
                      } else {
                        setEditDp(parseInt(cleanValue).toLocaleString('id-ID'));
                      }
                    }}
                  />
                </div>
              </div>

              <div className={styles.custInputGroup}>
                <label htmlFor="edit-res-status">Status</label>
                <select
                  id="edit-res-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="pending">Menunggu</option>
                  <option value="confirmed">Dikonfirmasi</option>
                  <option value="cancelled">Dibatalkan</option>
                  <option value="completed">Selesai</option>
                </select>
              </div>

              <div className={styles.custInputGroup}>
                <label htmlFor="edit-res-menu">Daftar Menu</label>
                <textarea
                  id="edit-res-menu"
                  required
                  rows={4}
                  value={editMenu}
                  onChange={(e) => setEditMenu(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <GlowButton
                  variant="outline"
                  type="button"
                  onClick={() => setEditingReservation(null)}
                  disabled={editIsSaving}
                >
                  Batal
                </GlowButton>
                <GlowButton
                  variant="primary"
                  type="submit"
                  disabled={editIsSaving}
                >
                  {editIsSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </GlowButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {saveResultNotification && (
        <div className={styles.notificationToast}>
          <div className={styles.notificationHeader}>
            <div className={styles.notificationTitle}>
              <Sparkles size={16} style={{ color: 'var(--secondary)', marginRight: '8px' }} />
              Catatan Pintar Berhasil Dibuat
            </div>
            <button
              className={styles.notificationCloseBtn}
              onClick={() => setSaveResultNotification(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className={styles.notificationBody}>
            <p className={styles.notificationSubtitle}>
              Catatan hasil rekaman Anda telah dianalisis dan dikelompokkan ke folder yang sesuai:
            </p>
            <div className={styles.notificationList}>
              {saveResultNotification.notes.map((n, idx) => (
                <div key={idx} className={styles.notificationItem}>
                  <span className={styles.notificationNoteTitle} title={n.title}>📝 {n.title}</span>
                  <span className={styles.notificationFolderBadge}>📁 {n.folderName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeContentWrapper() {
  const [mounted, setMounted] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const isAdminParam = params.get('admin') === 'true';
    const isAssistantPath = window.location.pathname === '/assistant';
    const isAuthorized = localStorage.getItem('admin_authorized') === 'true';
    setIsAdminMode(isAdminParam || isAuthorized || isAssistantPath);
  }, []);

  if (!mounted) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAdminMode) {
    return <CustomerReservation />;
  }

  return <DashboardContent />;
}

function CustomerReservation() {
  const [resName, setResName] = useState('');
  const [resDateTime, setResDateTime] = useState('');
  const [resTable, setResTable] = useState('');
  const [resSize, setResSize] = useState(4);
  const [resDp, setResDp] = useState('');
  const [resMenu, setResMenu] = useState('');
  const [resStatus, setResStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [resError, setResError] = useState('');
  const [submittedRes, setSubmittedRes] = useState<any | null>(null);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleSubmitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setResStatus('submitting');
    setResError('');

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: resName,
          dateTime: resDateTime,
          tableInfo: resTable,
          partySize: resSize,
          dpAmount: parseFloat(resDp.replace(/\./g, '')) || 0,
          menuList: resMenu,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResStatus('success');
        setSubmittedRes(data);
        setResName('');
        setResDateTime('');
        setResTable('');
        setResSize(4);
        setResDp('');
        setResMenu('');
      } else {
        setResStatus('error');
        setResError(data.error || 'Gagal mengirim reservasi.');
      }
    } catch (err) {
      setResStatus('error');
      setResError('Terjadi kesalahan jaringan.');
    }
  };

  return (
    <div className={styles.custContainer}>
      <div className={styles.custAlertBanner} onClick={() => setShowTermsModal(true)}>
        <AlertCircle size={15} className={styles.alertBannerIcon} />
        <span><strong>PENTING:</strong> Wajib H-2 & DP min. 50% untuk pesanan menu. Klik untuk Syarat & Ketentuan lengkap.</span>
        <ArrowRight size={14} className={styles.alertBannerArrow} />
      </div>

      <div className={styles.custHeader}>
        <div className={styles.custBrand}>
          <Sparkles size={24} className={styles.brandIcon} />
          <h1>Reservasi Meja Restoran</h1>
        </div>
        <p>Nikmati santapan premium bersama keluarga dan rekan Anda. Isi form di bawah untuk melakukan boking meja.</p>
      </div>

      <div className={styles.custContentGrid}>
        {/* Left Panel: Form */}
        <div className={`${styles.custFormCard} glass-panel`}>
          {resStatus === 'success' && submittedRes ? (
            <div className={styles.successSummaryCard}>
              <div className={styles.successIconWrapper}>✓</div>
              <h3>Reservasi Berhasil Diajukan!</h3>
              <p className={styles.successSubtitle}>Manajemen kami sedang meninjau reservasi Anda. Berikut ringkasan detail boking Anda:</p>

              <div className={styles.summaryDetails}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Atas Nama:</span>
                  <span className={styles.summaryValue}>{submittedRes.name}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Jadwal Booking:</span>
                  <span className={styles.summaryValue}>
                    {formatDateLong(submittedRes.dateTime) + ' ' + formatTime(submittedRes.dateTime)}
                  </span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Tempat / Meja:</span>
                  <span className={styles.summaryValue}>{submittedRes.tableInfo}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Jumlah Tamu:</span>
                  <span className={styles.summaryValue}>{submittedRes.partySize} orang</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Down Payment (DP):</span>
                  <span className={styles.summaryValue}>Rp {submittedRes.dpAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className={styles.summaryItem} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className={styles.summaryLabel}>Menu Dipesan:</span>
                  <span className={styles.summaryValue} style={{ whiteSpace: 'pre-wrap', marginTop: '4px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', width: '100%' }}>{submittedRes.menuList}</span>
                </div>
              </div>

              <div className={styles.successActions}>
                <button
                  type="button"
                  onClick={() => {
                    setResStatus('idle');
                    setSubmittedRes(null);
                  }}
                  className={styles.newResBtn}
                >
                  Buat Reservasi Baru
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitReservation} className={styles.custForm}>
              <h3>Formulir Boking Meja</h3>

              {resStatus === 'error' && (
                <div className={styles.formErrorBanner}>
                  <AlertCircle size={16} />
                  <span>{resError}</span>
                </div>
              )}

              <div className={styles.custInputGroup}>
                <label htmlFor="res-name">Atas Nama Reservasi</label>
                <input
                  id="res-name"
                  type="text"
                  required
                  placeholder="Nama lengkap Anda (cth: Andi)"
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                  disabled={resStatus === 'submitting'}
                />
              </div>

              <div className={styles.custInputRow}>
                <div className={styles.custInputGroup} style={{ flex: 1 }}>
                  <label htmlFor="res-datetime">Tanggal & Waktu Booking</label>
                  <input
                    id="res-datetime"
                    type="datetime-local"
                    required
                    value={resDateTime}
                    onChange={(e) => setResDateTime(e.target.value)}
                    disabled={resStatus === 'submitting'}
                  />
                </div>

                <div className={styles.custInputGroup} style={{ width: '120px' }}>
                  <label htmlFor="res-size">Jumlah Orang</label>
                  <input
                    id="res-size"
                    type="number"
                    min="4"
                    required
                    value={resSize}
                    onChange={(e) => setResSize(parseInt(e.target.value) || 0)}
                    disabled={resStatus === 'submitting'}
                  />
                </div>
              </div>

              <div className={styles.custInputRow}>
                <div className={styles.custInputGroup} style={{ flex: 1 }}>
                  <label htmlFor="res-table">Tempat / Area Meja</label>
                  <input
                    id="res-table"
                    type="text"
                    required
                    placeholder="Cth: Ruang VIP / Rooftop"
                    value={resTable}
                    onChange={(e) => setResTable(e.target.value)}
                    disabled={resStatus === 'submitting'}
                  />
                </div>

                <div className={styles.custInputGroup} style={{ flex: 1 }}>
                  <label htmlFor="res-dp">Nominal DP (Rp)</label>
                  <input
                    id="res-dp"
                    type="text"
                    placeholder="Cth: 150.000"
                    value={resDp}
                    onChange={(e) => {
                      const cleanValue = e.target.value.replace(/\D/g, '');
                      if (!cleanValue) {
                        setResDp('');
                      } else {
                        setResDp(parseInt(cleanValue).toLocaleString('id-ID'));
                      }
                    }}
                    disabled={resStatus === 'submitting'}
                  />
                  <small style={{ color: 'var(--text-dark)', fontSize: '0.7rem' }}>Min. 50% jika menyertakan list menu</small>
                </div>
              </div>

              <div className={styles.custInputGroup}>
                <label htmlFor="res-menu">Daftar Menu Makanan & Minuman</label>
                <textarea
                  id="res-menu"
                  required
                  rows={4}
                  placeholder="Sebutkan menu yang ingin dipesan (cth: 3x Nasi Goreng, 2x Es Teh, 2x Ayam Bakar)"
                  value={resMenu}
                  onChange={(e) => setResMenu(e.target.value)}
                  disabled={resStatus === 'submitting'}
                />
              </div>

              <div className={styles.custCheckboxGroup}>
                <input
                  id="res-agree"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                />
                <label htmlFor="res-agree">
                  Saya menyetujui <span className={styles.termsLink} onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}>Syarat & Ketentuan</span> Reservasi
                </label>
              </div>

              <button
                type="submit"
                className={styles.custSubmitBtn}
                disabled={resStatus === 'submitting' || !agreeTerms}
              >
                {resStatus === 'submitting' ? 'Sedang Mengirim...' : 'Kirim Reservasi'}
              </button>
            </form>
          )}
        </div>

        {/* Right Panel: Terms and Conditions */}
        <div className={`${styles.custTermsCard} glass-panel`}>
          <h3>Syarat & Ketentuan Reservasi</h3>
          <ul className={styles.termsList}>
            <li>
              <span className={styles.termNumber}>1</span>
              <p>Sarat Reservasi minimal H - 2 hal ini agar ada upaya dari kami untuk mempersiapkanya.</p>
            </li>
            <li>
              <span className={styles.termNumber}>2</span>
              <p>Reserv minimal 4 orang apabila sudah disertakan menyerahkan List menu maka wajib DP minimal 50℅ dari total pembelian apabila H- 2 blum DP maka diputuskan sepihak dari manajemen bahwa reservasi dianggap batal.</p>
            </li>
            <li>
              <span className={styles.termNumber}>3</span>
              <p>H - 2 wajib confirm ulang untuk mengingatkan kami, mengingat kami bnyk mengakomodir customer dikawatirkan ada yg miscom, apabila hal ini tdk dilakukan maka apabila ada human error kami tdk bisa bertanggung jawab penuh atas dampak kesalahan yg terjadi.</p>
            </li>
            <li>
              <span className={styles.termNumber}>4</span>
              <p>DP akan hilang apabila reserv dibatalkan oleh pihak customer.</p>
            </li>
            <li>
              <span className={styles.termNumber}>5</span>
              <p>Untuk keterlambatan maximal 15 menit.</p>
            </li>
            <li>
              <span className={styles.termNumber}>6</span>
              <p>Untuk ruang VIP ada charge ruangan per 2 jam nya Rp. 25rb dan tdk diperkenankan merokok di dalam ruangan jg tdk diperkenankan menggunakan alas kaki.</p>
            </li>
            <li>
              <span className={styles.termNumber}>7</span>
              <p>Untuk kesepakatan terkait tempat sudah di bicarakan terhadap kedua belah pihak.</p>
            </li>
          </ul>
        </div>
      </div>

      {showTermsModal && (
        <div className={styles.termsModalOverlay} onClick={() => setShowTermsModal(false)}>
          <div className={`${styles.termsModalContent} glass-panel`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.termsModalHeader}>
              <h3>Syarat & Ketentuan Reservasi</h3>
              <button type="button" className={styles.termsModalClose} onClick={() => setShowTermsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.termsModalBody}>
              <ul className={styles.termsList}>
                <li>
                  <span className={styles.termNumber}>1</span>
                  <p>Sarat Reservasi minimal H - 2 hal ini agar ada upaya dari kami untuk mempersiapkanya.</p>
                </li>
                <li>
                  <span className={styles.termNumber}>2</span>
                  <p>Reserv minimal 4 orang apabila sudah disertakan menyerahkan List menu maka wajib DP minimal 50℅ dari total pembelian apabila H- 2 blum DP maka diputuskan sepihak dari manajemen bahwa reservasi dianggap batal.</p>
                </li>
                <li>
                  <span className={styles.termNumber}>3</span>
                  <p>H - 2 wajib confirm ulang untuk mengingatkan kami, mengingat kami bnyk mengakomodir customer dikawatirkan ada yg miscom, apabila hal ini tdk dilakukan maka apabila ada human error kami tdk bisa bertanggung jawab penuh atas dampak kesalahan yg terjadi.</p>
                </li>
                <li>
                  <span className={styles.termNumber}>4</span>
                  <p>DP akan hilang apabila reserv dibatalkan oleh pihak customer.</p>
                </li>
                <li>
                  <span className={styles.termNumber}>5</span>
                  <p>Untuk keterlambatan maximal 15 menit.</p>
                </li>
                <li>
                  <span className={styles.termNumber}>6</span>
                  <p>Untuk ruang VIP ada charge ruangan per 2 jam nya Rp. 25rb dan tdk diperkenankan merokok di dalam ruangan jg tdk diperkenankan menggunakan alas kaki.</p>
                </li>
                <li>
                  <span className={styles.termNumber}>7</span>
                  <p>Untuk kesepakatan terkait tempat sudah di bicarakan terhadap kedua belah pihak.</p>
                </li>
              </ul>
            </div>
            <div className={styles.termsModalFooter}>
              <button
                type="button"
                className={styles.termsModalAgreeBtn}
                onClick={() => {
                  setAgreeTerms(true);
                  setShowTermsModal(false);
                }}
              >
                Saya Mengerti & Setuju
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const compressImageToBlob = (file: File, maxWidth = 600, maxHeight = 600, quality = 0.45): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', quality);
      } catch (e) {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
  });
};

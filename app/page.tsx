"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FileText, Newspaper, Search, Plus, Sparkles, Mic, Trash2, Calendar as CalendarIcon, Folder as FolderIcon, Edit3, CheckSquare, MessageSquare, X, Bell, Clock, GitMerge } from 'lucide-react';
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
  created_at: string;
}


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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'notes' | 'news' | 'whatsapp' | 'calendar' | 'recorder' | 'reminders'>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<NotificationPermission>('default');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [opt1Day, setOpt1Day] = useState(true);
  const [opt1Hour, setOpt1Hour] = useState(true);
  const [optExact, setOptExact] = useState(true);
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

  const [pendingNoteData, setPendingNoteData] = useState<any | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
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
    onConfirm: () => {},
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
    notifyExact?: boolean
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
          notifyExact: notifyExact !== undefined ? notifyExact : true
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
  const handleCreateFolder = async (name: string) => {
    if (!name || name.trim() === '') return null;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
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
  const handleRenameFolder = async (id: string, name: string) => {
    if (!name || name.trim() === '') return;
    try {
      const res = await fetch('/api/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
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
    loadNotes();
    loadFolders();
    loadReminders();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermissionStatus(Notification.permission);
      
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.pushManager.getSubscription().then((subscription) => {
            setIsPushSubscribed(!!subscription);
          });
        });
      }
    }
  }, []);

  // Background cron executor (polls /api/cron to run pending jobs)
  useEffect(() => {
    // Run initial check
    fetch('/api/cron').catch(console.error);

    const interval = setInterval(() => {
      fetch('/api/cron')
        .then(res => res.json())
        .then(data => {
          if (data.results && data.results.length > 0) {
            console.log('Cron completed some jobs:', data);
            loadNotes();
          }
        })
        .catch(console.error);
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle actions sent from Voice Assistant
  useEffect(() => {
    const handleAssistantAction = async (e: Event) => {
      const { action, payload } = (e as CustomEvent).detail;
      console.log('Assistant Action received:', action, payload);

      if (action === 'SHOW_NEWS') {
        setActiveTab('news');
      } else if (action === 'CREATE_REMINDER') {
        try {
          const res = await fetch('/api/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: payload.title || 'Pengingat Suara',
              description: payload.description || 'Dibuat via Asisten Suara.',
              dateTime: payload.dateTime,
              notify1Day: payload.notify1Day,
              notify1Hour: payload.notify1Hour,
              notifyExact: payload.notifyExact
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
        // Automatically create note from Assistant payload
        try {
          const parsedTodos = payload.todo_list ? payload.todo_list.map((task: string) => ({
            text: task,
            completed: false,
          })) : [];

          const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: payload.title || 'Catatan Baru',
              content: payload.content || '',
              summary: payload.summary || 'Dibuat melalui Asisten Suara.',
              tags: payload.tags || ['Asisten Suara', 'AI'],
              todo_list: parsedTodos
            })
          });
          if (res.ok) {
            const data = await res.json();
            setNotes(prev => [data, ...prev]);
            setSelectedNote(data);
            setActiveTab('notes');
            setWorkspaceView('editor');
            if (window.innerWidth <= 768) {
              setMobileView('editor');
            }
          }
        } catch (err) {
          console.error('Failed to create note via assistant:', err);
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
      if (note.folder_id !== selectedFolderId) return false;
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
  const handleFormattedNote = async (formattedData: {
    notes?: Array<{
      title: string;
      content: string;
      summary: string;
      tags: string[];
      todo_list: string[];
      folderId: string | null;
      folderName: string | null;
    }>;
  }) => {
    if (!formattedData.notes || !Array.isArray(formattedData.notes)) return;
    
    try {
      const savedNotesList: any[] = [];
      let lastSavedNote: any = null;
      const localFolders = [...folders];
      const notificationNotes: Array<{ title: string; folderName: string }> = [];

      for (const note of formattedData.notes) {
        let folderId = note.folderId;
        let finalFolderName = note.folderName || 'Tanpa Folder';
        
        // Resolve folderId if folderName is suggested but folderId is null
        if (!folderId && note.folderName) {
          const existingFolder = localFolders.find(
            (f) => f.name.toLowerCase() === note.folderName!.toLowerCase()
          );
          if (existingFolder) {
            folderId = existingFolder.id;
            finalFolderName = existingFolder.name;
          } else {
            const newFolder = await handleCreateFolder(note.folderName);
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
        optExact
      );

      if (success) {
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
            <p className={styles.remindersSub}>Atur pengingat suara Anda melalui Asisten AI atau buat secara manual di bawah.</p>
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
                      } catch (err) {}
                    }}
                    onFocus={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (err) {}
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
                      } catch (err) {}
                    }}
                    onFocus={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (err) {}
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
                </div>
              </div>

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
      </div>
    );
  };

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
          {activeTab === 'notes' && mobileView === 'list' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {filteredNotes.length > 1 && (
                <button
                  onClick={() => {
                    setWorkspaceView('merge');
                    setMobileView('editor');
                  }}
                  title="Gabungkan Catatan"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <GitMerge size={18} />
                </button>
              )}
              <button className={styles.mobileNewNoteBtn} onClick={handleCreateNewNote}>
                <Plus size={18} />
              </button>
            </div>
          )}
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

                {/* Horizontal Folder Category Pills */}
                <div className={styles.mobileFolderScrollContainer}>
                  <button
                    type="button"
                    className={`${styles.mobileFolderChip} ${selectedFolderId === null ? styles.mobileFolderChipActive : ''}`}
                    onClick={() => setSelectedFolderId(null)}
                  >
                    📂 Semua
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className={`${styles.mobileFolderChip} ${selectedFolderId === folder.id ? styles.mobileFolderChipActive : ''}`}
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      📁 {folder.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.mobileFolderChip} ${styles.mobileFolderChipManage}`}
                    onClick={() => setIsMobileFoldersOpen(true)}
                    title="Kelola Folder"
                  >
                    ⚙️ Kelola
                  </button>
                </div>

                {/* Mobile Folder Timeframe Filter Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '14px 4px 4px 4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  <span>⏱️ Rentang Waktu:</span>
                </div>
                <div className={styles.mobileTimeframeFilterRow}>
                  <button
                    type="button"
                    className={`${styles.mobileTimeframeChip} ${timeframeFilter === null ? styles.mobileTimeframeChipActive : ''}`}
                    onClick={() => setTimeframeFilter(null)}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    className={`${styles.mobileTimeframeChip} ${timeframeFilter === 1 ? styles.mobileTimeframeChipActive : ''}`}
                    onClick={() => setTimeframeFilter(1)}
                  >
                    1 Hari
                  </button>
                  <button
                    type="button"
                    className={`${styles.mobileTimeframeChip} ${timeframeFilter === 3 ? styles.mobileTimeframeChipActive : ''}`}
                    onClick={() => setTimeframeFilter(3)}
                  >
                    3 Hari
                  </button>
                  <button
                    type="button"
                    className={`${styles.mobileTimeframeChip} ${timeframeFilter === 7 ? styles.mobileTimeframeChipActive : ''}`}
                    onClick={() => setTimeframeFilter(7)}
                  >
                    7 Hari
                  </button>
                  <button
                    type="button"
                    className={`${styles.mobileTimeframeChip} ${timeframeFilter === 30 ? styles.mobileTimeframeChipActive : ''}`}
                    onClick={() => setTimeframeFilter(30)}
                  >
                    1 Bulan
                  </button>
                </div>

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
                              {folders.map((folder) => (
                                <div key={folder.id} className={styles.mobileFolderEditRow}>
                                  {editingFolderId === folder.id ? (
                                    <input
                                      type="text"
                                      className={styles.folderRenameInput}
                                      value={editingFolderName}
                                      onChange={(e) => setEditingFolderName(e.target.value)}
                                      onBlur={() => handleRenameFolder(folder.id, editingFolderName)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRenameFolder(folder.id, editingFolderName);
                                        if (e.key === 'Escape') setEditingFolderId(null);
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={styles.folderNameText}>{folder.name}</span>
                                  )}
                                  
                                  <div className={styles.folderActions}>
                                    <button
                                      title="Ubah Nama"
                                      onClick={() => {
                                        setEditingFolderId(folder.id);
                                        setEditingFolderName(folder.name);
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
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className={styles.mobileAddFolderForm}>
                            <input
                              type="text"
                              placeholder="Nama folder baru..."
                              className={styles.addFolderInput}
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCreateFolder(newFolderName);
                                  setNewFolderName('');
                                }
                              }}
                            />
                            <button
                              className={styles.addFolderBtn}
                              onClick={() => {
                                handleCreateFolder(newFolderName);
                                setNewFolderName('');
                              }}
                            >
                              <Plus size={16} />
                            </button>
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
                                        {new Date(note.created_at).toLocaleDateString('id-ID', {
                                          day: 'numeric',
                                          month: 'short',
                                        })}
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
                  />
                )}
              </div>
            )
          )}

          {activeTab === 'recorder' && (
            <div className={styles.mobileRecorderContainer}>
              <VoiceRecorder onFormatted={handleFormattedNote} />
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
              <WhatsappChat />
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
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
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
        <div className={styles.brand}>
          <div className={styles.logo}>CATATAN PINTAR</div>
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
                
                {folders.map((folder) => (
                  <div key={folder.id} className={`${styles.folderItemContainer} ${selectedFolderId === folder.id ? styles.activeFolderItemContainer : ''}`}>
                    {editingFolderId === folder.id ? (
                      <input
                        type="text"
                        className={styles.folderRenameInput}
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onBlur={() => handleRenameFolder(folder.id, editingFolderName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameFolder(folder.id, editingFolderName);
                          if (e.key === 'Escape') setEditingFolderId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        className={styles.folderItemBtn}
                        onClick={() => setSelectedFolderId(folder.id)}
                      >
                        <FolderIcon size={14} />
                        <span className={styles.folderNameText}>{folder.name}</span>
                      </button>
                    )}
                    <div className={styles.folderActions}>
                      <button
                        title="Ubah Nama"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolderId(folder.id);
                          setEditingFolderName(folder.name);
                        }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        title="Hapus"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                
                <div className={styles.addFolderContainer}>
                  <input
                    type="text"
                    placeholder="Folder Baru..."
                    className={styles.addFolderInput}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateFolder(newFolderName);
                        setNewFolderName('');
                      }
                    }}
                  />
                  <button
                    className={styles.addFolderBtn}
                    onClick={() => {
                      handleCreateFolder(newFolderName);
                      setNewFolderName('');
                    }}
                  >
                    <Plus size={14} />
                  </button>
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

            {/* Timeframe Filter Row */}
            <div className={styles.timeframeFilterRow}>
              <span className={styles.timeframeLabel}>Waktu:</span>
              <button
                type="button"
                className={`${styles.timeframeBtn} ${timeframeFilter === null ? styles.timeframeBtnActive : ''}`}
                onClick={() => setTimeframeFilter(null)}
              >
                Semua
              </button>
              <button
                type="button"
                className={`${styles.timeframeBtn} ${timeframeFilter === 1 ? styles.timeframeBtnActive : ''}`}
                onClick={() => setTimeframeFilter(1)}
              >
                1 Hari
              </button>
              <button
                type="button"
                className={`${styles.timeframeBtn} ${timeframeFilter === 3 ? styles.timeframeBtnActive : ''}`}
                onClick={() => setTimeframeFilter(3)}
              >
                3 Hari
              </button>
              <button
                type="button"
                className={`${styles.timeframeBtn} ${timeframeFilter === 7 ? styles.timeframeBtnActive : ''}`}
                onClick={() => setTimeframeFilter(7)}
              >
                7 Hari
              </button>
              <button
                type="button"
                className={`${styles.timeframeBtn} ${timeframeFilter === 30 ? styles.timeframeBtnActive : ''}`}
                onClick={() => setTimeframeFilter(30)}
              >
                1 Bulan
              </button>
            </div>

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
                                    {new Date(note.created_at).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
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
                <VoiceRecorder onFormatted={handleFormattedNote} />
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
      ) : (
        <div className={styles.fullWidthNewsArea}>
          <WhatsappChat />
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
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
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

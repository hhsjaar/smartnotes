"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Newspaper, Search, Plus, Sparkles, Mic, Trash2, Calendar as CalendarIcon, Folder as FolderIcon, Edit3, CheckSquare, MessageSquare, X, Bell, Clock, GitMerge, Lock, Tag, Users, LogOut, ArrowRight, Send, AlertCircle, Filter, Pencil } from 'lucide-react';
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

export default function Home() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    }>
      <link rel="manifest" href="/manifest.json" />
      <HomeContentWrapper />
    </Suspense>
  );
}

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<'notes' | 'news' | 'whatsapp' | 'calendar' | 'recorder' | 'reminders' | 'chat' | 'reservations'>('notes');
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
  const [editingChatMessage, setEditingChatMessage] = useState<any | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSubmitting, setChatSubmitting] = useState(false);
  const [newAttributeInput, setNewAttributeInput] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatPollingRef = useRef<NodeJS.Timeout | null>(null);

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
    try {
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => {
          if (prev.length === data.length && (prev.length === 0 || prev[prev.length - 1].id === data[data.length - 1].id)) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      if (!isSilent) setChatLoading(false);
    }
  };

  const loadChatAttributes = async () => {
    try {
      const res = await fetch('/api/chat/attributes');
      if (res.ok) {
        const data = await res.json();
        setChatAttributes(data);
        const hasUmum = data.some((a: any) => a.name === 'Umum');
        setSelectedChatAttribute(hasUmum ? 'Umum' : (data[0]?.name || ''));
      }
    } catch (err) {
      console.error('Failed to load chat attributes:', err);
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

  const handleSendAdminChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMessage.trim() || chatSubmitting) return;
    setChatSubmitting(true);
    try {
      const isEditing = !!editingChatMessage;
      const url = '/api/chat';
      const method = isEditing ? 'PUT' : 'POST';
      const bodyPayload = isEditing
        ? {
            id: editingChatMessage.id,
            message: newChatMessage.trim(),
            attribute: selectedChatAttribute || null,
            senderName: 'Admin',
            senderRole: 'admin'
          }
        : {
            senderName: 'Admin',
            senderRole: 'admin',
            message: newChatMessage.trim(),
            attribute: selectedChatAttribute || null,
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
      } else {
        const errorData = await res.json();
        alert(errorData.error || `Gagal ${isEditing ? 'mengedit' : 'mengirim'} pesan`);
      }
    } catch (err) {
      alert('Terjadi kesalahan saat memproses pesan');
    } finally {
      setChatSubmitting(false);
    }
  };

  const handleAddChatAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttributeInput.trim()) return;
    try {
      const res = await fetch('/api/chat/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAttributeInput.trim() }),
      });
      if (res.ok) {
        const newAttr = await res.json();
        setChatAttributes(prev => [...prev, newAttr].sort((a, b) => a.name.localeCompare(b.name)));
        setNewAttributeInput('');
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
      const auth = localStorage.getItem('admin_authorized') === 'true';
      
      if (auth) {
        setIsAdminAuthorized(true);
        setAuthChecking(false);
      } else if (isAdminParam) {
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
            registration.pushManager.getSubscription().then((subscription) => {
              setIsPushSubscribed(!!subscription);
            });
          });
        }
      }
    }
  }, [isAdminAuthorized]);

  // Polling for Chat Messages when tab is active and authorized
  useEffect(() => {
    if (isAdminAuthorized && activeTab === 'chat') {
      loadChatMessages();
      loadChatAttributes();

      chatPollingRef.current = setInterval(() => {
        loadChatMessages(true);
      }, 2000);

      return () => {
        if (chatPollingRef.current) {
          clearInterval(chatPollingRef.current);
        }
      };
    }
  }, [isAdminAuthorized, activeTab]);

  // Scroll chat messages to bottom on new messages
  useEffect(() => {
    if (activeTab === 'chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);


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
                  <input
                    id="wa-reminder-number"
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={waReminderNumber}
                    onChange={(e) => setWaReminderNumber(e.target.value)}
                    required={enableWaReminder}
                  />
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
                  
                  <button
                    type="button"
                    className={styles.mobileFolderChip}
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
                    ➕ Baru
                  </button>
                  <button
                    type="button"
                    className={`${styles.mobileFolderChip} ${styles.mobileFolderChipManage}`}
                    onClick={() => setIsMobileFoldersOpen(true)}
                    title="Kelola Folder"
                  >
                    ⚙️ Kelola
                  </button>
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
                                        style={{ fontSize: '0.75rem', padding: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px' }}
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
                              style={{ width: '100%', fontSize: '0.75rem', padding: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px' }}
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
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
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
                        transition: 'all 0.2s'
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
                        const date = new Date(res.dateTime);
                        const formattedDate = date.toLocaleDateString('id-ID', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

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
                              <div style={{ fontSize: '0.8rem' }}>
                                <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Menu Pesanan:</span>
                                <p style={{ margin: '2px 0 0 0', color: '#94a3b8', lineHeight: '1.4' }}>{res.menuList}</p>
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
    const filteredChatMessages = chatFilterAttribute === 'Semua'
      ? chatMessages
      : chatMessages.filter((msg: any) => msg.attribute === chatFilterAttribute);

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
                  <p>Koordinasi real-time antara admin dan seluruh karyawan FnB</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => {
                    fetchAdminReservations();
                    setShowReservationsModalAdmin(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                  title="Daftar Reservasi"
                >
                  <CalendarIcon size={14} />
                  <span className={styles.adminChatResBtnText}>Reservasi</span>
                </button>
                <button onClick={handleAdminLogout} className={styles.adminLogoutBtn}>
                  <LogOut size={16} style={{ marginRight: '6px' }} />
                  <span>Keluar Admin</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterContainer}>
              <span className={styles.filterLabel}>
                <Filter size={12} style={{ marginRight: '4px' }} /> Filter:
              </span>
              {['Semua', ...chatAttributes.map(a => a.name)].map((attrName) => {
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

            <div className={styles.adminChatArea}>
              {chatLoading && chatMessages.length === 0 ? (
                <div className={styles.chatLoader}>
                  <div className="spinner" />
                  <p>Memuat percakapan...</p>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className={styles.chatEmpty}>
                  <MessageSquare size={40} />
                  <p>Belum ada pesan di chat room ini.</p>
                </div>
              ) : filteredChatMessages.length === 0 ? (
                <div className={styles.chatEmpty}>
                  <Tag size={40} style={{ color: getChatAttributeColor(chatFilterAttribute) }} />
                  <p>Tidak ada chat dengan atribut "{chatFilterAttribute}"</p>
                </div>
              ) : (
                <div className={styles.chatMessagesList}>
                  {filteredChatMessages.map((msg, index) => {
                    const isMe = msg.senderRole === 'admin';
                    const date = new Date(msg.createdAt);
                    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    
                    let showDivider = false;
                    let dividerText = '';
                    
                    const currentDateKey = date.toDateString();
                    const prevMsg = index > 0 ? filteredChatMessages[index - 1] : null;
                    const prevDateKey = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
                    
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
                        dividerText = compareDate.toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        });
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
                          <div className={`${styles.chatBubble} ${isMe ? styles.chatMyBubble : styles.chatOtherBubble}`}>
                            <div className={styles.chatBubbleHeader}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                            <p className={styles.chatMessageText}>{msg.message}</p>
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

              <div className={styles.attributeChipsContainer}>
                {chatAttributes.map((attr) => {
                  const isActive = selectedChatAttribute === attr.name;
                  const color = getChatAttributeColor(attr.name);
                  return (
                    <button
                      key={attr.id}
                      type="button"
                      className={`${styles.attributeChip} ${isActive ? styles.attributeChipActive : ''}`}
                      onClick={() => setSelectedChatAttribute(attr.name)}
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

              <form onSubmit={handleSendAdminChatMessage} className={styles.adminChatInputForm}>
                <textarea
                  placeholder="Tulis balasan atau pengumuman dari Admin..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className={styles.adminChatTextInput}
                  disabled={chatSubmitting}
                  required
                  rows={2}
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />

                <button 
                  type="submit" 
                  className={styles.adminChatSendBtn}
                  disabled={!newChatMessage.trim() || chatSubmitting}
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
              Atribut ini digunakan oleh karyawan untuk mengelompokkan pesan/laporan mereka (misalnya Sales, Progres, dll).
            </p>

            <form onSubmit={handleAddChatAttribute} className={styles.addAttrForm}>
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

            <div className={styles.attrsList}>
              {chatAttributes.map((attr) => (
                <div key={attr.id} className={styles.attrItem}>
                  <span className={styles.attrItemName}>🏷️ {attr.name}</span>
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
              ))}
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
                className={`${styles.calDayDot} ${
                  dayBookings.some(b => b.status === 'pending') ? styles.calDotPending : 
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
              📅 {adminSelectedDate ? new Date(adminSelectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Semua Tanggal'}
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
              <span>Tanggal: <strong>{new Date(adminSelectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</strong></span>
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
                const date = new Date(r.dateTime);
                const formattedDate = date.toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                });
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
                          <span className={styles.resMobileLabel}>Menu:</span>
                          <p className={styles.resMobileMenuText}>{r.menuList}</p>
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
                  new Date(adminSelectedDate).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
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
                      const date = new Date(r.dateTime);
                      const formattedDate = date.toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
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
        <div className={styles.fullWidthNewsArea}>
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
    const isAuthorized = localStorage.getItem('admin_authorized') === 'true';
    setIsAdminMode(isAdminParam || isAuthorized);
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
                    {new Date(submittedRes.dateTime).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
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

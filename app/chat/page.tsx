"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, AlertCircle, User, LogOut, Tag, ArrowRight, Filter, Pencil, Trash2, Calendar as CalendarIcon, X, Image, Copy, Check, ArrowDown, Sun, Moon, Camera, Search } from 'lucide-react';
import styles from './page.module.css';
import { supabase } from '@/lib/supabase';
import { formatForWhatsApp } from '@/lib/whatsappFormatter';


interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  imageUrl?: string | null;
  attribute: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
}

interface ChatAttribute {
  id: string;
  name: string;
  options?: any;
  chatbotEnabled?: boolean;
  isGroup?: boolean;
  groupAttributes?: any;
}

const DEFAULT_ATTRIBUTES: ChatAttribute[] = [
  { id: '1', name: 'Absen' },
  { id: '2', name: 'Barang ketinggalan' },
  { id: '3', name: 'Belanja Lain"' },
  { id: '4', name: 'Pemasukan' },
  { id: '5', name: 'Reservasi' },
  { id: '6', name: 'Umum' },
  { id: '7', name: 'Bon Karyawan' },
];

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

export default function EmployeeChatPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('smart_voice_notes_theme') as 'dark' | 'light';
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    } catch (e) { }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      localStorage.setItem('smart_voice_notes_theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    } catch (e) { }
  };

  const [name, setName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attributes, setAttributes] = useState<ChatAttribute[]>(DEFAULT_ATTRIBUTES);
  const [selectedAttribute, setSelectedAttribute] = useState<string>('Umum');
  const [filterAttribute, setFilterAttribute] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Image Upload and Lightbox States & Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // Message Copying States & Refs
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeContextMenu, setActiveContextMenu] = useState<{ x: number, y: number, messageId: string, text: string } | null>(null);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);

  const filteredMessages = (() => {
    let list = messages;
    if (filterAttribute !== 'Semua') {
      const filterAttrObj = attributes.find(a => a.name === filterAttribute);
      if (filterAttrObj?.isGroup) {
        const groupAttrs = Array.isArray(filterAttrObj.groupAttributes)
          ? (filterAttrObj.groupAttributes as string[])
          : [];
        list = list.filter(msg => msg.attribute === filterAttribute || (msg.attribute && groupAttrs.includes(msg.attribute)));
      } else {
        list = list.filter(msg => msg.attribute === filterAttribute);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(msg => 
        (msg.message && msg.message.toLowerCase().includes(q)) ||
        (msg.senderName && msg.senderName.toLowerCase().includes(q)) ||
        (msg.attribute && msg.attribute.toLowerCase().includes(q))
      );
    }

    return list;
  })();

  const [newMessageText, setNewMessageText] = useState('');
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

  const handleEditClick = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setNewMessageText(msg.message);
    setSelectedAttribute(msg.attribute || 'Umum');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setNewMessageText('');
    setSelectedAttribute('Umum');
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pesan ini?')) return;

    setErrorMsg('');
    try {
      const res = await fetch(`/api/chat?id=${msgId}&senderName=${encodeURIComponent(name)}&senderRole=employee`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus pesan');
      }

      setMessages(prev => prev.filter(m => m.id !== msgId));
      if (editingMessage?.id === msgId) {
        handleCancelEdit();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menghapus pesan.');
    }
  };
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [showReservationsModal, setShowReservationsModal] = useState(false);
  const [reservationsList, setReservationsList] = useState<any[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [resListFilter, setResListFilter] = useState('upcoming');
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const deferredPrompt = useRef<any>(null);

  const chatAreaRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const isInitialLoadRef = useRef<boolean>(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const isLoadingOlderRef = useRef<boolean>(false);

  // PWA Install Event Handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt.current) return;

    // Store launch target in localStorage so PWA starts at /chat
    localStorage.setItem('pwa_launch_target', '/chat');

    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    deferredPrompt.current = null;
    setShowInstallBanner(false);
  };

  // Check if name is already set in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('employee_chat_name');
      if (savedName) {
        setName(savedName);
        setIsNameSet(true);
      }
      setIsCheckingName(false);
    }
  }, []);

  // Monitor page visibility to pause polling when tab is inactive
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisibility = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Monitor user activity to pause polling after 3 minutes of inactivity
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      setIsActive(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsActive(false);
      }, 180000); // 3 minutes
    };
    resetTimer();
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });
    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  // Fetch messages and attributes & listen to Supabase Realtime updates (Instant WebSocket updates, 0 GB short-polling)
  useEffect(() => {
    if (isNameSet) {
      fetchMessages();
      fetchAttributes();

      // Subscribe to Supabase Realtime postgres_changes
      const channel = supabase
        .channel('employee_chat_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_messages' },
          () => {
            fetchMessages(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_attributes' },
          () => {
            fetchAttributes(true);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isNameSet]);

  // Smart scroll handling when messages change
  useEffect(() => {
    if (messages.length === 0) return;

    if (isInitialLoadRef.current) {
      scrollToBottom('auto');
      isInitialLoadRef.current = false;
    } else if (isAtBottomRef.current) {
      scrollToBottom('smooth');
    } else if (!isLoadingOlderRef.current) {
      setHasNewMessages(true);
      setShowScrollBottomBtn(true);
    }
  }, [messages]);


  // Scroll to bottom when filter tab changes
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('auto');
    }
  }, [filterAttribute]);

  const fetchReservationsForModal = async () => {
    setReservationsLoading(true);
    try {
      const res = await fetch('/api/reservations');
      if (res.ok) {
        const data = await res.json();
        setReservationsList(data);
      }
    } catch (err) {
      console.error('Failed to load reservations:', err);
    } finally {
      setReservationsLoading(false);
    }
  };

  useEffect(() => {
    if (showReservationsModal) {
      fetchReservationsForModal();
    }
  }, [showReservationsModal]);

  const fetchMessages = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const res = await fetch('/api/chat?limit=150', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = Array.isArray(data) ? data : (data.messages || []);
        setMessages(prev => {
          const pendingTempMsgs = prev.filter(m => m.id.startsWith('temp-'));

          const msgMap = new Map<string, ChatMessage>(prev.map(m => [m.id, m]));
          msgs.forEach(m => msgMap.set(m.id, m));
          pendingTempMsgs.forEach(t => {
            if (!msgMap.has(t.id)) msgMap.set(t.id, t);
          });

          const sorted = Array.from(msgMap.values()).sort((a, b) => {
            const dateA = getValidDate(a.createdAt);
            const dateB = getValidDate(b.createdAt);
            const timeA = dateA ? dateA.getTime() : 0;
            const timeB = dateB ? dateB.getTime() : 0;
            return timeA - timeB;
          });
          return sorted;
        });
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
      isLoadingOlderRef.current = false;
    }
  };

  const loadOlderMessages = async () => {
    if (messages.length === 0 || loadingOlder || !hasMoreOlder) return;
    setLoadingOlder(true);
    isLoadingOlderRef.current = true;

    const chatArea = chatAreaRef.current;
    const oldScrollHeight = chatArea ? chatArea.scrollHeight : 0;
    const oldScrollTop = chatArea ? chatArea.scrollTop : 0;

    try {
      const oldestMsg = messages[0];
      const res = await fetch(`/api/chat?limit=150&before=${encodeURIComponent(oldestMsg.createdAt)}`);
      if (res.ok) {
        const newOlderMsgs = await res.json();
        if (newOlderMsgs.length < 150) {
          setHasMoreOlder(false);
        }
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
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
      setLoadingOlder(false);
    }
  };

  const fetchAttributes = async (isSilent = false) => {
    try {
      const res = await fetch('/api/chat/attributes', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const attrs = Array.isArray(data) ? data : (data.attributes || []);
        setAttributes(attrs);
        if (!isSilent) {
          setSelectedAttribute(prev => {
            const exists = attrs.some((a: ChatAttribute) => a.name === prev);
            if (exists && prev) return prev;
            const hasUmum = attrs.some((a: ChatAttribute) => a.name === 'Umum');
            return hasUmum ? 'Umum' : (attrs[0]?.name || '');
          });
        }
      }
    } catch (err) {
      console.error('Failed to load chat attributes:', err);
    }
  };

  const handleTakeOptionTask = async (attrId: string, optionId: string, optionText: string) => {
    try {
      const res = await fetch('/api/chat/attributes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: attrId, action: 'take', optionId, assignedTo: name }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Gagal mengambil tugas');
        return;
      }
      await fetchAttributes(true);

      // Auto-send chat message
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: name,
          senderRole: 'employee',
          message: `Saya melakukan check-in / mengambil tugas progres: "${optionText}"`,
          attribute: selectedAttribute,
        }),
      });
      fetchMessages();
    } catch (err) {
      console.error('Error taking option task:', err);
    }
  };

  const handleEndOptionTask = async (attrId: string, optionId: string, optionText: string) => {
    if (!confirm('Apakah Anda yakin ingin menyelesaikan/mengakhiri tugas progres ini?')) return;
    try {
      const res = await fetch('/api/chat/attributes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: attrId, action: 'end', optionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Gagal mengakhiri tugas');
        return;
      }
      await fetchAttributes(true);

      // Auto-send chat message
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: name,
          senderRole: 'employee',
          message: `Saya melakukan check-out / menyelesaikan tugas progres: "${optionText}" (Tugas di-reset kembali)`,
          attribute: selectedAttribute,
        }),
      });
      fetchMessages();
    } catch (err) {
      console.error('Error ending progress:', err);
    }
  };

  const handleScroll = () => {
    if (!chatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceFromBottom <= 120;

    isAtBottomRef.current = isNearBottom;
    setShowScrollBottomBtn(!isNearBottom);
    if (isNearBottom) {
      setHasNewMessages(false);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    } else if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setHasNewMessages(false);
  };

  const handleSetName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;

    localStorage.setItem('employee_chat_name', tempName.trim());
    setName(tempName.trim());
    setIsNameSet(true);
  };

  const handleLogoutName = () => {
    if (confirm('Apakah Anda yakin ingin mengganti nama?')) {
      localStorage.removeItem('employee_chat_name');
      setName('');
      setTempName('');
      setIsNameSet(false);
      setMessages([]);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') ||
      (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === 'placeholder-key' ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'placeholder-key';

    if (isPlaceholder) {
      console.warn('PERINGATAN: Konfigurasi Supabase Storage belum diset. Fallback Base64 akan digunakan untuk lokal testing.');
    }

    // Validate type with file extension fallback
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const ext = file.name ? (file.name.split('.').pop() || '').toLowerCase() : '';
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      alert('Format file tidak didukung. Harap pilih gambar (JPEG, PNG, GIF, WEBP).');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    if (!text) return;
    const formattedText = formatForWhatsApp(text);
    navigator.clipboard.writeText(formattedText).then(() => {
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 1500);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: ChatMessage) => {
    if (!msg.message) return; // Only allow long-press on text messages
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current);

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    longPressTimeout.current = setTimeout(() => {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      setActiveContextMenu({
        x,
        y,
        messageId: msg.id,
        text: msg.message
      });
    }, 600); // 600ms threshold
  };

  const handleTouchEnd = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };

  const handleRemovePreview = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = newMessageText.trim();
    if ((!textToSend && !selectedFile) || isSubmitting) return;

    const isAbsen = selectedAttribute.toLowerCase().includes('absen');

    // 1. Enforce photo for Absen
    if (isAbsen && !selectedFile) {
      alert('Untuk melakukan absensi, silakan lampirkan foto selfie terlebih dahulu menggunakan tombol kamera/gambar di samping kolom teks.');
      return;
    }

    // 2. Identify shift option for Absen
    let matchedOption: any = null;
    let absenAttr: any = null;
    if (isAbsen) {
      absenAttr = attributes.find(a => a.name.toLowerCase().includes('absen'));
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

    const proceedWithSendMessage = async (lat: number | null = null, lon: number | null = null) => {
      setIsSubmitting(true);
      setIsUploading(!!selectedFile);
      setErrorMsg('');

      const isEditing = !!editingMessage;
      let tempId: string | null = null;

      try {
        let uploadedImageUrl = null;

        // Compress and upload file to Local VPS Storage if selected
        if (selectedFile) {
          try {
            const compressedBlob = await compressImageToBlob(selectedFile);
            const fileExt = selectedFile.name.split('.').pop() || 'jpg';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

            const formData = new FormData();
            formData.append('file', compressedBlob, fileName);

            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (!uploadRes.ok) {
              const errData = await uploadRes.json().catch(() => ({}));
              throw new Error(errData.error || 'Gagal mengunggah gambar ke storage VPS');
            }

            const uploadData = await uploadRes.json();
            uploadedImageUrl = uploadData.url;
          } catch (err: any) {
            throw new Error(err.message || 'Gagal memproses gambar');
          }
        }

        // Optimistic update for new messages
        if (!isEditing) {
          tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
          const optimisticMsg: ChatMessage = {
            id: tempId,
            senderName: name,
            senderRole: 'employee',
            message: textToSend,
            imageUrl: uploadedImageUrl,
            attribute: selectedAttribute || null,
            latitude: lat,
            longitude: lon,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [...prev, optimisticMsg]);

          // Instantly reset input form state for seamless UX
          setNewMessageText('');
          setSelectedFile(null);
          setImagePreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }

        const url = '/api/chat';
        const method = isEditing ? 'PUT' : 'POST';
        const bodyPayload = isEditing
          ? {
            id: editingMessage.id,
            message: textToSend,
            attribute: selectedAttribute || null,
            senderName: name,
            senderRole: 'employee',
            imageUrl: editingMessage.imageUrl
          }
          : {
            senderName: name,
            senderRole: 'employee',
            message: textToSend,
            imageUrl: uploadedImageUrl,
            attribute: selectedAttribute || null,
            latitude: lat,
            longitude: lon
          };

        const res = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
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

        const resultMsg = await res.json();

        if (isEditing) {
          setMessages(prev => prev.map(m => m.id === resultMsg.id ? resultMsg : m));
          setEditingMessage(null);
          setNewMessageText('');
        } else if (tempId) {
          // Replace temp optimistic message with actual message from server
          setMessages(prev => prev.map(m => m.id === tempId ? resultMsg : m));
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
              assignedTo: name
            })
          });

          if (checkInRes.ok) {
            await fetchAttributes(true);
          }
        }
      } catch (err: any) {
        // Revert optimistic message on error
        if (tempId) {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          // Restore failed text
          setNewMessageText(textToSend);
        }
        setErrorMsg(err.message || 'Terjadi kesalahan.');
      } finally {
        setIsSubmitting(false);
        setIsUploading(false);
      }
    };

    if (isAbsen) {
      if (!navigator.geolocation) {
        alert('Browser Anda tidak mendukung deteksi lokasi (Geolocation).');
        return;
      }

      setIsSubmitting(true);
      setIsUploading(true);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          // Haversine distance to Burjo Level Up (-7.1538944, 110.4047934)
          const R = 6371e3; // metres
          const phi1 = lat * Math.PI / 180;
          const phi2 = -7.1538944 * Math.PI / 180;
          const deltaPhi = (-7.1538944 - lat) * Math.PI / 180;
          const deltaLambda = (110.4047934 - lon) * Math.PI / 180;

          const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          if (distance > 100) {
            alert(`Absen gagal! Anda berada di luar radius toko. Jarak Anda saat ini: ${Math.round(distance)} meter dari toko (Maksimal radius 100 meter).`);
            setIsSubmitting(false);
            setIsUploading(false);
            return;
          }

          await proceedWithSendMessage(lat, lon);
        },
        async (error) => {
          let errorMessage = 'Gagal mendeteksi lokasi perangkat. ';
          switch (error.code) {
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
          setIsSubmitting(false);
          setIsUploading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      await proceedWithSendMessage();
    }
  };

  // Helper function to color-code attribute tags
  const getAttributeColor = (attr: string | null) => {
    if (!attr) return '#64748b';
    switch (attr.toLowerCase()) {
      case 'sales':
        return '#10b981'; // Green
      case 'progres':
        return '#06b6d4'; // Cyan
      case 'urgent':
        return '#ef4444'; // Red
      case 'umum':
        return '#6366f1'; // Indigo
      default:
        return '#d946ef'; // Magenta
    }
  };

  if (isCheckingName) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <div className="spinner" />
        <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Memuat profil chat...</p>
      </div>
    );
  }

  if (!isNameSet) {
    return (
      <div className={styles.authContainer}>
        <link rel="manifest" href="/manifest-chat.json?v=2" />
        <div className={`${styles.authCard} glass-panel`}>
          <div className={styles.authHeader}>
            <div className={styles.chatIconWrapper}>
              <MessageSquare className={styles.chatIcon} />
            </div>
            <h1 className={styles.authTitle}>Chat Room Karyawan</h1>
            <p className={styles.authSubtitle}>
              Grup koordinasi internal FnB & Pelaporan urgent
            </p>
          </div>

          <form onSubmit={handleSetName} className={styles.authForm}>
            <div className={styles.inputGroup}>
              <label htmlFor="employee-name" className={styles.inputLabel}>
                Nama Lengkap Karyawan
              </label>
              <div className={styles.inputWithIcon}>
                <User className={styles.fieldIcon} />
                <input
                  id="employee-name"
                  type="text"
                  placeholder="Masukkan nama Anda (cth: Andi)"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className={styles.textInput}
                  maxLength={50}
                  required
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn}>
              <span>Masuk ke Chat Room</span>
              <ArrowRight className={styles.btnIcon} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <link rel="manifest" href="/manifest-chat.json" />
      <div className={styles.pageContainer}>
      <link rel="manifest" href="/manifest-chat.json?v=2" />
      <div className={`${styles.chatWrapper} glass-panel`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.activeIndicator} />
            <div>
              <h2 className={styles.roomTitle}>Grup Koordinasi Burjolevelup</h2>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--foreground)',
                cursor: 'pointer',
                marginRight: '8px'
              }}
              type="button"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setShowReservationsModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                marginRight: '12px'
              }}
              title="Daftar Reservasi"
              type="button"
            >
              <CalendarIcon size={14} />
              <span className={styles.btnText}>Reservasi</span>
            </button>
            <div className={styles.userInfo}>
              <User className={styles.userIcon} />
              <span className={styles.userName}>{name}</span>
              <span className={styles.roleBadge}>Karyawan</span>
            </div>
            <button
              onClick={handleLogoutName}
              className={styles.logoutBtn}
              title="Ganti Nama"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={styles.filterContainer}>
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '4px 10px', marginRight: '8px', flexShrink: 0 }}>
            <Search size={13} style={{ color: 'var(--text-muted)', marginRight: '6px' }} />
            <input
              type="text"
              placeholder="Cari chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'inherit',
                fontSize: '0.75rem',
                width: searchQuery ? '110px' : '80px',
                transition: 'width 0.2s',
              }}
            />
            {searchQuery && (
              <X size={12} style={{ cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '4px' }} onClick={() => setSearchQuery('')} />
            )}
          </div>

          <span className={styles.filterLabel}>
            <Filter size={12} style={{ marginRight: '4px' }} /> Filter:
          </span>
          {['Semua', ...Array.from(new Set(attributes.map(a => a.name)))].map((attrName) => {
            const isActive = filterAttribute === attrName;
            const color = attrName === 'Semua' ? '#6366f1' : getAttributeColor(attrName);
            return (
              <button
                key={attrName}
                type="button"
                className={`${styles.filterChip} ${isActive ? styles.filterChipActive : ''}`}
                onClick={() => setFilterAttribute(attrName)}
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

        {/* Messages */}
        <div className={styles.chatArea} ref={chatAreaRef} onScroll={handleScroll}>
          {isLoading && messages.length === 0 ? (
            <div className={styles.loaderContainer}>
              <div className="spinner" />
              <p>Memuat percakapan...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyChat}>
              <MessageSquare size={48} className={styles.emptyIcon} />
              <h3>Belum ada percakapan</h3>
              <p>Kirimkan laporan pertama Anda terkait progres atau kendala F&B.</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className={styles.emptyChat}>
              <Tag size={48} className={styles.emptyIcon} style={{ color: getAttributeColor(filterAttribute) }} />
              <h3>Tidak ada chat dengan atribut "{filterAttribute}"</h3>
              <p>Belum ada laporan atau koordinasi yang menggunakan klasifikasi ini.</p>
            </div>
          ) : (
            <div className={styles.messagesList}>
              {messages.length >= 150 && hasMoreOlder && (
                <button
                  type="button"
                  disabled={loadingOlder}
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
                    cursor: loadingOlder ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none',
                    textAlign: 'center',
                    opacity: loadingOlder ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingOlder) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    if (!loadingOlder) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                >
                  {loadingOlder ? 'Memuat...' : 'Muat Chat Lebih Lama...'}
                </button>
              )}
              {filteredMessages.map((msg, index) => {
                const isMe = msg.senderName === name && msg.senderRole === 'employee';
                const date = getValidDate(msg.createdAt) || new Date();
                const timeStr = formatTime(msg.createdAt);

                let showDivider = false;
                let dividerText = '';

                const currentDateKey = date.toDateString();
                const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
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
                    <div
                      className={`${styles.messageRow} ${isMe ? styles.myRow : styles.otherRow}`}
                    >
                      <div
                        className={`${styles.bubble} ${isMe ? styles.myBubble : styles.otherBubble} ${copiedMessageId === msg.id ? styles.bubbleCopied : ''}`}
                        onTouchStart={(e) => handleTouchStart(e, msg)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                      >
                        {/* Sender metadata */}
                        <div className={styles.bubbleHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={styles.senderName}>{msg.senderName}</span>
                            <span className={`${styles.roleIndicator} ${msg.senderRole === 'admin' ? styles.roleAdmin : styles.roleEmployee}`}>
                              {msg.senderRole === 'admin' ? 'Admin' : 'Karyawan'}
                            </span>
                          </div>
                          {(isMe || msg.message) && (
                            <div className={styles.messageActions}>
                              {isMe && (
                                <>
                                  <button
                                    onClick={() => handleEditClick(msg)}
                                    className={styles.actionBtn}
                                    title="Edit Pesan"
                                    type="button"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                                    title="Hapus Pesan"
                                    type="button"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </>
                              )}
                              {msg.message && (
                                <button
                                  onClick={() => handleCopyMessage(msg.id, msg.message)}
                                  className={styles.actionBtn}
                                  title="Salin Pesan"
                                  type="button"
                                >
                                  {copiedMessageId === msg.id ? <Check size={11} style={{ color: '#10b981' }} /> : <Copy size={11} />}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Attribute tag */}
                        {msg.attribute && (
                          <div
                            className={styles.attributeTag}
                            style={{ borderColor: getAttributeColor(msg.attribute), color: getAttributeColor(msg.attribute) }}
                          >
                            <Tag size={10} className={styles.tagIcon} />
                            <span>{msg.attribute}</span>
                          </div>
                        )}

                        {/* Image inside bubble */}
                        {msg.imageUrl && (
                          <div
                            className={styles.messageImageWrapper}
                            onClick={() => setActiveLightboxImage(msg.imageUrl || null)}
                          >
                            <img 
                              src={msg.imageUrl} 
                              alt="Lampiran foto" 
                              className={styles.messageImage} 
                              onError={(e) => {
                                const img = e.currentTarget;
                                img.style.display = 'none';
                                const fallback = img.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className={styles.imageFallbackBadge} style={{ display: 'none' }}>
                              <Image size={14} />
                              <span>Arsip Foto (Storage Supabase Terkunci)</span>
                            </div>
                          </div>
                        )}

                        {/* Content */}
                        {msg.message && (
                          <p className={styles.messageText}>{formatBoldText(msg.message)}</p>
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

                        {/* Time */}
                        <span className={styles.timeText}>{timeStr}</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className={styles.scrollToBottomBtn}
            title="Ke Pesan Terbaru"
          >
            <ArrowDown size={18} />
            {hasNewMessages && <span className={styles.unreadDot} />}
          </button>
        )}

        {/* Footer input form */}
        <div className={styles.footer}>
          {errorMsg && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {editingMessage && (
            <div className={styles.editBanner}>
              <span className={styles.editText}>
                <Pencil size={12} style={{ marginRight: '6px' }} /> Sedang mengedit pesan...
              </span>
              <button
                type="button"
                onClick={handleCancelEdit}
                className={styles.editCancelBtn}
              >
                Batal
              </button>
            </div>
          )}

          {/* Attribute Chips Selection */}
          <div className={styles.attributeChipsContainer}>
            {attributes.filter(attr => !attr.isGroup).map((attr) => {
              const isActive = selectedAttribute === attr.name;
              const color = getAttributeColor(attr.name);
              return (
                <button
                  key={attr.id}
                  type="button"
                  className={`${styles.attributeChip} ${isActive ? styles.attributeChipActive : ''}`}
                  onClick={() => setSelectedAttribute(attr.name)}
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

          {/* Quick Options (Pesan Cepat / Pilihan Ganda) */}
          {(() => {
            const currentAttr = attributes.find(a => a.name === selectedAttribute);
            const allOptions = Array.isArray(currentAttr?.options) ? (currentAttr.options as any[]) : [];
            if (allOptions.length === 0) return null;

            const simpleOptions = allOptions.filter(o => !o.hasTimeframe);
            const taskOptions = allOptions.filter(o => o.hasTimeframe);

            const toggleSimpleOption = (optText: string) => {
              const currentText = newMessageText.trim();
              const items = currentText ? currentText.split('\n').map(item => item.trim()).filter(Boolean) : [];
              const index = items.findIndex(item => item.toLowerCase() === optText.toLowerCase());
              if (index !== -1) {
                items.splice(index, 1);
              } else {
                items.push(optText);
              }
              setNewMessageText(items.join('\n'));
              chatInputRef.current?.focus();
            };

            return (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-secondary)',
                  borderTop: '1px solid var(--glass-border)',
                  borderBottom: '1px solid var(--glass-border)',
                }}
              >
                {/* Simple Quick Replies */}
                {simpleOptions.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '2px' }}>
                    {simpleOptions.map((opt) => {
                      const isSelected = newMessageText
                        ? newMessageText.split('\n').map(item => item.trim().toLowerCase()).includes(opt.text.toLowerCase())
                        : false;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleSimpleOption(opt.text)}
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
                            boxShadow: isSelected ? '0 4px 12px rgba(67, 56, 202, 0.25)' : '0 1px 3px rgba(0, 0, 0, 0.04)'
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
                      const isMine = isTaken && task.assignedTo === name;

                      let expiryStr = '';
                      if (task.expiryDate) {
                        expiryStr = formatTime(task.expiryDate) + ' ' + formatDateShort(task.expiryDate);
                      }

                      return (
                        <div
                          key={task.id}
                          style={{
                            background: isMine ? 'rgba(99, 102, 241, 0.12)' : 'var(--glass-bg)',
                            border: isMine ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.78rem'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--foreground)' }}>{task.text}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {isTaken ? `Diambil: ${task.assignedTo} (${expiryStr})` : `Durasi: ${task.duration}`}
                            </span>
                          </div>

                          {!isTaken ? (
                            <button
                              type="button"
                              onClick={() => currentAttr && handleTakeOptionTask(currentAttr.id, task.id, task.text)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: '#10b981',
                                color: '#fff',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Ambil
                            </button>
                          ) : (
                            isMine && (
                              <button
                                type="button"
                                onClick={() => currentAttr && handleEndOptionTask(currentAttr.id, task.id, task.text)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: '#ef4444',
                                  color: '#fff',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Selesai
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Image Upload Preview */}
          {imagePreview && (
            <div className={styles.imagePreviewContainer}>
              <img src={imagePreview} alt="Upload preview" className={styles.imagePreview} />
              <button
                type="button"
                onClick={handleRemovePreview}
                className={styles.removePreviewBtn}
                title="Hapus gambar"
              >
                <X size={14} />
              </button>
              {isUploading && (
                <div className={styles.uploadOverlay}>
                  <div className="spinner" style={{ width: '20px', height: '20px' }} />
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSendMessage} className={styles.inputForm}>
            {/* Attachment Button & Popover */}
            <div className={styles.attachMenuWrapper}>
              {showAttachMenu && (
                <div className={styles.attachMenuPopover}>
                  <button
                    type="button"
                    className={styles.attachMenuItem}
                    onClick={() => {
                      setShowAttachMenu(false);
                      cameraInputRef.current?.click();
                    }}
                  >
                    <Camera size={16} />
                    <span>Ambil Foto (Kamera)</span>
                  </button>
                  <button
                    type="button"
                    className={styles.attachMenuItem}
                    onClick={() => {
                      setShowAttachMenu(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Image size={16} />
                    <span>Pilih dari Galeri</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                className={`${styles.attachBtn} ${isSubmitting ? styles.disabledAttachBtn : ''}`}
                onClick={() => setShowAttachMenu(prev => !prev)}
                title="Lampirkan foto"
                disabled={isSubmitting}
              >
                <Image size={20} />
              </button>

              <input
                type="file"
                ref={cameraInputRef}
                onChange={(e) => {
                  setShowAttachMenu(false);
                  handleFileChange(e);
                }}
                style={{ display: 'none' }}
                accept="image/*"
                capture="environment"
                disabled={isSubmitting}
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  setShowAttachMenu(false);
                  handleFileChange(e);
                }}
                style={{ display: 'none' }}
                accept="image/*"
                disabled={isSubmitting}
              />
            </div>

            {/* Chat Text Input */}
            <textarea
              ref={chatInputRef}
              placeholder="Tulis laporan atau pesan penting..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              className={styles.chatInput}
              disabled={isSubmitting}
              required={!selectedFile}
              rows={2}
              style={{ resize: 'none', fontFamily: 'inherit' }}
            />

            {/* Send Button */}
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={(!newMessageText.trim() && !selectedFile) || isSubmitting}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {showReservationsModal && (
        <div
          onClick={() => setShowReservationsModal(false)}
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
                onClick={() => setShowReservationsModal(false)}
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
                const isActive = resListFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => setResListFilter(pill.id)}
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
              {reservationsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Memuat data reservasi...</span>
                  <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes spin { to { transform: rotate(360deg); } }
                  `}} />
                </div>
              ) : (() => {
                const filtered = reservationsList.filter(r => {
                  if (resListFilter === 'upcoming') {
                    return r.status === 'pending' || r.status === 'confirmed';
                  }
                  if (resListFilter !== 'all' && r.status !== resListFilter) {
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
                onClick={() => fetchReservationsForModal()}
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
                onClick={() => setShowReservationsModal(false)}
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

      {showInstallBanner && (
        <div className={styles.installBanner}>
          <div className={styles.installBannerContent}>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Instal Aplikasi Karyawan</div>
            <div>Instal aplikasi Chat Burjolevelup di layar utama Anda untuk akses yang lebih cepat dan mudah.</div>
            <div className={styles.installBannerActions}>
              <button className={styles.installBtn} onClick={handleInstallClick}>Instal Sekarang</button>
              <button className={styles.closeInstallBtn} onClick={() => setShowInstallBanner(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {activeLightboxImage && (
        <div
          className={styles.lightbox}
          onClick={() => setActiveLightboxImage(null)}
        >
          <button
            className={styles.lightboxCloseBtn}
            onClick={() => setActiveLightboxImage(null)}
            type="button"
          >
            <X size={24} />
          </button>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <img src={activeLightboxImage} alt="Fullscreen Attachment" className={styles.lightboxImage} />
          </div>
        </div>
      )}

      {activeContextMenu && (
        <div
          className={styles.contextMenuOverlay}
          onClick={() => setActiveContextMenu(null)}
          onTouchStart={() => setActiveContextMenu(null)}
        >
          <div
            className={`${styles.contextMenu} glass-panel`}
            style={{
              top: `${Math.min(activeContextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 80 : 300)}px`,
              left: `${Math.min(activeContextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 150 : 150)}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.contextMenuItem}
              onClick={() => {
                handleCopyMessage(activeContextMenu.messageId, activeContextMenu.text);
                setActiveContextMenu(null);
              }}
            >
              <Copy size={14} style={{ marginRight: '8px' }} />
              <span>Salin Teks</span>
            </button>
          </div>
        </div>
      )}
    </div>
  </>
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

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, AlertCircle, User, LogOut, Tag, ArrowRight, Filter, Pencil, Trash2, Calendar as CalendarIcon, X } from 'lucide-react';
import styles from './page.module.css';

interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  attribute: string | null;
  createdAt: string;
}

interface ChatAttribute {
  id: string;
  name: string;
  options?: string[];
  chatbotEnabled?: boolean;
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

export default function EmployeeChatPage() {
  const [name, setName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attributes, setAttributes] = useState<ChatAttribute[]>([]);
  const [selectedAttribute, setSelectedAttribute] = useState<string>('Umum');
  const [filterAttribute, setFilterAttribute] = useState<string>('Semua');

  const filteredMessages = filterAttribute === 'Semua'
    ? messages
    : messages.filter(msg => msg.attribute === filterAttribute);

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Fetch messages and attributes
  useEffect(() => {
    if (isNameSet && isVisible && isActive) {
      fetchMessages();
      fetchAttributes();

      // Set up short-polling for real-time messages & attribute options (every 4 seconds)
      pollingIntervalRef.current = setInterval(() => {
        fetchMessages(true); // silent fetch messages
        fetchAttributes(true); // silent fetch attributes
      }, 4000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [isNameSet, isVisible, isActive]);

  // Scroll to bottom when messages list changes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => {
          if (prev.length === data.length && (prev.length === 0 || prev[prev.length - 1].id === data[data.length - 1].id)) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const fetchAttributes = async (isSilent = false) => {
    try {
      const res = await fetch('/api/chat/attributes');
      if (res.ok) {
        const data = await res.json();
        setAttributes(data);
        if (!isSilent) {
          // Default to "Umum" if present, otherwise first attribute
          const hasUmum = data.some((a: ChatAttribute) => a.name === 'Umum');
          setSelectedAttribute(hasUmum ? 'Umum' : (data[0]?.name || ''));
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const isEditing = !!editingMessage;
      const url = '/api/chat';
      const method = isEditing ? 'PUT' : 'POST';
      const bodyPayload = isEditing 
        ? {
            id: editingMessage.id,
            message: newMessageText.trim(),
            attribute: selectedAttribute || null,
            senderName: name,
            senderRole: 'employee'
          }
        : {
            senderName: name,
            senderRole: 'employee',
            message: newMessageText.trim(),
            attribute: selectedAttribute || null,
          };

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Gagal ${isEditing ? 'mengedit' : 'mengirim'} pesan`);
      }

      const resultMsg = await res.json();
      
      if (isEditing) {
        setMessages(prev => prev.map(m => m.id === resultMsg.id ? resultMsg : m));
        setEditingMessage(null);
      } else {
        setMessages(prev => [...prev, resultMsg]);
      }
      
      setNewMessageText('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
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
              onClick={() => setShowReservationsModal(true)}
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
          <span className={styles.filterLabel}>
            <Filter size={12} style={{ marginRight: '4px' }} /> Filter:
          </span>
          {['Semua', ...attributes.map(a => a.name)].map((attrName) => {
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
        <div className={styles.chatArea}>
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
              {filteredMessages.map((msg, index) => {
                const isMe = msg.senderName === name && msg.senderRole === 'employee';
                const date = new Date(msg.createdAt);
                const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                let showDivider = false;
                let dividerText = '';
                
                const currentDateKey = date.toDateString();
                const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
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
                    <div 
                      className={`${styles.messageRow} ${isMe ? styles.myRow : styles.otherRow}`}
                    >
                      <div className={`${styles.bubble} ${isMe ? styles.myBubble : styles.otherBubble}`}>
                        {/* Sender metadata */}
                        <div className={styles.bubbleHeader}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={styles.senderName}>{msg.senderName}</span>
                            <span className={`${styles.roleIndicator} ${msg.senderRole === 'admin' ? styles.roleAdmin : styles.roleEmployee}`}>
                              {msg.senderRole === 'admin' ? 'Admin' : 'Karyawan'}
                            </span>
                          </div>
                          {isMe && (
                            <div className={styles.messageActions}>
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

                        {/* Content */}
                        <p className={styles.messageText}>{formatBoldText(msg.message)}</p>
                        
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
            {attributes.map((attr) => {
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

            return (
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '8px 12px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                {/* Simple Quick Replies */}
                {simpleOptions.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
                    {simpleOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setNewMessageText(opt.text);
                          chatInputRef.current?.focus();
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s'
                        }}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                )}

                {/* Task / Timeframe Options */}
                {taskOptions.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                    {taskOptions.map((task) => {
                      const isTaken = task.status === 'taken';
                      const isMine = isTaken && task.assignedTo === name;
                      
                      let expiryStr = '';
                      if (task.expiryDate) {
                        const expDate = new Date(task.expiryDate);
                        expiryStr = expDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' ' + expDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                      }

                      return (
                        <div
                          key={task.id}
                          style={{
                            background: isMine ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                            border: isMine ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
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
                            <span style={{ fontWeight: 600, fontSize: '0.78rem', color: '#fff' }}>{task.text}</span>
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

          <form onSubmit={handleSendMessage} className={styles.inputForm}>
            {/* Chat Text Input */}
            <textarea
              ref={chatInputRef}
              placeholder="Tulis laporan atau pesan penting..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              className={styles.chatInput}
              disabled={isSubmitting}
              required
              rows={2}
              style={{ resize: 'none', fontFamily: 'inherit' }}
            />

            {/* Send Button */}
            <button 
              type="submit" 
              className={styles.sendBtn}
              disabled={!newMessageText.trim() || isSubmitting}
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
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
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
              {reservationsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Memuat data reservasi...</span>
                  <style dangerouslySetInnerHTML={{__html: `
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
    </div>
  );
}

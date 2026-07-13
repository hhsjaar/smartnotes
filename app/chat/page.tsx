"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, AlertCircle, User, LogOut, Tag, ArrowRight, Filter } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch messages and attributes
  useEffect(() => {
    if (isNameSet) {
      fetchMessages();
      fetchAttributes();

      // Set up short-polling for real-time messages
      pollingIntervalRef.current = setInterval(() => {
        fetchMessages(true); // silent fetch
      }, 2000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [isNameSet]);

  // Scroll to bottom when messages list changes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const fetchAttributes = async () => {
    try {
      const res = await fetch('/api/chat/attributes');
      if (res.ok) {
        const data = await res.json();
        setAttributes(data);
        // Default to "Umum" if present, otherwise first attribute
        const hasUmum = data.some((a: ChatAttribute) => a.name === 'Umum');
        setSelectedAttribute(hasUmum ? 'Umum' : (data[0]?.name || ''));
      }
    } catch (err) {
      console.error('Failed to load chat attributes:', err);
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderName: name,
          senderRole: 'employee',
          message: newMessageText.trim(),
          attribute: selectedAttribute || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal mengirim pesan');
      }

      const sentMsg = await res.json();
      setMessages(prev => [...prev, sentMsg]);
      setNewMessageText('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengirim pesan.');
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
      <div className={`${styles.chatWrapper} glass-panel`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.activeIndicator} />
            <div>
              <h2 className={styles.roomTitle}>F&B Urgent & Report Group</h2>
              <p className={styles.roomSubtitle}>Saluran koordinasi real-time karyawan dan admin</p>
            </div>
          </div>

          <div className={styles.headerRight}>
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
                          <span className={styles.senderName}>{msg.senderName}</span>
                          <span className={`${styles.roleIndicator} ${msg.senderRole === 'admin' ? styles.roleAdmin : styles.roleEmployee}`}>
                            {msg.senderRole === 'admin' ? 'Admin' : 'Karyawan'}
                          </span>
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
                        <p className={styles.messageText}>{msg.message}</p>
                        
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

          <form onSubmit={handleSendMessage} className={styles.inputForm}>
            {/* Chat Text Input */}
            <input
              type="text"
              placeholder="Tulis laporan atau pesan penting..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              className={styles.chatInput}
              disabled={isSubmitting}
              required
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
    </div>
  );
}

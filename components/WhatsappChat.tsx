"use client";

import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, AlertCircle, Check, Trash2, Clock, UserPlus, Users, User, X } from 'lucide-react';
import { GlowButton } from './ui/GlowButton';
import styles from './WhatsappChat.module.css';

interface Contact {
  name: string;
  number: string;
}

export const WhatsappChat: React.FC = () => {
  const [targetNumber, setTargetNumber] = useState('');
  const [message, setMessage] = useState('');
  const [recentNumbers, setRecentNumbers] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  // Autocomplete state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Compute selected contact and filtered contacts for autocomplete
  const selectedContact = contacts.find(c => c.number === targetNumber);
  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(targetNumber.toLowerCase()) ||
    c.number.includes(targetNumber)
  );
  
  // Add Contact states
  const [newContactName, setNewContactName] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Load history & contacts from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRecents = localStorage.getItem('recent_wa_numbers');
      if (savedRecents) {
        try {
          setRecentNumbers(JSON.parse(savedRecents));
        } catch (e) {
          console.error(e);
        }
      }

      const savedContacts = localStorage.getItem('wa_contacts');
      if (savedContacts) {
        try {
          setContacts(JSON.parse(savedContacts));
        } catch (e) {
          console.error(e);
        }
      } else {
        // Seed initial mock contacts if empty
        const defaultContacts = [
          { name: 'Keluarga Rumah', number: '08123456789' },
          { name: 'Rekan Kerja A', number: '08234567890' }
        ];
        setContacts(defaultContacts);
        localStorage.setItem('wa_contacts', JSON.stringify(defaultContacts));
      }
    }
  }, []);

  // Ref or document listener to close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsDropdownOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactNumber.trim()) return;

    // Clean number to digits only
    const cleanNumber = newContactNumber.replace(/[^0-9]/g, '');
    
    if (contacts.some(c => c.name.toLowerCase() === newContactName.trim().toLowerCase())) {
      alert('Nama kontak sudah ada.');
      return;
    }

    const updated = [...contacts, { name: newContactName.trim(), number: cleanNumber }].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    setContacts(updated);
    localStorage.setItem('wa_contacts', JSON.stringify(updated));
    setNewContactName('');
    setNewContactNumber('');
  };

  const handleDeleteContact = (name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus kontak "${name}"?`)) {
      const updated = contacts.filter(c => c.name !== name);
      setContacts(updated);
      localStorage.setItem('wa_contacts', JSON.stringify(updated));
    }
  };

  const handleClearHistory = () => {
    if (confirm('Hapus semua riwayat nomor telepon?')) {
      setRecentNumbers([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('recent_wa_numbers');
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!targetNumber.trim()) {
      setErrorMsg('Masukkan nomor WhatsApp penerima.');
      setStatus('error');
      return;
    }
    
    if (!message.trim()) {
      setErrorMsg('Isi pesan tidak boleh kosong.');
      setStatus('error');
      return;
    }

    setIsLoading(true);
    setStatus('idle');
    setErrorMsg('');

    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetNumber,
          message: message,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengirim WhatsApp.');
      }

      setStatus('success');
      
      // Update history in localStorage
      const cleanNum = targetNumber.trim();
      const updatedRecents = [
        cleanNum,
        ...recentNumbers.filter(n => n !== cleanNum)
      ].slice(0, 5);

      setRecentNumbers(updatedRecents);
      if (typeof window !== 'undefined') {
        localStorage.setItem('recent_wa_numbers', JSON.stringify(updatedRecents));
      }

      setMessage('');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengirim pesan.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get contact initials
  const getInitials = (name: string) => {
    return name ? name.substring(0, 2).toUpperCase() : 'WA';
  };

  // Helper to generate a random pastel background color for avatar
  const getAvatarColor = (name: string) => {
    const colors = [
      '#6366f1', // Indigo
      '#06b6d4', // Cyan
      '#d946ef', // Magenta
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444'  // Red
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  return (
    <div className={`${styles.chatContainer} glass-panel animate-fade-in`}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <MessageSquare size={22} className={styles.titleIcon} />
          Pesan WhatsApp Cepat
        </h2>
        <p className={styles.subtitle}>
          Kirim pesan darurat atau obrolan cepat secara langsung menggunakan daftar kontak tersimpan
        </p>
      </div>

      <div className={styles.layoutGrid}>
        {/* Left Column: Send Message Form */}
        <form onSubmit={handleSend} className={styles.formSection}>
          <div className={styles.inputGroup} style={{ position: 'relative' }}>
            <label htmlFor="target-number" className={styles.inputLabel}>
              Nomor WhatsApp Penerima
            </label>
            {selectedContact ? (
              <div className={styles.selectedContactBadge}>
                <div
                  className={styles.badgeAvatar}
                  style={{ backgroundColor: getAvatarColor(selectedContact.name) }}
                >
                  {getInitials(selectedContact.name)}
                </div>
                <div className={styles.badgeDetails}>
                  <span className={styles.badgeName}>{selectedContact.name}</span>
                  <span className={styles.badgeNumber}>({selectedContact.number})</span>
                </div>
                <button
                  type="button"
                  className={styles.badgeClearBtn}
                  onClick={() => setTargetNumber('')}
                  title="Ganti Penerima"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <input
                  id="target-number"
                  type="tel"
                  placeholder="Cari nama kontak atau ketik nomor telepon..."
                  className={styles.textInput}
                  value={targetNumber}
                  onChange={(e) => {
                    setTargetNumber(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  disabled={isLoading}
                  autoComplete="off"
                />
                
                {isDropdownOpen && (
                  <div className={styles.contactsDropdown}>
                    {filteredContacts.length === 0 ? (
                      <div className={styles.dropdownEmpty}>
                        <span>Tidak ada kontak cocok. Kirim sebagai nomor manual.</span>
                      </div>
                    ) : (
                      filteredContacts.map((contact, i) => (
                        <button
                          key={i}
                          type="button"
                          className={styles.dropdownItem}
                          onClick={() => {
                            setTargetNumber(contact.number);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div
                            className={styles.dropdownAvatar}
                            style={{ backgroundColor: getAvatarColor(contact.name) }}
                          >
                            {getInitials(contact.name)}
                          </div>
                          <div className={styles.dropdownDetails}>
                            <span className={styles.dropdownName}>{contact.name}</span>
                            <span className={styles.dropdownNumber}>{contact.number}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {recentNumbers.length > 0 && (
            <div className={styles.recentContainer}>
              <div className={styles.recentHeader}>
                <span className={styles.recentLabel}>Nomor Terakhir:</span>
                <button
                  type="button"
                  className={styles.clearHistoryBtn}
                  onClick={handleClearHistory}
                  title="Hapus Riwayat"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className={styles.recentList}>
                {recentNumbers.map((num, i) => (
                  <button
                    key={i}
                    type="button"
                    className={styles.recentBadge}
                    onClick={() => setTargetNumber(num)}
                    disabled={isLoading}
                  >
                    <Clock size={10} style={{ marginRight: '4px' }} />
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.inputGroup} style={{ marginTop: '8px' }}>
            <label htmlFor="wa-message" className={styles.inputLabel}>
              Isi Pesan WhatsApp
            </label>
            <textarea
              id="wa-message"
              placeholder="Tulis pesan kustom atau pesan darurat Anda di sini..."
              className={styles.textarea}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {status === 'success' && (
            <div className={styles.statusBannerSuccess}>
              <Check size={16} className={styles.statusIcon} />
              <span>Pesan WhatsApp berhasil terkirim via Fonnte API!</span>
            </div>
          )}

          {status === 'error' && (
            <div className={styles.statusBannerError}>
              <AlertCircle size={16} className={styles.statusIcon} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className={styles.actionRow}>
            <GlowButton
              variant="accent"
              type="submit"
              disabled={isLoading}
              style={{ width: '100%', height: '46px', gap: '8px' }}
            >
              <Send size={16} />
              {isLoading ? 'Sedang Mengirim...' : 'Kirim Pesan Sekarang'}
            </GlowButton>
          </div>
        </form>

        {/* Right Column: Contact List Manager */}
        <div className={styles.contactListSection}>
          <div className={styles.contactFormContainer}>
            <h3 className={styles.sectionTitle}>
              <UserPlus size={16} style={{ color: 'var(--secondary)' }} />
              Tambah Kontak Baru
            </h3>
            
            <form onSubmit={handleAddContact} className={styles.addContactForm}>
              <div className={styles.addContactFields}>
                <input
                  type="text"
                  placeholder="Nama Kontak"
                  className={styles.miniTextInput}
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  disabled={isLoading}
                />
                <input
                  type="tel"
                  placeholder="Nomor WA (contoh: 0812...)"
                  className={styles.miniTextInput}
                  value={newContactNumber}
                  onChange={(e) => setNewContactNumber(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <button type="submit" className={styles.miniAddBtn} disabled={isLoading}>
                Tambah
              </button>
            </form>
          </div>

          <div className={styles.contactsListContainer}>
            <h3 className={styles.sectionTitle} style={{ marginBottom: '8px' }}>
              <Users size={16} style={{ color: 'var(--primary)' }} />
              Daftar Kontak Tersimpan ({contacts.length})
            </h3>
            
            {contacts.length === 0 ? (
              <div className={styles.emptyContacts}>
                <User size={32} style={{ color: 'var(--text-dark)', opacity: 0.5 }} />
                <p>Belum ada kontak tersimpan.</p>
              </div>
            ) : (
              <div className={styles.contactsScrollList}>
                {contacts.map((contact, idx) => (
                  <div key={idx} className={styles.contactItemCard}>
                    <button
                      type="button"
                      className={styles.contactSelectBtn}
                      onClick={() => setTargetNumber(contact.number)}
                      title={`Pilih ${contact.name}`}
                    >
                      <div
                        className={styles.contactAvatar}
                        style={{ backgroundColor: getAvatarColor(contact.name) }}
                      >
                        {getInitials(contact.name)}
                      </div>
                      <div className={styles.contactTextDetails}>
                        <div className={styles.contactName}>{contact.name}</div>
                        <div className={styles.contactNumber}>{contact.number}</div>
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      className={styles.contactDeleteBtn}
                      onClick={() => handleDeleteContact(contact.name)}
                      title={`Hapus ${contact.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

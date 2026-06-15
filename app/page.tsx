"use client";

import React, { useState, useEffect } from 'react';
import { FileText, Newspaper, Search, Plus, Sparkles, Mic, Trash2, Calendar as CalendarIcon, Folder as FolderIcon, Edit3, CheckSquare, MessageSquare, X } from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { NoteCard } from '@/components/NoteCard';
import { NoteEditor } from '@/components/NoteEditor';
import { NewsSection } from '@/components/NewsSection';
import { GlowButton } from '@/components/ui/GlowButton';
import { Calendar } from '@/components/Calendar';
import { WhatsappChat } from '@/components/WhatsappChat';
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
  const [activeTab, setActiveTab] = useState<'notes' | 'news' | 'whatsapp' | 'calendar' | 'recorder'>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'editor' | 'recorder'>('editor');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [pendingNoteData, setPendingNoteData] = useState<any | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [isFoldersListOpen, setIsFoldersListOpen] = useState(true);
  
  const [isMobileCalendarOpen, setIsMobileCalendarOpen] = useState(false);
  const [isMobileFoldersOpen, setIsMobileFoldersOpen] = useState(false);

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
    if (!confirm('Apakah Anda yakin ingin menghapus folder ini? Catatan di dalamnya tidak akan terhapus, melainkan dipindahkan ke "Tanpa Folder".')) return;
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
  };

  useEffect(() => {
    loadNotes();
    loadFolders();
  }, []);

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

  // Filter notes based on search query, selected date, and selected folder
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

    // 3. Filter by search query
    const q = searchQuery.toLowerCase();
    const matchesTitle = (note.title || '').toLowerCase().includes(q);
    const matchesContent = (note.content || '').toLowerCase().includes(q);
    const matchesTags = (note.tags || []).some((tag) => tag.toLowerCase().includes(q));
    return matchesTitle || matchesContent || matchesTags;
  });

  // Handle formatted note from voice recorder - opens folder selection modal
  const handleFormattedNote = (formattedData: {
    title: string;
    content: string;
    summary: string;
    tags: string[];
    todo_list: string[];
  }) => {
    setPendingNoteData(formattedData);
    setIsFolderModalOpen(true);
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
    if (!confirm('Apakah Anda yakin ingin menghapus catatan ini secara permanen?')) return;
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
            <button className={styles.mobileNewNoteBtn} onClick={handleCreateNewNote}>
              <Plus size={18} />
            </button>
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
                <NoteEditor
                  note={selectedNote}
                  onSave={handleSaveNote}
                  onDelete={handleDeleteNote}
                  onBack={() => setMobileView('list')}
                  folders={folders}
                />
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
                  Tulis Catatan
                </button>
                <button
                  className={styles.rekamAiBtn}
                  onClick={() => {
                    setSelectedNote(null);
                    setWorkspaceView('recorder');
                  }}
                >
                  <Mic size={14} />
                  Rekam AI
                </button>
              </div>
            </div>

            {/* Filter Chips Bar */}
            {(selectedFolderId || selectedDate || searchQuery) && (
              <div className={styles.filterChipsRow}>
                {selectedFolderId && (
                  <div className={styles.filterChip}>
                    <span>📂 {folders.find(f => f.id === selectedFolderId)?.name || 'Folder'}</span>
                    <button onClick={() => setSelectedFolderId(null)} title="Hapus Filter Folder">×</button>
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
    </div>
  );
}

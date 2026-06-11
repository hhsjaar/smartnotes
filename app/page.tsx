"use client";

import React, { useState, useEffect } from 'react';
import { FileText, Newspaper, Search, Plus, Sparkles, Mic, Trash2, Calendar as CalendarIcon, Folder as FolderIcon, Edit3 } from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { NoteCard } from '@/components/NoteCard';
import { NoteEditor } from '@/components/NoteEditor';
import { NewsSection } from '@/components/NewsSection';
import { GlowButton } from '@/components/ui/GlowButton';
import { Calendar } from '@/components/Calendar';
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'notes' | 'news' | 'recorder'>('notes');
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

  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [pendingNoteData, setPendingNoteData] = useState<any | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [isFoldersListOpen, setIsFoldersListOpen] = useState(true);

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
                {/* Search Bar */}
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

                {/* Collapsible Calendar for Mobile */}
                <div className={styles.mobileCalendarSection}>
                  <button
                    className={styles.mobileCalendarToggleBtn}
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarIcon size={16} />
                      <span>{selectedDate ? `Filter: ${selectedDate}` : 'Filter Tanggal (Kalender)'}</span>
                    </span>
                    <span className={`${styles.toggleArrow} ${isCalendarOpen ? styles.arrowUp : ''}`}>▼</span>
                  </button>

                  {isCalendarOpen && (
                    <div className={styles.mobileCalendarWrapper}>
                      <Calendar
                        notes={notes}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                      />
                    </div>
                  )}
                </div>

                {/* Collapsible Folders for Mobile */}
                <div className={styles.mobileFolderSection}>
                  <button
                    className={styles.mobileFolderToggleBtn}
                    onClick={() => setIsFoldersListOpen(!isFoldersListOpen)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderIcon size={16} style={{ color: 'var(--primary)' }} />
                      <span>{selectedFolderId ? `Folder: ${folders.find(f => f.id === selectedFolderId)?.name || ''}` : 'Filter Folder (Kategori)'}</span>
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
                    filteredNotes.map((note) => (
                      <button
                        key={note.id}
                        className={`${styles.mobileNoteCard} ${selectedNote?.id === note.id ? styles.activeMobileNoteCard : ''
                          }`}
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
                        <div className={styles.mobileNoteMeta}>
                          {note.tags?.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="tag-badge default" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))
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
            className={`${styles.navItem} ${activeTab === 'news' ? styles.activeNavItem : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <Newspaper size={18} />
            Berita Terkini
          </button>
        </nav>

        {/* Collapsible Calendar Section */}
        {activeTab === 'notes' && (
          <div className={styles.calendarSidebarSection}>
            <button
              className={styles.calendarToggleBtn}
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={15} />
                <span>Kalender Catatan</span>
              </span>
              <span className={`${styles.toggleArrow} ${isCalendarOpen ? styles.arrowUp : ''}`}>▼</span>
            </button>

            {isCalendarOpen && (
              <div className={styles.calendarWrapper}>
                <Calendar
                  notes={notes}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </div>
            )}
          </div>
        )}

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
 
        {/* Sidebar Notes List (Quick Access) */}
        {activeTab === 'notes' && (
          <div className={styles.notesSection}>
            <div className={styles.notesListHeader}>
              {selectedDate ? 'Catatan Terfilter' : 'Daftar Catatan'}
            </div>
            <div className={styles.notesList}>
              {isLoadingNotes ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.8rem', padding: '20px' }}>
                  Memuat catatan...
                </div>
              ) : filteredNotes.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.8rem', padding: '20px' }}>
                  Tidak ada catatan.
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    className={`${styles.sidebarNoteCard} ${selectedNote?.id === note.id ? styles.activeSidebarNoteCard : ''
                      }`}
                    onClick={() => setSelectedNote(note)}
                  >
                    <div className={styles.sidebarNoteTitle}>
                      {note.title || 'Catatan Tanpa Judul'}
                    </div>
                    <div className={styles.sidebarNoteMeta}>
                      <span>{note.tags?.[0] || 'Umum'}</span>
                      <span>
                        {new Date(note.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main Dashboard Area */}
      <main className={styles.mainContainer}>
        {/* Top Search bar */}
        <div className={styles.topBar}>
          {activeTab === 'notes' ? (
            <div className={styles.searchBar}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Cari judul, isi, atau tag catatan..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Membaca update berita Indonesia secara real-time
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <GlowButton variant="primary" onClick={handleCreateNewNote}>
              <Plus size={16} /> Catatan Baru
            </GlowButton>
          </div>
        </div>

        {/* Dashboard Grid Content */}
        <div className={styles.contentArea}>
          {activeTab === 'notes' ? (
            <div className={styles.notesLayoutGrid}>
              {/* Left Column: Voice Recorder */}
              <div className={styles.leftColumn}>
                <VoiceRecorder onFormatted={handleFormattedNote} />
              </div>

              {/* Right Column: Note Editor */}
              <div className={styles.rightColumn}>
                <NoteEditor
                  note={selectedNote}
                  onSave={handleSaveNote}
                  onDelete={handleDeleteNote}
                  folders={folders}
                />
              </div>
            </div>
          ) : (
            <div className={styles.fullWidthArea}>
              <NewsSection onCreateNoteFromNews={handleCreateNoteFromNews} />
            </div>
          )}
        </div>
      </main>

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

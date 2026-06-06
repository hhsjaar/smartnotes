"use client";

import React, { useState, useEffect } from 'react';
import { FileText, Newspaper, Search, Plus, Sparkles, Mic, Trash2 } from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { NoteCard } from '@/components/NoteCard';
import { NoteEditor } from '@/components/NoteEditor';
import { NewsSection } from '@/components/NewsSection';
import { GlowButton } from '@/components/ui/GlowButton';
import styles from './page.module.css';

interface Note {
  id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  todo_list: { text: string; completed: boolean }[] | string[];
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
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load notes from Supabase
  const loadNotes = async () => {
    setIsLoadingNotes(true);
    try {
      const res = await fetch('/api/notes');
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      setNotes(data);
      // Automatically select the first note if none is selected
      if (data.length > 0 && !selectedNote) {
        // Keep selection if it already exists in the new list, otherwise select first
        setSelectedNote(data[0]);
      }
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  // Filter notes based on search query
  const filteredNotes = notes.filter((note) => {
    const q = searchQuery.toLowerCase();
    const matchesTitle = (note.title || '').toLowerCase().includes(q);
    const matchesContent = (note.content || '').toLowerCase().includes(q);
    const matchesTags = (note.tags || []).some((tag) => tag.toLowerCase().includes(q));
    return matchesTitle || matchesContent || matchesTags;
  });

  // Handle formatted note from voice recorder
  const handleFormattedNote = async (formattedData: {
    title: string;
    content: string;
    summary: string;
    tags: string[];
    todo_list: string[];
  }) => {
    try {
      // Map string todo list to objects
      const parsedTodos = formattedData.todo_list.map((task) => ({
        text: task,
        completed: false,
      }));

      const newNote = {
        title: formattedData.title,
        content: formattedData.content,
        summary: formattedData.summary,
        tags: formattedData.tags,
        todo_list: parsedTodos,
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
      if (window.innerWidth <= 768) {
        setMobileView('editor');
      }
    } catch (err) {
      console.error('Error saving new AI note:', err);
      alert('Gagal menyimpan catatan baru ke database.');
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
      const blankNote = {
        title: 'Catatan Baru',
        content: '',
        summary: '',
        tags: ['Pribadi'],
        todo_list: [],
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
      </div>
    );
  }

  return (
    <div className={styles.layout}>
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

        {/* Sidebar Notes List (Quick Access) */}
        {activeTab === 'notes' && (
          <div className={styles.notesSection}>
            <div className={styles.notesListHeader}>Daftar Catatan</div>
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
    </div>
  );
}

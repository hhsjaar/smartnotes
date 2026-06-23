"use client";

import React, { useState, useEffect } from 'react';
import { Edit3, Check, Trash2, Calendar, FileText, CheckSquare, Sparkles, Tag, Plus, X, ArrowLeft, Copy, Mic } from 'lucide-react';
import { GlowButton } from './ui/GlowButton';
import styles from './NoteEditor.module.css';

interface Note {
  id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  todo_list: { text: string; completed: boolean }[] | string[]; // support both format
  created_at: string;
  folder_id?: string | null;
}

interface Folder {
  id: string;
  name: string;
  created_at: string;
}

interface NoteEditorProps {
  note: Note | null;
  onSave: (updatedNote: Partial<Note>) => Promise<void>;
  onDelete: (id: string) => void;
  onBack?: () => void;
  folders: Folder[];
  onToggleRecorder?: () => void;
  onCreateFolder?: (name: string) => Promise<Folder | null>;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onDelete, onBack, folders, onToggleRecorder, onCreateFolder }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [todos, setTodos] = useState<{ text: string; completed: boolean }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isTodosExpanded, setIsTodosExpanded] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'content' | 'summary' | 'todos'>('content');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);



  // Detect mobile viewport
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync state with note prop changes
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setSummary(note.summary || '');
      setTags(note.tags || []);

      // Parse todo list to ensure {text, completed} format
      let parsedTodos: { text: string; completed: boolean }[] = [];
      if (note.todo_list) {
        parsedTodos = (note.todo_list as any[]).map((item) => {
          if (typeof item === 'string') {
            return { text: item, completed: false };
          }
          return { text: item.text || '', completed: !!item.completed };
        });
      }
      setTodos(parsedTodos);
      setFolderId(note.folder_id || null);
      setIsEditing(false);
      setActiveSubTab('content'); // Reset sub-tab on note switch
    }
  }, [note]);

  if (!note) {
    return (
      <div className={`${styles.noSelect} glass-panel`}>
        <FileText size={64} style={{ color: 'var(--text-dark)' }} />
        <h3>Belum Ada Catatan Terpilih</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Pilih catatan dari daftar di kiri, atau rekam suara baru untuk membuat catatan cerdas.
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        id: note.id,
        title,
        content,
        summary,
        tags,
        todo_list: todos,
        folder_id: folderId,
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTodoToggle = async (index: number) => {
    const updatedTodos = todos.map((todo, idx) =>
      idx === index ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);
    // Auto save todo state in background
    try {
      await onSave({
        id: note.id,
        todo_list: updatedTodos,
      });
    } catch (e) {
      console.error('Failed to auto-save todo state:', e);
    }
  };

  const handleCopy = (text: string, section: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    });
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  // Safe client-side Markdown rendering
  const renderMarkdown = (md: string) => {
    if (!md) return { __html: '<p style="color: var(--text-dark); font-style: italic;">Tidak ada konten.</p>' };

    // Escape HTML characters
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italics (rendered as bold)
    html = html.replace(/\*(?!\s)(.*?)(?<!\s)\*/gim, '<strong>$1</strong>');

    // Blockquotes
    html = html.replace(/^\>\s+(.*$)/gim, '<blockquote>$1</blockquote>');

    // Split lines and parse lists and paragraphs
    const lines = html.split('\n');
    let output: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for bullet list item
      const bulletMatch = lines[i].match(/^(\s*)[\-\*]\s+(.*$)/);
      // Check for numbered list item
      const numberMatch = lines[i].match(/^(\s*)\d+\.\s+(.*$)/);

      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) output.push(`</${listType}>`);
          output.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        output.push(`<li>${bulletMatch[2]}</li>`);
      } else if (numberMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) output.push(`</${listType}>`);
          output.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        output.push(`<li>${numberMatch[2]}</li>`);
      } else {
        if (inList) {
          output.push(`</${listType}>`);
          inList = false;
          listType = null;
        }

        if (line === '') {
          output.push('<br/>');
        } else if (line.startsWith('<h') || line.startsWith('<block')) {
          output.push(lines[i]); // Already formatted
        } else {
          output.push(`<p>${lines[i]}</p>`);
        }
      }
    }

    if (inList) {
      output.push(`</${listType}>`);
    }

    return { __html: output.join('\n') };
  };

  return (
    <div className={`${styles.editorContainer} glass-panel`}>
      <div className={styles.header}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack} title="Kembali ke Daftar">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className={styles.titleArea}>
          {isEditing ? (
            <input
              type="text"
              className={styles.titleInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul Catatan..."
            />
          ) : (
            <h2 className={styles.title}>{title || 'Catatan Tanpa Judul'}</h2>
          )}
          <div className={styles.metadata}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={14} />
              {formatDate(note.created_at)}
            </span>
            {isEditing ? (
              <div className={styles.folderSelectContainer}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Folder:</span>
                <select
                  className={styles.folderSelect}
                  value={folderId || ''}
                  onChange={(e) => setFolderId(e.target.value || null)}
                >
                  <option value="">Tanpa Folder (Umum)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {onCreateFolder && (
                  <button
                    type="button"
                    className={styles.newFolderBtn}
                    onClick={async () => {
                      const name = prompt('Masukkan nama folder baru:');
                      if (name && name.trim()) {
                        const newFolder = await onCreateFolder(name.trim());
                        if (newFolder) {
                          setFolderId(newFolder.id);
                        }
                      }
                    }}
                    title="Tambah Folder Baru"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            ) : (
              note.folder_id && folders.find(f => f.id === note.folder_id) && (
                <span className={styles.folderBadge}>
                  📂 {folders.find(f => f.id === note.folder_id)?.name}
                </span>
              )
            )}
          </div>
        </div>

        <div className={styles.actions}>
          {isEditing ? (
            <button className={`${styles.actionIconBtn} ${styles.saveBtn}`} onClick={handleSave} disabled={isSaving}>
              <Check size={18} />
              {!isMobile && <span style={{ marginLeft: '6px' }}>Simpan</span>}
            </button>
          ) : (
            <>
              {onToggleRecorder && (
                <button className={`${styles.actionIconBtn} ${styles.recorderShortcutBtn}`} onClick={onToggleRecorder} title="Input Suara Cerdas (AI)">
                  <Mic size={16} style={{ color: 'var(--secondary)', marginRight: !isMobile ? '6px' : '0' }} />
                  {!isMobile && <span>Input Suara AI</span>}
                </button>
              )}
              <button className={`${styles.actionIconBtn} ${styles.editBtn}`} onClick={() => setIsEditing(true)}>
                <Edit3 size={16} />
                {!isMobile && <span style={{ marginLeft: '6px' }}>Edit</span>}
              </button>

            </>
          )}
          <button className={`${styles.actionIconBtn} ${styles.deleteBtn}`} onClick={() => onDelete(note.id)}>
            <Trash2 size={16} />
            {!isMobile && <span style={{ marginLeft: '6px' }}>Hapus</span>}
          </button>
        </div>
      </div>

      {/* Sub-tab navigation inside Editor on Mobile */}
      {isMobile && (
        <div className={styles.subTabBar}>
          <button
            className={`${styles.subTab} ${activeSubTab === 'content' ? styles.activeSubTab : ''}`}
            onClick={() => setActiveSubTab('content')}
          >
            <FileText size={16} />
            <span>Konten</span>
          </button>
          <button
            className={`${styles.subTab} ${activeSubTab === 'summary' ? styles.activeSubTab : ''}`}
            onClick={() => setActiveSubTab('summary')}
          >
            <Sparkles size={16} />
            <span>Teks Asli</span>
          </button>
          <button
            className={`${styles.subTab} ${activeSubTab === 'todos' ? styles.activeSubTab : ''}`}
            onClick={() => setActiveSubTab('todos')}
          >
            <CheckSquare size={16} />
            <span>Tugas</span>
          </button>
        </div>
      )}

      <div className={styles.contentWrapper}>
        {isMobile ? (
          <div className={styles.mobileTabContent}>
            {activeSubTab === 'content' && (
              <div className={styles.mainContent}>
                <button
                  className={styles.copyBtn}
                  onClick={() => handleCopy(content, 'content')}
                  title="Salin Konten Catatan"
                >
                  {copiedSection === 'content' ? (
                    <>
                      <Check size={14} style={{ color: '#22c55e' }} />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Salin</span>
                    </>
                  )}
                </button>
                {isEditing ? (
                  <textarea
                    className={styles.textarea}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Tulis catatan Anda di sini (mendukung Markdown)..."
                  />
                ) : (
                  <div
                    className={`${styles.previewArea} markdown-body`}
                    dangerouslySetInnerHTML={renderMarkdown(content)}
                  />
                )}
              </div>
            )}

            {activeSubTab === 'summary' && (
              <div className={styles.mobileSummaryTab}>
                {summary ? (
                  <div className={styles.panelCard}>
                    <button
                      className={styles.copyBtn}
                      onClick={() => handleCopy(summary, 'summary')}
                      title="Salin Teks Asli Rekaman"
                    >
                      {copiedSection === 'summary' ? (
                        <>
                          <Check size={14} style={{ color: '#22c55e' }} />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                    <h4 className={styles.panelTitle}>
                      <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                      Teks Asli Rekaman
                    </h4>
                    <p className={styles.summaryText} style={{ whiteSpace: 'pre-wrap' }}>{summary}</p>
                  </div>
                ) : (
                  <div className={styles.emptyTabState}>
                    <Sparkles size={32} style={{ color: 'var(--accent)', opacity: 0.5 }} />
                    <p>Belum ada teks asli rekaman untuk catatan ini.</p>
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'todos' && (
              <div className={styles.mobileTodosTab}>
                {todos.length > 0 ? (
                  <div className={styles.panelCard}>
                    <button
                      className={styles.copyBtn}
                      onClick={() => {
                        const todosText = todos.map(t => `${t.completed ? '[x]' : '[ ]'} ${t.text}`).join('\n');
                        handleCopy(todosText, 'todos');
                      }}
                      title="Salin Daftar Tugas"
                    >
                      {copiedSection === 'todos' ? (
                        <>
                          <Check size={14} style={{ color: '#22c55e' }} />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                    <h4 className={styles.panelTitle}>
                      <CheckSquare size={16} style={{ color: 'var(--secondary)' }} />
                      Daftar Tugas (Action Items)
                    </h4>
                    <div className={styles.todoList}>
                      {todos.map((todo, idx) => (
                        <label key={idx} className={styles.todoItem}>
                          <input
                            type="checkbox"
                            className={styles.todoCheckbox}
                            checked={todo.completed}
                            onChange={() => handleTodoToggle(idx)}
                          />
                          <span className={todo.completed ? styles.todoCompleted : ''}>
                            {todo.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyTabState}>
                    <CheckSquare size={32} style={{ color: 'var(--secondary)', opacity: 0.5 }} />
                    <p>Tidak ada tugas tindakan terdeteksi.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Single-Scroll Notion-like document flow */}
            
            {/* 1. Summary Collapsible Section */}
            {summary && (
              <div className={`${styles.collapsiblePanel} ${isSummaryExpanded ? styles.expanded : ''}`}>
                <button
                  type="button"
                  className={styles.collapsibleHeader}
                  onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                >
                  <div className={styles.collapsibleHeaderTitle}>
                    <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                    <span>Teks Asli Rekaman</span>
                  </div>
                  <span className={`${styles.collapsibleArrow} ${isSummaryExpanded ? styles.arrowUp : ''}`}>▼</span>
                </button>
                {isSummaryExpanded && (
                  <div className={styles.collapsibleContent}>
                    <button
                      className={styles.copyBtn}
                      onClick={() => handleCopy(summary, 'summary')}
                      title="Salin Teks Asli Rekaman"
                    >
                      {copiedSection === 'summary' ? (
                        <>
                          <Check size={14} style={{ color: '#22c55e' }} />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                    <p className={styles.summaryText} style={{ whiteSpace: 'pre-wrap' }}>{summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Todos Collapsible Section */}
            {todos.length > 0 && (
              <div className={`${styles.collapsiblePanel} ${isTodosExpanded ? styles.expanded : ''}`}>
                <button
                  type="button"
                  className={styles.collapsibleHeader}
                  onClick={() => setIsTodosExpanded(!isTodosExpanded)}
                >
                  <div className={styles.collapsibleHeaderTitle}>
                    <CheckSquare size={16} style={{ color: 'var(--secondary)' }} />
                    <span>Daftar Tugas ({todos.filter(t => t.completed).length}/${todos.length} Selesai)</span>
                  </div>
                  <span className={`${styles.collapsibleArrow} ${isTodosExpanded ? styles.arrowUp : ''}`}>▼</span>
                </button>
                {isTodosExpanded && (
                  <div className={styles.collapsibleContent}>
                    <button
                      className={styles.copyBtn}
                      onClick={() => {
                        const todosText = todos.map(t => `${t.completed ? '[x]' : '[ ]'} ${t.text}`).join('\n');
                        handleCopy(todosText, 'todos');
                      }}
                      title="Salin Daftar Tugas"
                    >
                      {copiedSection === 'todos' ? (
                        <>
                          <Check size={14} style={{ color: '#22c55e' }} />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                    <div className={styles.todoList}>
                      {todos.map((todo, idx) => (
                        <label key={idx} className={styles.todoItem}>
                          <input
                            type="checkbox"
                            className={styles.todoCheckbox}
                            checked={todo.completed}
                            onChange={() => handleTodoToggle(idx)}
                          />
                          <span className={todo.completed ? styles.todoCompleted : ''}>
                            {todo.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Main Note Content (Editor or Preview) */}
            <div className={styles.mainContent}>
              <button
                className={styles.copyBtn}
                onClick={() => handleCopy(content, 'content')}
                title="Salin Konten Catatan"
              >
                {copiedSection === 'content' ? (
                  <>
                    <Check size={14} style={{ color: '#22c55e' }} />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Salin</span>
                  </>
                )}
              </button>
              {isEditing ? (
                <textarea
                  className={styles.textarea}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tulis catatan Anda di sini (mendukung Markdown)..."
                />
              ) : (
                <div
                  className={`${styles.previewArea} markdown-body`}
                  dangerouslySetInnerHTML={renderMarkdown(content)}
                />
              )}
            </div>
          </>
        )}
      </div>


    </div>
  );
};

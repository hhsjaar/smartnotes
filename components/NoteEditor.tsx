"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Edit3, Check, Trash2, Calendar, FileText, CheckSquare, Sparkles, Tag, Plus, X, ArrowLeft, Copy, Mic, FolderInput, Square, Upload, AlertCircle, List, FileAudio, Shield } from 'lucide-react';
import { GlowButton } from './ui/GlowButton';
import styles from './NoteEditor.module.css';

// Declare SpeechRecognition properties safely on window
const SpeechRecognition = typeof window !== 'undefined' 
  ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) 
  : null;

function mergeTranscripts(accumulated: string, current: string): string {
  const accClean = accumulated.trim();
  const currClean = current.trim();
  
  if (!accClean) return currClean;
  if (!currClean) return accClean;

  const accWords = accClean.split(/\s+/);
  const currWords = currClean.split(/\s+/);

  const maxOverlap = Math.min(accWords.length, currWords.length);
  let overlapLength = 0;

  for (let len = 1; len <= maxOverlap; len++) {
    let match = true;
    for (let i = 0; i < len; i++) {
      const accWord = accWords[accWords.length - len + i].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      const currWord = currWords[i].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      if (accWord !== currWord) {
        match = false;
        break;
      }
    }
    if (match) {
      overlapLength = len;
    }
  }

  if (overlapLength > 0) {
    const nonOverlapping = currWords.slice(overlapLength).join(' ');
    return nonOverlapping ? `${accClean} ${nonOverlapping}` : accClean;
  }

  return `${accClean} ${currClean}`;
}

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
  parentId?: string | null;
}

const getSortedFolderTree = (foldersList: Folder[]) => {
  const rootFolders = foldersList.filter(f => !f.parentId);
  const result: (Folder & { depth: number })[] = [];
  
  rootFolders.forEach(root => {
    result.push({ ...root, depth: 0 });
    const children = foldersList.filter(f => f.parentId === root.id);
    children.forEach(child => {
      result.push({ ...child, depth: 1 });
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

interface NoteEditorProps {
  note: Note | null;
  onSave: (updatedNote: Partial<Note>) => Promise<void>;
  onDelete: (id: string) => void;
  onBack?: () => void;
  folders: Folder[];
  onToggleRecorder?: () => void;
  onCreateFolder?: (name: string) => Promise<Folder | null>;
  onCopy?: (id: string) => void;
  onMove?: (id: string, folderId: string | null) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onDelete, onBack, folders, onToggleRecorder, onCreateFolder, onCopy, onMove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [todos, setTodos] = useState<{ text: string; completed: boolean }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isTodosExpanded, setIsTodosExpanded] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'content' | 'summary' | 'todos'>('content');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Inline Recorder States
  const [showInlineRecorder, setShowInlineRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('id-ID');
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'standard' | 'laporan' | 'intel' | 'poin' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRecordingRef = useRef(false);
  const accumulatedTextRef = useRef('');
  const currentFinalRef = useRef('');

  // Synchronize isRecording state to ref
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Speech Recognition hook
  useEffect(() => {
    if (!SpeechRecognition) return;

    const createInstance = (): any => {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = language;

      rec.onresult = (event: any) => {
        if (recognitionRef.current !== rec) return;

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript.trim();
            finalTranscript = mergeTranscripts(finalTranscript, text);
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        finalTranscript = finalTranscript.trim();
        currentFinalRef.current = finalTranscript;

        const totalFinal = mergeTranscripts(accumulatedTextRef.current, finalTranscript);
        const display = (totalFinal + ' ' + interimTranscript).trim();
        
        setTranscript(display);
      };

      rec.onerror = (event: any) => {
        if (recognitionRef.current !== rec) return;
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Izin mikrofon ditolak. Silakan aktifkan izin mikrofon di pengaturan browser Anda.');
          setIsRecording(false);
          isRecordingRef.current = false;
        } else if (event.error === 'no-speech') {
          // Ignore silence cuts
        } else {
          setErrorMsg(`Error perekaman: ${event.error}. Silakan coba lagi.`);
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      };

      rec.onend = () => {
        if (recognitionRef.current !== rec) return;

        if (isRecordingRef.current) {
          const prevAccumulated = accumulatedTextRef.current;
          const currentFinal = currentFinalRef.current;
          accumulatedTextRef.current = mergeTranscripts(prevAccumulated, currentFinal);
          currentFinalRef.current = '';
          
          setTimeout(() => {
            if (isRecordingRef.current) {
              try {
                if (recognitionRef.current) {
                  try { recognitionRef.current.abort(); } catch (e) {}
                }
                const newInstance = createInstance();
                recognitionRef.current = newInstance;
                newInstance.start();
              } catch (e: any) {
                console.error('Failed to restart speech recognition:', e);
              }
            }
          }, 100);
        }
      };

      return rec;
    };

    const initialRec = createInstance();
    recognitionRef.current = initialRec;

    return () => {
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, [language]);

  const startRecording = async () => {
    setErrorMsg('');
    setTranscript('');
    accumulatedTextRef.current = '';
    currentFinalRef.current = '';
    
    if (!recognitionRef.current) {
      setErrorMsg('Fitur perekaman suara langsung tidak didukung oleh browser Anda.');
      return;
    }

    try {
      setIsRecording(true);
      setStatusMsg('Mendengarkan suara Anda...');
      recognitionRef.current.start();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      setErrorMsg('Gagal memulai perekaman suara.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatusMsg('Perekaman selesai. Siap diproses.');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 1024 * 1024 * 1024) {
        setErrorMsg('Ukuran file maksimal adalah 1GB.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processTranscription = async (formatType: 'standard' | 'laporan' | 'intel' | 'poin' = 'standard') => {
    if (!file) return;
    
    setIsRecordingLoading(true);
    setLoadingType(formatType);
    setErrorMsg('');
    setStatusMsg('Mentranskripsi berkas audio menggunakan AI (Gemini)...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal melakukan transkripsi');
      }

      const data = await res.json();
      setTranscript(data.text);
      setStatusMsg('Transkripsi selesai! Sekarang sedang memformat catatan...');
      
      await processFormatting(data.text, formatType);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mentranskripsi audio.');
      setIsRecordingLoading(false);
      setLoadingType(null);
    }
  };

  const processFormatting = async (textToFormat: string, formatType: 'standard' | 'laporan' | 'intel' | 'poin' = 'standard') => {
    if (!note) return;
    const rawText = textToFormat || transcript;
    if (!rawText.trim()) {
      setErrorMsg('Teks transkripsi kosong. Silakan rekam suara Anda terlebih dahulu.');
      setIsRecordingLoading(false);
      return;
    }

    setIsRecordingLoading(true);
    setLoadingType(formatType);
    setErrorMsg('');
    
    let statusText = 'AI sedang menyusun, memparagraf, dan merapikan catatan Anda...';
    if (formatType === 'laporan') {
      statusText = 'AI sedang menyusun Laporan Kegiatan dari catatan suara Anda...';
    } else if (formatType === 'intel') {
      statusText = 'AI sedang menyusun Laporan Intel dari catatan suara Anda...';
    } else if (formatType === 'poin') {
      statusText = 'AI sedang merangkum catatan Anda dalam bentuk poin-poin singkat...';
    }
    setStatusMsg(statusText);

    try {
      const res = await fetch('/api/notes/format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: rawText, 
          formatType,
          selectedFolderIds: folderId ? [folderId] : [],
          singleNote: true
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal memformat catatan');
      }

      const responseData = await res.json();
      if (responseData.notes && responseData.notes.length > 0) {
        const formattedNoteData = responseData.notes[0];
        
        // Update local editor states
        setTitle(formattedNoteData.title || title);
        setContent(formattedNoteData.content || '');
        setSummary(formattedNoteData.summary || '');
        setTags(formattedNoteData.tags || []);
        
        const parsedTodos = formattedNoteData.todo_list ? formattedNoteData.todo_list.map((task: any) => {
          if (typeof task === 'string') return { text: task, completed: false };
          return { text: task.text || '', completed: !!task.completed };
        }) : [];
        setTodos(parsedTodos);

        // Call onSave to update the active note in database directly
        await onSave({
          id: note.id,
          title: formattedNoteData.title || title,
          content: formattedNoteData.content || '',
          summary: formattedNoteData.summary || '',
          tags: formattedNoteData.tags || [],
          todo_list: parsedTodos,
          folder_id: folderId
        });

        // Close inline recorder
        setShowInlineRecorder(false);
        setTranscript('');
        setFile(null);
      } else {
        throw new Error('AI tidak mengembalikan format catatan yang valid.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal memproses kecerdasan catatan.');
    } finally {
      setIsRecordingLoading(false);
      setLoadingType(null);
    }
  };



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
      setTargetMoveFolderId(note.folder_id || null);
      setIsMoving(false);
      setIsEditing(false);
      setActiveSubTab('content'); // Reset sub-tab on note switch
    }
  }, [note]);

  const handleConfirmMove = () => {
    if (note && onMove) {
      onMove(note.id, targetMoveFolderId);
      setIsMoving(false);
    }
  };

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
    html = html.replace(/\*\*(.*?)\*\//gim, '<strong>$1</strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italics (rendered as bold)
    html = html.replace(/\*(?!\s)(.*?)(?<!\s)\*/gim, '<strong>$1</strong>');

    // Blockquotes
    html = html.replace(/^\>\s+(.*$)/gim, '<blockquote>$1</blockquote>');

    // Split lines and parse lists, tables, and paragraphs
    const lines = html.split('\n');
    let output: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    let inTable = false;
    let tableAlignments: Array<'left' | 'center' | 'right' | null> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isTableRow = line.startsWith('|') && line.endsWith('|') && line.length > 1;

      if (isTableRow) {
        if (inList) {
          output.push(`</${listType}>`);
          inList = false;
          listType = null;
        }

        const rawCells = line.split('|').slice(1, -1);
        const cells = rawCells.map(c => c.trim());
        const isSeparator = cells.every(c => c.match(/^[:\-\s]+$/));

        if (isSeparator) {
          tableAlignments = cells.map(c => {
            const trimmed = c.trim();
            const left = trimmed.startsWith(':');
            const right = trimmed.endsWith(':');
            if (left && right) return 'center';
            if (right) return 'right';
            if (left) return 'left';
            return null;
          });
          continue;
        }

        if (!inTable) {
          output.push('<div style="overflow-x: auto; margin: 16px 0;"><table style="width:100%; border-collapse:collapse; margin-bottom:1em; font-size:14px; text-align:left;">');
          inTable = true;
          output.push('<thead><tr style="border-bottom:2px solid var(--border-color); background-color:rgba(255,255,255,0.03);">');
          cells.forEach((cell, idx) => {
            const align = tableAlignments[idx] || 'left';
            output.push(`<th style="padding:10px 12px; font-weight:600; text-align:${align}; border:1px solid var(--border-color);">${cell}</th>`);
          });
          output.push('</tr></thead><tbody>');
        } else {
          output.push('<tr style="border-bottom:1px solid var(--border-color); transition: background-color 0.2s;">');
          cells.forEach((cell, idx) => {
            const align = tableAlignments[idx] || 'left';
            output.push(`<td style="padding:10px 12px; text-align:${align}; border:1px solid var(--border-color);">${cell}</td>`);
          });
          output.push('</tr>');
        }
        continue;
      } else {
        if (inTable) {
          output.push('</tbody></table></div>');
          inTable = false;
          tableAlignments = [];
        }
      }

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
        } else if (line.startsWith('<h') || line.startsWith('<block') || line.startsWith('<div')) {
          output.push(lines[i]); // Already formatted or wrapper
        } else {
          output.push(`<p>${lines[i]}</p>`);
        }
      }
    }

    if (inList) {
      output.push(`</${listType}>`);
    }
    if (inTable) {
      output.push('</tbody></table></div>');
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
                  {getSortedFolderTree(folders).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.depth > 0 ? `↳ ${f.name}` : f.name}
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
          {isMoving ? (
            <div className={styles.moveActionsWrapper}>
              <select
                className={styles.moveFolderSelect}
                value={targetMoveFolderId || ''}
                onChange={(e) => setTargetMoveFolderId(e.target.value || null)}
              >
                <option value="">Tanpa Folder (Umum)</option>
                {getSortedFolderTree(folders).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.depth > 0 ? `↳ ${f.name}` : f.name}
                  </option>
                ))}
              </select>
              <button className={`${styles.actionIconBtn} ${styles.saveBtn}`} onClick={handleConfirmMove}>
                <Check size={16} />
                <span>Pindahkan</span>
              </button>
              <button className={`${styles.actionIconBtn} ${styles.deleteBtn}`} onClick={() => setIsMoving(false)}>
                <X size={16} />
                <span>Batal</span>
              </button>
            </div>
          ) : isEditing ? (
            <button className={`${styles.actionIconBtn} ${styles.saveBtn}`} onClick={handleSave} disabled={isSaving}>
              <Check size={18} />
              {!isMobile && <span style={{ marginLeft: '6px' }}>Simpan</span>}
            </button>
          ) : (
            <>
              <button className={`${styles.actionIconBtn} ${styles.recorderShortcutBtn} ${showInlineRecorder ? styles.recorderShortcutBtnActive : ''}`} onClick={() => setShowInlineRecorder(!showInlineRecorder)} title="Input Suara AI ke Catatan Ini">
                <Mic size={16} style={{ color: 'var(--secondary)', marginRight: !isMobile ? '6px' : '0' }} />
                {!isMobile && <span>Input Suara AI</span>}
              </button>
              <button className={`${styles.actionIconBtn} ${styles.editBtn}`} onClick={() => setIsEditing(true)} title="Edit Catatan">
                <Edit3 size={16} />
                {!isMobile && <span style={{ marginLeft: '6px' }}>Edit</span>}
              </button>
              {onCopy && (
                <button className={`${styles.actionIconBtn} ${styles.copyBtn}`} onClick={() => onCopy(note.id)} title="Salin Catatan">
                  <Copy size={16} />
                  {!isMobile && <span style={{ marginLeft: '6px' }}>Salin</span>}
                </button>
              )}
              <button className={`${styles.actionIconBtn} ${styles.moveBtn}`} onClick={() => setIsMoving(true)} title="Pindahkan Catatan ke Folder Lain">
                <FolderInput size={16} />
                {!isMobile && <span style={{ marginLeft: '6px' }}>Pindahkan</span>}
              </button>
            </>
          )}
          {!isMoving && (
            <button className={`${styles.actionIconBtn} ${styles.deleteBtn}`} onClick={() => onDelete(note.id)}>
              <Trash2 size={16} />
              {!isMobile && <span style={{ marginLeft: '6px' }}>Hapus</span>}
            </button>
          )}
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

      {showInlineRecorder && (
        <div className={styles.inlineRecorderSection}>
          <div className={styles.inlineRecorderHeader}>
            <span className={styles.inlineRecorderTitle}>
              <Mic size={16} style={{ color: 'var(--secondary)' }} />
              Rekam Suara & Parafrase AI (Catatan Tunggal)
            </span>
            <button 
              className={styles.closeRecorderBtn} 
              onClick={() => {
                setShowInlineRecorder(false);
                setTranscript('');
                setFile(null);
                setErrorMsg('');
                setStatusMsg('');
              }}
              disabled={isRecordingLoading}
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.inlineRecorderBody}>
            {/* Centered recording control deck */}
            <div className={styles.recordDeck}>
              <button
                type="button"
                className={`${styles.deckRecordBtn} ${isRecording ? styles.deckRecordBtnActive : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isRecordingLoading}
                title={isRecording ? 'Klik untuk menyelesaikan rekaman' : 'Klik untuk mulai merekam suara'}
              >
                {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={24} />}
              </button>
              
              <div className={styles.deckStatus}>
                {isRecording ? (
                  <span className={styles.deckStatusActive}>
                    <span className={styles.deckPulseDot} />
                    Merekam... Ketuk untuk Selesai
                  </span>
                ) : (
                  statusMsg || 'Ketuk mikrofon di atas untuk mulai merekam'
                )}
              </div>
            </div>

            {/* Sub-controls: Language Selector & Audio Upload */}
            {!isRecording && (
              <div className={styles.deckControls}>
                <div className={styles.deckControlItem}>
                  <span className={styles.deckLabel}>Bahasa</span>
                  <select
                    className={styles.inlineLangSelect}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={isRecordingLoading}
                  >
                    <option value="id-ID">🇮🇩 Indonesia</option>
                    <option value="en-US">🇺🇸 English</option>
                  </select>
                </div>

                <div className={styles.deckControlItem}>
                  <span className={styles.deckLabel}>File Audio</span>
                  {!file ? (
                    <button
                      type="button"
                      className={styles.inlineUploadBtn}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRecordingLoading}
                    >
                      <Upload size={13} />
                      <span>Unggah File</span>
                    </button>
                  ) : (
                    <div className={styles.inlineSelectedFile}>
                      <span className={styles.inlineFileName}>{file.name}</span>
                      <button className={styles.inlineRemoveFile} onClick={removeFile} disabled={isRecordingLoading}>×</button>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="audio/*"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            )}

            {/* Waveform for recording */}
            {isRecording && (
              <div className={styles.inlineWaveform}>
                {[...Array(9)].map((_, i) => (
                  <div key={i} className={styles.inlineWaveBar} />
                ))}
              </div>
            )}

            {errorMsg && (
              <div className={styles.inlineErrorMsg}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Real-time transcript preview */}
            {transcript && (
              <div className={styles.inlineTranscriptArea}>
                {transcript}
              </div>
            )}

            {/* Formatting cards */}
            {(transcript || file) && !isRecording && (
              <div className={styles.inlineFormatSection}>
                <div className={styles.inlineFormatLabel}>
                  {file ? 'Pilih Gaya Transkripsi & Parafrase AI:' : 'Pilih Gaya Parafrase AI:'}
                </div>
                <div className={styles.inlineFormatGrid}>
                  <button
                    className={`${styles.inlineFormatCard} ${loadingType === 'standard' ? styles.inlineFormatCardLoading : ''}`}
                    onClick={() => file ? processTranscription('standard') : processFormatting('', 'standard')}
                    disabled={isRecordingLoading}
                  >
                    <Sparkles size={16} className={styles.inlineFormatIconAccent} />
                    <span className={styles.inlineFormatName}>Format AI</span>
                    {loadingType === 'standard' && <div className={styles.inlineSpinner} />}
                  </button>

                  <button
                    className={`${styles.inlineFormatCard} ${loadingType === 'poin' ? styles.inlineFormatCardLoading : ''}`}
                    onClick={() => file ? processTranscription('poin') : processFormatting('', 'poin')}
                    disabled={isRecordingLoading}
                  >
                    <List size={16} className={styles.inlineFormatIconPurple} />
                    <span className={styles.inlineFormatName}>Point AI</span>
                    {loadingType === 'poin' && <div className={styles.inlineSpinner} />}
                  </button>

                  <button
                    className={`${styles.inlineFormatCard} ${loadingType === 'laporan' ? styles.inlineFormatCardLoading : ''}`}
                    onClick={() => file ? processTranscription('laporan') : processFormatting('', 'laporan')}
                    disabled={isRecordingLoading}
                  >
                    <FileText size={16} className={styles.inlineFormatIconBlue} />
                    <span className={styles.inlineFormatName}>Laporan Kegiatan</span>
                    {loadingType === 'laporan' && <div className={styles.inlineSpinner} />}
                  </button>

                  <button
                    className={`${styles.inlineFormatCard} ${loadingType === 'intel' ? styles.inlineFormatCardLoading : ''}`}
                    onClick={() => file ? processTranscription('intel') : processFormatting('', 'intel')}
                    disabled={isRecordingLoading}
                  >
                    <Shield size={16} className={styles.inlineFormatIconOrange} />
                    <span className={styles.inlineFormatName}>Laporan Intel</span>
                    {loadingType === 'intel' && <div className={styles.inlineSpinner} />}
                  </button>
                </div>
              </div>
            )}
          </div>
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

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Upload, Trash2, Sparkles, FileAudio, AlertCircle, FileText, Folder, FolderCheck } from 'lucide-react';
import { GlowButton } from './ui/GlowButton';
import styles from './VoiceRecorder.module.css';

interface FormattedNote {
  notes?: Array<{
    title: string;
    content: string;
    summary: string;
    tags: string[];
    todo_list: string[];
    folderId: string | null;
    folderName: string | null;
  }>;
}

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

interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
}

interface VoiceRecorderProps {
  folders?: Folder[];
  initialCheckedFolderIds?: string[];
  onFormatted: (note: FormattedNote, targetFolderIds?: string[]) => void;
  autoStart?: boolean;
  onAutoStartTriggered?: () => void;
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

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  folders = [], 
  initialCheckedFolderIds = [],
  onFormatted, 
  autoStart, 
  onAutoStartTriggered 
}) => {
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('id-ID');
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'standard' | 'laporan' | 'intel' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [checkedFolderIds, setCheckedFolderIds] = useState<string[]>([]);

  // Sync initialCheckedFolderIds prop to state
  useEffect(() => {
    if (initialCheckedFolderIds && initialCheckedFolderIds.length > 0) {
      setCheckedFolderIds(initialCheckedFolderIds);
    } else {
      setCheckedFolderIds([]);
    }
  }, [initialCheckedFolderIds]);

  const handleFolderToggle = (folderId: string) => {
    setCheckedFolderIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRecordingRef = useRef(false);
  const accumulatedTextRef = useRef('');
  const currentFinalRef = useRef('');

  // Synchronize isRecording state to ref
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Initialize SpeechRecognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser.');
      return;
    }

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

        // Combine previously accumulated text with current session's final and interim text using overlap resolution
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
          // Don't show critical error for silent breaks, just restart in onend
        } else {
          setErrorMsg(`Error perekaman: ${event.error}. Silakan coba lagi.`);
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      };

      rec.onend = () => {
        if (recognitionRef.current !== rec) return;

        // Automatically restart if isRecording is still true (handles timeouts/pauses)
        if (isRecordingRef.current) {
          // Save the final text of the session that just ended, removing overlaps
          const prevAccumulated = accumulatedTextRef.current;
          const currentFinal = currentFinalRef.current;
          accumulatedTextRef.current = mergeTranscripts(prevAccumulated, currentFinal);
          currentFinalRef.current = ''; // Reset for the next session
          
          // Use a small timeout to let the SpeechRecognition instance fully clean up before starting again.
          // This prevents InvalidStateError on Android Chrome when restarting.
          setTimeout(() => {
            if (isRecordingRef.current) {
              try {
                // Destroy old instance and start a fresh one to prevent duplicate/leaked transcripts
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.abort();
                  } catch (e) {}
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
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [language]);

  useEffect(() => {
    if (autoStart) {
      const checkAndStart = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
          setTimeout(checkAndStart, 250);
        } else {
          startRecording();
          if (onAutoStartTriggered) {
            onAutoStartTriggered();
          }
        }
      };
      
      const timer = setTimeout(checkAndStart, 800);
      return () => clearTimeout(timer);
    }
  }, [autoStart]);

  const startRecording = async () => {
    setErrorMsg('');
    setTranscript('');
    accumulatedTextRef.current = '';
    currentFinalRef.current = '';
    
    if (!recognitionRef.current) {
      setErrorMsg('Fitur perekaman suara langsung tidak didukung oleh browser Anda. Harap gunakan browser Chrome, Safari, atau Edge, atau gunakan opsi Unggah File.');
      return;
    }

    try {
      setIsRecording(true);
      setStatusMsg('Mendengarkan suara Anda...');
      recognitionRef.current.start();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      setErrorMsg('Gagal memulai perekaman suara. Pastikan Anda telah memberikan izin perekaman.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatusMsg('Perekaman selesai. Siap diproses.');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/webm', 'video/webm'];
      
      // Basic check
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

  const processTranscription = async (formatType: 'standard' | 'laporan' | 'intel' = 'standard') => {
    if (!file) return;
    
    setIsLoading(true);
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
      
      // Automatically proceed to formatting the transcript
      await processFormatting(data.text, formatType);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mentranskripsi audio.');
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const processFormatting = async (textToFormat: string, formatType: 'standard' | 'laporan' | 'intel' = 'standard') => {
    const rawText = textToFormat || transcript;
    if (!rawText.trim()) {
      setErrorMsg('Teks transkripsi kosong. Silakan rekam suara Anda terlebih dahulu atau tulis sesuatu.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingType(formatType);
    setErrorMsg('');
    
    let statusText = 'AI sedang menyusun, memparagraf, dan merapikan catatan Anda...';
    if (formatType === 'laporan') {
      statusText = 'AI sedang menyusun Laporan Kegiatan dari catatan suara Anda...';
    } else if (formatType === 'intel') {
      statusText = 'AI sedang menyusun Laporan Intel dari catatan suara Anda...';
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
          selectedFolderIds: checkedFolderIds
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal memformat catatan');
      }

      const formattedNote = await res.json();
      onFormatted(formattedNote, checkedFolderIds);
      setTranscript('');
      setFile(null);
      
      let successText = 'Catatan cerdas berhasil dibuat!';
      if (formatType === 'laporan') {
        successText = 'Laporan Kegiatan berhasil dibuat!';
      } else if (formatType === 'intel') {
        successText = 'Laporan Intel berhasil dibuat!';
      }
      setStatusMsg(successText);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal memproses kecerdasan catatan.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.recorderCard} glass-panel`}>
        <div className={styles.header}>
          <span className={styles.title}>
            <Mic size={18} className="text-indigo-400" />
            Input Suara Cerdas
          </span>
          <div className={styles.settings}>
            <select
              className={styles.langSelect}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isRecording || isLoading}
            >
              <option value="id-ID">🇮🇩 Bahasa Indonesia</option>
              <option value="en-US">🇺🇸 English</option>
            </select>
          </div>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', width: '100%', gap: '10px', marginBottom: '15px' }}>
          <GlowButton
            variant={activeTab === 'record' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('record')}
            disabled={isRecording || isLoading}
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
          >
            Perekaman Langsung
          </GlowButton>
          <GlowButton
            variant={activeTab === 'upload' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('upload')}
            disabled={isRecording || isLoading}
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
          >
            Unggah File Audio
          </GlowButton>
        </div>

        {/* Folder Target Checklist */}
        {folders && folders.length > 0 && (
          <div className={styles.folderChecklistSection}>
            <div className={styles.folderChecklistTitle}>
              Folder Indikator (Tujuan Penyimpanan):
            </div>
            <div className={styles.folderChecklistGrid}>
              {folders
                .filter((f) => !f.parentId && f.name.toLowerCase() !== 'utuh')
                .map((folder) => {
                  const isChecked = checkedFolderIds.includes(folder.id);
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      className={`${styles.folderChecklistItem} ${
                        isChecked ? styles.folderChecklistItemChecked : ''
                      }`}
                      onClick={() => handleFolderToggle(folder.id)}
                      disabled={isRecording || isLoading}
                    >
                      <span className={styles.folderChecklistIcon}>
                        {isChecked ? (
                          <FolderCheck size={16} />
                        ) : (
                          <Folder size={16} />
                        )}
                      </span>
                      <span className={styles.folderChecklistName}>{folder.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {activeTab === 'record' ? (
          <>
            <div className={styles.recordButtonContainer}>
              <button
                className={`${styles.recordBtn} ${isRecording ? styles.recordBtnRecording : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
              >
                {isRecording ? <Square size={36} fill="white" /> : <Mic size={40} />}
              </button>
            </div>

            {/* Waveform visualizer */}
            {isRecording && (
              <div className={styles.waveform}>
                {[...Array(7)].map((_, i) => (
                  <div key={i} className={`${styles.waveBar} ${styles.recordingWaveBar}`} />
                ))}
              </div>
            )}

            <div className={styles.statusText}>
              {isRecording ? (
                <span className={styles.statusActive}>
                  <span className={styles.pulseDot} />
                  Perekaman Sedang Berlangsung...
                </span>
              ) : (
                statusMsg || 'Tekan tombol mikrofon di atas untuk berbicara'
              )}
            </div>
          </>
        ) : (
          <>
            {!file ? (
              <div
                className={styles.fileUploadArea}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileAudio size={40} className="text-gray-400" style={{ color: 'var(--text-muted)' }} />
                <span className={styles.fileUploadText}>Klik untuk memilih file audio (MP3, WAV, M4A, MPEG, WEBM, dsb.)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Maksimal ukuran 1GB</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className={styles.fileInput}
                  accept="audio/*"
                  onChange={handleFileChange}
                  disabled={isLoading}
                />
              </div>
            ) : (
              <div className={styles.fileSelectedInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <FileAudio size={18} style={{ color: 'var(--secondary)' }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>
                    {file.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
                <button className={styles.removeFileBtn} onClick={removeFile} disabled={isLoading}>
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <div className={styles.statusText}>{statusMsg || 'Pilih berkas audio Anda lalu klik Format AI'}</div>
          </>
        )}

        {/* Real-time transcript preview */}
        {transcript && (
          <div className={styles.transcriptArea}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginBottom: '5px', fontWeight: 'bold' }}>
              TRANSKRIP SEMENTARA (MENTAH):
            </div>
            {transcript}
          </div>
        )}

        {errorMsg && (
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--border-radius-md)',
            padding: '12px',
            width: '100%',
            color: '#f87171',
            fontSize: '0.85rem',
            textAlign: 'left',
            marginBottom: '15px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Bottom Actions */}
        <div className={styles.actions}>
          {transcript && !isRecording && (
            <GlowButton
              variant="outline"
              onClick={() => {
                setTranscript('');
                setStatusMsg('');
                accumulatedTextRef.current = '';
                currentFinalRef.current = '';
              }}
              disabled={isLoading}
            >
              <Trash2 size={16} /> Hapus
            </GlowButton>
          )}

          {activeTab === 'record' ? (
            transcript && !isRecording && (
              <>
                <GlowButton
                  variant="accent"
                  onClick={() => processFormatting('', 'standard')}
                  disabled={isLoading}
                >
                  {loadingType === 'standard' ? <div className={styles.spinner} /> : <Sparkles size={16} />}
                  Format AI
                </GlowButton>
                <GlowButton
                  variant="secondary"
                  onClick={() => processFormatting('', 'laporan')}
                  disabled={isLoading}
                >
                  {loadingType === 'laporan' ? <div className={styles.spinner} /> : <FileText size={16} />}
                  Laporan Kegiatan
                </GlowButton>
                <GlowButton
                  variant="primary"
                  onClick={() => processFormatting('', 'intel')}
                  disabled={isLoading}
                >
                  {loadingType === 'intel' ? <div className={styles.spinner} /> : <FileText size={16} />}
                  Laporan Intel
                </GlowButton>
              </>
            )
          ) : (
            file && (
              <>
                <GlowButton
                  variant="accent"
                  onClick={() => processTranscription('standard')}
                  disabled={isLoading}
                >
                  {loadingType === 'standard' ? <div className={styles.spinner} /> : <Sparkles size={16} />}
                  Transkripsi & Format AI
                </GlowButton>
                <GlowButton
                  variant="secondary"
                  onClick={() => processTranscription('laporan')}
                  disabled={isLoading}
                >
                  {loadingType === 'laporan' ? <div className={styles.spinner} /> : <FileText size={16} />}
                  Laporan Kegiatan
                </GlowButton>
                <GlowButton
                  variant="primary"
                  onClick={() => processTranscription('intel')}
                  disabled={isLoading}
                >
                  {loadingType === 'intel' ? <div className={styles.spinner} /> : <FileText size={16} />}
                  Laporan Intel
                </GlowButton>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

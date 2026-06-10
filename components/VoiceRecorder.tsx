"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Upload, Trash2, Sparkles, FileAudio, AlertCircle } from 'lucide-react';
import { GlowButton } from './ui/GlowButton';
import styles from './VoiceRecorder.module.css';

interface FormattedNote {
  title: string;
  content: string;
  summary: string;
  tags: string[];
  todo_list: string[];
}

interface VoiceRecorderProps {
  onFormatted: (note: FormattedNote) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onFormatted }) => {
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('id-ID');
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
        let interimTranscript = '';
        let finalTranscript = '';
        let lastTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript.trim();
            if (text && text !== lastTranscript) {
              finalTranscript += text + ' ';
              lastTranscript = text;
            }
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        finalTranscript = finalTranscript.trim();
        currentFinalRef.current = finalTranscript;

        // Combine previously accumulated text with current session's final and interim text
        const totalFinal = (accumulatedTextRef.current + ' ' + finalTranscript).trim();
        const display = (totalFinal + ' ' + interimTranscript).trim();
        
        setTranscript(display);
      };

      rec.onerror = (event: any) => {
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
        // Automatically restart if isRecording is still true (handles timeouts/pauses)
        if (isRecordingRef.current) {
          // Save the final text of the session that just ended
          const prevAccumulated = accumulatedTextRef.current;
          const currentFinal = currentFinalRef.current;
          accumulatedTextRef.current = (prevAccumulated + ' ' + currentFinal).trim();
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
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [language]);

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
      if (selectedFile.size > 25 * 1024 * 1024) {
        setErrorMsg('Ukuran file maksimal adalah 25MB.');
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

  const processTranscription = async () => {
    if (!file) return;
    
    setIsLoading(true);
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
      await processFormatting(data.text);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mentranskripsi audio.');
      setIsLoading(false);
    }
  };

  const processFormatting = async (textToFormat: string) => {
    const rawText = textToFormat || transcript;
    if (!rawText.trim()) {
      setErrorMsg('Teks transkripsi kosong. Silakan rekam suara Anda terlebih dahulu atau tulis sesuatu.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setStatusMsg('AI sedang menyusun, memparagraf, dan merapikan catatan Anda...');

    try {
      const res = await fetch('/api/notes/format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: rawText }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal memformat catatan');
      }

      const formattedNote = await res.json();
      onFormatted(formattedNote);
      setTranscript('');
      setFile(null);
      setStatusMsg('Catatan cerdas berhasil dibuat!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal memproses kecerdasan catatan.');
    } finally {
      setIsLoading(false);
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
                <span className={styles.fileUploadText}>Klik untuk memilih file audio (MP3, WAV, M4A, WEBM)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Maksimal ukuran 25MB</span>
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
              <GlowButton
                variant="accent"
                onClick={() => processFormatting('')}
                disabled={isLoading}
              >
                {isLoading ? <div className={styles.spinner} /> : <Sparkles size={16} />}
                Format AI
              </GlowButton>
            )
          ) : (
            file && (
              <GlowButton
                variant="accent"
                onClick={processTranscription}
                disabled={isLoading}
              >
                {isLoading ? <div className={styles.spinner} /> : <Sparkles size={16} />}
                Transkripsi & Format AI
              </GlowButton>
            )
          )}
        </div>
      </div>
    </div>
  );
};

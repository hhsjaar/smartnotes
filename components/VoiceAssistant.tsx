"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Sparkles, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import styles from './VoiceAssistant.module.css';

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

  const uniqueCurrWords = currWords.slice(overlapLength);
  return (accClean + ' ' + uniqueCurrWords.join(' ')).trim();
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface VoiceAssistantProps {
  selectedNote?: any;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ selectedNote }) => {
  const [recognition, setRecognition] = useState<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Dragging states for mobile/desktop flexibility
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    touchStartPosRef.current = {
      x: e.clientX,
      y: e.clientY
    };
    isDraggingRef.current = false;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - touchStartPosRef.current.x;
      const dy = moveEvent.clientY - touchStartPosRef.current.y;
      
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDraggingRef.current = true;
      }
      
      if (isDraggingRef.current) {
        setPosition({
          x: moveEvent.clientX - dragStartRef.current.x,
          y: moveEvent.clientY - dragStartRef.current.y
        });
      }
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (isDraggingRef.current) {
        const clickHandler = (event: MouseEvent) => {
          event.stopImmediatePropagation();
          document.removeEventListener('click', clickHandler, true);
        };
        document.addEventListener('click', clickHandler, true);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    const touch = e.touches[0];
    dragStartRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
    touchStartPosRef.current = {
      x: touch.clientX,
      y: touch.clientY
    };
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isDraggingRef.current = true;
    }
    
    if (isDraggingRef.current) {
      setPosition({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      const clickHandler = (event: MouseEvent) => {
        event.stopImmediatePropagation();
        document.removeEventListener('click', clickHandler, true);
      };
      document.addEventListener('click', clickHandler, true);
    }
  };
  
  // Multi-turn state variables
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const dialogEndRef = useRef<HTMLDivElement | null>(null);
  
  // Debounce timeout for silence detection
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of final transcript accumulated across auto-restarts (workaround for mobile auto-cutoffs)
  const accumulatedTranscriptRef = useRef('');

  // Keep references to prevent stale closures in event listeners
  const chatHistoryRef = useRef<ChatMessage[]>([]);
  const pendingActionRef = useRef<any | null>(null);
  const showPanelRef = useRef(showPanel);
  const contactsRef = useRef<any[]>([]);
  const transcriptRef = useRef(transcript);
  const selectedNoteRef = useRef<any>(selectedNote);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  // Load and listen to speechSynthesis voices change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const updateVoices = () => {
        if (window.speechSynthesis) {
          setVoices(window.speechSynthesis.getVoices());
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  useEffect(() => {
    pendingActionRef.current = pendingAction;
  }, [pendingAction]);

  useEffect(() => {
    showPanelRef.current = showPanel;
  }, [showPanel]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    selectedNoteRef.current = selectedNote;
  }, [selectedNote]);

  // Load contacts whenever panel opens
  useEffect(() => {
    if (showPanel && typeof window !== 'undefined') {
      const saved = localStorage.getItem('wa_contacts');
      if (saved) {
        try {
          setContacts(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse wa_contacts', e);
        }
      }
    }
  }, [showPanel]);

  // Scroll to bottom of chat dialog whenever history changes
  useEffect(() => {
    if (dialogEndRef.current) {
      dialogEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, status, transcript]);

  // Core function to process commands via the Gemini API
  const processCommand = async (commandText: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setStatus('processing');
    setErrorMsg('');

    // 1. Add user speech command to chat history view
    const userMsg: ChatMessage = { role: 'user', text: commandText };
    setChatHistory(prev => [...prev, userMsg]);
    
    try {
      // Call our assistant API to process the command
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          command: commandText,
          history: chatHistoryRef.current,
          pendingAction: pendingActionRef.current,
          contacts: contactsRef.current,
          selectedNote: selectedNoteRef.current
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal memproses instruksi');
      }
      
      const data = await res.json();
      setResponse(data.response);

      // 2. Add AI reply to history
      const modelMsg: ChatMessage = { role: 'model', text: data.response };
      setChatHistory(prev => [...prev, modelMsg]);
      
      // 3. Process actions
      let isTerminal = false;
      if (data.action === 'ASK_CONFIRMATION') {
        setPendingAction(data.payload);
      } else if (data.action === null) {
        // Interactive conversation, do not close and do not dispatch action
      } else {
        isTerminal = true;
        if (data.action === 'CONFIRM_JOB') {
          setPendingAction(null);
          window.dispatchEvent(new CustomEvent('assistant-action', {
            detail: {
              action: 'SCHEDULE_JOB',
              payload: data.payload,
              response: data.response
            }
          }));
        } else if (data.action === 'CANCEL_JOB') {
          setPendingAction(null);
        } else {
          setPendingAction(null);
          window.dispatchEvent(new CustomEvent('assistant-action', {
            detail: {
              action: data.action,
              payload: data.payload,
              response: data.response
            }
          }));
        }
      }
      
      // Speak back the response
      speak(data.response);

      if (isTerminal) {
        autoClosePanel();
      }
    } catch (err: any) {
      console.error('Assistant process failed', err);
      const errMsg = err.message || 'Gagal memproses perintah suara Anda.';
      setErrorMsg(errMsg);
      setStatus('error');
      setChatHistory(prev => [...prev, { role: 'model', text: `Terjadi kesalahan: ${errMsg}` }]);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const processCommandRef = useRef(processCommand);
  useEffect(() => {
    processCommandRef.current = processCommand;
  }, [processCommand]);

  // Check speech support and initialize speech recognition
  useEffect(() => {
    let rec: any = null;
    if (typeof window !== 'undefined') {
      setIsSupported(!!SpeechRecognition);
      synthRef.current = window.speechSynthesis;
      
      if (SpeechRecognition) {
        rec = new SpeechRecognition();
        rec.continuous = true;       // Allow pauses without immediate browser cutoff
        rec.interimResults = true;   // Capture speech in real-time
        rec.lang = 'id-ID';          // default to Indonesian
        
        rec.onstart = () => {
          setStatus('listening');
          // Only clear transcript if we are starting a completely fresh session (not restarting)
          if (!accumulatedTranscriptRef.current) {
            setTranscript('');
          }
          setResponse('');
          setErrorMsg('');
        };
        
        rec.onerror = (event: any) => {
          if (event.error === 'no-speech' || event.error === 'aborted') {
            return;
          }
          console.error('Speech recognition error', event);
          if (event.error === 'not-allowed') {
            setErrorMsg('Izin mikrofon ditolak.');
          } else {
            setErrorMsg(`Kesalahan suara: ${event.error}`);
          }
          setStatus('error');
        };
        
        rec.onend = () => {
          // Keep listening indefinitely if the status is still 'listening'
          // This prevents automatic browser cutoffs from ending the voice session
          if (statusRef.current === 'listening') {
            try {
              rec.start();
            } catch (e) {
              console.warn('Failed to restart SpeechRecognition on end:', e);
            }
            return;
          }

          setStatus(prev => {
            if (prev === 'listening') return 'idle';
            return prev;
          });
        };
        
        rec.onresult = (event: any) => {
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
          
          // Merge with accumulated transcript from previous sessions
          const totalFinal = mergeTranscripts(accumulatedTranscriptRef.current, finalTranscript);
          
          if (finalTranscript) {
            accumulatedTranscriptRef.current = totalFinal;
          }
          
          const currentText = (totalFinal + ' ' + interimTranscript).trim();
          setTranscript(currentText);

          // Check if user spoke the trigger word "cukup" at the end of the text
          const cleanText = currentText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim().toLowerCase();
          const words = cleanText.split(/\s+/);
          const hasCukupTrigger = words.length > 0 && words[words.length - 1] === 'cukup';

          if (hasCukupTrigger) {
            const cleanedText = currentText.replace(/\s*cukup[.,\/#!$%\^&\*;:{}=\-_`~()]*$/i, '').trim();
            
            // Set statusRef.current directly to processing to prevent onend restart
            statusRef.current = 'processing';
            setStatus('processing');
            accumulatedTranscriptRef.current = '';
            
            try {
              rec.stop();
            } catch (e) {}

            if (cleanedText) {
              processCommandRef.current(cleanedText);
            } else {
              try {
                rec.stop();
              } catch (e) {}
              stopListening();
              setStatus('idle');
              speak("Mendengarkan selesai.");
            }
          }
        };
        
        setRecognition(rec);
      }
    }

    return () => {
      if (rec) {
        try {
          rec.onstart = null;
          rec.onerror = null;
          rec.onend = null;
          rec.onresult = null;
          rec.abort();
        } catch (e) {}
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const autoListenNext = () => {
    // Delay slightly to prevent microphone catching the end of output speech
    setTimeout(() => {
      if (showPanelRef.current && recognition) {
        accumulatedTranscriptRef.current = ''; // Reset accumulated transcript for next instruction
        setTranscript('');
        try {
          recognition.start();
        } catch (e) {
          console.warn('Auto-start SpeechRecognition ignored', e);
        }
      }
    }, 450);
  };

  const startListening = () => {
    if (synthRef.current) {
      synthRef.current.cancel(); // Stop any ongoing speech synthesis
    }

    accumulatedTranscriptRef.current = ''; // Reset accumulated transcript
    setTranscript('');

    // Reset history for a fresh dialogue session if the panel was completely closed
    if (!showPanel) {
      setChatHistory([]);
      setPendingAction(null);
      setShowPanel(true);
      
      const welcomeMsg = "Halo! Saya asisten suara cerdas Anda. Ada yang bisa saya bantu hari ini?";
      setChatHistory([{ role: 'model', text: welcomeMsg }]);
      speak(welcomeMsg);
    } else {
      if (recognition) {
        try {
          recognition.start();
        } catch (e) {
          console.warn('SpeechRecognition already started', e);
        }
      }
    }
  };

  const stopListening = () => {
    statusRef.current = 'idle';
    setStatus('idle');
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }
    // If user clicked stop manually and there is spoken text, process it immediately
    if (transcriptRef.current && transcriptRef.current.trim() !== '') {
      processCommandRef.current(transcriptRef.current.trim());
    }
  };

  const speak = (text: string) => {
    if (!synthRef.current || isMuted) {
      setStatus('idle');
      autoListenNext();
      return;
    }
    
    // Stop and resume to clear any stuck state
    synthRef.current.cancel();
    if (synthRef.current.paused) {
      synthRef.current.resume();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID'; // Force Indonesian language locale
    
    // Choose Indonesian voice if available
    const voicesList = voices.length > 0 ? voices : (synthRef.current ? synthRef.current.getVoices() : []);
    const idVoice = voicesList.find(v => 
      v.lang.startsWith('id') || 
      v.lang.startsWith('in') || 
      v.lang.toLowerCase().includes('indonesia')
    );
    if (idVoice) {
      utterance.voice = idVoice;
    }
    
    utterance.onstart = () => {
      setStatus('speaking');
    };
    
    utterance.onend = () => {
      setStatus('idle');
      autoListenNext();
    };
    
    utterance.onerror = (event: any) => {
      console.warn('SpeechSynthesisUtterance error:', event);
      setStatus('idle');
      autoListenNext();
    };
    
    activeUtteranceRef.current = utterance;
    // Workaround for Chrome garbage collection bug
    (window as any)._activeUtterance = utterance;
    
    synthRef.current.speak(utterance);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted && synthRef.current) {
      synthRef.current.cancel();
      setStatus('idle');
    }
  };

  const autoClosePanel = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    stopListening();
    setShowPanel(false);
  };

  const closePanel = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    stopListening();
    setShowPanel(false);
    setStatus('idle');
  };

  if (!isSupported) {
    return null; // Don't render if browser doesn't support Web Speech API
  }

  return (
    <>
      {/* Floating Wave Trigger Button */}
      <button 
        type="button" 
        className={`${styles.floatingAssistantBtn} ${status === 'listening' ? styles.btnListening : ''}`}
        onClick={status === 'listening' ? stopListening : startListening}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          touchAction: 'none',
          transition: isDraggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        title="Bicara dengan Asisten AI"
      >
        {status === 'listening' ? (
          <div className={styles.pulseContainer}>
            <div className={styles.pulseWave} />
            <MicOff size={22} className={styles.assistantIcon} />
          </div>
        ) : (
          <div className={styles.btnGlowWrapper}>
            <Mic size={22} className={styles.assistantIcon} />
            <Sparkles size={10} className={styles.sparkleIcon} />
          </div>
        )}
      </button>

      {/* Siri-like Assistant Overlay Panel */}
      {showPanel && (
        <div className={styles.assistantPanelOverlay} onClick={closePanel}>
          <div className={styles.assistantPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.panelHeader}>
              <div className={styles.assistantBrand}>
                <Sparkles size={16} className={styles.sparkleBrandIcon} />
                <span>Asisten Suara Pintar</span>
              </div>
              <div className={styles.headerControls}>
                <button 
                  type="button" 
                  className={styles.controlBtn} 
                  onClick={toggleMute}
                  title={isMuted ? 'Aktifkan Suara' : 'Bisukan Suara'}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button 
                  type="button" 
                  className={styles.closeBtn} 
                  onClick={closePanel}
                  title="Tutup Panel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.panelBody}>
              {/* Glowing Orb Animation Wave */}
              <div className={styles.orbWrapper}>
                <div className={`${styles.orb} ${styles[status]}`}>
                  <div className={styles.orbInner} />
                  <div className={styles.orbGlow} />
                  <div className={styles.wave1} />
                  <div className={styles.wave2} />
                  <div className={styles.wave3} />
                </div>
                <span className={styles.statusLabel}>
                  {status === 'listening' && 'Mendengarkan Anda...'}
                  {status === 'processing' && 'Memproses instruksi...'}
                  {status === 'speaking' && 'Menjawab...'}
                  {status === 'idle' && 'Siap melayani Anda'}
                  {status === 'error' && 'Terjadi Kesalahan'}
                </span>
              </div>

              {/* Dialog Panel Contents */}
              <div className={styles.dialogContainer}>
                {chatHistory.length === 0 && !transcript && (
                  <div className={styles.aiBubble}>
                    <span className={styles.bubbleLabelAI}>Asisten</span>
                    <p className={styles.bubbleTextAI}>Halo! Ada yang bisa saya bantu hari ini?</p>
                  </div>
                )}

                {chatHistory.map((msg, index) => (
                  <div 
                    key={index} 
                    className={msg.role === 'user' ? styles.userBubble : styles.aiBubble}
                  >
                    <span className={msg.role === 'user' ? styles.bubbleLabel : styles.bubbleLabelAI}>
                      {msg.role === 'user' ? 'Anda' : 'Asisten'}
                    </span>
                    <p className={msg.role === 'user' ? styles.bubbleText : styles.bubbleTextAI}>
                      {msg.text}
                    </p>
                  </div>
                ))}

                {/* Real-time transcript bubble while speaking */}
                {status === 'listening' && transcript && (
                  <div className={styles.userBubble}>
                    <span className={styles.bubbleLabel}>Anda (Berbicara...)</span>
                    <p className={styles.bubbleText}>"{transcript}"</p>
                  </div>
                )}

                {status === 'processing' && (
                  <div className={styles.aiBubble}>
                    <span className={styles.bubbleLabelAI}>Asisten</span>
                    <div className={styles.typingIndicator}>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className={styles.errorBubble}>
                    <AlertCircle size={16} className={styles.errorIcon} />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <div ref={dialogEndRef} />
              </div>
            </div>

            {/* Quick Suggestions Footer */}
            {status === 'idle' && (
              <div className={styles.suggestions}>
                <span className={styles.suggestionsLabel}>Saran Obrolan:</span>
                <div className={styles.suggestionsRow}>
                  <button 
                    type="button" 
                    className={styles.suggestionBtn}
                    onClick={() => {
                      const text = 'Tampilkan berita terbaru';
                      setTranscript(text);
                      const responseText = 'Tentu, saya akan membuka halaman berita untuk Anda.';
                      setResponse(responseText);
                      setChatHistory(prev => [
                        ...prev, 
                        { role: 'user', text },
                        { role: 'model', text: responseText }
                      ]);
                      speak(responseText);
                      window.dispatchEvent(new CustomEvent('assistant-action', {
                        detail: { action: 'SHOW_NEWS', payload: {} }
                      }));
                      autoClosePanel();
                    }}
                  >
                    📰 Buka Berita
                  </button>
                  <button 
                    type="button" 
                    className={styles.suggestionBtn}
                    onClick={() => {
                      const text = 'Buat catatan baru tentang rapat besok';
                      setTranscript(text);
                      const responseText = 'Tentu, saya akan membuat catatan baru tentang rapat besok.';
                      setResponse(responseText);
                      setChatHistory(prev => [
                        ...prev, 
                        { role: 'user', text },
                        { role: 'model', text: responseText }
                      ]);
                      speak(responseText);
                      window.dispatchEvent(new CustomEvent('assistant-action', {
                        detail: { 
                          action: 'CREATE_NOTE', 
                          payload: { title: 'Agenda Rapat Besok', content: '# Agenda Rapat Besok\n\n1. Pembahasan rencana kuartalan\n2. Alokasi budget divisi baru\n3. Tanya jawab' } 
                        }
                      }));
                      autoClosePanel();
                    }}
                  >
                    📝 Buat Catatan Rapat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

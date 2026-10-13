"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Pause, Play, Download, RotateCcw, Trash2 } from 'lucide-react';
import styles from './AccurateRecorder.module.css';

interface AccurateRecorderProps {
  onStart: () => void;
  onTranscribed: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}

type Phase = 'idle' | 'recording' | 'paused' | 'transcribing' | 'failed';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const SILENCE_LEVEL = 0.012; // di bawah ini dianggap tidak ada suara yang tertangkap

const pickMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || '';
};

const extensionFor = (mime: string): string => {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
};

const formatDuration = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

/**
 * Mode "Rekam Akurat": merekam audio sungguhan dengan pengaturan mikrofon (penguat suara,
 * peredam bising, indikator level), lalu mentranskripsikannya dengan Gemini setelah selesai.
 * Teks tidak tampil saat bicara, tetapi lebih akurat, terutama untuk nama dan gelar.
 */
export const AccurateRecorder: React.FC<AccurateRecorderProps> = ({ onStart, onTranscribed, onBusyChange, disabled }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [gain, setGain] = useState(1.5);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const peakRef = useRef(0);
  const wakeLockRef = useRef<any>(null);
  const mimeRef = useRef('');
  const lastLevelUpdateRef = useRef(0);

  // Beri tahu induk saat sedang merekam/mentranskripsi agar pilihan mode dikunci
  useEffect(() => {
    onBusyChange?.(phase !== 'idle' && phase !== 'failed');
  }, [phase]);

  // Timer hanya berjalan saat benar-benar merekam
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Penguat suara bisa diubah langsung saat merekam
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = gain;
  }, [gain]);

  const releaseWakeLock = () => {
    try { wakeLockRef.current?.release?.(); } catch (e) {}
    wakeLockRef.current = null;
  };

  const requestWakeLock = async () => {
    try {
      wakeLockRef.current = await (navigator as any).wakeLock?.request?.('screen');
    } catch (e) {
      wakeLockRef.current = null; // tidak didukung / ditolak: rekaman tetap jalan
    }
  };

  const cleanupAudio = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { ctxRef.current?.close(); } catch (e) {}
    ctxRef.current = null;
    gainRef.current = null;
    releaseWakeLock();
    setLevel(0);
  };

  // Layar menyala kembali setelah ditinggal: ambil ulang wake lock agar rekaman tidak terputus
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (phase === 'recording' || phase === 'paused')) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [phase]);

  useEffect(() => () => {
    try { recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); } catch (e) {}
    cleanupAudio();
  }, []);

  const startMeter = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.fftSize);
    const tick = (now: number) => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      if (rms > peakRef.current) peakRef.current = rms;
      if (now - lastLevelUpdateRef.current > 70) {
        lastLevelUpdateRef.current = now;
        setLevel(Math.min(1, rms * 4));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    setError('');
    setMessage('');
    setAudioFile(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Browser ini tidak mendukung perekaman audio. Gunakan Chrome terbaru, atau pakai mode Cepat.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const gainNode = ctx.createGain();
      gainNode.gain.value = gain;
      gainRef.current = gainNode;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      const destination = ctx.createMediaStreamDestination();
      source.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(destination);

      const mime = pickMimeType();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(destination.stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 96000,
      });
      chunksRef.current = [];
      peakRef.current = 0;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStopped;
      recorderRef.current = recorder;
      recorder.start(1000); // simpan per detik agar tidak hilang bila ada gangguan

      startMeter(analyser);
      requestWakeLock();
      setSeconds(0);
      setPhase('recording');
      onStart();
    } catch (e: any) {
      console.error('Gagal memulai rekam akurat:', e);
      cleanupAudio();
      setError(
        e?.name === 'NotAllowedError'
          ? 'Izin mikrofon ditolak. Aktifkan izin mikrofon di pengaturan browser Anda.'
          : 'Gagal memulai perekaman. Pastikan mikrofon tersedia dan tidak dipakai aplikasi lain.'
      );
      setPhase('idle');
    }
  };

  const pause = () => {
    try { recorderRef.current?.pause(); } catch (e) {}
    setPhase('paused');
  };

  const resume = () => {
    try { recorderRef.current?.resume(); } catch (e) {}
    setPhase('recording');
  };

  const stop = () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopped = () => {
    const mime = mimeRef.current || recorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mime });
    const file = new File([blob], `rekaman-${Date.now()}.${extensionFor(mime)}`, { type: mime });
    const peak = peakRef.current;
    cleanupAudio();
    setAudioFile(file);

    if (file.size < 2000) {
      setError('Rekaman terlalu singkat atau kosong.');
      setPhase('failed');
      return;
    }
    if (peak < SILENCE_LEVEL) {
      setError('Suara hampir tidak terdeteksi. Naikkan penguat suara atau dekatkan mikrofon, lalu rekam ulang.');
      setPhase('failed');
      return;
    }
    transcribe(file);
  };

  const transcribe = async (file: File) => {
    setPhase('transcribing');
    setError('');
    setMessage('Mentranskripsi rekaman dengan AI (bisa beberapa menit untuk rekaman panjang)...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal melakukan transkripsi.');
      setAudioFile(null);
      setMessage('');
      setPhase('idle');
      onTranscribed(data.text);
    } catch (e: any) {
      console.error(e);
      setError(`${e?.message || 'Gagal melakukan transkripsi.'} Rekaman Anda masih tersimpan, coba lagi atau unduh audionya.`);
      setPhase('failed');
    }
  };

  const downloadAudio = () => {
    if (!audioFile) return;
    const url = URL.createObjectURL(audioFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = audioFile.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const discard = () => {
    setAudioFile(null);
    setError('');
    setMessage('');
    setPhase('idle');
  };

  const active = phase === 'recording' || phase === 'paused';

  return (
    <div className={styles.wrap}>
      {phase === 'idle' && (
        <button type="button" className={styles.micBtn} onClick={start} disabled={disabled} title="Mulai merekam">
          <Mic size={40} />
        </button>
      )}

      {active && (
        <>
          <div className={`${styles.timer} ${phase === 'paused' ? styles.timerPaused : ''}`}>
            {phase === 'recording' && <span className={styles.dot} />}
            {formatDuration(seconds)}
            {phase === 'paused' && ' (Dijeda)'}
          </div>
          <div className={styles.controls}>
            {phase === 'recording' ? (
              <button type="button" className={`${styles.ctl} ${styles.pause}`} onClick={pause}>
                <Pause size={18} fill="currentColor" /> Jeda
              </button>
            ) : (
              <button type="button" className={`${styles.ctl} ${styles.resume}`} onClick={resume}>
                <Play size={18} fill="currentColor" /> Lanjutkan
              </button>
            )}
            <button type="button" className={`${styles.ctl} ${styles.stop}`} onClick={stop}>
              <Square size={18} fill="currentColor" /> Selesai
            </button>
          </div>
        </>
      )}

      {phase === 'transcribing' && (
        <div className={styles.busy}>
          <div className={styles.spinner} />
          <span>{message}</span>
        </div>
      )}

      {(active || phase === 'idle') && (
        <div className={styles.mic}>
          <div className={styles.meterRow}>
            <span className={styles.meterLabel}>Level suara</span>
            <div className={styles.meter}>
              <div
                className={`${styles.meterFill} ${level > 0.85 ? styles.meterHot : ''}`}
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
          </div>
          <label className={styles.gainRow}>
            <span className={styles.meterLabel}>Penguat suara</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.25}
              value={gain}
              onChange={(e) => setGain(parseFloat(e.target.value))}
            />
            <span className={styles.gainValue}>{gain.toFixed(2).replace(/\.?0+$/, '')}×</span>
          </label>
          <p className={styles.hint}>
            {active
              ? 'Bicaralah. Bila bar level jarang bergerak, naikkan penguat suara. Jika sering penuh merah, turunkan.'
              : 'Teks tidak tampil saat bicara. Transkrip akurat muncul setelah Anda menekan Selesai. Layar dijaga tetap menyala saat merekam.'}
          </p>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {phase === 'failed' && (
        <div className={styles.failActions}>
          {audioFile && audioFile.size >= 2000 && (
            <button type="button" className={styles.actionBtn} onClick={() => transcribe(audioFile)}>
              <RotateCcw size={14} /> Coba Transkripsi Lagi
            </button>
          )}
          {audioFile && (
            <button type="button" className={styles.actionBtn} onClick={downloadAudio}>
              <Download size={14} /> Unduh Audio
            </button>
          )}
          <button type="button" className={`${styles.actionBtn} ${styles.danger}`} onClick={discard}>
            <Trash2 size={14} /> Buang &amp; Rekam Ulang
          </button>
        </div>
      )}
    </div>
  );
};

"use client";

import React, { useEffect, useState } from 'react';
import { BookText, X, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './GlossaryManager.module.css';

interface Term {
  id: string;
  term: string;
}

const authHeaders = (): Record<string, string> => {
  let token = '';
  try { token = localStorage.getItem('admin_token') || ''; } catch (e) {}
  return { Authorization: `Bearer ${token}` };
};

/** Kamus nama, gelar, dan istilah untuk memperbaiki salah-dengar saat transkripsi. */
export const GlossaryManager: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<Term[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/glossary', { headers: authHeaders() });
      if (res.ok) {
        setTerms(await res.json());
        setError('');
      } else {
        setError(res.status === 401 ? 'Sesi admin berakhir, silakan login ulang.' : 'Gagal memuat kamus.');
      }
    } catch (e) {
      setError('Gagal memuat kamus.');
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded]);

  const add = async () => {
    if (!input.trim()) return;
    try {
      const res = await fetch('/api/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ term: input }),
      });
      if (res.ok) {
        setTerms(await res.json());
        setInput('');
        setError('');
      } else {
        setError('Gagal menambah istilah.');
      }
    } catch (e) {
      setError('Gagal menambah istilah.');
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/glossary?id=${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) setTerms((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError('Gagal menghapus istilah.');
    }
  };

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.header} onClick={() => setOpen((v) => !v)}>
        <BookText size={16} />
        <span>Kamus Nama &amp; Gelar</span>
        <span className={styles.count}>{loaded ? `${terms.length} istilah` : ''}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className={styles.body}>
          <p className={styles.hint}>
            Tulis nama lengkap beserta gelarnya persis seperti ejaan yang benar. AI memakai daftar ini untuk
            memperbaiki nama yang salah dengar saat merekam. Nama kontak karyawan ikut terpakai otomatis.
          </p>
          <textarea
            className={styles.input}
            rows={3}
            value={input}
            placeholder={'Satu istilah per baris, contoh:\nProf. Dr. Suharnomo, S.E., M.Si'}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="button" className={styles.addBtn} onClick={add} disabled={!input.trim()}>
            Tambah ke Kamus
          </button>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.chips}>
            {terms.map((t) => (
              <span key={t.id} className={styles.chip}>
                {t.term}
                <button type="button" onClick={() => remove(t.id)} aria-label={`Hapus ${t.term}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {loaded && terms.length === 0 && !error && <span className={styles.empty}>Belum ada istilah.</span>}
          </div>
        </div>
      )}
    </div>
  );
};

'use strict';

import React from 'react';
import { Trash2, Calendar } from 'lucide-react';
import styles from './NoteCard.module.css';

interface Note {
  id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  todo_list: string[];
  created_at: string;
}

interface NoteCardProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  isActive,
  onClick,
  onDelete,
}) => {
  const getTagClass = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('rapat') || t.includes('meet')) return 'rapat';
    if (t.includes('ide') || t.includes('kreatif') || t.includes('concept')) return 'ide';
    if (t.includes('tugas') || t.includes('todo') || t.includes('kerja')) return 'tugas';
    if (t.includes('uang') || t.includes('keuangan') || t.includes('finansial')) return 'keuangan';
    if (t.includes('pribadi') || t.includes('personal')) return 'pribadi';
    return 'default';
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Baru saja';
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return 'Baru saja';
    }
  };

  return (
    <div
      className={`${styles.card} ${isActive ? styles.activeCard : ''} glass-panel animate-slide-in`}
      onClick={onClick}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{note.title || 'Catatan Tanpa Judul'}</h3>
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
          title="Hapus Catatan"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <p className={styles.summary}>
        {note.summary || (note.content ? note.content.substring(0, 80) + '...' : 'Tidak ada ringkasan.')}
      </p>

      <div className={styles.footer}>
        <div className={styles.tagsContainer}>
          {note.tags && note.tags.slice(0, 2).map((tag, idx) => (
            <span key={idx} className={`tag-badge ${getTagClass(tag)}`}>
              {tag}
            </span>
          ))}
        </div>
        <span className={styles.date}>
          {formatDate(note.created_at)}
        </span>
      </div>
    </div>
  );
};

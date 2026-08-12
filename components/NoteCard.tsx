'use strict';

import React from 'react';
import { Trash2, Mic, Newspaper, FileText } from 'lucide-react';
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
  const isVoiceNote = note.tags?.some(t => t.toLowerCase().includes('voice') || t.toLowerCase().includes('suara')) || note.content?.toLowerCase().includes('transkrip');
  const isNewsNote = note.tags?.some(t => t.toLowerCase().includes('berita') || t.toLowerCase().includes('news'));

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <div
      className={`${styles.card} ${isActive ? styles.activeCard : ''} glass-panel animate-slide-in`}
      onClick={onClick}
    >
      <div className={styles.header}>
        <div className={styles.titleArea}>
          {isNewsNote ? (
            <Newspaper size={15} className={`${styles.icon} ${styles.newsIcon}`} />
          ) : isVoiceNote ? (
            <Mic size={15} className={`${styles.icon} ${styles.voiceIcon}`} />
          ) : (
            <FileText size={15} className={`${styles.icon} ${styles.defaultIcon}`} />
          )}
          <h3 className={styles.title}>{note.title || 'Catatan Tanpa Judul'}</h3>
        </div>
        <div className={styles.rightActions}>
          <span className={styles.date}>{formatDate(note.created_at)}</span>
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
      </div>
    </div>
  );
};

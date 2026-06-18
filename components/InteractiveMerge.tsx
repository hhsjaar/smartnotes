"use client";

import React, { useEffect } from 'react';
import { ArrowLeft, ChevronRight, Folder, Calendar } from 'lucide-react';
import styles from './InteractiveMerge.module.css';

interface InteractiveMergeProps {
  filteredNotes: any[];
  folders: any[];
  currentFolderId: string | null;
  currentTimeframe: number | null;
  onCancel: () => void;
  onSelectNote: (note: any) => void;
}

export const InteractiveMerge: React.FC<InteractiveMergeProps> = ({
  filteredNotes,
  folders,
  currentFolderId,
  currentTimeframe,
  onCancel,
  onSelectNote
}) => {
  // Helper to format date as YYYY-MM-DD in local time
  const getLocalDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Group notes for UI grouping
  const getGroupedFilteredNotes = () => {
    // Sort from newest to oldest so they see recent notes first (or oldest to newest, let's do newest to oldest)
    const sorted = [...filteredNotes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const grouped: Record<string, any[]> = {};
    
    sorted.forEach(note => {
      const dateKey = getLocalDateString(note.created_at);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(note);
    });

    return grouped;
  };

  const groupedNotes = getGroupedFilteredNotes();
  const folderObj = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;
  const folderNameStr = folderObj ? folderObj.name : 'Semua';
  
  const timeframeText =
    currentTimeframe === 1
      ? '1 Hari Terakhir'
      : currentTimeframe === 3
      ? '3 Hari Terakhir'
      : currentTimeframe === 7
      ? '7 Hari Terakhir'
      : currentTimeframe === 30
      ? '1 Bulan Terakhir'
      : 'Semua Waktu';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onCancel} title="Kembali">
          <ArrowLeft size={16} />
          Kembali
        </button>
        <div className={styles.titleText}>
          <h2>Klasifikasi Catatan Harian</h2>
          <p>Navigasi dan buka catatan secara langsung berdasarkan kelompok waktu pembuatan.</p>
        </div>
      </div>

      <div className={styles.dashboardSummary}>
        <div className={styles.summaryBadge}>
          <Folder size={12} />
          Folder: {folderNameStr}
        </div>
        <div className={styles.summaryBadge}>
          <Calendar size={12} />
          Rentang: {timeframeText}
        </div>
        <div className={styles.summaryBadge}>
          📋 Total Catatan: {filteredNotes.length}
        </div>
      </div>

      <div className={styles.notesScrollArea}>
        {filteredNotes.length === 0 ? (
          <div className={styles.emptyState}>
            <span>Tidak ada catatan yang memenuhi kriteria filter saat ini.</span>
          </div>
        ) : (
          Object.entries(groupedNotes).map(([dateStr, notesList]) => (
            <div key={dateStr} className={styles.dateGroup}>
              <div className={styles.dateGroupHeader}>
                <span>{dateStr}</span>
              </div>
              <div className={styles.noteGrid}>
                {notesList.map(note => {
                  const timeStr = new Date(note.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <button
                      key={note.id}
                      type="button"
                      className={styles.noteCard}
                      onClick={() => onSelectNote(note)}
                    >
                      <div className={styles.noteCardHeader}>
                        <span className={styles.noteTitleText}>{note.title || 'Catatan Tanpa Judul'}</span>
                        <span className={styles.noteTime}>{timeStr}</span>
                      </div>
                      
                      {note.content && (
                        <p className={styles.noteSnippet}>
                          {note.content.substring(0, 120)}{note.content.length > 120 ? '...' : ''}
                        </p>
                      )}
                      
                      <div className={styles.noteMetaRow}>
                        <div className={styles.leftMeta}>
                          {note.folder_id && (
                            <span className={styles.folderTag}>
                              📂 {folders.find(f => f.id === note.folder_id)?.name || 'Folder'}
                            </span>
                          )}
                          {note.tags && note.tags.slice(0, 2).map((t: string, idx: number) => (
                            <span key={idx} className={styles.tagBadge}>{t}</span>
                          ))}
                        </div>
                        <span className={styles.actionIndicator}>
                          Buka Catatan <ChevronRight size={14} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

"use client";

import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Sparkles, RefreshCw, AlertCircle, X, Check, BookOpen, Info } from 'lucide-react';
import { GlowButton } from './ui/GlowButton';
import styles from './NewsSection.module.css';

interface NewsSummary {
  context: string;
  points: string[];
  impact: string;
  title: string;
  source: string;
  url: string;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
  summary: string;
  category: string;
  time: string;
}

interface NewsSectionProps {
  onCreateNoteFromNews: (news: NewsItem) => Promise<void>;
}

const CATEGORIES = ['Semua', 'Teknologi', 'Bisnis', 'Politik', 'Kesehatan', 'Hiburan', 'Olahraga'];

export const NewsSection: React.FC<NewsSectionProps> = ({ onCreateNoteFromNews }) => {
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [creatingNoteId, setCreatingNoteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSummary, setActiveSummary] = useState<NewsSummary | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  const fetchNews = async (category: string, forceRefresh = false) => {
    setIsLoading(true);
    setErrorMsg('');
    setVisibleCount(12); // Reset back to default on load
    try {
      const url = `/api/news?category=${encodeURIComponent(category)}${forceRefresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Gagal memuat berita: status ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setNews(data);
      } else {
        throw new Error('Format berita dari server tidak sesuai.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat memuat berita terupdate.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(activeCategory);
  }, [activeCategory]);

  const handleCreateNote = async (item: NewsItem, idx: number) => {
    const noteIdKey = `${item.title}-${idx}`;
    setCreatingNoteId(noteIdKey);
    try {
      await onCreateNoteFromNews(item);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingNoteId(null);
    }
  };

  const handleSummarizeNews = async (item: NewsItem, idx: number) => {
    const noteIdKey = `${item.title}-${idx}`;
    setSummarizingId(noteIdKey);
    try {
      const res = await fetch('/api/news/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          url: item.url,
          summary: item.summary,
          source: item.source,
        }),
      });

      if (!res.ok) {
        throw new Error('Gagal mengenerate ringkasan.');
      }

      const data = await res.json();
      setActiveSummary({
        context: data.context || '',
        points: Array.isArray(data.points) ? data.points : [],
        impact: data.impact || '',
        title: item.title,
        source: item.source,
        url: item.url,
      });
      setIsModalOpen(true);
    } catch (e) {
      console.error(e);
      alert('Gagal membuat ringkasan berita dengan AI.');
    } finally {
      setSummarizingId(null);
    }
  };

  return (
    <div className={`${styles.container} glass-panel`}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Newspaper size={20} style={{ color: 'var(--secondary)' }} />
          Berita Terkini (Real-time)
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <GlowButton
            variant="outline"
            onClick={() => fetchNews(activeCategory, true)}
            disabled={isLoading}
            style={{ padding: '6px 12px' }}
            title="Muat Ulang Berita"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </GlowButton>
        </div>
      </div>

      {/* Category Tabs */}
      <div className={styles.categories}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`${styles.categoryBtn} ${activeCategory === cat ? styles.activeCategoryBtn : ''}`}
            onClick={() => setActiveCategory(cat)}
            disabled={isLoading}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={styles.scrollContainer}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Mengambil berita ter-update langsung dari Google Search...
            </p>
          </div>
        ) : errorMsg ? (
          <div className={styles.errorState}>
            <AlertCircle size={36} style={{ color: 'var(--error)' }} />
            <p style={{ fontSize: '0.9rem' }}>{errorMsg}</p>
            <GlowButton variant="outline" onClick={() => fetchNews(activeCategory)}>
              Coba Lagi
            </GlowButton>
          </div>
        ) : news.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Tidak ada berita yang ditemukan.</p>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
            {news.slice(0, visibleCount).map((item, idx) => {
              const noteIdKey = `${item.title}-${idx}`;
              const isCreatingNote = creatingNoteId === noteIdKey;
              
              return (
                <div key={idx} className={`${styles.newsCard} animate-slide-in`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.metaInfo}>
                      <span className={styles.sourceBadge}>{item.source}</span>
                      <span className={`tag-badge default`}>{item.category || 'Berita'}</span>
                    </div>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.newsTitle}
                  >
                    {item.title}
                  </a>

                  <p className={styles.newsSummary}>{item.summary}</p>

                  <div className={styles.cardFooter}>
                    <span className={styles.timeText}>{item.time || 'Hari ini'}</span>
                    <div className={styles.actions}>
                      <button
                        className={styles.summarizeBtn}
                        onClick={() => handleSummarizeNews(item, idx)}
                        disabled={summarizingId !== null}
                      >
                        {summarizingId === noteIdKey ? (
                          <>
                            <div className={styles.spinner} style={{ width: '12px', height: '12px', borderWidth: '1px' }} />
                            Meringkas...
                          </>
                        ) : (
                          <>
                            <BookOpen size={12} />
                            Ringkas AI
                          </>
                        )}
                      </button>
                      <button
                        className={styles.createNoteBtn}
                        onClick={() => handleCreateNote(item, idx)}
                        disabled={isCreatingNote}
                      >
                        {isCreatingNote ? (
                          <>
                            <div className={styles.spinner} style={{ width: '12px', height: '12px', borderWidth: '1px' }} />
                            Menyimpan...
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            Buat Catatan
                          </>
                        )}
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.linkBtn}
                      >
                        Baca <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
            {news.length > visibleCount && (
              <div className={styles.showMoreContainer}>
                <GlowButton
                  variant="outline"
                  onClick={() => setVisibleCount(prev => prev + 100)}
                  style={{ padding: '10px 24px', marginTop: '24px' }}
                >
                  Tampilkan Lebih Banyak (+100 Berita)
                </GlowButton>
              </div>
            )}
          </>
        )}
      </div>

      {/* News Summary Modal */}
      {isModalOpen && activeSummary && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
              <X size={18} />
            </button>
            
            <div className={styles.modalHeader}>
              <div className={styles.modalMeta}>
                <span className={styles.sourceBadge}>{activeSummary.source}</span>
                <span className="tag-badge default" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                  <Sparkles size={10} /> Ringkasan AI
                </span>
              </div>
              <h3 className={styles.modalTitle}>{activeSummary.title}</h3>
            </div>

            <div className={styles.modalBody}>
              {/* Context */}
              <div className={styles.summaryCard} style={{ borderLeft: '3px solid var(--primary)' }}>
                <h4 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', margin: '0 0 8px 0', fontWeight: '600' }}>
                  <Info size={14} /> Konteks Utama
                </h4>
                <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-muted)', margin: '0' }}>
                  {activeSummary.context}
                </p>
              </div>

              {/* Key Points */}
              <div className={styles.summaryCard} style={{ borderLeft: '3px solid var(--secondary)' }}>
                <h4 style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', margin: '0 0 8px 0', fontWeight: '600' }}>
                  <Check size={14} /> Poin Utama
                </h4>
                <ul style={{ paddingLeft: '16px', margin: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeSummary.points.map((pt, i) => (
                    <li key={i} style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-muted)' }}>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Impact */}
              {activeSummary.impact && (
                <div className={styles.summaryCard} style={{ borderLeft: '3px solid var(--accent)' }}>
                  <h4 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', margin: '0 0 8px 0', fontWeight: '600' }}>
                    <Sparkles size={14} /> Dampak & Implikasi
                  </h4>
                  <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-muted)', margin: '0' }}>
                    {activeSummary.impact}
                  </p>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <a
                href={activeSummary.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.modalLinkBtn}
              >
                Baca Selengkapnya <ExternalLink size={14} />
              </a>
              <GlowButton variant="secondary" onClick={() => setIsModalOpen(false)}>
                Tutup
              </GlowButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

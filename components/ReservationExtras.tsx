'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import styles from './ReservationExtras.module.css';

export const ADMIN_WA_NUMBER = '6285878094821';

const waLink = (number: string, text: string) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

const fmtDate = (d: Date) =>
  d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Link WhatsApp customer -> admin dengan template konfirmasi reservasi. */
export function buildCustomerConfirmLink(res: any): string {
  const d = new Date(res.dateTime);
  const text =
    `Halo Admin, saya ingin konfirmasi reservasi *${res.code || ''}*\n\n` +
    `Atas nama: ${res.name}\n` +
    `Tanggal: ${fmtDate(d)}\n` +
    `Jam: ${fmtTime(d)}\n` +
    `Jumlah orang: ${res.partySize}\n` +
    `Tempat / Meja: ${res.tableInfo}\n` +
    `DP: Rp ${Number(res.dpAmount || 0).toLocaleString('id-ID')}\n\n` +
    `Mohon konfirmasinya. Terima kasih 🙏`;
  return waLink(ADMIN_WA_NUMBER, text);
}

/** Link WhatsApp admin -> customer dengan template balasan konfirmasi. */
export function buildAdminReplyLink(res: any): string | null {
  if (!res.phone) return null;
  const d = new Date(res.dateTime);
  const text =
    `Halo Kak ${res.name}, reservasi Anda *${res.code || ''}* ` +
    `${res.status === 'confirmed' ? 'sudah kami konfirmasi' : 'sedang kami proses'}:\n\n` +
    `Tanggal: ${fmtDate(d)}\n` +
    `Jam: ${res.timeNote || fmtTime(d)}\n` +
    `Jumlah orang: ${res.partySize}\n` +
    `Tempat / Meja: ${res.tableInfo}\n` +
    `DP: ${res.dpPaid ? 'sudah kami terima ✅' : 'belum kami terima'}\n\n` +
    `Mohon konfirmasi ulang di H-2 ya Kak. Terima kasih 🙏`;
  return waLink(res.phone, text);
}

/** Tombol floating WhatsApp Admin. */
export function WhatsAppFab() {
  return (
    <a
      className={styles.fab}
      href={waLink(ADMIN_WA_NUMBER, 'Halo Admin, saya ingin bertanya tentang reservasi.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp Admin"
    >
      <MessageCircle size={22} />
      <span className={styles.fabLabel}>WhatsApp Admin</span>
    </a>
  );
}

/** Kalender reservasi publik: hanya reservasi berstatus confirmed, tanpa data pribadi. */
export function PublicReservationCalendar({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reservations/public', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => !cancelled && setItems(Array.isArray(data) ? data : []))
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const it of items) {
      const k = dayKey(new Date(it.dateTime));
      (map[k] ||= []).push(it);
    }
    return map;
  }, [items]);

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Senin = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dayKey(new Date());

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
    setSelected(null);
  };

  const listDays = selected
    ? [selected]
    : Object.keys(byDay)
        .filter((k) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
        .sort();

  return (
    <div className={`${styles.calCard} glass-panel`}>
      <h3 className={styles.calTitle}>Kalender Reservasi</h3>
      <p className={styles.calHint}>Jadwal yang sudah dikonfirmasi admin. Tanggal bertanda titik sudah ada reservasi.</p>

      <div className={styles.calLayout}>
        <div className={styles.calGridWrap}>
          <div className={styles.calNav}>
            <button type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya">&larr;</button>
            <strong>{monthNames[month]} {year}</strong>
            <button type="button" onClick={() => shift(1)} aria-label="Bulan berikutnya">&rarr;</button>
          </div>
          <div className={styles.calWeekdays}>
            {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className={styles.calGrid}>
            {Array.from({ length: firstOffset }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = byDay[k]?.length || 0;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelected(selected === k ? null : k)}
                  className={`${styles.calDay} ${k === todayKey ? styles.calToday : ''} ${selected === k ? styles.calSelected : ''}`}
                >
                  {day}
                  {count > 0 && <i className={styles.calDot}>{count}</i>}
                </button>
              );
            })}
          </div>
          {selected && (
            <button type="button" className={styles.calClear} onClick={() => setSelected(null)}>
              Tampilkan semua tanggal bulan ini
            </button>
          )}
        </div>

        <div className={styles.calList}>
          {loading ? (
            <p className={styles.calEmpty}>Memuat kalender...</p>
          ) : listDays.length === 0 ? (
            <p className={styles.calEmpty}>
              {selected ? 'Belum ada reservasi terkonfirmasi di tanggal ini.' : 'Belum ada reservasi terkonfirmasi bulan ini.'}
            </p>
          ) : (
            listDays.map((k) => {
              const rows = byDay[k] || [];
              const [y, m, d] = k.split('-').map(Number);
              return (
                <div key={k} className={styles.calDayGroup}>
                  <div className={styles.calDayHeading}>{fmtDate(new Date(y, m - 1, d))}</div>
                  {rows.length === 0 ? (
                    <p className={styles.calEmpty}>Belum ada reservasi terkonfirmasi di tanggal ini.</p>
                  ) : rows.map((r) => (
                    <div key={r.id} className={styles.calItem}>
                      <span className={styles.calItemTime}>{r.timeNote || fmtTime(new Date(r.dateTime))}</span>
                      <span className={styles.calItemPlace}>{r.tableInfo}</span>
                      <span className={styles.calItemPax}>{r.partySize} orang</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** Preview + checklist admin untuk satu reservasi: switch konfirmasi, switch DP, catatan jam, balas WA. */
export function AdminReservationChecks({
  r,
  onPatch,
}: {
  r: any;
  onPatch: (id: string, patch: Record<string, any>) => Promise<void> | void;
}) {
  const locked = r.status === 'cancelled' || r.status === 'completed';
  const reply = buildAdminReplyLink(r);

  return (
    <div className={styles.checks}>
      <div className={styles.checkRow}>
        <label className={styles.switchRow}>
          <input
            type="checkbox"
            checked={r.status === 'confirmed' || r.status === 'completed'}
            disabled={locked}
            onChange={(e) => onPatch(r.id, { status: e.target.checked ? 'confirmed' : 'pending' })}
          />
          <span className={styles.track} />
          <span>Dikonfirmasi</span>
        </label>
        <label className={styles.switchRow}>
          <input
            type="checkbox"
            checked={!!r.dpPaid}
            onChange={(e) => onPatch(r.id, { dpPaid: e.target.checked })}
          />
          <span className={styles.track} />
          <span>DP diterima</span>
        </label>
      </div>
      <div className={styles.checkRow}>
        <input
          className={styles.noteInput}
          type="text"
          key={r.timeNote || ''}
          defaultValue={r.timeNote || ''}
          placeholder="Catatan jam (cth: 19.00 - 21.00)"
          onBlur={(e) => {
            if (e.target.value.trim() !== (r.timeNote || '')) onPatch(r.id, { timeNote: e.target.value });
          }}
        />
        {reply ? (
          <a className={styles.replyBtn} href={reply} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} /> Balas WA
          </a>
        ) : (
          <span className={styles.noPhone}>Tanpa no. WA</span>
        )}
      </div>
    </div>
  );
}

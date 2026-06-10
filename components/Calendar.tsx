"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';
import styles from './Calendar.module.css';

interface Note {
  id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  todo_list: any;
  created_at: string;
}

interface CalendarProps {
  notes: Note[];
  selectedDate: string | null; // format: 'YYYY-MM-DD'
  onSelectDate: (dateStr: string | null) => void;
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const WEEKDAYS = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'];

export const Calendar: React.FC<CalendarProps> = ({ notes, selectedDate, onSelectDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Helper to format date as YYYY-MM-DD in local time
  const toLocalDateString = (year: number, month: number, day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Convert note created_at to local date string set
  const datesWithNotes = useMemo(() => {
    const dates = new Set<string>();
    notes.forEach((note) => {
      if (!note.created_at) return;
      const d = new Date(note.created_at);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = d.getMonth();
        const day = d.getDate();
        dates.add(toLocalDateString(y, m, day));
      }
    });
    return dates;
  }, [notes]);

  // Generate grid days
  const calendarDays = useMemo(() => {
    // First day of current month
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Number of days in current month
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Day of the week of first day (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDayWeek = firstDay.getDay();
    // Adjust so week starts on Monday (0 = Mon, 1 = Tue, ..., 6 = Sun)
    const startOffset = (firstDayWeek + 6) % 7;

    // Previous month total days
    const prevTotalDays = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Add days from previous month to fill the first week row
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevTotalDays - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = toLocalDateString(prevYear, prevMonth, dayNum);
      days.push({
        day: dayNum,
        isCurrentMonth: false,
        dateStr,
        hasNotes: datesWithNotes.has(dateStr)
      });
    }

    // Add days of current month
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = toLocalDateString(currentYear, currentMonth, i);
      days.push({
        day: i,
        isCurrentMonth: true,
        dateStr,
        hasNotes: datesWithNotes.has(dateStr)
      });
    }

    // Add days of next month to complete the grid (usually 35 or 42 total cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const nextDaysNeeded = totalCells - days.length;
    for (let i = 1; i <= nextDaysNeeded; i++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = toLocalDateString(nextYear, nextMonth, i);
      days.push({
        day: i,
        isCurrentMonth: false,
        dateStr,
        hasNotes: datesWithNotes.has(dateStr)
      });
    }

    return days;
  }, [currentYear, currentMonth, datesWithNotes]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleSelectDay = (dateStr: string) => {
    if (selectedDate === dateStr) {
      onSelectDate(null); // click again to clear
    } else {
      onSelectDate(dateStr);
    }
  };

  const handleClearFilter = () => {
    onSelectDate(null);
  };

  // Get current day date string for highlighting today
  const todayStr = useMemo(() => {
    const today = new Date();
    return toLocalDateString(today.getFullYear(), today.getMonth(), today.getDate());
  }, []);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className={`${styles.calendarContainer} glass-panel animate-fade-in`}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={handlePrevMonth} title="Bulan Sebelumnya">
          <ChevronLeft size={16} />
        </button>
        <span className={styles.monthTitle}>
          {INDONESIAN_MONTHS[currentMonth]} {currentYear}
        </span>
        <button className={styles.navBtn} onClick={handleNextMonth} title="Bulan Berikutnya">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekdays */}
      <div className={styles.weekdaysGrid}>
        {WEEKDAYS.map((day, idx) => (
          <span key={idx} className={styles.weekdayLabel}>{day}</span>
        ))}
      </div>

      {/* Days Grid */}
      <div className={styles.daysGrid}>
        {calendarDays.map((cell, idx) => {
          const isSelected = selectedDate === cell.dateStr;
          const isToday = todayStr === cell.dateStr;

          let cellClass = styles.dayCell;
          if (!cell.isCurrentMonth) cellClass += ` ${styles.otherMonth}`;
          if (isSelected) cellClass += ` ${styles.selected}`;
          if (isToday) cellClass += ` ${styles.today}`;
          if (cell.hasNotes) cellClass += ` ${styles.hasNotesCell}`;

          return (
            <button
              key={idx}
              className={cellClass}
              onClick={() => handleSelectDay(cell.dateStr)}
              title={`${cell.day} ${INDONESIAN_MONTHS[currentMonth]} ${currentYear}${cell.hasNotes ? ' (Memiliki Catatan)' : ''}`}
            >
              <span className={styles.dayNumber}>{cell.day}</span>
              {cell.hasNotes && <span className={styles.noteIndicator} />}
            </button>
          );
        })}
      </div>

      {/* Selected Filter Bar */}
      {selectedDate && (
        <div className={styles.filterBar}>
          <div className={styles.filterInfo}>
            <CalendarIcon size={12} className={styles.filterIcon} />
            <span className={styles.filterText}>Filter: {formattedSelectedDate}</span>
          </div>
          <button className={styles.clearBtn} onClick={handleClearFilter} title="Hapus Filter">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useFlyoutPlacement } from '../../lib/ui/flyoutPosition';
import '../ui/LiquidGlass.css';

interface CalendarPanelProps {
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export function CalendarPanel({ onClose, anchorRef }: CalendarPanelProps) {
  const panelPosition = useDesktopStore((state) => state.panelPosition);
  const panelStyle = useDesktopStore((state) => state.panelStyle ?? 'floating');

  const placement = useFlyoutPlacement({
    anchorRef,
    panelPosition,
    panelStyle,
    preferredWidth: 360,
    preferredHeight: 460,
    align: 'end',
  });

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());

  // Live 1-second system clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut: Escape closes panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 24-hour time formatting
  const hours = String(currentTime.getHours()).padStart(2, '0');
  const minutes = String(currentTime.getMinutes()).padStart(2, '0');
  const seconds = String(currentTime.getSeconds()).padStart(2, '0');
  const timeString = `${hours}:${minutes}:${seconds}`;

  const dayOfWeek = currentTime.toLocaleDateString(undefined, { weekday: 'long' });
  const fullDate = currentTime.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Calendar calculations for viewed month
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const monthName = viewDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // Navigation handlers
  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleResetToToday = () => {
    setViewDate(new Date());
  };

  // Compute calendar days grid (Monday-based start)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

  // JavaScript getDay(): Sunday = 0, Monday = 1 ... Saturday = 6
  // Convert so Monday = 0 ... Sunday = 6
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  // Days from previous month
  const prevMonthLastDate = new Date(viewYear, viewMonth, 0).getDate();
  const calendarCells: Array<{ day: number; isCurrentMonth: boolean; isToday: boolean }> = [];

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({
      day: prevMonthLastDate - i,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  // Days in current month
  const today = new Date();
  const isViewingCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isViewingCurrentMonth && d === today.getDate();
    calendarCells.push({
      day: d,
      isCurrentMonth: true,
      isToday,
    });
  }

  // Fill trailing cells to complete a 35 or 42 grid
  const totalCellsNeeded = calendarCells.length > 35 ? 42 : 35;
  const trailingDays = totalCellsNeeded - calendarCells.length;
  for (let t = 1; t <= trailingDays; t++) {
    calendarCells.push({
      day: t,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div
      className={`liquid-glass-flyout ${placement.positionClass}`}
      style={placement.style}
      role="dialog"
      aria-label="System Clock and Calendar"
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Clock Header */}
      <div className="cal-header-clock">
        <div
          className="cal-clock-digits"
          role="timer"
          aria-label={`Time: ${timeString}`}
        >
          {timeString}
        </div>
        <div className="cal-clock-date-line">
          {dayOfWeek}, {fullDate}
        </div>
      </div>

      {/* Monthly Calendar Navigation */}
      <div className="cal-month-nav">
        <span className="cal-month-title">{monthName}</span>
        <div className="cal-nav-controls">
          <button
            type="button"
            className="cal-nav-btn today-btn"
            onClick={handleResetToToday}
            title="Reset to current month"
            aria-label="View current month"
          >
            <RotateCcw size={11} style={{ marginRight: 3 }} />
            <span>Today</span>
          </button>
          <button
            type="button"
            className="cal-nav-btn"
            onClick={handlePrevMonth}
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="cal-nav-btn"
            onClick={handleNextMonth}
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Weekday Row */}
      <div className="cal-grid" role="grid" aria-label={`Calendar for ${monthName}`}>
        {weekdays.map((w) => (
          <div key={w} className="cal-weekday" role="columnheader">
            {w}
          </div>
        ))}

        {/* Days Grid */}
        {calendarCells.map((cell, idx) => (
          <div
            key={idx}
            className={`cal-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''}`}
            role="gridcell"
            aria-current={cell.isToday ? 'date' : undefined}
          >
            {cell.day}
          </div>
        ))}
      </div>
    </div>
  );
}

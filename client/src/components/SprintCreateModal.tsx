import { useState, useEffect, useRef } from 'react';
import { X, Zap, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Inline calendar date picker component with text input
function DatePickerCalendar({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (date: string) => void;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => value ? new Date(value) : new Date());
  const [inputValue, setInputValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Format YYYY-MM-DD to DD/MM/YYYY for display
  const toDisplayFormat = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // Parse DD/MM/YYYY to YYYY-MM-DD
  const fromDisplayFormat = (display: string): string | null => {
    const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, d, m, y] = match;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    setInputValue(toDisplayFormat(value));
  }, [value]);

  useEffect(() => {
    if (value) setViewMonth(new Date(value));
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedDate = value ? new Date(value) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (yr: number, mo: number) => new Date(yr, mo + 1, 0).getDate();
  const getFirstDayOfMonth = (yr: number, mo: number) => new Date(yr, mo, 1).getDay();

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  const selectDate = (day: number) => {
    const d = new Date(year, month, day);
    const str = d.toISOString().split('T')[0];
    onChange(str);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const parsed = fromDisplayFormat(val);
    if (parsed) {
      onChange(parsed);
    }
  };

  const handleInputBlur = () => {
    // Reset to current value if input is invalid
    setInputValue(toDisplayFormat(value));
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  return (
    <div ref={ref} className="relative">
      <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 mb-2">
        <Calendar className="w-4 h-4" />
        {label}
      </label>
      <div className={cn(
        "flex items-center bg-white dark:bg-[#14151a] border rounded-lg transition-colors",
        isOpen
          ? "border-teal-500 ring-2 ring-teal-500"
          : "border-gray-200 dark:border-[#1f2229] hover:border-gray-300 dark:hover:border-slate-500"
      )}>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="DD/MM/YYYY"
          className="flex-1 px-4 py-3 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none min-w-0"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-3 text-gray-400 dark:text-slate-500 hover:text-teal-500 transition-colors flex-shrink-0"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 p-3 w-[280px]">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-slate-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-slate-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="w-8 h-7 flex items-center justify-center text-[11px] font-medium text-gray-400 dark:text-slate-500">
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} className="w-8 h-8" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const thisDate = new Date(year, month, day);
              const isSelected = selectedDate && isSameDay(thisDate, selectedDate);
              const isToday = isSameDay(thisDate, today);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-medium flex items-center justify-center transition-colors",
                    isSelected
                      ? "bg-teal-600 text-white"
                      : isToday
                        ? "bg-teal-600/20 text-teal-400 hover:bg-teal-600/30"
                        : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-[#1f2229]">
            <button
              type="button"
              onClick={() => {
                const str = new Date().toISOString().split('T')[0];
                onChange(str);
                setIsOpen(false);
              }}
              className="w-full text-center text-xs text-teal-500 hover:text-teal-400 py-1 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SprintFolderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (data: { name: string; default_duration: number }) => void;
}

export function SprintFolderCreateModal({ isOpen, onClose, onCreateFolder }: SprintFolderCreateModalProps) {
  const [name, setName] = useState('Sprints');
  const [duration, setDuration] = useState(14);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onCreateFolder({ name: name.trim() || 'Sprints', default_duration: duration });
    setName('Sprints');
    setDuration(14);
    onClose();
  };

  const durationOptions = [
    { value: 7, label: '1 week' },
    { value: 14, label: '2 weeks' },
    { value: 21, label: '3 weeks' },
    { value: 28, label: '4 weeks' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-100 dark:bg-[#14151a] rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Sprint Folder</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">Organize work into time-boxed sprints</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Folder Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Sprints"
              className="w-full px-4 py-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Default Sprint Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {durationOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={cn(
                    "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                    duration === opt.value
                      ? "bg-teal-600/20 border-teal-500 text-teal-300"
                      : "bg-white dark:bg-[#14151a] border-gray-200 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Create Sprint Folder
          </button>
        </div>
      </div>
    </div>
  );
}

interface SprintCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSprint: (data: { name: string; start_date: string; end_date: string }) => void;
  defaultDuration: number;
  nextSprintNumber: number;
  lastSprintEndDate?: string;
}

export function SprintCreateModal({
  isOpen,
  onClose,
  onCreateSprint,
  defaultDuration,
  nextSprintNumber,
  lastSprintEndDate
}: SprintCreateModalProps) {
  const getDefaultStartDate = () => {
    if (lastSprintEndDate) {
      const d = new Date(lastSprintEndDate);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const getDefaultEndDate = (startStr: string, duration: number) => {
    const d = new Date(startStr);
    d.setDate(d.getDate() + duration);
    return d.toISOString().split('T')[0];
  };

  const defaultStart = getDefaultStartDate();
  const [name, setName] = useState(`Sprint ${nextSprintNumber}`);
  const [startDate, setStartDate] = useState(defaultStart);
  const [selectedDuration, setSelectedDuration] = useState(defaultDuration);
  const [endDate, setEndDate] = useState(getDefaultEndDate(defaultStart, defaultDuration));

  // Reset state when modal opens with new props
  useEffect(() => {
    if (isOpen) {
      const newStartDate = getDefaultStartDate();
      setName(`Sprint ${nextSprintNumber}`);
      setStartDate(newStartDate);
      setSelectedDuration(defaultDuration);
      setEndDate(getDefaultEndDate(newStartDate, defaultDuration));
    }
  }, [isOpen, nextSprintNumber, defaultDuration, lastSprintEndDate]);

  // Duration preset options
  const durationOptions = [
    { value: 7, label: '1 week' },
    { value: 14, label: '2 weeks' },
    { value: 21, label: '3 weeks' },
    { value: 28, label: '4 weeks' },
  ];

  if (!isOpen) return null;

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    setEndDate(getDefaultEndDate(newStart, selectedDuration));
  };

  const handleDurationSelect = (duration: number) => {
    setSelectedDuration(duration);
    setEndDate(getDefaultEndDate(startDate, duration));
  };

  const handleSubmit = () => {
    onCreateSprint({
      name: name.trim() || `Sprint ${nextSprintNumber}`,
      start_date: startDate,
      end_date: endDate
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-100 dark:bg-[#14151a] rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-teal-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Sprint</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Sprint Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Sprint Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {durationOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleDurationSelect(opt.value)}
                  className={cn(
                    "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                    selectedDuration === opt.value
                      ? "bg-teal-600/20 border-teal-500 text-teal-300"
                      : "bg-white dark:bg-[#14151a] border-gray-200 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DatePickerCalendar
              label="Start Date"
              value={startDate}
              onChange={handleStartDateChange}
            />
            <DatePickerCalendar
              label="End Date"
              value={endDate}
              onChange={setEndDate}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Create Sprint
          </button>
        </div>
      </div>
    </div>
  );
}

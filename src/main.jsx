import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Armchair,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Shield,
  Waves,
  X,
} from 'lucide-react';
import './styles.css';

const CURRENT_YEAR = new Date().getFullYear();
const STORAGE_KEY = `fitness-calendar-${CURRENT_YEAR}`;

const muscleGroups = [
  { id: 'default', label: '综合', icon: Dumbbell, color: '#64748b' },
  { id: 'chest', label: '胸部', icon: Shield, color: '#ef4444' },
  { id: 'arms', label: '手臂', icon: Armchair, color: '#f97316' },
  { id: 'back', label: '背部', icon: Waves, color: '#2563eb' },
  { id: 'legs', label: '腿部', icon: Footprints, color: '#16a34a' },
  { id: 'core', label: '核心', icon: Flame, color: '#a855f7' },
  { id: 'cardio', label: '有氧', icon: HeartPulse, color: '#db2777' },
  { id: 'mobility', label: '拉伸', icon: Activity, color: '#0f766e' },
];

const groupMap = Object.fromEntries(muscleGroups.map((group) => [group.id, group]));
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];
const monthLabels = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatChineseDate(date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function getDaysInYear(year) {
  const days = [];
  const date = new Date(year, 0, 1);
  while (date.getFullYear() === year) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function App() {
  const todayIso = isoDate(new Date());
  const [checkins, setCheckins] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    } catch {
      return {};
    }
  });
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkins));
  }, [checkins]);

  const days = useMemo(() => getDaysInYear(CURRENT_YEAR), []);
  const months = useMemo(
    () =>
      monthLabels.map((label, monthIndex) => ({
        label,
        days: days.filter((date) => date.getMonth() === monthIndex),
      })),
    [days]
  );

  const totalWorkoutDays = Object.keys(checkins).length;
  const selectedCheckin = checkins[selectedDate];
  const selectedDateObject = new Date(`${selectedDate}T12:00:00`);
  const canEditSelected = selectedDate <= todayIso;

  const mostUsedGroup = useMemo(() => {
    const counts = {};
    Object.values(checkins).forEach((entry) => {
      const group = entry?.group ?? 'default';
      counts[group] = (counts[group] ?? 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? { ...groupMap[top[0]], count: top[1] } : null;
  }, [checkins]);

  function toggleCheckin(dateIso, group = 'default') {
    if (dateIso > todayIso) return;
    setSelectedDate(dateIso);
    setCheckins((current) => {
      const next = { ...current };
      if (next[dateIso]?.group === group || (next[dateIso] && group === 'remove')) {
        delete next[dateIso];
      } else {
        next[dateIso] = { group, checkedAt: new Date().toISOString() };
      }
      return next;
    });
  }

  function setSelectedGroup(group) {
    if (!canEditSelected) return;
    setCheckins((current) => ({
      ...current,
      [selectedDate]: { group, checkedAt: current[selectedDate]?.checkedAt ?? new Date().toISOString() },
    }));
  }

  const visibleMonths = months.map((month) => ({
    ...month,
    days: month.days.filter((date) => {
      if (filter === 'all') return true;
      const entry = checkins[isoDate(date)];
      return filter === 'checked' ? Boolean(entry) : entry?.group === filter;
    }),
  }));

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{CURRENT_YEAR} Fitness Calendar</p>
          <h1>年度健身日历</h1>
          <p className="hero-copy">选择今天或过去任意一天完成健身打卡，并记录训练部位。数据保存在当前浏览器本地。</p>
        </div>
        <div className="stats-grid">
          <Stat label="今年已健身" value={`${totalWorkoutDays} 天`} />
          <Stat label="完成率" value={`${Math.round((totalWorkoutDays / days.length) * 100)}%`} />
          <Stat label="高频训练" value={mostUsedGroup ? `${mostUsedGroup.label} · ${mostUsedGroup.count}` : '暂无'} />
        </div>
      </section>

      <section className="control-panel">
        <div className="selected-card">
          <span>当前选择</span>
          <strong>{formatChineseDate(selectedDateObject)}</strong>
          <p>{canEditSelected ? '可打卡或调整训练部位' : '未来日期暂不可打卡'}</p>
        </div>
        <div className="muscle-picker" aria-label="训练部位选择">
          {muscleGroups.map((group) => {
            const Icon = group.icon;
            const active = selectedCheckin?.group === group.id || (!selectedCheckin && group.id === 'default');
            return (
              <button
                key={group.id}
                className={active && selectedCheckin ? 'active' : ''}
                style={{ '--group-color': group.color }}
                onClick={() => setSelectedGroup(group.id)}
                disabled={!canEditSelected}
              >
                <Icon size={18} />
                {group.label}
              </button>
            );
          })}
          <button className="remove-button" onClick={() => toggleCheckin(selectedDate, 'remove')} disabled={!selectedCheckin}>
            <X size={18} />
            取消打卡
          </button>
        </div>
      </section>

      <section className="filters">
        <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>
          全部日期
        </button>
        <button className={filter === 'checked' ? 'selected' : ''} onClick={() => setFilter('checked')}>
          只看已打卡
        </button>
        {muscleGroups.slice(1).map((group) => (
          <button key={group.id} className={filter === group.id ? 'selected' : ''} onClick={() => setFilter(group.id)}>
            {group.label}
          </button>
        ))}
      </section>

      <section className="calendar-grid">
        {visibleMonths.map((month, monthIndex) => (
          <article className="month-card" key={month.label}>
            <header>
              <h2>{month.label}</h2>
              <span>{months[monthIndex].days.filter((date) => checkins[isoDate(date)]).length} 天</span>
            </header>
            <div className="weekdays">
              {weekdayLabels.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="days">
              {filter === 'all' &&
                Array.from({ length: (months[monthIndex].days[0].getDay() + 6) % 7 }).map((_, index) => (
                  <span className="empty-day" key={`empty-${index}`} />
                ))}
              {month.days.map((date) => {
                const dateIso = isoDate(date);
                const entry = checkins[dateIso];
                const group = groupMap[entry?.group ?? 'default'];
                const Icon = group.icon;
                const isFuture = dateIso > todayIso;
                const isSelected = dateIso === selectedDate;
                return (
                  <button
                    key={dateIso}
                    className={`day ${entry ? 'checked' : ''} ${isFuture ? 'future' : ''} ${isSelected ? 'selected' : ''}`}
                    style={{ '--group-color': group.color }}
                    onClick={() => (entry ? setSelectedDate(dateIso) : toggleCheckin(dateIso))}
                    title={`${formatChineseDate(date)}${entry ? ` · ${group.label}` : ''}`}
                    disabled={isFuture}
                  >
                    <span className="day-number">{date.getDate()}</span>
                    {entry && <Icon size={15} strokeWidth={2.4} />}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

const currentYear = new Date().getFullYear();
const storageKey = `fitness-calendar-${currentYear}`;

const muscleGroups = [
  { id: "default", label: "综合", icon: "🏋️", color: "#64748b" },
  { id: "chest", label: "胸部", icon: "🛡️", color: "#ef4444" },
  { id: "arms", label: "手臂", icon: "💪", color: "#f97316" },
  { id: "back", label: "背部", icon: "🌊", color: "#2563eb" },
  { id: "legs", label: "腿部", icon: "🦵", color: "#16a34a" },
  { id: "core", label: "核心", icon: "🔥", color: "#a855f7" },
  { id: "cardio", label: "有氧", icon: "❤️", color: "#db2777" },
  { id: "mobility", label: "拉伸", icon: "🧘", color: "#0f766e" },
];

const groupMap = Object.fromEntries(muscleGroups.map((group) => [group.id, group]));
const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
const monthLabels = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

type Checkin = {
  group: string;
  checkedAt: string;
};

type Checkins = Record<string, Checkin>;

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatChineseDate(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function getDaysInYear(year: number) {
  const days: Date[] = [];
  const date = new Date(year, 0, 1);
  while (date.getFullYear() === year) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export default function Home() {
  const todayIso = isoDate(new Date());
  const [checkins, setCheckins] = useState<Checkins>({});
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    try {
      setCheckins(JSON.parse(localStorage.getItem(storageKey) ?? "{}"));
    } catch {
      setCheckins({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checkins));
  }, [checkins]);

  const days = useMemo(() => getDaysInYear(currentYear), []);
  const months = useMemo(
    () =>
      monthLabels.map((label, monthIndex) => ({
        label,
        days: days.filter((date) => date.getMonth() === monthIndex),
      })),
    [days],
  );

  const totalWorkoutDays = Object.keys(checkins).length;

  const mostUsedGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(checkins).forEach((entry) => {
      const group = entry?.group ?? "default";
      counts[group] = (counts[group] ?? 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? { ...groupMap[top[0]], count: top[1] } : null;
  }, [checkins]);

  function toggleCheckin(dateIso: string, group = "default") {
    if (dateIso > todayIso) return;
    setSelectedDate(dateIso);
    setOpenDate(dateIso);
    setCheckins((current) => {
      const next = { ...current };
      if (group === "remove" || next[dateIso]?.group === group) {
        delete next[dateIso];
      } else {
        next[dateIso] = { group, checkedAt: new Date().toISOString() };
      }
      return next;
    });
  }

  function setSelectedGroup(group: string) {
    if (!openDate || openDate > todayIso) return;
    setCheckins((current) => ({
      ...current,
      [openDate]: {
        group,
        checkedAt: current[openDate]?.checkedAt ?? new Date().toISOString(),
      },
    }));
  }

  const visibleMonths = months.map((month) => ({
    ...month,
    days: month.days.filter((date) => {
      if (filter === "all") return true;
      const entry = checkins[isoDate(date)];
      return filter === "checked" ? Boolean(entry) : entry?.group === filter;
    }),
  }));

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-card">
          <p className="eyebrow">{currentYear} Fitness Calendar</p>
          <h1>年度健身日历</h1>
          <p className="hero-copy">选择今天或过去任意一天完成健身打卡，并记录训练部位。数据保存在当前浏览器本地。</p>
        </div>
        <div className="stats-grid">
          <Stat label="今年已健身" value={`${totalWorkoutDays} 天`} />
          <Stat label="完成率" value={`${Math.round((totalWorkoutDays / days.length) * 100)}%`} />
          <Stat label="高频训练" value={mostUsedGroup ? `${mostUsedGroup.label} · ${mostUsedGroup.count}` : "暂无"} />
        </div>
      </section>

      <section className="filters" aria-label="筛选日期">
        <button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>
          全部日期
        </button>
        <button className={filter === "checked" ? "selected" : ""} onClick={() => setFilter("checked")}>
          只看已打卡
        </button>
        {muscleGroups.slice(1).map((group) => (
          <button key={group.id} className={filter === group.id ? "selected" : ""} onClick={() => setFilter(group.id)}>
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
              {filter === "all" &&
                Array.from({ length: (months[monthIndex].days[0].getDay() + 6) % 7 }).map((_, index) => (
                  <span className="empty-day" key={`empty-${index}`} />
                ))}
              {month.days.map((date) => {
                const dateIso = isoDate(date);
                const entry = checkins[dateIso];
                const group = groupMap[entry?.group ?? "default"];
                const isFuture = dateIso > todayIso;
                const isSelected = dateIso === selectedDate;
                const isPopoverOpen = openDate === dateIso;
                const dateObject = new Date(`${dateIso}T12:00:00`);
                const popoverSide = date.getDay() === 0 || date.getDay() === 6 ? "popover-left" : "popover-right";
                return (
                  <div className="day-cell" key={dateIso}>
                    <button
                      className={`day ${entry ? "checked" : ""} ${isFuture ? "future" : ""} ${isSelected ? "selected" : ""}`}
                      style={{ "--group-color": group.color } as CSSProperties}
                      onClick={() => {
                        setSelectedDate(dateIso);
                        setOpenDate(dateIso);
                      }}
                      title={`${formatChineseDate(date)}${entry ? ` · ${group.label}` : ""}`}
                      disabled={isFuture}
                    >
                      <span className="day-number">{date.getDate()}</span>
                      {entry && <span className="day-icon">{group.icon}</span>}
                    </button>
                    {isPopoverOpen && (
                      <div
                        className={`checkin-popover ${popoverSide}`}
                        role="dialog"
                        aria-label={`${formatChineseDate(dateObject)} 健身打卡`}
                      >
                        <div className="popover-header">
                          <div>
                            <span>选择日期</span>
                            <strong>{formatChineseDate(dateObject)}</strong>
                          </div>
                          <button className="close-popover" onClick={() => setOpenDate(null)} aria-label="关闭">
                            ×
                          </button>
                        </div>
                        <div className="muscle-picker compact" aria-label="训练部位选择">
                          {muscleGroups.map((muscleGroup) => {
                            const active = entry?.group === muscleGroup.id;
                            return (
                              <button
                                key={muscleGroup.id}
                                className={active ? "active" : ""}
                                style={{ "--group-color": muscleGroup.color } as CSSProperties}
                                onClick={() => setSelectedGroup(muscleGroup.id)}
                              >
                                <span aria-hidden="true">{muscleGroup.icon}</span>
                                {muscleGroup.label}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          className="popover-remove"
                          onClick={() => toggleCheckin(dateIso, "remove")}
                          disabled={!entry}
                        >
                          取消打卡
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

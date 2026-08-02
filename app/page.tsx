"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

const currentYear = new Date().getFullYear();
const storageKey = `fitness-calendar-${currentYear}`;

const muscleGroups = [
  { id: "default", label: "综合", icon: "/icons/default.png", color: "#64748b" },
  { id: "chest", label: "胸部", icon: "/icons/chest.png", color: "#ef4444" },
  { id: "arms", label: "手臂", icon: "/icons/arms.png", color: "#f97316" },
  { id: "shoulders", label: "肩部", icon: "/icons/shoulders.png", color: "#0891b2" },
  { id: "back", label: "背部", icon: "/icons/back.png", color: "#2563eb" },
  { id: "legs", label: "腿部", icon: "/icons/legs.png", color: "#16a34a" },
  { id: "core", label: "核心", icon: "/icons/core.png", color: "#a855f7" },
  { id: "cardio", label: "有氧", icon: "/icons/cardio.png", color: "#db2777" },
];

const groupMap = Object.fromEntries(muscleGroups.map((group) => [group.id, group]));
const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
const monthLabels = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

type Checkin = {
  group?: string;
  groups?: string[];
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

function normalizeGroups(entry?: Checkin) {
  if (!entry) return [];
  const groups = Array.isArray(entry.groups) ? entry.groups : entry.group ? [entry.group] : [];
  const validGroups = groups.filter((group, index) => groupMap[group] && groups.indexOf(group) === index);
  return validGroups.length ? validGroups.slice(0, 3) : ["default"];
}

function MuscleIcon({ src, label }: { src: string; label: string }) {
  return <img className="muscle-icon" src={src} alt="" aria-hidden="true" draggable={false} data-label={label} />;
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

  useEffect(() => {
    if (!openDate) return;

    function closePopoverOnOutsideClick(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".checkin-popover") || target.closest(".day")) return;
      setOpenDate(null);
    }

    document.addEventListener("pointerdown", closePopoverOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closePopoverOnOutsideClick);
  }, [openDate]);

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
  const workoutCounts = useMemo(() => {
    const counts = Object.fromEntries(muscleGroups.map((group) => [group.id, 0])) as Record<string, number>;
    Object.values(checkins).forEach((entry) => {
      normalizeGroups(entry).forEach((group) => {
        counts[group] = (counts[group] ?? 0) + 1;
      });
    });
    return counts;
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
        next[dateIso] = { groups: [group], checkedAt: new Date().toISOString() };
      }
      return next;
    });
  }

  function setSelectedGroup(group: string) {
    if (!openDate || openDate > todayIso) return;
    setCheckins((current) => {
      const currentEntry = current[openDate];
      const currentGroups = normalizeGroups(currentEntry);
      let nextGroups: string[];

      if (group === "default") {
        nextGroups = ["default"];
      } else if (currentGroups.includes(group)) {
        nextGroups = currentGroups.filter((currentGroup) => currentGroup !== group);
      } else {
        const baseGroups = currentGroups.filter((currentGroup) => currentGroup !== "default");
        nextGroups = [...baseGroups, group].slice(0, 3);
      }

      if (!nextGroups.length) {
        const next = { ...current };
        delete next[openDate];
        return next;
      }

      return {
        ...current,
        [openDate]: {
          groups: nextGroups,
          checkedAt: currentEntry?.checkedAt ?? new Date().toISOString(),
        },
      };
    });
  }

  const visibleMonths = months.map((month) => ({
    ...month,
    days: month.days.filter((date) => {
      if (filter === "all") return true;
      const entry = checkins[isoDate(date)];
      const entryGroups = normalizeGroups(entry);
      return filter === "checked" ? Boolean(entry) : entryGroups.includes(filter);
    }),
  }));

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-card">
          <h1>
            <span>{currentYear}</span>
            <span>Fitness Calendar</span>
          </h1>
        </div>
        <div className="stats-grid">
          <Stat label="今年已健身" value={`${totalWorkoutDays} 天`}>
            <div className="stat-breakdown">
              {muscleGroups.map((group) => (
                <span key={group.id}>
                  <MuscleIcon src={group.icon} label={group.label} />
                  {group.label} {workoutCounts[group.id] ?? 0}
                </span>
              ))}
            </div>
          </Stat>
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
        {visibleMonths.map((month, monthIndex) => {
          const monthHasOpenPopover = openDate
            ? months[monthIndex].days.some((date) => isoDate(date) === openDate)
            : false;

          return (
            <article className={`month-card ${monthHasOpenPopover ? "popover-active" : ""}`} key={month.label}>
              <header>
                <h2>{month.label}</h2>
                <span>{months[monthIndex].days.filter((date) => checkins[isoDate(date)]).length} 天</span>
              </header>
              {filter === "all" && (
                <div className="weekdays">
                  {weekdayLabels.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
              )}
              <div className="days">
                {filter === "all" &&
                  Array.from({ length: (months[monthIndex].days[0].getDay() + 6) % 7 }).map((_, index) => (
                    <span className="empty-day" key={`empty-${index}`} />
                  ))}
                {month.days.map((date) => {
                const dateIso = isoDate(date);
                const entry = checkins[dateIso];
                const entryGroups = normalizeGroups(entry);
                const displayGroups = entryGroups.map((group) => groupMap[group] ?? groupMap.default);
                const primaryGroup = displayGroups[0] ?? groupMap.default;
                const backgroundGroup = displayGroups.length > 1 ? groupMap.default : primaryGroup;
                const isFuture = dateIso > todayIso;
                const isSelected = dateIso === selectedDate;
                const isPopoverOpen = openDate === dateIso;
                const dateObject = new Date(`${dateIso}T12:00:00`);
                const popoverSide = date.getDay() === 0 || date.getDay() === 6 ? "popover-left" : "popover-right";
                const dayStyle = {
                  "--group-color": backgroundGroup.color,
                  "--slot-1": displayGroups[0]?.color ?? primaryGroup.color,
                  "--slot-2": displayGroups[1]?.color ?? primaryGroup.color,
                  "--slot-3": displayGroups[2]?.color ?? primaryGroup.color,
                } as CSSProperties;
                return (
                  <div className="day-cell" key={dateIso}>
                    <button
                      className={`day ${entry ? "checked" : ""} count-${displayGroups.length} ${isFuture ? "future" : ""} ${isSelected ? "selected" : ""}`}
                      style={dayStyle}
                      onClick={() => {
                        setSelectedDate(dateIso);
                        setOpenDate(dateIso);
                        if (!entry) {
                          setCheckins((current) => ({
                            ...current,
                            [dateIso]: {
                              groups: ["default"],
                              checkedAt: new Date().toISOString(),
                            },
                          }));
                        }
                      }}
                      title={`${formatChineseDate(date)}${entry ? ` · ${displayGroups.map((group) => group.label).join("、")}` : ""}`}
                      disabled={isFuture}
                    >
                      <span className="day-number">{date.getDate()}</span>
                      {entry && (
                        <span className="day-icons" aria-hidden="true">
                          {displayGroups.map((group) => (
                            <span className="day-icon" key={group.id} style={{ "--icon-color": group.color } as CSSProperties}>
                              <MuscleIcon src={group.icon} label={group.label} />
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                    {isPopoverOpen && (
                      <div
                        className={`checkin-popover ${popoverSide}`}
                        role="dialog"
                        aria-label={`${formatChineseDate(dateObject)} 健身打卡`}
                      >
                        <div className="popover-header">
                          <div>
                            <strong>{formatChineseDate(dateObject)}</strong>
                          </div>
                          <button className="close-popover" onClick={() => setOpenDate(null)} aria-label="关闭">
                            ×
                          </button>
                        </div>
                        <div className="muscle-picker compact" aria-label="训练部位选择">
                          {muscleGroups.map((muscleGroup) => {
                            const active = entryGroups.includes(muscleGroup.id);
                            const disabled = !active && entryGroups.filter((group) => group !== "default").length >= 3 && muscleGroup.id !== "default";
                            return (
                              <button
                                key={muscleGroup.id}
                                className={active ? "active" : ""}
                                style={{ "--group-color": muscleGroup.color } as CSSProperties}
                                onClick={() => setSelectedGroup(muscleGroup.id)}
                                disabled={disabled}
                              >
                                <MuscleIcon src={muscleGroup.icon} label={muscleGroup.label} />
                                {muscleGroup.label}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          className="popover-remove"
                          onClick={() => {
                            setCheckins((current) => {
                              const next = { ...current };
                              delete next[dateIso];
                              return next;
                            });
                            setOpenDate(null);
                          }}
                          disabled={!entry}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {children}
    </div>
  );
}

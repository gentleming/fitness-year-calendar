"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

const launchYear = 2026;
const actualYear = new Date().getFullYear();

const muscleGroups = [
  { id: "default", label: "Full Body", icon: "/icons/default.png", color: "#60a5fa" },
  { id: "chest", label: "Chest", icon: "/icons/chest.png", color: "#ef4444" },
  { id: "arms", label: "Arms", icon: "/icons/arms.png", color: "#f97316" },
  { id: "shoulders", label: "Shoulders", icon: "/icons/shoulders.png", color: "#0891b2" },
  { id: "back", label: "Back", icon: "/icons/back.png", color: "#2563eb" },
  { id: "legs", label: "Legs", icon: "/icons/legs.png", color: "#16a34a" },
  { id: "core", label: "Core", icon: "/icons/core.png", color: "#a855f7" },
  { id: "cardio", label: "Cardio", icon: "/icons/cardio.png", color: "#db2777" },
];

const groupMap = Object.fromEntries(muscleGroups.map((group) => [group.id, group]));
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthLabels = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

type Checkin = {
  group?: string;
  groups?: string[];
  checkedAt: string;
};

type Checkins = Record<string, Checkin>;

function getStorageKey(year: number) {
  return `fitness-calendar-${year}`;
}

function getYearOptions(year: number) {
  const startYear = Math.min(launchYear, year);
  return Array.from({ length: year - startYear + 1 }, (_, index) => startYear + index).reverse();
}

function loadCheckins(year: number) {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(year)) ?? "{}") as Checkins;
  } catch {
    return {};
  }
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEnglishDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

function getElapsedDaysInYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const elapsed = Math.floor((date.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, elapsed);
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
  const today = new Date();
  const todayIso = isoDate(today);
  const [viewYear, setViewYear] = useState(actualYear);
  const [checkinsByYear, setCheckinsByYear] = useState<Record<number, Checkins>>({});
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [isSharing, setIsSharing] = useState(false);
  const captureRef = useRef<HTMLElement | null>(null);
  const yearOptions = useMemo(() => getYearOptions(actualYear), []);
  const checkins = checkinsByYear[viewYear] ?? {};

  useEffect(() => {
    setCheckinsByYear(Object.fromEntries(yearOptions.map((year) => [year, loadCheckins(year)])));
  }, [yearOptions]);

  useEffect(() => {
    setOpenDate(null);
    setSelectedDate(viewYear === actualYear ? todayIso : `${viewYear}-12-31`);
  }, [todayIso, viewYear]);

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

  const days = useMemo(() => getDaysInYear(viewYear), [viewYear]);
  const months = useMemo(
    () =>
      monthLabels.map((label, monthIndex) => ({
        label,
        days: days.filter((date) => date.getMonth() === monthIndex),
      })),
    [days],
  );

  const totalWorkoutDays = Object.keys(checkins).length;
  const elapsedDays = viewYear === actualYear ? Math.min(days.length, getElapsedDaysInYear(today)) : days.length;
  const workoutCounts = useMemo(() => {
    const counts = Object.fromEntries(muscleGroups.map((group) => [group.id, 0])) as Record<string, number>;
    Object.values(checkins).forEach((entry) => {
      normalizeGroups(entry).forEach((group) => {
        counts[group] = (counts[group] ?? 0) + 1;
      });
    });
    return counts;
  }, [checkins]);

  function updateCheckins(updater: (current: Checkins) => Checkins) {
    setCheckinsByYear((current) => {
      const currentYearCheckins = current[viewYear] ?? loadCheckins(viewYear);
      const nextYearCheckins = updater(currentYearCheckins);
      localStorage.setItem(getStorageKey(viewYear), JSON.stringify(nextYearCheckins));
      return {
        ...current,
        [viewYear]: nextYearCheckins,
      };
    });
  }

  function toggleCheckin(dateIso: string, group = "default") {
    if (dateIso > todayIso) return;
    setSelectedDate(dateIso);
    setOpenDate(dateIso);
    updateCheckins((current) => {
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
    updateCheckins((current) => {
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

  async function shareAsImage() {
    const node = captureRef.current;
    if (!node) return;

    setOpenDate(null);
    setIsSharing(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await document.fonts.ready;
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        backgroundColor: "#f3f6fb",
        cacheBust: true,
        pixelRatio: 2,
        width: node.scrollWidth,
        height: node.scrollHeight,
        style: {
          width: `${node.scrollWidth}px`,
          height: `${node.scrollHeight}px`,
        },
      });
      const link = document.createElement("a");
      link.download = `fitness-calendar-${viewYear}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      window.alert("Could not generate the image. Please try again.");
    } finally {
      setIsSharing(false);
    }
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
      <section className="toolbar" aria-label="Calendar actions">
        <div className="year-switcher" aria-label="Year selector">
          {yearOptions.map((year) => (
            <button key={year} className={viewYear === year ? "selected" : ""} onClick={() => setViewYear(year)}>
              {year}
            </button>
          ))}
        </div>
        <button className="share-button" onClick={shareAsImage} disabled={isSharing}>
          {isSharing ? "Generating..." : "Share"}
        </button>
      </section>

      <section className={`share-capture ${isSharing ? "exporting" : ""}`} ref={captureRef}>
      <section className="hero">
        <div className="hero-card">
          <h1>
            <span>{viewYear}</span>
            <span>Fitness Calendar</span>
          </h1>
        </div>
        <div className="stats-grid">
          <Stat
            label="Workout"
            value={
              <>
                {totalWorkoutDays} days <span>of {elapsedDays} days</span>
              </>
            }
          >
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

      <section className="filters" aria-label="Date filters">
        <button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>
          All Dates
        </button>
        <button className={filter === "checked" ? "selected" : ""} onClick={() => setFilter("checked")}>
          Checked
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
                <span>{months[monthIndex].days.filter((date) => checkins[isoDate(date)]).length} days</span>
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
                          updateCheckins((current) => ({
                            ...current,
                            [dateIso]: {
                              groups: ["default"],
                              checkedAt: new Date().toISOString(),
                            },
                          }));
                        }
                      }}
                      title={`${formatEnglishDate(date)}${entry ? ` · ${displayGroups.map((group) => group.label).join(", ")}` : ""}`}
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
                        aria-label={`${formatEnglishDate(dateObject)} workout check-in`}
                      >
                        <div className="popover-header">
                          <div>
                            <strong>{formatEnglishDate(dateObject)}</strong>
                          </div>
                          <button className="close-popover" onClick={() => setOpenDate(null)} aria-label="Close">
                            ×
                          </button>
                        </div>
                        <div className="muscle-picker compact" aria-label="Workout category selection">
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
                            updateCheckins((current) => {
                              const next = { ...current };
                              delete next[dateIso];
                              return next;
                            });
                            setOpenDate(null);
                          }}
                          disabled={!entry}
                        >
                          Delete
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
      </section>
    </main>
  );
}

function Stat({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {children}
    </div>
  );
}

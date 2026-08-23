"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

const launchYear = 2025;
const actualYear = new Date().getFullYear();
const languageStorageKey = "fitness-calendar-language";
const themeStorageKey = "fitness-calendar-theme";

const muscleGroups = [
  { id: "default", icon: "/icons/default.png", darkIcon: "/icons/default-dark.png", color: "#3b82f6" },
  { id: "chest", icon: "/icons/chest.png", darkIcon: "/icons/chest-dark.png", color: "#ef4444" },
  { id: "arms", icon: "/icons/arms.png", darkIcon: "/icons/arms-dark.png", color: "#f97316" },
  { id: "shoulders", icon: "/icons/shoulders.png", darkIcon: "/icons/shoulders-dark.png", color: "#0891b2" },
  { id: "back", icon: "/icons/back.png", darkIcon: "/icons/back-dark.png", color: "#0f766e" },
  { id: "legs", icon: "/icons/legs.png", darkIcon: "/icons/legs-dark.png", color: "#16a34a" },
  { id: "core", icon: "/icons/core.png", darkIcon: "/icons/core-dark.png", color: "#a855f7" },
  { id: "cardio", icon: "/icons/cardio.png", darkIcon: "/icons/cardio-dark.png", color: "#db2777" },
];

const groupMap = Object.fromEntries(muscleGroups.map((group) => [group.id, group]));

type Language = "en" | "zh";
type Theme = "light" | "dark";
type SyncStatus = "loading" | "online" | "offline";

const copy = {
  en: {
    title: "Fitness Calendar",
    allDates: "All Dates",
    checked: "Checked",
    days: "days",
    ofDays: "of {days} days",
    generating: "Generating...",
    importExport: "Import / Export",
    exportCsv: "Export CSV",
    importCsv: "Import from file",
    share: "Share",
    close: "Close",
    delete: "Delete",
    alert: "Could not generate the image. Please try again.",
    importAlert: "Could not import the CSV file. Please check the format.",
    syncLoading: "Syncing...",
    syncOnline: "Synced",
    syncOffline: "Local only",
    dateFilters: "Date filters",
    yearSelector: "Year selector",
    calendarActions: "Calendar actions",
    categorySelection: "Workout category selection",
    checkinDialog: "{date} workout check-in",
    languageToggle: "中文",
    locale: "en-US",
    joiner: ", ",
    monthLabels: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    weekdayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    groups: {
      default: "Full Body",
      chest: "Chest",
      arms: "Arms",
      shoulders: "Shoulders",
      back: "Back",
      legs: "Legs",
      core: "Core",
      cardio: "Cardio",
    },
  },
  zh: {
    title: "健身日历",
    allDates: "全部日期",
    checked: "已打卡",
    days: "天",
    ofDays: "共 {days} 天",
    generating: "生成中...",
    importExport: "导入 / 导出",
    exportCsv: "导出 CSV",
    importCsv: "从文件导入",
    share: "分享",
    close: "关闭",
    delete: "删除",
    alert: "图片生成失败，请重试。",
    importAlert: "CSV 导入失败，请检查文件格式。",
    syncLoading: "同步中...",
    syncOnline: "已同步",
    syncOffline: "仅本地",
    dateFilters: "日期筛选",
    yearSelector: "年份选择",
    calendarActions: "日历操作",
    categorySelection: "训练项目选择",
    checkinDialog: "{date} 健身打卡",
    languageToggle: "EN",
    locale: "zh-CN",
    joiner: "、",
    monthLabels: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    weekdayLabels: ["一", "二", "三", "四", "五", "六", "日"],
    groups: {
      default: "综合",
      chest: "胸部",
      arms: "手臂",
      shoulders: "肩部",
      back: "背部",
      legs: "腿部",
      core: "核心",
      cardio: "有氧",
    },
  },
} as const;

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

function loadCheckinsByYear(years: number[]) {
  return Object.fromEntries(years.map((year) => [year, loadCheckins(year)])) as Record<number, Checkins>;
}

function persistCheckinsByYear(checkinsByYear: Record<number, Checkins>) {
  if (typeof window === "undefined") return;
  Object.entries(checkinsByYear).forEach(([year, checkins]) => {
    localStorage.setItem(getStorageKey(Number(year)), JSON.stringify(checkins));
  });
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date, language: Language) {
  return date.toLocaleDateString(copy[language].locale, {
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

function normalizeCheckinsByYear(input: Record<string | number, Checkins>, latestAllowedYear: number, todayIso: string) {
  return Object.entries(input).reduce<Record<number, Checkins>>((result, [year, checkins]) => {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < launchYear || parsedYear > latestAllowedYear) return result;

    Object.entries(checkins ?? {}).forEach(([date, entry]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) !== parsedYear) return;
      if (parsedYear === actualYear && date > todayIso) return;
      const groups = normalizeGroups(entry);
      result[parsedYear] = {
        ...(result[parsedYear] ?? {}),
        [date]: {
          groups,
          checkedAt: entry.checkedAt || new Date().toISOString(),
        },
      };
    });

    return result;
  }, {});
}

function mergeCheckinsByYear(local: Record<number, Checkins>, remote: Record<number, Checkins>) {
  const years = new Set([...Object.keys(local), ...Object.keys(remote)].map(Number));
  const merged: Record<number, Checkins> = {};

  years.forEach((year) => {
    const dates = new Set([...Object.keys(local[year] ?? {}), ...Object.keys(remote[year] ?? {})]);
    dates.forEach((date) => {
      const localEntry = local[year]?.[date];
      const remoteEntry = remote[year]?.[date];
      const entry =
        localEntry && remoteEntry
          ? Date.parse(remoteEntry.checkedAt) > Date.parse(localEntry.checkedAt)
            ? remoteEntry
            : localEntry
          : localEntry ?? remoteEntry;
      if (!entry) return;
      merged[year] = {
        ...(merged[year] ?? {}),
        [date]: entry,
      };
    });
  });

  return merged;
}

function MuscleIcon({ src, label }: { src: string; label: string }) {
  return <img className="muscle-icon" src={src} alt="" aria-hidden="true" draggable={false} data-label={label} />;
}

function getMuscleIcon(group: (typeof muscleGroups)[number], theme: Theme) {
  return theme === "dark" ? group.darkIcon : group.icon;
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}

function parseCsv(text: string, latestAllowedYear: number, todayIso: string) {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) return {};

  const header = parseCsvLine(rows[0]).map((column) => column.toLowerCase());
  const dateIndex = header.indexOf("date");
  const groupsIndex = header.indexOf("groups");
  const checkedAtIndex = header.indexOf("checkedat");
  if (dateIndex === -1 || groupsIndex === -1) throw new Error("Invalid CSV header");

  const labelToGroup = new Map<string, string>();
  muscleGroups.forEach((group) => {
    labelToGroup.set(group.id.toLowerCase(), group.id);
    labelToGroup.set(copy.en.groups[group.id as keyof typeof copy.en.groups].toLowerCase(), group.id);
    labelToGroup.set(copy.zh.groups[group.id as keyof typeof copy.zh.groups], group.id);
  });

  return rows.slice(1).reduce<Record<number, Checkins>>((result, row) => {
    const cells = parseCsvLine(row);
    const date = cells[dateIndex];
    const parsedYear = Number(date?.slice(0, 4));
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedYear)) return result;
    if (parsedYear < launchYear || parsedYear > latestAllowedYear) return result;
    if (parsedYear === actualYear && date > todayIso) return result;

    const parsedGroups = (cells[groupsIndex] || "default")
      .split("|")
      .map((group) => labelToGroup.get(group.trim().toLowerCase()) ?? labelToGroup.get(group.trim()))
      .filter((group): group is string => Boolean(group))
      .filter((group, index, groups) => groups.indexOf(group) === index)
      .slice(0, 3);

    if (!parsedGroups.length) return result;

    result[parsedYear] = {
      ...(result[parsedYear] ?? {}),
      [date]: {
      groups: parsedGroups,
      checkedAt: checkedAtIndex === -1 ? new Date().toISOString() : cells[checkedAtIndex] || new Date().toISOString(),
      },
    };
    return result;
  }, {});
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
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const captureRef = useRef<HTMLElement | null>(null);
  const yearMenuRef = useRef<HTMLDivElement | null>(null);
  const dataMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cloudSyncReadyRef = useRef(false);
  const latestCheckinsByYearRef = useRef<Record<number, Checkins>>({});
  const yearOptions = useMemo(() => getYearOptions(actualYear), []);
  const checkins = checkinsByYear[viewYear] ?? {};
  const text = copy[language];

  useEffect(() => {
    const localCheckinsByYear = loadCheckinsByYear(yearOptions);
    latestCheckinsByYearRef.current = localCheckinsByYear;
    setCheckinsByYear(localCheckinsByYear);
    const storedLanguage = localStorage.getItem(languageStorageKey);
    const storedTheme = localStorage.getItem(themeStorageKey);
    if (storedLanguage === "en" || storedLanguage === "zh") setLanguage(storedLanguage);
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
    void loadCloudCheckins(localCheckinsByYear);
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

  useEffect(() => {
    if (!isYearMenuOpen && !isDataMenuOpen) return;

    function closeMenuOnOutsideClick(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (yearMenuRef.current?.contains(target) || dataMenuRef.current?.contains(target)) return;
      setIsYearMenuOpen(false);
      setIsDataMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
  }, [isYearMenuOpen, isDataMenuOpen]);

  const days = useMemo(() => getDaysInYear(viewYear), [viewYear]);
  const months = useMemo(
    () =>
      text.monthLabels.map((label, monthIndex) => ({
        label,
        days: days.filter((date) => date.getMonth() === monthIndex),
      })),
    [days, text.monthLabels],
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

  async function loadCloudCheckins(localCheckinsByYear: Record<number, Checkins>) {
    try {
      setSyncStatus("loading");
      const response = await fetch("/api/checkins", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        cloudSyncReadyRef.current = false;
        setSyncStatus("offline");
        return;
      }
      const payload = (await response.json()) as { checkinsByYear?: Record<string, Checkins> };
      const remoteCheckinsByYear = normalizeCheckinsByYear(payload.checkinsByYear ?? {}, actualYear, todayIso);
      const mergedCheckinsByYear = mergeCheckinsByYear(localCheckinsByYear, remoteCheckinsByYear);
      latestCheckinsByYearRef.current = mergedCheckinsByYear;
      persistCheckinsByYear(mergedCheckinsByYear);
      setCheckinsByYear(mergedCheckinsByYear);
      cloudSyncReadyRef.current = true;
      setSyncStatus("online");
      void saveCloudCheckins(mergedCheckinsByYear);
    } catch {
      cloudSyncReadyRef.current = false;
      setSyncStatus("offline");
    }
  }

  async function deleteCloudCheckins(dates: string[]) {
    if (!cloudSyncReadyRef.current || !dates.length) return;
    try {
      const response = await fetch("/api/checkins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dates }),
      });
      if (response.status === 401) {
        cloudSyncReadyRef.current = false;
        setSyncStatus("offline");
      } else if (response.ok) {
        setSyncStatus("online");
      }
    } catch {
      setSyncStatus("offline");
      // Keep local data as the source of truth until the next successful cloud load.
    }
  }

  async function saveCloudCheckins(nextCheckinsByYear: Record<number, Checkins>, deletedDates: string[] = []) {
    if (!cloudSyncReadyRef.current) return;
    try {
      setSyncStatus("loading");
      const response = await fetch("/api/checkins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ checkinsByYear: nextCheckinsByYear }),
      });
      if (response.status === 401) {
        cloudSyncReadyRef.current = false;
        setSyncStatus("offline");
      } else if (response.ok) {
        setSyncStatus("online");
      }
      if (response.ok && deletedDates.length) {
        await deleteCloudCheckins(deletedDates);
      }
    } catch {
      setSyncStatus("offline");
      // Keep local data as the source of truth until the next successful cloud load.
    }
  }

  function updateCheckins(updater: (current: Checkins) => Checkins) {
    setCheckinsByYear((current) => {
      const currentYearCheckins = current[viewYear] ?? loadCheckins(viewYear);
      const nextYearCheckins = updater(currentYearCheckins);
      const deletedDates = Object.keys(currentYearCheckins).filter((date) => !nextYearCheckins[date]);
      const nextCheckinsByYear = {
        ...current,
        [viewYear]: nextYearCheckins,
      };
      localStorage.setItem(getStorageKey(viewYear), JSON.stringify(nextYearCheckins));
      latestCheckinsByYearRef.current = nextCheckinsByYear;
      void saveCloudCheckins(nextCheckinsByYear, deletedDates);
      return nextCheckinsByYear;
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

  function exportCsv() {
    const years = getYearOptions(actualYear);
    const rows = [
      ["date", "groups"],
      ...years.flatMap((year) =>
        Object.entries(checkinsByYear[year] ?? loadCheckins(year))
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([date, entry]) => [date, normalizeGroups(entry).join("|")]),
      ),
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.download = "fitness-calendar-all-years.csv";
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    setIsDataMenuOpen(false);
  }

  async function importCsv(file?: File) {
    if (!file) return;
    try {
      const importedCheckinsByYear = parseCsv(file ? await file.text() : "", actualYear, todayIso);
      setCheckinsByYear((current) => {
        const next = { ...current };
        Object.entries(importedCheckinsByYear).forEach(([year, importedCheckins]) => {
          const parsedYear = Number(year);
          const nextYearCheckins = {
            ...(next[parsedYear] ?? loadCheckins(parsedYear)),
            ...importedCheckins,
          };
          localStorage.setItem(getStorageKey(parsedYear), JSON.stringify(nextYearCheckins));
          next[parsedYear] = nextYearCheckins;
        });
        latestCheckinsByYearRef.current = next;
        void saveCloudCheckins(next);
        return next;
      });
      setOpenDate(null);
      setIsDataMenuOpen(false);
    } catch {
      window.alert(text.importAlert);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
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
      window.alert(text.alert);
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
    <main className={`app-shell theme-${theme}`}>
      <section className="toolbar" aria-label={text.calendarActions}>
        <div className="year-switcher" ref={yearMenuRef}>
          <button className="year-trigger" onClick={() => setIsYearMenuOpen((open) => !open)} aria-expanded={isYearMenuOpen} aria-label={text.yearSelector}>
            <span>{viewYear}</span>
            <span className="year-trigger-arrow" aria-hidden="true" />
          </button>
          {isYearMenuOpen && (
            <div className="year-menu-panel">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  className={viewYear === year ? "active" : ""}
                  onClick={() => {
                    setViewYear(year);
                    setIsYearMenuOpen(false);
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="toolbar-actions">
          <div className="data-menu" ref={dataMenuRef}>
            <button className="utility-button" onClick={() => setIsDataMenuOpen((open) => !open)} aria-expanded={isDataMenuOpen}>
              {text.importExport}
            </button>
            {isDataMenuOpen && (
              <div className="data-menu-panel">
                <button onClick={exportCsv}>{text.exportCsv}</button>
                <button onClick={() => fileInputRef.current?.click()}>{text.importCsv}</button>
              </div>
            )}
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void importCsv(event.target.files?.[0])}
            />
          </div>
          <button
            className="utility-button"
            onClick={() => {
              const nextLanguage = language === "en" ? "zh" : "en";
              setLanguage(nextLanguage);
              localStorage.setItem(languageStorageKey, nextLanguage);
            }}
          >
            {text.languageToggle}
          </button>
          <button
            className="theme-toggle"
            onClick={() => {
              const nextTheme = theme === "light" ? "dark" : "light";
              setTheme(nextTheme);
              localStorage.setItem(themeStorageKey, nextTheme);
            }}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            <span aria-hidden="true">{theme === "light" ? "🌙" : "☀️"}</span>
          </button>
          <span className={`sync-pill sync-${syncStatus}`}>
            {text[syncStatus === "loading" ? "syncLoading" : syncStatus === "online" ? "syncOnline" : "syncOffline"]}
          </span>
        </div>
      </section>

      <section className={`share-capture ${isSharing ? "exporting" : ""}`} ref={captureRef}>
        <section className="hero">
          <div className="hero-card">
            <h1>
              <span>{viewYear}</span>
              <span>{text.title}</span>
            </h1>
            <button className="share-button hero-share-button" onClick={shareAsImage} disabled={isSharing}>
              {isSharing ? text.generating : text.share}
            </button>
          </div>
          <div className="stats-grid">
            <Stat
              value={
                <>
                  {totalWorkoutDays} {text.days} <span>{text.ofDays.replace("{days}", String(elapsedDays))}</span>
                </>
              }
            >
              <div className="stat-breakdown">
                {muscleGroups.map((group) => (
                  <span className="stat-item" key={group.id}>
                    <MuscleIcon src={getMuscleIcon(group, theme)} label={text.groups[group.id as keyof typeof text.groups]} />
                    <span className="stat-name">{text.groups[group.id as keyof typeof text.groups]}</span>
                    <span className="stat-count">{workoutCounts[group.id] ?? 0}</span>
                  </span>
                ))}
              </div>
            </Stat>
          </div>
        </section>

      <section className="filters" aria-label={text.dateFilters}>
        <button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>
          {text.allDates}
        </button>
        <button className={filter === "checked" ? "selected" : ""} onClick={() => setFilter("checked")}>
          {text.checked}
        </button>
        {muscleGroups.slice(1).map((group) => (
          <button key={group.id} className={filter === group.id ? "selected" : ""} onClick={() => setFilter(group.id)}>
            {text.groups[group.id as keyof typeof text.groups]}
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
                <span>
                  {months[monthIndex].days.filter((date) => checkins[isoDate(date)]).length} {text.days}
                </span>
              </header>
              {filter === "all" && (
                <div className="weekdays">
                  {text.weekdayLabels.map((day) => (
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
                      title={`${formatDate(date, language)}${
                        entry ? ` · ${displayGroups.map((group) => text.groups[group.id as keyof typeof text.groups]).join(text.joiner)}` : ""
                      }`}
                      disabled={isFuture}
                    >
                      <span className="day-number">{date.getDate()}</span>
                      {entry && (
                        <span className="day-icons" aria-hidden="true">
                          {displayGroups.map((group) => (
                            <span className="day-icon" key={group.id} style={{ "--icon-color": group.color } as CSSProperties}>
                              <MuscleIcon src={getMuscleIcon(group, theme)} label={text.groups[group.id as keyof typeof text.groups]} />
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                    {isPopoverOpen && (
                      <div
                        className={`checkin-popover ${popoverSide}`}
                        role="dialog"
                        aria-label={text.checkinDialog.replace("{date}", formatDate(dateObject, language))}
                      >
                        <div className="popover-header">
                          <div>
                            <strong>{formatDate(dateObject, language)}</strong>
                          </div>
                          <button className="close-popover" onClick={() => setOpenDate(null)} aria-label={text.close}>
                            ×
                          </button>
                        </div>
                        <div className="muscle-picker compact" aria-label={text.categorySelection}>
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
                                <MuscleIcon src={getMuscleIcon(muscleGroup, theme)} label={text.groups[muscleGroup.id as keyof typeof text.groups]} />
                                {text.groups[muscleGroup.id as keyof typeof text.groups]}
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
                          {text.delete}
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

function Stat({ label, value, children }: { label?: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="stat-card">
      {label && <span>{label}</span>}
      <strong>{value}</strong>
      {children}
    </div>
  );
}

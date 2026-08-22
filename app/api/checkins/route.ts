import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const launchYear = 2025;
const validGroups = new Set(["default", "chest", "arms", "shoulders", "back", "legs", "core", "cardio"]);

type Checkin = {
  group?: string;
  groups?: string[];
  checkedAt?: string;
};

type Checkins = Record<string, Checkin>;
type CheckinsByYear = Record<string, Checkins>;

type WorkoutCheckinRow = {
  date: string;
  groups: string;
  checked_at: string;
};

function getDb() {
  if (!env.DB) {
    throw new Error("Database is unavailable.");
  }
  return env.DB;
}

async function requireUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return user;
}

async function ensureSchema() {
  const db = getDb();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS workout_checkins (
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        groups TEXT NOT NULL,
        checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, date)
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_workout_checkins_user_date
      ON workout_checkins (user_id, date)
    `),
  ]);
}

function normalizeGroups(entry?: Checkin) {
  if (!entry) return [];
  const groups = Array.isArray(entry.groups) ? entry.groups : entry.group ? [entry.group] : [];
  const uniqueGroups = groups
    .filter((group, index) => validGroups.has(group) && groups.indexOf(group) === index)
    .slice(0, 3);
  return uniqueGroups.length ? uniqueGroups : ["default"];
}

function normalizePayload(payload: unknown) {
  const input =
    payload && typeof payload === "object" && "checkinsByYear" in payload
      ? (payload as { checkinsByYear?: unknown }).checkinsByYear
      : null;
  if (!input || typeof input !== "object") return [];

  const rows: Array<{ date: string; groups: string; checkedAt: string }> = [];
  Object.entries(input as CheckinsByYear).forEach(([year, checkins]) => {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < launchYear || !checkins || typeof checkins !== "object") return;

    Object.entries(checkins).forEach(([date, entry]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) !== parsedYear) return;
      const groups = normalizeGroups(entry);
      if (!groups.length) return;
      rows.push({
        date,
        groups: groups.join("|"),
        checkedAt: typeof entry.checkedAt === "string" && entry.checkedAt ? entry.checkedAt : new Date().toISOString(),
      });
    });
  });

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function rowsToCheckinsByYear(rows: WorkoutCheckinRow[]) {
  return rows.reduce<CheckinsByYear>((result, row) => {
    const year = row.date.slice(0, 4);
    result[year] = {
      ...(result[year] ?? {}),
      [row.date]: {
        groups: row.groups.split("|").filter((group) => validGroups.has(group)),
        checkedAt: row.checked_at,
      },
    };
    return result;
  }, {});
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Sign in with ChatGPT to sync data." }, { status: 401 });
  }

  await ensureSchema();
  const { results } = await getDb()
    .prepare("SELECT date, groups, checked_at FROM workout_checkins WHERE user_id = ? ORDER BY date")
    .bind(user.userId)
    .all<WorkoutCheckinRow>();

  return Response.json({
    user: {
      email: user.email,
      displayName: user.displayName,
    },
    checkinsByYear: rowsToCheckinsByYear(results ?? []),
  });
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Sign in with ChatGPT to sync data." }, { status: 401 });
  }

  const rows = normalizePayload(await request.json());
  await ensureSchema();

  const db = getDb();
  const existingDates = new Set(
    (
      (
        await db
          .prepare("SELECT date FROM workout_checkins WHERE user_id = ?")
          .bind(user.userId)
          .all<{ date: string }>()
      ).results ?? []
    ).map((row) => row.date),
  );
  const incomingDates = new Set(rows.map((row) => row.date));
  const statements = [
    ...[...existingDates]
      .filter((date) => !incomingDates.has(date))
      .map((date) => db.prepare("DELETE FROM workout_checkins WHERE user_id = ? AND date = ?").bind(user.userId, date)),
    ...rows.map((row) =>
      db
        .prepare(`
          INSERT INTO workout_checkins (user_id, date, groups, checked_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, date) DO UPDATE SET
            groups = excluded.groups,
            checked_at = excluded.checked_at,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(user.userId, row.date, row.groups, row.checkedAt),
    ),
  ];

  if (statements.length) {
    await db.batch(statements);
  }

  return Response.json({ ok: true, checkinsByYear: rowsToCheckinsByYear(rows.map((row) => ({ date: row.date, groups: row.groups, checked_at: row.checkedAt }))) });
}

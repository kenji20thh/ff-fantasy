"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { asArray, errorMessage } from "@/lib/types";
import { MVP_OVERRIDES } from "@/lib/mvp-overrides";

import type { PlayerRanking, TournamentDay } from "@/lib/types";

type Phase = "league" | "rush" | "final";

const PHASES: { id: Phase; label: string }[] = [
  { id: "league", label: "League Phase" },
  { id: "rush", label: "Rush Point" },
  { id: "final", label: "Grand Final" },
];

function parseDayName(name: string): {
  phase: Phase | "unknown";
  week?: number;
  day?: number;
} {
  const league = name.match(/^week\s*(\d+)\s*day\s*(\d+)/i);
  if (league) {
    return { phase: "league", week: Number(league[1]), day: Number(league[2]) };
  }

  const rush = name.match(/^rush\s*day\s*(\d+)/i);
  if (rush) {
    return { phase: "rush", day: Number(rush[1]) };
  }

  const final = name.match(/^(grand\s*)?final\s*day\s*(\d+)/i);
  if (final) {
    return { phase: "final", day: Number(final[1]) };
  }

  return { phase: "unknown" };
}

function dayNumber(d: TournamentDay) {
  return parseDayName(d.name).day ?? 0;
}

function PlayerRowSkeleton() {
  return (
    <div className="grid grid-cols-[50px_1fr_auto] items-center gap-4 border-b border-border px-4 py-5 last:border-b-0 md:grid-cols-[60px_1fr_180px_120px]">
      <div className="h-4 w-5 animate-pulse rounded bg-border/60" />

      <div className="flex min-w-0 items-center gap-4">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-border/60" />
        <div className="h-4 w-32 animate-pulse rounded bg-border/60" />
      </div>

      <div className="hidden h-4 w-24 animate-pulse rounded bg-border/60 md:block" />

      <div className="ml-auto h-5 w-10 animate-pulse rounded bg-border/60" />
    </div>
  );
}

function TeamLogo({
  teamId,
  teamName,
  size = "h-10 w-10",
}: {
  teamId: number;
  teamName: string;
  size?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={`${size} shrink-0 rounded-full border border-border`} />;
  }

  return (
    <img
      src={`/logos/${teamId}.png`}
      alt={teamName}
      onError={() => setFailed(true)}
      className={`${size} shrink-0 rounded-full border border-border bg-background object-contain p-1`}
    />
  );
}

function PlayerPhoto({
  playerId,
  teamId,
  teamName,
  size = "h-28 w-28",
}: {
  playerId: number;
  teamId: number;
  teamName: string;
  size?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <TeamLogo teamId={teamId} teamName={teamName} size={size} />;
  }

  return (
    <img
      src={`/players/${playerId}.png`}
      alt=""
      onError={() => setFailed(true)}
      className={`${size} rounded-full border border-border object-cover`}
    />
  );
}

function MvpCard({
  player,
  label,
}: {
  player: PlayerRanking | null;
  label: string;
}) {
  if (!player) return null;

  return (
    <div className="border border-border bg-card p-6">
      <p className="eyebrow">MVP</p>

      <div className="mt-4 flex flex-col items-center text-center">
        <PlayerPhoto
          playerId={player.player_id}
          teamId={player.team_id}
          teamName={player.team_name}
        />

        <Link
          href={`/players/${player.player_id}`}
          className="mt-4 font-mono text-lg font-bold uppercase hover:text-primary"
        >
          {player.nickname}
        </Link>

        <p className="text-sm text-muted-foreground">{player.team_name}</p>

        <p className="mt-3 font-mono text-3xl font-bold">{player.kills}</p>
        <p className="text-xs text-muted-foreground">kills</p>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PlayersContent() {
  const searchParams = useSearchParams();

  const [days, setDays] = useState<TournamentDay[]>([]);
  const [players, setPlayers] = useState<PlayerRanking[]>([]);

  const [phase, setPhase] = useState<Phase>(
    (searchParams.get("phase") as Phase) || "league",
  );
  const [week, setWeek] = useState<number | "all" | null>(
    searchParams.get("week")
      ? searchParams.get("week") === "all"
        ? "all"
        : Number(searchParams.get("week"))
      : null,
  );
  const [dayId, setDayId] = useState<string>(searchParams.get("day") ?? "all");
  const [sort, setSort] = useState<"points" | "kills">("kills");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load all tournament days once.
  useEffect(() => {
    api
      .days()
      .then((data) => setDays(asArray<TournamentDay>(data)))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Group days by phase, and by week within League Phase.
  const grouped = useMemo(() => {
    const league = new Map<number, TournamentDay[]>();
    const rush: TournamentDay[] = [];
    const final: TournamentDay[] = [];

    for (const d of days) {
      const parsed = parseDayName(d.name);

      if (parsed.phase === "league" && parsed.week) {
        const list = league.get(parsed.week) ?? [];
        list.push(d);
        league.set(parsed.week, list);
      } else if (parsed.phase === "rush") {
        rush.push(d);
      } else if (parsed.phase === "final") {
        final.push(d);
      }
    }

    const byDayNumber = (list: TournamentDay[]) =>
      [...list].sort((a, b) => dayNumber(a) - dayNumber(b));

    const leagueSorted = new Map(
      [...league.entries()]
        .sort(([a], [b]) => a - b)
        .map(([w, list]) => [w, byDayNumber(list)] as const),
    );

    return { league: leagueSorted, rush: byDayNumber(rush), final: byDayNumber(final) };
  }, [days]);

  // Default to the first available week once League Phase data loads.
  useEffect(() => {
    if (phase === "league" && week === null && grouped.league.size > 0) {
      setWeek([...grouped.league.keys()][0]);
    }
  }, [phase, week, grouped]);

  // Days in the currently selected scope (a week, or a whole non-league phase).
  const currentDays = useMemo(() => {
    if (phase === "league") {
      if (week === "all") {
        return [...grouped.league.values()].flat();
      }

      return week !== null ? grouped.league.get(week) ?? [] : [];
    }

    return phase === "rush" ? grouped.rush : grouped.final;
  }, [phase, week, grouped]);

  // Keep the URL shareable.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("phase", phase);

    if (phase === "league" && week !== null) {
      url.searchParams.set("week", String(week));
    } else {
      url.searchParams.delete("week");
    }

    if (dayId !== "all") {
      url.searchParams.set("day", dayId);
    } else {
      url.searchParams.delete("day");
    }

    window.history.replaceState({}, "", url);
  }, [phase, week, dayId]);

  // Fetch rankings for the current selection. "All Days" within a scope of
  // more than one day is aggregated client-side, since /api/player-rankings
  // only accepts a single day_id.
  useEffect(() => {
    if (currentDays.length === 0) {
      setPlayers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    async function run() {
      try {
        if (dayId !== "all") {
          const data = await api.playerRankings(Number(dayId), sort);
          if (!cancelled) setPlayers(asArray<PlayerRanking>(data));
          return;
        }

        if (currentDays.length === 1) {
          const data = await api.playerRankings(currentDays[0].id, sort);
          if (!cancelled) setPlayers(asArray<PlayerRanking>(data));
          return;
        }

        const results = await Promise.all(
          currentDays.map((d) =>
            api
              .playerRankings(d.id, sort)
              .then((data) => asArray<PlayerRanking>(data)),
          ),
        );

        const merged = new Map<number, PlayerRanking>();

        for (const list of results) {
          for (const p of list) {
            const existing = merged.get(p.player_id);

            if (existing) {
              existing.points += p.points;
              existing.kills += p.kills;
            } else {
              merged.set(p.player_id, { ...p });
            }
          }
        }

        const combined = [...merged.values()].sort((a, b) =>
          sort === "points" ? b.points - a.points : b.kills - a.kills,
        );

        if (!cancelled) setPlayers(combined);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [currentDays, dayId, sort]);

  function handlePhaseChange(next: Phase) {
    setPhase(next);
    setDayId("all");
    setWeek(next === "league" ? [...grouped.league.keys()][0] ?? null : null);
  }

  function handleWeekChange(w: number | "all") {
    setWeek(w);
    setDayId("all");
  }

  const weeks = [...grouped.league.keys()];

  const scopeKey = useMemo(() => {
    if (dayId !== "all") return `day:${dayId}`;
    if (phase === "league" && week === "all") return "phase:league";
    if (phase === "league" && week !== null) return `week:league:${week}`;
    return `phase:${phase}`;
  }, [phase, week, dayId]);

  const mvp = useMemo(() => {
    const overrideId = MVP_OVERRIDES[scopeKey];

    if (overrideId) {
      const picked = players.find((p) => p.player_id === overrideId);
      if (picked) return picked;
    }

    if (players.length === 0) return null;
    return [...players].sort((a, b) => b.points - a.points)[0];
  }, [players, scopeKey]);

  const scopeLabel = useMemo(() => {
    if (dayId !== "all") {
      const d = currentDays.find((cd) => String(cd.id) === dayId);
      return d ? d.name : "Selected day";
    }

    if (phase === "league" && week === "all") return "League Phase — Overall";
    if (phase === "league" && week !== null) return `Week ${week} — All Days`;

    const label = PHASES.find((p) => p.id === phase)?.label ?? "";
    return `${label} — All Days`;
  }, [phase, week, dayId, currentDays]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <Link href="/" className="eyebrow">
        ← FF / FANTASY
      </Link>

      <p className="eyebrow mt-10">Player statistics</p>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="section-title">Player rankings.</h1>

          <p className="mt-3 text-muted-foreground">
            Compare player performance across the tournament.
          </p>
        </div>

        <Link
          href="/schedule"
          className="text-sm font-semibold hover:text-primary"
        >
          Tournament Schedule →
        </Link>
      </div>

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="order-last min-w-0 flex-1 lg:order-first">
          {/* Phase */}
          <div className="flex flex-wrap gap-2">
            {PHASES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePhaseChange(p.id)}
                className={`px-5 py-3 text-sm font-semibold border border-border transition ${
                  phase === p.id
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Week (League Phase only) */}
          {phase === "league" && weeks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleWeekChange("all")}
                className={`px-4 py-2 text-xs font-semibold border border-border transition ${
                  week === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Overall
              </button>

              {weeks.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => handleWeekChange(w)}
                  className={`px-4 py-2 text-xs font-semibold border border-border transition ${
                    week === w
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Week {w}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {/* Day, within the current scope */}
            <div className="flex flex-wrap gap-2 pl-4 border-l border-border">
              <button
                type="button"
                onClick={() => setDayId("all")}
                className={`px-4 py-2 text-xs font-semibold transition ${
                  dayId === "all"
                    ? "text-foreground underline underline-offset-4 decoration-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Days
              </button>

              {currentDays.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDayId(String(d.id))}
                  className={`px-4 py-2 text-xs font-semibold transition ${
                    dayId === String(d.id)
                      ? "text-foreground underline underline-offset-4 decoration-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Day {dayNumber(d)}
                </button>
              ))}
            </div>

            <div className="flex border border-border">
              <button
                type="button"
                onClick={() => setSort("points")}
                className={`px-5 py-3 text-sm font-semibold transition ${
                  sort === "points"
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                Points
              </button>

              <button
                type="button"
                onClick={() => setSort("kills")}
                className={`px-5 py-3 text-sm font-semibold transition ${
                  sort === "kills"
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                Kills
              </button>
            </div>
          </div>

          {error && <p className="mt-8 text-muted-foreground">{error}</p>}

          <div className="mt-10 border-y border-border">
            <div className="grid grid-cols-[50px_1fr_auto] gap-4 border-b border-border px-4 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground md:grid-cols-[60px_1fr_180px_120px]">
              <span>#</span>
              <span>Player</span>
              <span className="hidden md:block">Team</span>
              <span className="text-right">
                {sort === "points" ? "Points" : "Kills"}
              </span>
            </div>

            {loading ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <PlayerRowSkeleton key={i} />
                ))}
              </>
            ) : currentDays.length === 0 ? (
              <div className="px-4 py-10 text-center text-muted-foreground">
                No days found for this phase yet.
              </div>
            ) : players.length === 0 ? (
              <div className="px-4 py-10 text-center text-muted-foreground">
                No player statistics available.
              </div>
            ) : (
              players.map((player, index) => (
                <div
                  key={player.player_id}
                  className="grid grid-cols-[50px_1fr_auto] items-center gap-4 border-b border-border px-4 py-5 last:border-b-0 md:grid-cols-[60px_1fr_180px_120px]"
                >
                  <span className="font-mono text-sm text-muted-foreground">
                    {index + 1}
                  </span>

                  <div className="flex min-w-0 items-center gap-4">
                    <TeamLogo teamId={player.team_id} teamName={player.team_name} />

                    <div className="min-w-0">
                      <Link
                        href={`/players/${player.player_id}`}
                        className="truncate font-semibold hover:text-primary"
                      >
                        {player.nickname}
                      </Link>

                      <p className="truncate text-sm text-muted-foreground md:hidden">
                        {player.team_name}
                      </p>
                    </div>
                  </div>

                  <span className="hidden truncate text-sm text-muted-foreground md:block">
                    {player.team_name}
                  </span>

                  <span className="text-right font-mono text-lg font-bold">
                    {sort === "points" ? player.points : player.kills}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="order-first lg:order-last lg:w-72 lg:shrink-0 lg:sticky lg:top-10">
          <MvpCard player={mvp} label={scopeLabel} />
        </aside>
      </div>
    </main>
  );
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PlayersContent />
    </Suspense>
  );
}
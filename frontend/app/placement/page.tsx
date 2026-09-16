"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import { asArray, errorMessage } from "@/lib/types";

import type { PlacementTeam, TournamentDay } from "@/lib/types";

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
    return {
      phase: "league",
      week: Number(league[1]),
      day: Number(league[2]),
    };
  }

  const rush = name.match(/^.*rush.*$/i);

  if (rush) {
    return {
      phase: "rush",
    };
  }

  const final = name.match(/^grand\s*final/i);

  if (final) {
    return {
      phase: "final",
    };
  }

  return {
    phase: "unknown",
  };
}

function dayNumber(day: TournamentDay) {
  const parsed = parseDayName(day.name);

  if (parsed.day) {
    return parsed.day;
  }

  const match = day.name.match(/day\s*(\d+)/i);

  return match ? Number(match[1]) : 0;
}

function PlacementRowSkeleton() {
  return (
    <div className="grid grid-cols-[50px_1fr_auto] items-center gap-4 border-b border-border px-4 py-5 last:border-b-0 md:grid-cols-[60px_1fr_120px_100px_120px_100px_100px]">
      <div className="h-4 w-5 animate-pulse rounded bg-border/60" />

      <div className="flex min-w-0 items-center gap-4">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-border/60" />
        <div className="h-4 w-32 animate-pulse rounded bg-border/60" />
      </div>

      <div className="hidden h-4 w-16 animate-pulse rounded bg-border/60 md:block" />
      <div className="hidden h-4 w-12 animate-pulse rounded bg-border/60 md:block" />
      <div className="hidden h-4 w-16 animate-pulse rounded bg-border/60 md:block" />
      <div className="hidden h-4 w-12 animate-pulse rounded bg-border/60 md:block" />
      <div className="ml-auto h-5 w-10 animate-pulse rounded bg-border/60" />
    </div>
  );
}

function TeamLogo({
  teamId,
  teamName,
}: {
  teamId: number;
  teamName: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="h-10 w-10 shrink-0 rounded-full border border-border" />
    );
  }

  return (
    <img
      src={`/logos/${teamId}.png`}
      alt={teamName}
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-full border border-border bg-background object-contain p-1"
    />
  );
}

function mergePlacementResults(
  results: PlacementTeam[][],
): PlacementTeam[] {
  const merged = new Map<number, PlacementTeam>();

  for (const list of results) {
    for (const team of list) {
      const existing = merged.get(team.team_id);

      if (existing) {
        existing.points += team.points;
        existing.kills += team.kills;
        existing.placement_points += team.placement_points;
        existing.booyahs += team.booyahs;
        existing.rooms_played += team.rooms_played;
      } else {
        merged.set(team.team_id, { ...team });
      }
    }
  }

  return [...merged.values()].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.kills !== a.kills) {
      return b.kills - a.kills;
    }

    return a.team_name.localeCompare(b.team_name);
  });
}

function PlacementContent() {
  const searchParams = useSearchParams();

  const [days, setDays] = useState<TournamentDay[]>([]);
  const [placement, setPlacement] = useState<PlacementTeam[]>([]);

  const [phase, setPhase] = useState<Phase>(
    (searchParams.get("phase") as Phase) || "league",
  );

  const [week, setWeek] = useState<number | "all" | null>(() => {
    const value = searchParams.get("week");

    if (!value) {
      return null;
    }

    return value === "all" ? "all" : Number(value);
  });

  const [dayId, setDayId] = useState<string>(
    searchParams.get("day") ?? "all",
  );

  const [loading, setLoading] = useState(true);
  const [daysLoading, setDaysLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * Load tournament days once.
   */
  useEffect(() => {
    api
      .days()
      .then((data) => {
        setDays(asArray<TournamentDay>(data));
      })
      .catch((err) => {
        setError(errorMessage(err));
      })
      .finally(() => {
        setDaysLoading(false);
      });
  }, []);

  /*
   * Group tournament days.
   */
  const grouped = useMemo(() => {
    const league = new Map<number, TournamentDay[]>();
    const rush: TournamentDay[] = [];
    const final: TournamentDay[] = [];

    for (const day of days) {
      const parsed = parseDayName(day.name);

      if (parsed.phase === "league" && parsed.week) {
        const list = league.get(parsed.week) ?? [];

        list.push(day);
        league.set(parsed.week, list);
      } else if (parsed.phase === "rush") {
        rush.push(day);
      } else if (parsed.phase === "final") {
        final.push(day);
      }
    }

    const sortDays = (list: TournamentDay[]) =>
      [...list].sort((a, b) => dayNumber(a) - dayNumber(b));

    const leagueSorted = new Map(
      [...league.entries()]
        .sort(([a], [b]) => a - b)
        .map(([weekNumber, list]) => [
          weekNumber,
          sortDays(list),
        ]),
    );

    return {
      league: leagueSorted,
      rush: sortDays(rush),
      final: sortDays(final),
    };
  }, [days]);

  const weeks = [...grouped.league.keys()];

  /*
   * Default League Phase to Overall.
   */
  useEffect(() => {
    if (
      !daysLoading &&
      phase === "league" &&
      week === null &&
      weeks.length > 0
    ) {
      setWeek("all");
    }
  }, [daysLoading, phase, week, weeks]);

  /*
   * Current days according to selected phase/week.
   */
  const currentDays = useMemo(() => {
    if (phase === "league") {
      if (week === "all") {
        return [...grouped.league.values()].flat();
      }

      if (week !== null) {
        return grouped.league.get(week) ?? [];
      }

      return [];
    }

    if (phase === "rush") {
      return grouped.rush;
    }

    return grouped.final;
  }, [phase, week, grouped]);

  /*
   * Keep URL shareable.
   */
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

  /*
   * If selected day no longer belongs to the current scope,
   * reset to All Days.
   */
  useEffect(() => {
    if (
      dayId !== "all" &&
      !currentDays.some((day) => String(day.id) === dayId)
    ) {
      setDayId("all");
    }
  }, [currentDays, dayId]);

  /*
   * Fetch placement.
   *
   * For "All Days", we fetch every day in the current scope
   * and aggregate them client-side.
   */
  useEffect(() => {
    if (currentDays.length === 0) {
      setPlacement([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError("");

    async function load() {
      try {
        /*
         * Specific day.
         */
        if (dayId !== "all") {
          const data = await api.placementDay(Number(dayId));

          if (!cancelled) {
            setPlacement(asArray<PlacementTeam>(data));
          }

          return;
        }

        /*
         * All days in the current scope.
         */
        const results = await Promise.all(
          currentDays.map(async (day) => {
            const data = await api.placementDay(day.id);

            return asArray<PlacementTeam>(data);
          }),
        );

        const combined = mergePlacementResults(results);

        if (!cancelled) {
          setPlacement(combined);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
          setPlacement([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [currentDays, dayId]);

  function handlePhaseChange(next: Phase) {
    setPhase(next);
    setDayId("all");

    if (next === "league") {
      setWeek("all");
    } else {
      setWeek(null);
    }
  }

  function handleWeekChange(next: number | "all") {
    setWeek(next);
    setDayId("all");
  }

  const scopeLabel = useMemo(() => {
    if (dayId !== "all") {
      const selected = currentDays.find(
        (day) => String(day.id) === dayId,
      );

      return selected?.name ?? "Selected Day";
    }

    if (phase === "league") {
      if (week === "all") {
        return "League Phase — Overall";
      }

      return `Week ${week} — Overall`;
    }

    if (phase === "rush") {
      return "Rush Point — Overall";
    }

    return "Grand Final — Overall";
  }, [phase, week, dayId, currentDays]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <Link href="/" className="eyebrow">
        ← FF / FANTASY
      </Link>

      <p className="eyebrow mt-10">Team standings</p>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="section-title">Placement.</h1>

          <p className="mt-3 text-muted-foreground">
            Follow team performance across the tournament.
          </p>
        </div>

        <Link
          href="/schedule"
          className="text-sm font-semibold hover:text-primary"
        >
          Tournament Schedule →
        </Link>
      </div>

      <div className="mt-10">
        {/* ========================= */}
        {/* PHASE */}
        {/* ========================= */}

        <div className="flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePhaseChange(p.id)}
              className={`border border-border px-5 py-3 text-sm font-semibold transition ${
                phase === p.id
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ========================= */}
        {/* LEAGUE WEEKS */}
        {/* ========================= */}

        {phase === "league" && weeks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleWeekChange("all")}
              className={`border border-border px-4 py-2 text-xs font-semibold transition ${
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
                className={`border border-border px-4 py-2 text-xs font-semibold transition ${
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

        {/* ========================= */}
        {/* DAYS */}
        {/* ========================= */}

        {currentDays.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-l border-border pl-4">
            <button
              type="button"
              onClick={() => setDayId("all")}
              className={`px-3 py-2 text-xs font-semibold transition ${
                dayId === "all"
                  ? "text-foreground underline decoration-primary underline-offset-4"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Days
            </button>

            {currentDays.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => setDayId(String(day.id))}
                className={`px-3 py-2 text-xs font-semibold transition ${
                  dayId === String(day.id)
                    ? "text-foreground underline decoration-primary underline-offset-4"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Day {dayNumber(day)}
              </button>
            ))}
          </div>
        )}

        {/* ========================= */}
        {/* ERROR */}
        {/* ========================= */}

        {error && (
          <p className="mt-8 text-sm text-muted-foreground">
            {error}
          </p>
        )}

        {/* ========================= */}
        {/* CURRENT SCOPE */}
        {/* ========================= */}

        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Standings</p>

            <h2 className="mt-2 text-xl font-bold">
              {scopeLabel}
            </h2>
          </div>
        </div>

        {/* ========================= */}
        {/* TABLE */}
        {/* ========================= */}

        <div className="mt-5 overflow-x-auto border-y border-border">
          <div className="min-w-[850px]">
            {/* Header */}
            <div className="grid grid-cols-[60px_1fr_120px_100px_120px_100px_100px] gap-4 border-b border-border px-4 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>#</span>
              <span>Team</span>
              <span>Total Points</span>
              <span>Kills</span>
              <span>Placement</span>
              <span>Booyahs</span>
              <span>Rooms</span>
            </div>

            {/* Loading */}
            {loading || daysLoading ? (
              <>
                {Array.from({ length: 8 }).map((_, index) => (
                  <PlacementRowSkeleton key={index} />
                ))}
              </>
            ) : currentDays.length === 0 ? (
              <div className="px-4 py-10 text-center text-muted-foreground">
                No tournament days available.
              </div>
            ) : placement.length === 0 ? (
              <div className="px-4 py-10 text-center text-muted-foreground">
                No placement data available.
              </div>
            ) : (
              placement.map((team, index) => (
                <div
                  key={team.team_id}
                  className="grid grid-cols-[60px_1fr_120px_100px_120px_100px_100px] items-center gap-4 border-b border-border px-4 py-5 last:border-b-0"
                >
                  {/* Rank */}
                  <span className="font-mono text-sm text-muted-foreground">
                    {index + 1}
                  </span>

                  {/* Team */}
                  <div className="flex min-w-0 items-center gap-4">
                    <TeamLogo
                      teamId={team.team_id}
                      teamName={team.team_name}
                    />

                    <span className="truncate font-semibold">
                      {team.team_name}
                    </span>
                  </div>

                  {/* Total */}
                  <span className="font-mono text-lg font-bold">
                    {team.points}
                  </span>

                  {/* Kills */}
                  <span className="font-mono">
                    {team.kills}
                  </span>

                  {/* Placement */}
                  <span className="font-mono">
                    {team.placement_points}
                  </span>

                  {/* Booyahs */}
                  <div className="flex items-center gap-1">
                    {team.booyahs > 0 ? (
                      <>
                        <img
                          src="/booyah.png"
                          alt="Booyah"
                          className="h-10 w-10 object-contain"
                        />

                        <span className="font-mono">
                          x{team.booyahs}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Rooms */}
                  <span className="font-mono text-muted-foreground">
                    {team.rooms_played}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PlacementPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PlacementContent />
    </Suspense>
  );
}
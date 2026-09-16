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

  if (/rush/i.test(name)) {
    return {
      phase: "rush",
    };
  }

  if (/^grand\s*final/i.test(name)) {
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

function TeamLogo({ teamId, teamName }: { teamId: number; teamName: string }) {
  return (
    <img
      src={`/logos/${teamId}.png`}
      alt={teamName}
      className="h-10 w-10 shrink-0 rounded-full object-contain"
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

function PlacementRowSkeleton({ showStarting }: { showStarting: boolean }) {
  return (
    <div
      className={`grid items-center gap-4 border-b border-border px-4 py-5 last:border-b-0 ${
        showStarting
          ? "grid-cols-[50px_1fr_auto] md:grid-cols-[60px_1fr_110px_110px_100px_120px_100px_100px]"
          : "grid-cols-[50px_1fr_auto] md:grid-cols-[60px_1fr_120px_100px_120px_100px_100px]"
      }`}
    >
      <div className="h-4 w-5 animate-pulse rounded bg-border/60" />

      <div className="flex min-w-0 items-center gap-4">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-border/60" />
        <div className="h-4 w-32 animate-pulse rounded bg-border/60" />
      </div>

      {showStarting && (
        <div className="hidden h-4 w-12 animate-pulse rounded bg-border/60 md:block" />
      )}

      <div className="hidden h-4 w-16 animate-pulse rounded bg-border/60 md:block" />
      <div className="hidden h-4 w-12 animate-pulse rounded bg-border/60 md:block" />
      <div className="hidden h-4 w-16 animate-pulse rounded bg-border/60 md:block" />
      <div className="hidden h-4 w-12 animate-pulse rounded bg-border/60 md:block" />
      <div className="hidden h-4 w-12 animate-pulse rounded bg-border/60 md:block" />

      <div className="ml-auto h-5 w-10 animate-pulse rounded bg-border/60" />
    </div>
  );
}

function mergePlacementResults(results: PlacementTeam[][]): PlacementTeam[] {
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
  const [teams, setTeams] = useState<PlacementTeam[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingPlacement, setLoadingPlacement] = useState(true);
  const [error, setError] = useState("");

  const phase = (searchParams.get("phase") as Phase) || "league";
  const week = searchParams.get("week") || "all";
  const day = searchParams.get("day") || "all";

  const activePhase: Phase = PHASES.some((item) => item.id === phase)
    ? phase
    : "league";

  useEffect(() => {
    let cancelled = false;

    async function loadDays() {
      try {
        setLoadingDays(true);
        setError("");

        const response = await api.days();
        const data = asArray<TournamentDay>(response);

        if (!cancelled) {
          setDays(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoadingDays(false);
        }
      }
    }

    loadDays();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const league = new Map<number, TournamentDay[]>();
    const rush: TournamentDay[] = [];
    const final: TournamentDay[] = [];

    for (const tournamentDay of days) {
      const parsed = parseDayName(tournamentDay.name);

      if (parsed.phase === "league" && parsed.week) {
        const existing = league.get(parsed.week) || [];
        existing.push(tournamentDay);
        league.set(parsed.week, existing);
      }

      if (parsed.phase === "rush") {
        rush.push(tournamentDay);
      }

      if (parsed.phase === "final") {
        final.push(tournamentDay);
      }
    }

    for (const value of league.values()) {
      value.sort((a, b) => dayNumber(a) - dayNumber(b));
    }

    rush.sort((a, b) => dayNumber(a) - dayNumber(b));
    final.sort((a, b) => dayNumber(a) - dayNumber(b));

    return {
      league,
      rush,
      final,
    };
  }, [days]);

  const weeks = useMemo(() => {
    return [...grouped.league.keys()].sort((a, b) => a - b);
  }, [grouped.league]);

  const currentDays = useMemo(() => {
    if (activePhase === "rush") {
      return grouped.rush;
    }

    if (activePhase === "final") {
      return grouped.final;
    }

    if (week === "all") {
      return weeks.flatMap(
        (weekNumber) => grouped.league.get(weekNumber) || [],
      );
    }

    const weekNumber = Number(week);

    return grouped.league.get(weekNumber) || [];
  }, [activePhase, grouped, week, weeks]);

  const selectedDays = useMemo(() => {
    if (day === "all") {
      return currentDays;
    }

    const dayNumberValue = Number(day);

    return currentDays.filter(
      (tournamentDay) => dayNumber(tournamentDay) === dayNumberValue,
    );
  }, [currentDays, day]);

  useEffect(() => {
    if (loadingDays) {
      return;
    }

    let cancelled = false;

    async function loadPlacement() {
      try {
        setLoadingPlacement(true);
        setError("");

        if (selectedDays.length === 0) {
          if (!cancelled) {
            setTeams([]);
          }
          return;
        }

        const results = await Promise.all(
          selectedDays.map((tournamentDay) =>
            api.placementDay(tournamentDay.id),
          ),
        );

        const parsedResults = results.map((result) =>
          asArray<PlacementTeam>(result),
        );

        const merged = mergePlacementResults(parsedResults);

        if (!cancelled) {
          setTeams(merged);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
          setTeams([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingPlacement(false);
        }
      }
    }

    loadPlacement();

    return () => {
      cancelled = true;
    };
  }, [loadingDays, selectedDays]);

  function buildUrl(next: { phase?: Phase; week?: string; day?: string }) {
    const nextPhase = next.phase ?? activePhase;
    const params = new URLSearchParams();

    params.set("phase", nextPhase);

    if (nextPhase === "league") {
      params.set("week", next.week ?? week);
      params.set("day", next.day ?? day);
    }

    return `/placement?${params.toString()}`;
  }

  const showStartingPoints = activePhase === "final";

  const dayButtons = useMemo(() => {
    const uniqueDays = new Map<number, TournamentDay>();

    for (const tournamentDay of currentDays) {
      const number = dayNumber(tournamentDay);

      if (number > 0) {
        uniqueDays.set(number, tournamentDay);
      }
    }

    return [...uniqueDays.entries()].sort(([a], [b]) => a - b);
  }, [currentDays]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="eyebrow mb-2">Tournament</p>
        <h1 className="section-title">Placement</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Team standings across the tournament.
        </p>
      </div>

      {/* Main phases */}
      <div className="mb-6 flex flex-wrap gap-2">
        {PHASES.map((item) => (
          <Link
            key={item.id}
            href={buildUrl({
              phase: item.id,
              week: item.id === "league" ? "all" : undefined,
            })}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
              activePhase === item.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* League weeks */}
      {activePhase === "league" && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={buildUrl({
              phase: "league",
              week: "all",
              day: "all",
            })}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              week === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Overall
          </Link>

          {weeks.map((weekNumber) => (
            <Link
              key={weekNumber}
              href={buildUrl({
                phase: "league",
                week: String(weekNumber),
                day: "all",
              })}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                week === String(weekNumber)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Week {weekNumber}
            </Link>
          ))}
        </div>
      )}

      {/* Days */}
      {activePhase === "league" && week != "all" && currentDays.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href={buildUrl({
              day: "all",
            })}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              day === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All Days
          </Link>

          {dayButtons.map(([dayNumberValue]) => (
            <Link
              key={dayNumberValue}
              href={buildUrl({
                day: String(dayNumberValue),
              })}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                day === String(dayNumberValue)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Day {dayNumberValue}
            </Link>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {/* Desktop header */}
        <div
          className={`hidden border-b border-border bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid ${
            showStartingPoints
              ? "grid-cols-[60px_1fr_110px_110px_100px_120px_100px_100px]"
              : "grid-cols-[60px_1fr_120px_100px_120px_100px_100px]"
          }`}
        >
          <div>#</div>
          <div>Team</div>

          {showStartingPoints && <div>Starting</div>}

          <div>Total</div>
          <div>Kills</div>
          <div>Placement</div>
          <div>Booyahs</div>
          <div>Rooms</div>
        </div>

        {loadingDays || loadingPlacement ? (
          <div>
            {Array.from({ length: 8 }).map((_, index) => (
              <PlacementRowSkeleton
                key={index}
                showStarting={showStartingPoints}
              />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No placement data available.
            </p>
          </div>
        ) : (
          teams.map((team, index) => (
            <div
              key={team.team_id}
              className={`grid items-center gap-4 border-b border-border px-4 py-4 last:border-b-0 ${
                showStartingPoints
                  ? "grid-cols-[50px_1fr_auto] md:grid-cols-[60px_1fr_110px_110px_100px_120px_100px_100px]"
                  : "grid-cols-[50px_1fr_auto] md:grid-cols-[60px_1fr_120px_100px_120px_100px_100px]"
              }`}
            >
              <div className="text-sm font-semibold text-muted-foreground">
                {index + 1}
              </div>

              <div className="flex min-w-0 items-center gap-4">
                <TeamLogo teamId={team.team_id} teamName={team.team_name} />

                <span className="truncate text-sm font-semibold">
                  {team.team_name}
                </span>
              </div>

              {showStartingPoints && (
                <div className="hidden text-sm font-medium md:block">
                  {team.starting_points}
                </div>
              )}

              <div className="text-right text-base font-bold md:text-left">
                {team.points}
              </div>

              <div className="hidden text-sm md:block">{team.kills}</div>

              <div className="hidden text-sm md:block">
                {team.placement_points}
              </div>

              <div className="hidden text-sm md:block">{team.booyahs}</div>

              <div className="hidden text-sm md:block">{team.rooms_played}</div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

export default function PlacementPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-3 w-20 animate-pulse rounded bg-border/60" />
            <div className="mt-3 h-8 w-40 animate-pulse rounded bg-border/60" />
          </div>

          <div className="rounded-lg border border-border bg-card">
            {Array.from({ length: 8 }).map((_, index) => (
              <PlacementRowSkeleton key={index} showStarting={false} />
            ))}
          </div>
        </main>
      }
    >
      <PlacementContent />
    </Suspense>
  );
}

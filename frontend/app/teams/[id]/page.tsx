
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { asArray, errorMessage } from "@/lib/types";
import type { Team, TeamStatsResponse } from "@/lib/types";

const MAP_STYLES: Record<
  string,
  {
    background: string;
    accent: string;
    glow: string;
    pattern: string;
  }
> = {
  Bermuda: {
    background:
      "bg-yellow-300",
    accent: "text-yellow-950",
    glow: "bg-yellow-100/40",
    pattern:
      "before:absolute before:inset-0 before:bg-[linear-gradient(135deg,transparent_0%,transparent_45%,rgba(255,255,255,0.18)_45%,rgba(255,255,255,0.18)_47%,transparent_47%,transparent_100%)] before:pointer-events-none",
  },

  Purgatory: {
    background:
      "bg-blue-600",
    accent: "text-white",
    glow: "bg-blue-300/20",
    pattern:
      "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.18)_0,transparent_25%),linear-gradient(135deg,transparent_0%,transparent_55%,rgba(255,255,255,0.08)_55%,rgba(255,255,255,0.08)_57%,transparent_57%)] before:pointer-events-none",
  },

  NexTerra: {
    background:
      "bg-zinc-100",
    accent: "text-zinc-950",
    glow: "bg-white/70",
    pattern:
      "before:absolute before:inset-0 before:bg-[linear-gradient(120deg,transparent_0%,transparent_42%,rgba(0,0,0,0.06)_42%,rgba(0,0,0,0.06)_43%,transparent_43%,transparent_70%,rgba(0,0,0,0.05)_70%,rgba(0,0,0,0.05)_71%,transparent_71%)] before:pointer-events-none",
  },

  Solara: {
    background:
      "bg-emerald-500",
    accent: "text-white",
    glow: "bg-emerald-200/20",
    pattern:
      "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.18)_0,transparent_28%),linear-gradient(155deg,transparent_0%,transparent_48%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0.08)_50%,transparent_50%)] before:pointer-events-none",
  },

  Kalahari: {
    background:
      "bg-orange-300",
    accent: "text-orange-950",
    glow: "bg-orange-100/40",
    pattern:
      "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.2)_0,transparent_24%),linear-gradient(145deg,transparent_0%,transparent_50%,rgba(120,53,15,0.08)_50%,rgba(120,53,15,0.08)_52%,transparent_52%)] before:pointer-events-none",
  },
};

function getMapStyle(mapType: string) {
  return (
    MAP_STYLES[mapType] || {
      background: "bg-muted",
      accent: "text-foreground",
      glow: "bg-white/10",
      pattern:
        "before:absolute before:inset-0 before:bg-[linear-gradient(135deg,transparent_0%,transparent_48%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0.08)_50%,transparent_50%)] before:pointer-events-none",
    }
  );
}

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();

  const [team, setTeam] = useState<Team | null>(null);
  const [stats, setStats] = useState<TeamStatsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const teamId = Number(id);

    Promise.all([api.teamStats(teamId), api.teams()])
      .then(([statsResponse, teamsResponse]) => {
        setStats(statsResponse as TeamStatsResponse);

        setTeam(
          asArray<Team>(teamsResponse).find((x) => x.id === teamId) ||
            null,
        );
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  const players = stats?.players ?? [];
  const maps = stats?.maps ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-[1200px] px-5 py-10">
      <Link
        href="/teams"
        className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Teams
      </Link>

      {/* TEAM HEADER */}
      <header className="mt-8">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Team profile
        </p>

        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight md:text-5xl">
          {team?.name || `Team ${id}`}
        </h1>
      </header>

      {error && (
        <p className="mt-8 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* PLAYERS */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Roster
            </p>
            <h2 className="mt-1 text-xl font-black uppercase">
              Players
            </h2>
          </div>

          <span className="font-mono text-xs text-muted-foreground">
            {players.length} PLAYERS
          </span>
        </div>

        {!error && !players.length && (
          <div className="border border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Loading players or no players found.
            </p>
          </div>
        )}

        {players.length > 0 && (
          <div className="overflow-x-auto pb-3">
            <div className="flex min-w-[850px] gap-3 md:min-w-0">
              {players.slice(0, 5).map((player, index) => (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  className="group relative flex min-w-[155px] flex-1 flex-col overflow-hidden border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/40"
                >
                  {/* PLAYER NUMBER */}
                  <div className="absolute left-3 top-3 z-10 font-mono text-[10px] font-bold text-white/70">
                    0{index + 1}
                  </div>

                  {/* PLAYER IMAGE */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                    <img
                      src={`/players/${player.id}.png`}
                      alt={player.nickname}
                      className="absolute inset-0 size-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />

                    {/* Image gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                    {/* Kills */}
                    <div className="absolute bottom-3 left-3">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/60">
                        Kills
                      </p>
                      <p className="font-mono text-2xl font-black text-white">
                        {player.total_kills}
                      </p>
                    </div>
                  </div>

                  {/* PLAYER NAME */}
                  <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-3">
                    <span className="truncate font-mono text-sm font-black uppercase">
                      {player.nickname}
                    </span>

                    <span className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* MAP STATISTICS */}
      {maps.length > 0 && (
        <section className="mt-16">
          <div className="mb-8">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Performance breakdown
            </p>

            <h2 className="mt-1 text-2xl font-black uppercase">
              Map statistics
            </h2>

            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Team performance across every map type played.
            </p>
          </div>

          <div className="space-y-12">
            {maps.map((map) => {
              const style = getMapStyle(map.map_type);

              return (
                <div key={map.map_type} className="relative pt-5">
                  {/* MAP NAME */}
                  <div className="absolute left-5 top-0 z-20">
                    <div className="border border-black/20 bg-black px-5 py-2 shadow-xl">
                      <span className="font-mono text-xs font-black uppercase tracking-[0.2em] text-white">
                        {map.map_type}
                      </span>
                    </div>
                  </div>

                  {/* MAP BOX */}
                  <div
                    className={`relative min-h-[300px] w-full overflow-hidden border border-black/20 ${style.background} ${style.pattern}`}
                  >
                    {/* Decorative shapes */}
                    <div
                      className={`absolute -right-20 -top-24 size-72 rounded-full ${style.glow}`}
                    />

                    <div
                      className={`absolute -bottom-28 -left-16 size-64 rotate-12 border-[30px] border-black/10`}
                    />

                    <div className="absolute right-8 top-8 font-mono text-[90px] font-black leading-none text-black/5">
                      {map.map_type.slice(0, 1).toUpperCase()}
                    </div>

                    {/* CONTENT */}
                    <div
                      className={`relative z-10 flex min-h-[300px] flex-col justify-between p-7 md:p-10 ${style.accent}`}
                    >
                      {/* TOP LABEL */}
                      <div>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">
                          Team performance
                        </p>

                        <h3 className="mt-1 text-3xl font-black uppercase tracking-tight md:text-4xl">
                          {map.map_type}
                        </h3>
                      </div>

                      {/* STATS */}
                      <div className="grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
                        <div className="border-l-2 border-current/30 pl-4">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Rooms played
                          </p>

                          <p className="mt-1 font-mono text-4xl font-black">
                            {map.rooms_played}
                          </p>
                        </div>

                        <div className="border-l-2 border-current/30 pl-4">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Average kills
                          </p>

                          <p className="mt-1 font-mono text-4xl font-black">
                            {map.rooms_played > 0
                              ? map.avg_kills
                              : "—"}
                          </p>
                        </div>

                        <div className="border-l-2 border-current/30 pl-4">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Average placement
                          </p>

                          <p className="mt-1 font-mono text-4xl font-black">
                            {map.rooms_played > 0
                              ? map.avg_placement
                              : "—"}
                          </p>
                        </div>
                      </div>

                      {/* BOTTOM DECORATION */}
                      <div className="mt-8 flex items-center gap-2">
                        <div className="h-1 w-20 bg-current opacity-70" />
                        <div className="h-1 w-8 bg-current opacity-40" />
                        <div className="h-1 w-3 bg-current opacity-20" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}


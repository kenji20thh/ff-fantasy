"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { asArray, errorMessage } from "@/lib/types";
import type { Team, TeamStatsResponse } from "@/lib/types";

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
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
      <Link href="/teams" className="eyebrow">
        ← Teams
      </Link>

      <h1 className="section-title mt-8">{team?.name || `Team ${id}`}</h1>

      {error && <p className="mt-8 text-red-400">{error}</p>}

      <section className="mt-10 border-t border-border">
        {!error && !players.length && (
          <p className="py-8 text-muted-foreground">
            Loading players or no players found.
          </p>
        )}

        {players.map((player) => (
          <Link
            key={player.id}
            href={`/players/${player.id}`}
            className="flex items-center justify-between gap-4 border-b border-border py-5 hover:bg-muted/30"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card">
                {player.picture_url ? (
                  <img
                    src={player.picture_url}
                    alt={player.nickname}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    {player.nickname.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <span className="font-mono font-bold uppercase">
                {player.nickname}
              </span>
            </div>

            <div className="text-right">
              <p className="font-mono text-lg font-bold text-primary">
                {player.total_kills}
              </p>

              <p className="text-xs uppercase text-muted-foreground">
                Kills
              </p>
            </div>
          </Link>
        ))}
      </section>

      {maps.length > 0 && (
        <section className="mt-14">
          <h2 className="font-mono text-lg font-bold uppercase">
            Map statistics
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Team averages per map across every room played.
          </p>

          <div className="mt-6 overflow-x-auto border-y border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="p-4">Map</th>
                  <th className="p-4">Rooms Played</th>
                  <th className="p-4">Avg. Kills</th>
                  <th className="p-4">Avg. Placement</th>
                </tr>
              </thead>

              <tbody>
                {maps.map((map) => (
                  <tr
                    key={map.map_type}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-4 font-mono font-bold uppercase">
                      {map.map_type}
                    </td>

                    <td className="p-4 text-muted-foreground">
                      {map.rooms_played}
                    </td>

                    <td className="p-4 font-bold text-primary">
                      {map.rooms_played > 0 ? map.avg_kills : "—"}
                    </td>

                    <td className="p-4">
                      {map.rooms_played > 0 ? map.avg_placement : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
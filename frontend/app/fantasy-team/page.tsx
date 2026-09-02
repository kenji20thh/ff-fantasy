"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { asArray, errorMessage } from "@/lib/types";
import type { Player, Team } from "@/lib/types";

type MyFantasyTeam = {
  id: number;
  user_id: number;
  player_ids: number[];
  captain_player_id?: number | null;
};

type FantasyPoints = {
  fantasy_team_id: number;
  total_points: number;
};

export default function FantasyTeam() {
  const { user } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myTeam, setMyTeam] = useState<MyFantasyTeam | null>(null);
  const [points, setPoints] = useState<FantasyPoints | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        setLoading(true);

        const fantasy = (await api.myFantasyTeam()) as MyFantasyTeam;

        setMyTeam(fantasy);

        const [teamsResponse, ...playerResponses] = await Promise.all([
          api.teams(),
          ...((await api.teams()) as unknown[]).map(async (team) => {
            const t = team as Team;
            return api.players(t.id);
          }),
        ]);

        const loadedTeams = asArray<Team>(teamsResponse);

        setTeams(loadedTeams);

        setPlayers(
          playerResponses.flatMap((response) => asArray<Player>(response)),
        );

        try {
          const fantasyPoints = (await api.fantasyPoints(
            fantasy.id,
          )) as FantasyPoints;
          setPoints(fantasyPoints);
        } catch {
          setPoints(null);
        }
      } catch (e) {
        const error = e as { status?: number };

        if (error.status === 404) {
          setMyTeam(null);
          return;
        }

        setMessage(errorMessage(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  if (!user) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <a href="/" className="eyebrow">
          ← FF / FANTASY
        </a>

        <div className="mt-16 max-w-2xl">
          <p className="eyebrow">Fantasy</p>

          <h1 className="section-title mt-4">
            Sign in to build your fantasy team.
          </h1>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <a href="/" className="eyebrow">
          ← FF / FANTASY
        </a>

        <p className="mt-12 text-muted-foreground">
          Loading your fantasy team...
        </p>
      </main>
    );
  }

  if (message) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <a href="/" className="eyebrow">
          ← FF / FANTASY
        </a>

        <p className="mt-12 border border-red-500/40 bg-card p-4 text-sm text-red-400">
          {message}
        </p>
      </main>
    );
  }

  /*
   * User already has a fantasy team.
   * DO NOT show the player selection screen.
   */
  if (myTeam) {
    const selectedPlayers = (myTeam.player_ids ?? [])
      .map((id) => players.find((player) => player.id === id))
      .filter((player): player is Player => player !== undefined);

    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <a href="/" className="eyebrow">
          ← FF / FANTASY
        </a>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Your fantasy team</p>

            <h1 className="section-title mt-2">Your squad.</h1>
          </div>

          {points && (
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground">
                Total points
              </p>

              <p className="font-mono text-3xl font-bold text-primary">
                {points.total_points}
              </p>
            </div>
          )}
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-lg font-bold uppercase">
              Selected players
            </h2>

            <span className="text-xs text-muted-foreground">
              {selectedPlayers.length} / 4
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {selectedPlayers.map((player) => {
              const team = teams.find((team) => team.id === player.team_id);

              const isCaptain = myTeam.captain_player_id === player.id;

              return (
                <div
                  key={player.id}
                  className={`border p-5 ${
                    isCaptain
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card"
                  }`}
                >
                  <span className="text-xs text-muted-foreground">
                    {team?.name || `Team ${player.team_id}`}
                  </span>

                  <strong className="mt-5 block font-mono uppercase">
                    {player.nickname}
                  </strong>

                  {isCaptain && (
                    <span className="mt-3 block text-xs font-bold uppercase text-primary">
                      Captain
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <Link
            href={`/fantasy-team/${myTeam.id}`}
            className="inline-block bg-primary px-6 py-3 font-bold text-primary-foreground"
          >
            View full fantasy team
          </Link>
        </section>
      </main>
    );
  }

  /*
   * User doesn't have a fantasy team.
   * Send them to the builder.
   */
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <a href="/" className="eyebrow">
        ← FF / FANTASY
      </a>

      <div className="mt-16 max-w-2xl">
        <p className="eyebrow">Fantasy</p>

        <h1 className="section-title mt-4">Build your fantasy team.</h1>

        <p className="mt-6 text-muted-foreground">
          Select four players from four different teams and choose your captain.
        </p>

        <Link
          href="/fantasy-team/builder"
          className="mt-8 inline-block bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          Create Fantasy Team
        </Link>
      </div>
    </main>
  );
}

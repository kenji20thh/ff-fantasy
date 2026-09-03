"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { asArray, errorMessage } from "@/lib/types";

import type { Player, Team, TournamentDay } from "@/lib/types";

type FantasyTeamResponse = {
  id: number;
  user_id: number;
};

export default function FantasyTeamBuilder() {
  const router = useRouter();
  const { user } = useAuth();

  const [days, setDays] = useState<TournamentDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<TournamentDay | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player[]>([]);
  const [captain, setCaptain] = useState<number>();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

  const [fantasyId, setFantasyId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        /*
         * Load tournament days and all teams.
         */
        const [daysResponse, teamsResponse] = await Promise.all([
          api.days(),
          api.teams(),
        ]);

        const loadedDays = asArray<TournamentDay>(daysResponse);
        const loadedTeams = asArray<Team>(teamsResponse);

        setDays(loadedDays);

        if (loadedDays.length === 0) {
          throw Error("No tournament days are available.");
        }

        /*
         * For now, use the first tournament day.
         */
        const currentDay = loadedDays[0];

        setSelectedDay(currentDay);

        /*
         * tournament day can return:
         *
         * teams: [1, 5, 8, 12]
         *
         * OR:
         *
         * teams: [
         *   { id: 1, name: "Team A" },
         *   ...
         * ]
         *
         * Handle both formats.
         */
        const participatingTeamIds = new Set(
          (currentDay.teams ?? []).map((team) =>
            typeof team === "number" ? team : team.id,
          ),
        );

        /*
         * Only show teams participating in this tournament day.
         */
        const dayTeams = loadedTeams.filter((team) =>
          participatingTeamIds.has(team.id),
        );

        setTeams(dayTeams);

        /*
         * Only load players belonging to participating teams.
         */
        const playerResponses = await Promise.all(
          dayTeams.map((team) => api.players(team.id)),
        );

        const loadedPlayers = playerResponses.flatMap((response) =>
          asArray<Player>(response),
        );

        setPlayers(loadedPlayers);

        /*
         * Check whether the user already has a fantasy team.
         * If they do, use that team instead of creating another one.
         */
        try {
          const existing = (await api.myFantasyTeam()) as {
            id: number;
            player_ids?: number[] | null;
            captain_player_id?: number | null;
          };

          setFantasyId(existing.id);

          const existingPlayers = existing.player_ids ?? [];

          /*
           * Only restore players that are available
           * in the current tournament day.
           */
          const selectedPlayers = existingPlayers
            .map((playerID) =>
              loadedPlayers.find((player) => player.id === playerID),
            )
            .filter(
              (player): player is Player => player !== undefined,
            );

          setSelected(selectedPlayers);

          if (existing.captain_player_id) {
            setCaptain(existing.captain_player_id);
          }
        } catch (error) {
          const apiError = error as { status?: number };

          if (apiError.status !== 404) {
            throw error;
          }
        }
      } catch (error) {
        setMessage(errorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  function toggle(player: Player) {
    if (selected.some((playerItem) => playerItem.id === player.id)) {
      setSelected(
        selected.filter(
          (playerItem) => playerItem.id !== player.id,
        ),
      );

      if (captain === player.id) {
        setCaptain(undefined);
      }

      setMessage("");
      return;
    }

    if (selected.length >= 4) {
      setMessage("You can only select four players.");
      return;
    }

    if (
      selected.some(
        (playerItem) => playerItem.team_id === player.team_id,
      )
    ) {
      setMessage("Choose four players from four different teams.");
      return;
    }

    setSelected([...selected, player]);
    setMessage("");
  }

  async function save() {
    try {
      if (!user) {
        throw Error("Sign in before creating a fantasy team.");
      }

      if (!selectedDay) {
        throw Error("No tournament day selected.");
      }

      if (selected.length !== 4) {
        throw Error("Select exactly four players.");
      }

      if (!captain) {
        throw Error("Choose a captain.");
      }

      setSaving(true);
      setMessage("");

      let id = fantasyId;

      /*
       * Only create the fantasy team if the user doesn't
       * already have one.
       */
      if (!id) {
        const response = (await api.createFantasy(
          user.id,
        )) as FantasyTeamResponse;

        id = response.id;
        setFantasyId(id);
      }

      /*
       * Save the four selected players.
       */
      await api.selectPlayers(id, {
        player_ids: selected.map((player) => player.id),
      });

      /*
       * Save the captain.
       */
      await api.captain(id, captain);

      /*
       * Team is fully saved.
       */
      router.push(`/fantasy-team/${id}`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const visiblePlayers = players.filter(
    (player) =>
      selectedTeam === null ||
      player.team_id === selectedTeam,
  );

  if (!user) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <a href="/" className="eyebrow">
          ← FF / FANTASY
        </a>

        <div className="mt-16">
          <h1 className="section-title">Sign in first.</h1>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <a href="/fantasy-team" className="eyebrow">
          ← Fantasy Team
        </a>

        <p className="mt-12 text-muted-foreground">
          Loading players...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <a href="/fantasy-team" className="eyebrow">
        ← Fantasy Team
      </a>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Fantasy builder</p>

          <h1 className="section-title">Draft your squad.</h1>

          {selectedDay && (
            <p className="mt-2 font-mono text-sm text-muted-foreground">
              {selectedDay.name}
            </p>
          )}
        </div>

        <span className="font-mono text-sm text-primary">
          {selected.length} / 4 selected
        </span>
      </div>

      {message && (
        <p className="mt-6 border border-primary/40 bg-card p-4 text-sm">
          {message}
        </p>
      )}

      <div className="mt-8">
        <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">
          Tournament Day
        </p>

        <div className="flex flex-wrap gap-2">
          {days.map((day) => (
            <div
              key={day.id}
              className={`border px-4 py-2 text-sm font-bold ${
                selectedDay?.id === day.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              {day.name}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">
          Select a team
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedTeam(null);
              setMessage("");
            }}
            className={`border px-4 py-2 text-sm font-bold ${
              selectedTeam === null
                ? "border-primary bg-primary/10"
                : "border-border bg-card"
            }`}
          >
            All Teams
          </button>

          {teams.map((team) => (
            <button
              type="button"
              key={team.id}
              onClick={() => {
                setSelectedTeam(team.id);
                setMessage("");
              }}
              className={`border px-4 py-2 text-sm font-bold ${
                selectedTeam === team.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visiblePlayers.map((player) => {
          const isSelected = selected.some(
            (selectedPlayer) =>
              selectedPlayer.id === player.id,
          );

          return (
            <button
              type="button"
              key={player.id}
              onClick={() => toggle(player)}
              className={`border p-5 text-left ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              <span className="text-xs text-muted-foreground">
                {teams.find(
                  (team) => team.id === player.team_id,
                )?.name || `Team ${player.team_id}`}
              </span>

              <strong className="mt-5 block font-mono uppercase">
                {player.nickname}
              </strong>

              {isSelected && (
                <span className="mt-3 block text-xs font-bold uppercase text-primary">
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visiblePlayers.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          No players are available for this tournament day.
        </p>
      )}

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="font-mono text-lg font-bold uppercase">
          Captain
        </h2>

        <div className="mt-4 flex flex-wrap gap-4">
          {selected.map((player) => (
            <label
              key={player.id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="captain"
                checked={captain === player.id}
                onChange={() => setCaptain(player.id)}
              />

              {player.nickname}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-8 bg-primary px-6 py-3 font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : fantasyId
              ? "Save changes"
              : "Create Fantasy Team"}
        </button>
      </section>
    </main>
  );
}
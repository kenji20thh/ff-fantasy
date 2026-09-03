"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { asArray, errorMessage } from "@/lib/types";

import type {
  Player,
  Team,
  TournamentDay,
} from "@/lib/types";

type FantasyTeamResponse = {
  id: number;
  user_id: number;
  day_id?: number | null;
  player_ids?: number[] | null;
  captain_player_id?: number | null;
  days?: FantasyDaySelection[];
};

type FantasyDaySelection = {
  id: number;
  day_id: number;
  day_name: string;
  player_ids: number[];
  captain_player_id?: number | null;
};

export default function FantasyTeamBuilder() {
  const router = useRouter();
  const { user } = useAuth();

  const [days, setDays] = useState<TournamentDay[]>([]);
  const [selectedDay, setSelectedDay] =
    useState<TournamentDay | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player[]>([]);
  const [captain, setCaptain] = useState<number>();

  const [daySelections, setDaySelections] = useState<
    FantasyDaySelection[]
  >([]);

  const [selectedTeam, setSelectedTeam] =
    useState<number | null>(null);

  const [fantasyId, setFantasyId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  /*
   * A day is locked when its deadline has passed.
   *
   * NULL deadline = no deadline = editable.
   */
  function isDayLocked(day: TournamentDay) {
    if (!day.deadline_at) {
      return false;
    }

    return new Date(day.deadline_at).getTime() <= Date.now();
  }

  /*
   * Load the players and saved fantasy selection
   * for one specific tournament day.
   */
  async function loadDay(
    day: TournamentDay,
    fantasyTeam?: FantasyTeamResponse,
  ) {
    try {
      setLoadingDay(true);
      setMessage("");
      setSelectedTeam(null);

      /*
       * The day may contain either team IDs or full Team objects.
       */
      const participatingTeamIds = new Set(
        (day.teams ?? []).map((team) =>
          typeof team === "number" ? team : team.id,
        ),
      );

      /*
       * Only show teams participating in this day.
       */
      const dayTeams = teams.filter((team) =>
        participatingTeamIds.has(team.id),
      );

      setTeams(dayTeams);

      /*
       * Load players for this day's teams.
       */
      const playerResponses = await Promise.all(
        dayTeams.map((team) => api.players(team.id)),
      );

      const loadedPlayers = playerResponses.flatMap(
        (response) => asArray<Player>(response),
      );

      setPlayers(loadedPlayers);

      /*
       * Find the saved selection for this day.
       */
      const savedSelection =
        fantasyTeam?.days?.find(
          (selection) => selection.day_id === day.id,
        );

      if (savedSelection) {
        const selectedPlayers = savedSelection.player_ids
          .map((playerID) =>
            loadedPlayers.find(
              (player) => player.id === playerID,
            ),
          )
          .filter(
            (player): player is Player =>
              player !== undefined,
          );

        setSelected(selectedPlayers);

        setCaptain(
          savedSelection.captain_player_id ?? undefined,
        );
      } else {
        setSelected([]);
        setCaptain(undefined);
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoadingDay(false);
    }
  }

  /*
   * Initial load.
   */
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [daysResponse, teamsResponse] =
          await Promise.all([
            api.days(),
            api.teams(),
          ]);

        const loadedDays =
          asArray<TournamentDay>(daysResponse);

        const loadedTeams =
          asArray<Team>(teamsResponse);

        if (loadedDays.length === 0) {
          throw Error(
            "No tournament days are available.",
          );
        }

        setDays(loadedDays);
        setTeams(loadedTeams);

        /*
         * Get the user's existing fantasy team.
         */
        let fantasyTeam: FantasyTeamResponse | undefined;

        try {
          fantasyTeam =
            (await api.myFantasyTeam()) as FantasyTeamResponse;

          setFantasyId(fantasyTeam.id);

          setDaySelections(
            fantasyTeam.days ?? [],
          );
        } catch (error) {
          const apiError = error as {
            status?: number;
          };

          if (apiError.status !== 404) {
            throw error;
          }
        }

        /*
         * Automatically select the first unlocked day.
         *
         * If all days are locked, select the last day so
         * the user can still see their history.
         */
        const firstOpenDay =
          loadedDays.find(
            (day) => !isDayLocked(day),
          ) ??
          loadedDays[loadedDays.length - 1];

        setSelectedDay(firstOpenDay);

        /*
         * Load players and saved selection for that day.
         */
        await loadDay(
          firstOpenDay,
          fantasyTeam,
        );
      } catch (error) {
        setMessage(errorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  /*
   * Change tournament day.
   */
  async function changeDay(day: TournamentDay) {
    setSelectedDay(day);

    await loadDay(day, {
      id: fantasyId ?? 0,
      user_id: user?.id ?? 0,
      days: daySelections,
    });
  }

  function toggle(player: Player) {
    if (selectedDay && isDayLocked(selectedDay)) {
      setMessage(
        "This tournament day is locked.",
      );
      return;
    }

    if (
      selected.some(
        (playerItem) =>
          playerItem.id === player.id,
      )
    ) {
      setSelected(
        selected.filter(
          (playerItem) =>
            playerItem.id !== player.id,
        ),
      );

      if (captain === player.id) {
        setCaptain(undefined);
      }

      setMessage("");
      return;
    }

    if (selected.length >= 4) {
      setMessage(
        "You can only select four players.",
      );
      return;
    }

    if (
      selected.some(
        (playerItem) =>
          playerItem.team_id === player.team_id,
      )
    ) {
      setMessage(
        "Choose four players from four different teams.",
      );
      return;
    }

    setSelected([...selected, player]);
    setMessage("");
  }

  async function save() {
    try {
      if (!user) {
        throw Error(
          "Sign in before creating a fantasy team.",
        );
      }

      if (!selectedDay) {
        throw Error(
          "No tournament day selected.",
        );
      }

      if (isDayLocked(selectedDay)) {
        throw Error(
          "This tournament day is locked.",
        );
      }

      if (selected.length !== 4) {
        throw Error(
          "Select exactly four players.",
        );
      }

      if (!captain) {
        throw Error(
          "Choose a captain.",
        );
      }

      setSaving(true);
      setMessage("");

      let id = fantasyId;

      /*
       * Create the permanent fantasy team only once.
       */
      if (!id) {
        const response =
          (await api.createFantasy(
            user.id,
          )) as FantasyTeamResponse;

        id = response.id;
        setFantasyId(id);
      }

      /*
       * Save this day's four players.
       *
       * This does NOT touch previous days.
       */
      await api.selectPlayers(id, {
        day_id: selectedDay.id,
        player_ids: selected.map(
          (player) => player.id,
        ),
      });

      /*
       * Save this day's captain.
       */
      await api.captain(
        id,
        selectedDay.id,
        captain,
      );

      /*
       * Update local history so changing between days
       * immediately shows the newly saved selection.
       */
      const newSelection: FantasyDaySelection = {
        id: 0,
        day_id: selectedDay.id,
        day_name: selectedDay.name,
        player_ids: selected.map(
          (player) => player.id,
        ),
        captain_player_id: captain,
      };

      setDaySelections((previous) => {
        const withoutCurrent = previous.filter(
          (selection) =>
            selection.day_id !== selectedDay.id,
        );

        return [
          ...withoutCurrent,
          newSelection,
        ].sort(
          (a, b) => a.day_id - b.day_id,
        );
      });

      router.push(
        `/fantasy-team/${id}`,
      );
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
          <h1 className="section-title">
            Sign in first.
          </h1>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <a
          href="/fantasy-team"
          className="eyebrow"
        >
          ← Fantasy Team
        </a>

        <p className="mt-12 text-muted-foreground">
          Loading players...
        </p>
      </main>
    );
  }

  const selectedDayLocked =
    selectedDay
      ? isDayLocked(selectedDay)
      : false;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <a
        href="/fantasy-team"
        className="eyebrow"
      >
        ← Fantasy Team
      </a>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            Fantasy builder
          </p>

          <h1 className="section-title">
            Draft your squad.
          </h1>

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

      {/* Tournament days */}
      <div className="mt-8">
        <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">
          Tournament Day
        </p>

        <div className="flex flex-wrap gap-2">
          {days.map((day) => {
            const locked =
              isDayLocked(day);

            const hasSelection =
              daySelections.some(
                (selection) =>
                  selection.day_id === day.id,
              );

            return (
              <button
                type="button"
                key={day.id}
                onClick={() =>
                  changeDay(day)
                }
                className={`border px-4 py-2 text-sm font-bold ${
                  selectedDay?.id === day.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                {day.name}

                {locked && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Locked
                  </span>
                )}

                {!locked &&
                  hasSelection && (
                    <span className="ml-2 text-xs text-primary">
                      ✓
                    </span>
                  )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Locked day notice */}
      {selectedDayLocked && (
        <div className="mt-6 border border-border bg-card p-4">
          <p className="font-bold">
            {selectedDay?.name} is locked.
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Your selection for this day is preserved
            and cannot be changed.
          </p>
        </div>
      )}

      {/* Team filters */}
      <div className="mt-8">
        <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">
          Select a team
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={selectedDayLocked}
            onClick={() => {
              setSelectedTeam(null);
              setMessage("");
            }}
            className={`border px-4 py-2 text-sm font-bold ${
              selectedTeam === null
                ? "border-primary bg-primary/10"
                : "border-border bg-card"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            All Teams
          </button>

          {teams.map((team) => (
            <button
              type="button"
              key={team.id}
              disabled={selectedDayLocked}
              onClick={() => {
                setSelectedTeam(
                  team.id,
                );
                setMessage("");
              }}
              className={`border px-4 py-2 text-sm font-bold ${
                selectedTeam === team.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      {/* Players */}
      {loadingDay ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Loading players...
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visiblePlayers.map(
            (player) => {
              const isSelected =
                selected.some(
                  (selectedPlayer) =>
                    selectedPlayer.id ===
                    player.id,
                );

              return (
                <button
                  type="button"
                  key={player.id}
                  disabled={selectedDayLocked}
                  onClick={() =>
                    toggle(player)
                  }
                  className={`border p-5 text-left ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="text-xs text-muted-foreground">
                    {teams.find(
                      (team) =>
                        team.id ===
                        player.team_id,
                    )?.name ||
                      `Team ${player.team_id}`}
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
            },
          )}
        </div>
      )}

      {!loadingDay &&
        visiblePlayers.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            No players are available for this
            tournament day.
          </p>
        )}

      {/* Captain */}
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
                disabled={selectedDayLocked}
                checked={
                  captain === player.id
                }
                onChange={() =>
                  setCaptain(
                    player.id,
                  )
                }
              />

              {player.nickname}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={
            saving ||
            selectedDayLocked
          }
          className="mt-8 bg-primary px-6 py-3 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : selectedDayLocked
              ? "Day Locked"
              : fantasyId
                ? "Save changes"
                : "Create Fantasy Team"}
        </button>
      </section>
    </main>
  );
}
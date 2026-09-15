"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Crown,
  Loader2,
  Lock,
  Plus,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { asArray, errorMessage } from "@/lib/utils";
import type { Player, Team, TournamentDay } from "@/lib/types";

const TEAM_BUDGET = 100;

type FantasyDaySelection = {
  id: number;
  day_id: number;
  day_name?: string;
  player_ids: number[];
  captain_player_id?: number | null;
};

type FantasyTeamResponse = {
  id: number;
  user_id: number;
  day_id?: number;
  player_ids?: number[];
  captain_player_id?: number | null;
  days?: FantasyDaySelection[];
};

function getParticipatingTeamIDs(day: TournamentDay): number[] {
  if (!day.teams || day.teams.length === 0) {
    return [];
  }

  if (typeof day.teams[0] === "number") {
    return day.teams as number[];
  }

  return (day.teams as Team[]).map((team) => team.id);
}

function getPhaseNumber(name?: string) {
  const match = name?.match(/week\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function getDayNumber(name?: string) {
  const match = name?.match(/day\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function sortDaysByWeekDay(a: TournamentDay, b: TournamentDay) {
  const phaseA = getPhaseNumber(a.name);
  const phaseB = getPhaseNumber(b.name);

  if (phaseA !== phaseB) {
    return phaseA - phaseB;
  }

  return getDayNumber(a.name) - getDayNumber(b.name);
}

export default function FantasyTeamBuilderPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [days, setDays] = useState<TournamentDay[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [selectedDay, setSelectedDay] = useState<TournamentDay | null>(null);
  const [selected, setSelected] = useState<Player[]>([]);
  const [captain, setCaptain] = useState<number | null>(null);

  const [daySelections, setDaySelections] = useState<FantasyDaySelection[]>([]);

  const [fantasyId, setFantasyId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [openDayMenu, setOpenDayMenu] = useState(false);

  const isDayLocked = useMemo(() => {
    if (!selectedDay?.deadline_at) {
      return false;
    }

    return new Date(selectedDay.deadline_at).getTime() <= Date.now();
  }, [selectedDay]);

  const totalPrice = useMemo(() => {
    return selected.reduce((total, player) => total + player.price, 0);
  }, [selected]);

  const remainingBudget = TEAM_BUDGET - totalPrice;

  const budgetPercentage = Math.min(
    100,
    Math.max(0, (totalPrice / TEAM_BUDGET) * 100),
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.price !== a.price) {
        return b.price - a.price;
      }

      return a.nickname.localeCompare(b.nickname);
    });
  }, [players]);

  const selectedPlayerIDs = useMemo(() => {
    return new Set(selected.map((player) => player.id));
  }, [selected]);

  function getTeamName(teamID: number) {
    return allTeams.find((team) => team.id === teamID)?.name ?? "Unknown Team";
  }

  function getTeamLogo(teamID: number) {
    return `/logos/${teamID}.png`;
  }

  function formatDeadline(day: TournamentDay) {
    if (!day.deadline_at) {
      return null;
    }

    return new Date(day.deadline_at).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function loadDay(
    day: TournamentDay,
    fantasyTeam?: FantasyTeamResponse | null,
    availableTeams = allTeams,
  ) {
    setLoadingDay(true);
    setMessage("");

    try {
      const participatingTeamIDs = getParticipatingTeamIDs(day);

      const dayTeams =
        participatingTeamIDs.length > 0
          ? availableTeams.filter((team) =>
              participatingTeamIDs.includes(team.id),
            )
          : availableTeams;

      const responses = await Promise.all(
        dayTeams.map((team) => api.players(team.id)),
      );

      const dayPlayers = responses.flatMap((response) =>
        asArray<Player>(response),
      );

      const uniquePlayers = Array.from(
        new Map(dayPlayers.map((player) => [player.id, player])).values(),
      );

      uniquePlayers.sort((a, b) => {
        if (b.price !== a.price) {
          return b.price - a.price;
        }

        return a.nickname.localeCompare(b.nickname);
      });

      setPlayers(uniquePlayers);

      const selection = fantasyTeam?.days?.find(
        (item) => item.day_id === day.id,
      );

      if (selection) {
        const restoredPlayers = uniquePlayers.filter((player) =>
          selection.player_ids.includes(player.id),
        );

        setSelected(restoredPlayers);
        setCaptain(selection.captain_player_id ?? null);
      } else {
        setSelected([]);
        setCaptain(null);
      }
    } catch (error) {
      setMessage(errorMessage(error));
      setPlayers([]);
      setSelected([]);
      setCaptain(null);
    } finally {
      setLoadingDay(false);
    }
  }

  async function loadInitialData() {
    setLoading(true);
    setMessage("");

    try {
      const [daysResponse, teamsResponse, fantasyResponse] = await Promise.all([
        api.days(),
        api.teams(),
        api.myFantasyTeam().catch(() => null),
      ]);

      const loadedDays =
        asArray<TournamentDay>(daysResponse).sort(sortDaysByWeekDay);

      const loadedTeams = asArray<Team>(teamsResponse);

      setDays(loadedDays);
      setAllTeams(loadedTeams);

      const fantasyTeam = fantasyResponse as FantasyTeamResponse | null;

      if (fantasyTeam?.id) {
        setFantasyId(fantasyTeam.id);
      }

      if (fantasyTeam?.days) {
        setDaySelections(fantasyTeam.days);
      }

      if (loadedDays.length === 0) {
        return;
      }

      const firstUnlocked =
        loadedDays.find(
          (day) =>
            !day.deadline_at ||
            new Date(day.deadline_at).getTime() > Date.now(),
        ) ?? loadedDays[loadedDays.length - 1];

      setSelectedDay(firstUnlocked);

      await loadDay(firstUnlocked, fantasyTeam, loadedTeams);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  async function changeDay(day: TournamentDay) {
    if (day.id === selectedDay?.id) {
      setOpenDayMenu(false);
      return;
    }

    setSelectedDay(day);
    setOpenDayMenu(false);

    const localSelection = daySelections.find(
      (selection) => selection.day_id === day.id,
    );

    if (localSelection) {
      setSelected(
        players.filter((player) =>
          localSelection.player_ids.includes(player.id),
        ),
      );
      setCaptain(localSelection.captain_player_id ?? null);
    } else {
      setSelected([]);
      setCaptain(null);
    }

    await loadDay(day, {
      id: fantasyId ?? 0,
      user_id: user?.id ?? 0,
      days: daySelections,
    });
  }

  function togglePlayer(player: Player) {
    if (isDayLocked || saving) {
      return;
    }

    const alreadySelected = selectedPlayerIDs.has(player.id);

    if (alreadySelected) {
      setSelected((current) => current.filter((item) => item.id !== player.id));

      if (captain === player.id) {
        setCaptain(null);
      }

      setMessage("");
      return;
    }

    if (selected.length >= 4) {
      setMessage("You can only select 4 players.");
      return;
    }

    const hasSameTeam = selected.some(
      (selectedPlayer) => selectedPlayer.team_id === player.team_id,
    );

    if (hasSameTeam) {
      setMessage("You must select players from 4 different teams.");
      return;
    }

    const newTotal = totalPrice + player.price;

    if (newTotal > TEAM_BUDGET) {
      setMessage(
        `You cannot select ${player.nickname}. Your budget would be ${newTotal}/${TEAM_BUDGET}.`,
      );
      return;
    }

    setSelected((current) => [...current, player]);
    setMessage("");

    if (selected.length + 1 === 4) {
      setMessage("Your squad is complete. Now choose your captain.");
    }
  }

  function removePlayer(playerID: number) {
    if (isDayLocked || saving) {
      return;
    }

    setSelected((current) =>
      current.filter((player) => player.id !== playerID),
    );

    if (captain === playerID) {
      setCaptain(null);
    }

    setMessage("");
  }

  async function save() {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedDay) {
      setMessage("Please select a tournament day.");
      return;
    }

    if (isDayLocked) {
      setMessage("This day is already locked.");
      return;
    }

    if (selected.length !== 4) {
      setMessage("You must select exactly 4 players.");
      return;
    }

    if (!captain) {
      setMessage("Please choose a captain.");
      return;
    }

    if (totalPrice > TEAM_BUDGET) {
      setMessage(`Your team is over budget: ${totalPrice}/${TEAM_BUDGET}.`);
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let currentFantasyId = fantasyId;

      if (!currentFantasyId) {
        const created = await api.createFantasy(user.id);
        const createdTeam = created as FantasyTeamResponse;

        currentFantasyId = createdTeam.id;
        setFantasyId(createdTeam.id);
      }

      await api.selectPlayers(currentFantasyId, {
        day_id: selectedDay.id,
        player_ids: selected.map((player) => player.id),
      });

      const updatedSelection: FantasyDaySelection = {
        id:
          daySelections.find((selection) => selection.day_id === selectedDay.id)
            ?.id ?? 0,
        day_id: selectedDay.id,
        day_name: selectedDay.name,
        player_ids: selected.map((player) => player.id),
        captain_player_id: captain,
      };

      setDaySelections((current) => {
        const exists = current.some(
          (selection) => selection.day_id === selectedDay.id,
        );

        if (exists) {
          return current.map((selection) =>
            selection.day_id === selectedDay.id ? updatedSelection : selection,
          );
        }

        return [...current, updatedSelection];
      });

      router.push(`/fantasy-team/${currentFantasyId}`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-4 w-4" />
            Fantasy Manager
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Build your fantasy squad
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Pick four players from four different teams, stay within the
                100-credit budget, then choose your captain.
              </p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDayMenu((value) => !value)}
                className="flex min-w-[220px] items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition hover:border-primary/50"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Tournament day
                  </p>

                  <p className="mt-1 font-bold">
                    {selectedDay?.name ?? "Select day"}
                  </p>
                </div>

                <ChevronDown
                  className={`h-4 w-4 transition ${
                    openDayMenu ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openDayMenu && (
                <div className="absolute right-0 z-30 mt-2 w-full min-w-[260px] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                  {days.map((day) => {
                    const locked =
                      !!day.deadline_at &&
                      new Date(day.deadline_at).getTime() <= Date.now();

                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => changeDay(day)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition ${
                          selectedDay?.id === day.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold">{day.name}</p>

                          {day.deadline_at && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Deadline: {formatDeadline(day)}
                            </p>
                          )}
                        </div>

                        {locked && (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {isDayLocked && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <Lock className="h-4 w-4 text-muted-foreground" />

            <div>
              <p className="font-semibold">This day is locked</p>
              <p className="text-xs text-muted-foreground">
                The deadline has passed. Your selection can no longer be
                changed.
              </p>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <section className="min-w-0">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Players</h2>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Sorted by price. Select one player from each team.
                </p>
              </div>

              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold">
                {selected.length}/4
              </span>
            </div>

            {loadingDay ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-border bg-card">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : sortedPlayers.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-border bg-card text-sm text-muted-foreground">
                No players available for this day.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="divide-y divide-border">
                  {sortedPlayers.map((player) => {
                    const selectedPlayer = selectedPlayerIDs.has(player.id);
                    const sameTeam = selected.some(
                      (item) => item.team_id === player.team_id,
                    );

                    const wouldExceedBudget =
                      totalPrice + player.price > TEAM_BUDGET;

                    const disabled =
                      isDayLocked ||
                      saving ||
                      (!selectedPlayer &&
                        (selected.length >= 4 ||
                          sameTeam ||
                          wouldExceedBudget));

                    return (
                      <button
                        key={player.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => togglePlayer(player)}
                        className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                          selectedPlayer
                            ? "bg-primary/10"
                            : disabled
                              ? "cursor-not-allowed opacity-45"
                              : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                          <img
                            src={getTeamLogo(player.team_id)}
                            alt={getTeamName(player.team_id)}
                            className="h-8 w-8 object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {player.nickname}
                          </p>

                          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {getTeamName(player.team_id)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`text-sm font-black ${
                              selectedPlayer
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {player.price}
                          </span>

                          <span className="text-[9px] font-bold uppercase text-muted-foreground">
                            CR
                          </span>

                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                              selectedPlayer
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background"
                            }`}
                          >
                            {selectedPlayer ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Budget
                    </p>

                    <p className="mt-1 text-2xl font-black">
                      {totalPrice}
                      <span className="text-sm font-bold text-muted-foreground">
                        {" "}
                        / {TEAM_BUDGET}
                      </span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Remaining
                    </p>

                    <p
                      className={`mt-1 text-lg font-black ${
                        remainingBudget < 0 ? "text-red-500" : "text-primary"
                      }`}
                    >
                      {remainingBudget}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${budgetPercentage}%` }}
                  />
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Your squad
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      {selected.length === 4
                        ? "Squad complete"
                        : `${4 - selected.length} slot${
                            4 - selected.length === 1 ? "" : "s"
                          } left`}
                    </h2>
                  </div>

                  <Shield className="h-5 w-5 text-primary" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((index) => {
                    const player = selected[index];

                    if (!player) {
                      return (
                        <div
                          key={index}
                          className="flex min-h-[105px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20"
                        >
                          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground">
                            <Plus className="h-4 w-4" />
                          </div>

                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Empty slot
                          </span>
                        </div>
                      );
                    }

                    const isCaptain = captain === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`relative rounded-xl border p-3 transition ${
                          isCaptain
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/20"
                        }`}
                      >
                        {!isDayLocked && (
                          <button
                            type="button"
                            onClick={() => removePlayer(player.id)}
                            className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-background text-muted-foreground transition hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}

                        <div className="flex flex-col items-center text-center">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                            <img
                              src={getTeamLogo(player.team_id)}
                              alt={getTeamName(player.team_id)}
                              className="h-7 w-7 object-contain"
                            />
                          </div>

                          <p className="mt-2 max-w-full truncate text-xs font-black">
                            {player.nickname}
                          </p>

                          <p className="mt-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                            {player.price} CR
                          </p>

                          {isCaptain && (
                            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-primary-foreground">
                              <Crown className="h-2.5 w-2.5" />
                              Captain
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selected.length === 4 && (
                  <div className="mt-6 border-t border-border pt-5">
                    <div className="mb-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-primary" />

                        <h3 className="text-sm font-bold">
                          Choose your captain
                        </h3>
                      </div>

                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Your captain receives the captain multiplier.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {selected.map((player) => {
                        const active = captain === player.id;

                        return (
                          <button
                            key={player.id}
                            type="button"
                            disabled={isDayLocked || saving}
                            onClick={() => setCaptain(player.id)}
                            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                              active
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                              <img
                                src={getTeamLogo(player.team_id)}
                                alt={getTeamName(player.team_id)}
                                className="h-6 w-6 object-contain"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold">
                                {player.nickname}
                              </p>

                              <p className="text-[9px] uppercase text-muted-foreground">
                                {getTeamName(player.team_id)}
                              </p>
                            </div>

                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                active
                                  ? "border-primary bg-primary"
                                  : "border-border"
                              }`}
                            >
                              {active && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={save}
                  disabled={
                    saving ||
                    isDayLocked ||
                    selected.length !== 4 ||
                    !captain ||
                    totalPrice > TEAM_BUDGET
                  }
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save fantasy team
                    </>
                  )}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Crown,
  Loader2,
  Lock,
  Search,
  Sparkles,
  Users,
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

  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<number | null>(
    null,
  );

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

  const selectedPlayerIDs = useMemo(() => {
    return new Set(selected.map((player) => player.id));
  }, [selected]);

  const participatingTeams = useMemo(() => {
    if (!selectedDay) {
      return [];
    }

    const teamIDs = getParticipatingTeamIDs(selectedDay);

    if (teamIDs.length === 0) {
      return allTeams;
    }

    return allTeams.filter((team) => teamIDs.includes(team.id));
  }, [selectedDay, allTeams]);

  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();

    return [...players]
      .filter((player) => {
        if (
          selectedTeamFilter !== null &&
          player.team_id !== selectedTeamFilter
        ) {
          return false;
        }

        if (query && !player.nickname.toLowerCase().includes(query)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (b.price !== a.price) {
          return b.price - a.price;
        }

        return a.nickname.localeCompare(b.nickname);
      });
  }, [players, playerSearch, selectedTeamFilter]);

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
    setPlayerSearch("");
    setSelectedTeamFilter(null);

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
      setSelected((current) =>
        current.filter((item) => item.id !== player.id),
      );

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
        `You cannot select ${player.nickname}. Your budget would be $${newTotal}/$${TEAM_BUDGET}.`,
      );
      return;
    }

    setSelected((current) => [...current, player]);
    setMessage("");

    if (selected.length + 1 === 4) {
      setMessage("Your squad is complete. Click a player's name to make them captain.");
    }
  }

  function chooseCaptain(playerID: number) {
    if (isDayLocked || saving || !selectedPlayerIDs.has(playerID)) {
      return;
    }

    setCaptain(playerID);
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
      setMessage("You must select exactly 4 players before saving.");
      return;
    }

    if (!captain) {
      setMessage("You must choose a captain by clicking one of the selected player's names.");
      return;
    }

    if (totalPrice > TEAM_BUDGET) {
      setMessage(
        `Your team is over budget: $${totalPrice}/$${TEAM_BUDGET}.`,
      );
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

      await api.captain(currentFantasyId, selectedDay.id, captain);

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
            selection.day_id === selectedDay.id
              ? updatedSelection
              : selection,
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

  const saveDisabled =
    saving ||
    isDayLocked ||
    selected.length !== 4 ||
    !captain ||
    totalPrice > TEAM_BUDGET;

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
        {/* Header */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-4 w-4" />
            Fantasy Manager
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Build your fantasy team
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Select 4 players from 4 different teams and choose your captain.
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
                <div className="absolute right-0 z-40 mt-2 w-full min-w-[270px] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
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
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />

            <div>
              <p className="font-semibold">This day is locked</p>
              <p className="text-xs text-muted-foreground">
                The deadline has passed. Your selection can no longer be changed.
              </p>
            </div>
          </div>
        )}

        {/* Budget / Points */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="p-5 text-center sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Budget
              </p>

              <p
                className={`mt-2 text-3xl font-black sm:text-4xl ${
                  totalPrice > TEAM_BUDGET
                    ? "text-red-500"
                    : "text-foreground"
                }`}
              >
                ${totalPrice}
                <span className="text-base font-bold text-muted-foreground">
                  {" "}
                  / ${TEAM_BUDGET}
                </span>
              </p>
            </div>

            <div className="p-5 text-center sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Points
              </p>

              <p className="mt-2 text-3xl font-black sm:text-4xl">
                —{" "}
                <span className="text-base font-bold text-muted-foreground">
                  pts
                </span>
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            {message}
          </div>
        )}

        {/* Main builder */}
        <section className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="border-b border-border bg-muted/10 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-wide">
                  Search players
                </h2>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  type="text"
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  placeholder="Player name..."
                  className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wide">
                  Select by team
                </h2>

                {selectedTeamFilter !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedTeamFilter(null)}
                    className="text-[10px] font-bold uppercase tracking-wider text-primary"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedTeamFilter(null)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    selectedTeamFilter === null
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-[10px] font-black">
                    ALL
                  </div>

                  <span className="font-semibold">All teams</span>
                </button>

                {participatingTeams.map((team) => {
                  const active = selectedTeamFilter === team.id;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() =>
                        setSelectedTeamFilter(active ? null : team.id)
                      }
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background ${
                          active
                            ? "border-primary"
                            : "border-border"
                        }`}
                      >
                        <img
                          src={getTeamLogo(team.id)}
                          alt={team.name}
                          className="h-6 w-6 object-contain"
                        />
                      </div>

                      <span className="truncate text-xs font-bold">
                        {team.name}
                      </span>

                      {active && (
                        <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Selected
                </span>

                <span className="text-sm font-black">
                  {selected.length} / 4
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (selected.length / 4) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </aside>

          {/* Players */}
          <div className="min-w-0 p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-black">Select players</h2>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Click a player to select them. After selecting them, click
                  their name to make them captain.
                </p>
              </div>

              <div className="text-xs font-bold text-muted-foreground">
                {filteredPlayers.length} players
              </div>
            </div>

            {loadingDay ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-background">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border bg-background text-sm text-muted-foreground">
                No players found.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPlayers.map((player) => {
                  const isSelected = selectedPlayerIDs.has(player.id);
                  const isCaptain = captain === player.id;

                  const sameTeam = selected.some(
                    (item) => item.team_id === player.team_id,
                  );

                  const wouldExceedBudget =
                    totalPrice + player.price > TEAM_BUDGET;

                  const disabled =
                    isDayLocked ||
                    saving ||
                    (!isSelected &&
                      (selected.length >= 4 ||
                        sameTeam ||
                        wouldExceedBudget));

                  return (
                    <div
                      key={player.id}
                      className={`rounded-2xl border transition ${
                        isSelected
                          ? isCaptain
                            ? "border-primary bg-primary/10"
                            : "border-primary/50 bg-primary/5"
                          : disabled
                            ? "border-border bg-muted/20 opacity-45"
                            : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => togglePlayer(player)}
                        className="flex w-full items-center gap-3 p-4 text-left"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                          <img
                            src={getTeamLogo(player.team_id)}
                            alt={getTeamName(player.team_id)}
                            className="h-8 w-8 object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <span
                                role="button"
                                tabIndex={isDayLocked || saving ? -1 : 0}
                                onClick={(event) => {
                                  event.stopPropagation();

                                  if (!isDayLocked && !saving) {
                                    chooseCaptain(player.id);
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    event.stopPropagation();

                                    if (!isDayLocked && !saving) {
                                      chooseCaptain(player.id);
                                    }
                                  }
                                }}
                                className={`truncate text-sm font-black underline-offset-2 hover:underline ${
                                  isCaptain
                                    ? "text-primary"
                                    : "text-foreground"
                                }`}
                                title="Click name to choose captain"
                              >
                                {player.nickname}
                              </span>
                            ) : (
                              <span className="truncate text-sm font-black">
                                {player.nickname}
                              </span>
                            )}

                            {isCaptain && (
                              <Crown className="h-3.5 w-3.5 shrink-0 text-primary" />
                            )}
                          </div>

                          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {getTeamName(player.team_id)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span
                            className={`text-sm font-black ${
                              isSelected
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            ${player.price}
                          </span>

                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card"
                            }`}
                          >
                            {isSelected ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <span className="text-xs font-black">+</span>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save */}
            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Team cost
                  </p>

                  <p
                    className={`mt-1 text-xl font-black ${
                      totalPrice > TEAM_BUDGET
                        ? "text-red-500"
                        : "text-foreground"
                    }`}
                  >
                    ${totalPrice}
                    <span className="text-sm font-bold text-muted-foreground">
                      {" "}
                      / ${TEAM_BUDGET}
                    </span>
                  </p>
                </div>

                <p
                  className={`text-xs font-bold ${
                    remainingBudget < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {remainingBudget >= 0
                    ? `$${remainingBudget} remaining`
                    : `$${Math.abs(remainingBudget)} over budget`}
                </p>
              </div>

              {saveDisabled && !saving && !isDayLocked && (
                <div className="mb-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  {selected.length !== 4
                    ? "Select exactly 4 players to save your team."
                    : !captain
                      ? "Choose your captain by clicking one of the selected player's names."
                      : totalPrice > TEAM_BUDGET
                        ? `Your team is over the $${TEAM_BUDGET} budget.`
                        : ""}
                </div>
              )}

              <button
                type="button"
                onClick={save}
                disabled={saveDisabled}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-black text-primary-foreground transition ${
                  totalPrice > TEAM_BUDGET
                    ? "bg-red-500"
                    : "bg-primary hover:opacity-90"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save team
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
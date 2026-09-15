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
  Search,
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

  const [daySelections, setDaySelections] = useState<FantasyDaySelection[]>(
    [],
  );

  const [fantasyId, setFantasyId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [openDayMenu, setOpenDayMenu] = useState(false);

  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<number | null>(
    null,
  );

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

  const totalPoints = useMemo(() => {
    return selected.reduce((total, player) => {
      return total + 0;
    }, 0);
  }, [selected]);

  const selectedPlayerIDs = useMemo(() => {
    return new Set(selected.map((player) => player.id));
  }, [selected]);

  const participatingTeamIDs = useMemo(() => {
    if (!selectedDay) {
      return [];
    }

    return getParticipatingTeamIDs(selectedDay);
  }, [selectedDay]);

  const participatingTeams = useMemo(() => {
    if (participatingTeamIDs.length === 0) {
      return allTeams;
    }

    return allTeams.filter((team) =>
      participatingTeamIDs.includes(team.id),
    );
  }, [allTeams, participatingTeamIDs]);

  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();

    return players
      .filter((player) => {
        const matchesSearch =
          !query || player.nickname.toLowerCase().includes(query);

        const matchesTeam =
          selectedTeamFilter === null ||
          player.team_id === selectedTeamFilter;

        return matchesSearch && matchesTeam;
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
      const [daysResponse, teamsResponse, fantasyResponse] = await Promise.all(
        [
          api.days(),
          api.teams(),
          api.myFantasyTeam().catch(() => null),
        ],
      );

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
    setPlayerSearch("");
    setSelectedTeamFilter(null);

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
        `You cannot select ${player.nickname}. Your budget would be ${newTotal}/${TEAM_BUDGET}.`,
      );
      return;
    }

    setSelected((current) => [...current, player]);
    setMessage("");
  }

  function selectCaptain(player: Player) {
    if (isDayLocked || saving) {
      return;
    }

    if (!selectedPlayerIDs.has(player.id)) {
      setMessage("Select this player first, then click their name to make them captain.");
      return;
    }

    setCaptain(player.id);
    setMessage("");
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
      setMessage(
        `You need exactly 4 players to save. You currently have ${selected.length}/4.`,
      );
      return;
    }

    if (!captain) {
      setMessage(
        "You need to choose a captain. Click the name of one of your selected players.",
      );
      return;
    }

    if (totalPrice > TEAM_BUDGET) {
      setMessage(
        `Your team is over budget: ${totalPrice}/${TEAM_BUDGET}. Remove a player before saving.`,
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

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  const budgetIsValid = totalPrice <= TEAM_BUDGET;
  const squadIsComplete = selected.length === 4;
  const captainIsSelected = captain !== null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HEADER */}
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
                100-credit budget, then click a selected player's name to make
                them captain.
              </p>
            </div>

            {/* DAY SELECTOR */}
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

        {/* LOCKED DAY */}
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

        {/* MESSAGE */}
        {message && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            {message}
          </div>
        )}

        {/* TOP STATS */}
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          {/* BUDGET */}
          <div
            className={`rounded-2xl border bg-card p-5 transition ${
              budgetIsValid
                ? "border-emerald-500/30"
                : "border-red-500/40 bg-red-500/5"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Budget
                </p>

                <p
                  className={`mt-1 text-3xl font-black ${
                    budgetIsValid ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {totalPrice}
                  <span className="text-base font-bold text-muted-foreground">
                    {" "}
                    / {TEAM_BUDGET}
                  </span>
                </p>
              </div>

              <div
                className={`rounded-xl p-2 ${
                  budgetIsValid
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-red-500/10 text-red-500"
                }`}
              >
                <Shield className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetIsValid ? "bg-emerald-500" : "bg-red-500"
                }`}
                style={{ width: `${budgetPercentage}%` }}
              />
            </div>

            <p
              className={`mt-2 text-xs font-semibold ${
                budgetIsValid ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {budgetIsValid
                ? `${remainingBudget} credits remaining`
                : `${Math.abs(remainingBudget)} credits over budget`}
            </p>
          </div>

          {/* POINTS */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Points
                </p>

                <p className="mt-1 text-3xl font-black">
                  {totalPoints}
                </p>
              </div>

              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Current fantasy points for this squad.
            </p>
          </div>

          {/* SQUAD */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Squad
                </p>

                <p className="mt-1 text-3xl font-black">
                  {selected.length}
                  <span className="text-base font-bold text-muted-foreground">
                    {" "}
                    / 4
                  </span>
                </p>
              </div>

              <div
                className={`rounded-xl p-2 ${
                  squadIsComplete
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Users className="h-5 w-5" />
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              {squadIsComplete
                ? captainIsSelected
                  ? "Squad complete and captain selected."
                  : "Squad complete — choose your captain."
                : `${4 - selected.length} player${
                    4 - selected.length === 1 ? "" : "s"
                  } still needed.`}
            </p>
          </div>
        </section>

        {/* BUILDER */}
        <div className="grid gap-6 lg:grid-cols-[32%_1fr]">
          {/* LEFT FILTER SIDEBAR */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-5">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-black">Find players</h2>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Search players or filter by team.
                </p>
              </div>

              {/* SEARCH */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  type="text"
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  placeholder="Search player..."
                  disabled={isDayLocked || loadingDay}
                  className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                />

                {playerSearch && (
                  <button
                    type="button"
                    onClick={() => setPlayerSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* TEAM FILTER */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Select by team
                  </p>

                  <button
                    type="button"
                    onClick={() => setSelectedTeamFilter(null)}
                    className={`text-[10px] font-bold uppercase tracking-wider transition ${
                      selectedTeamFilter === null
                        ? "text-primary"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    All
                  </button>
                </div>

                <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
                  {participatingTeams.map((team) => {
                    const teamSelectedPlayers = selected.filter(
                      (player) => player.team_id === team.id,
                    ).length;

                    const active = selectedTeamFilter === team.id;

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() =>
                          setSelectedTeamFilter((current) =>
                            current === team.id ? null : team.id,
                          )
                        }
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                          <img
                            src={getTeamLogo(team.id)}
                            alt={team.name}
                            className="h-6 w-6 object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-xs font-bold ${
                              active ? "text-primary" : ""
                            }`}
                          >
                            {team.name}
                          </p>

                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            {teamSelectedPlayers > 0
                              ? `${teamSelectedPlayers} selected`
                              : "No player selected"}
                          </p>
                        </div>

                        {teamSelectedPlayers > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-primary-foreground">
                            {teamSelectedPlayers}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SELECTED SQUAD */}
              <div className="mt-6 border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Your squad
                  </p>

                  <span className="text-xs font-black text-primary">
                    {selected.length}/4
                  </span>
                </div>

                <div className="space-y-2">
                  {[0, 1, 2, 3].map((index) => {
                    const player = selected[index];

                    if (!player) {
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2.5"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground">
                            <Plus className="h-3.5 w-3.5" />
                          </div>

                          <span className="text-xs font-semibold text-muted-foreground">
                            Empty slot
                          </span>
                        </div>
                      );
                    }

                    const isCaptain = captain === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                          isCaptain
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/20"
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                          <img
                            src={getTeamLogo(player.team_id)}
                            alt={getTeamName(player.team_id)}
                            className="h-5 w-5 object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold">
                            {player.nickname}
                          </p>

                          <p className="text-[9px] uppercase text-muted-foreground">
                            {player.price} CR
                          </p>
                        </div>

                        {isCaptain && (
                          <Crown className="h-4 w-4 shrink-0 text-primary" />
                        )}

                        {!isDayLocked && (
                          <button
                            type="button"
                            onClick={() => removePlayer(player.id)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                  Click a selected player's <strong>name</strong> on the right
                  to make them captain.
                </p>
              </div>

              {/* SAVE */}
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
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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

              {/* SAVE REQUIREMENTS */}
              {!isDayLocked && (
                <div className="mt-4 space-y-1.5">
                  <div
                    className={`flex items-center gap-2 text-[10px] font-semibold ${
                      squadIsComplete
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    Exactly 4 players
                  </div>

                  <div
                    className={`flex items-center gap-2 text-[10px] font-semibold ${
                      budgetIsValid
                        ? "text-emerald-500"
                        : "text-red-500"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    Within 100-credit budget
                  </div>

                  <div
                    className={`flex items-center gap-2 text-[10px] font-semibold ${
                      captainIsSelected
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    Captain selected
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* PLAYER LIST */}
          <section className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Players</h2>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Click a player to select them. Click their name to make them
                  captain.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedTeamFilter !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedTeamFilter(null)}
                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary"
                  >
                    {getTeamName(selectedTeamFilter)}
                  </button>
                )}

                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold">
                  {filteredPlayers.length} player
                  {filteredPlayers.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {loadingDay ? (
              <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-border bg-card">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
                <Search className="h-8 w-8 text-muted-foreground" />

                <p className="mt-3 text-sm font-bold">
                  No players found
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Try another search or team filter.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPlayers.map((player) => {
                  const selectedPlayer = selectedPlayerIDs.has(player.id);
                  const isCaptain = captain === player.id;

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
                    <div
                      key={player.id}
                      role="button"
                      tabIndex={disabled ? -1 : 0}
                      onClick={() => {
                        if (!disabled) {
                          togglePlayer(player);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          !disabled &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          togglePlayer(player);
                        }
                      }}
                      className={`group relative overflow-hidden rounded-2xl border bg-card text-left transition ${
                        selectedPlayer
                          ? "border-primary shadow-sm shadow-primary/10"
                          : disabled
                            ? "cursor-not-allowed opacity-45"
                            : "border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                      }`}
                    >
                      {/* SELECTED INDICATOR */}
                      {selectedPlayer && (
                        <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
                      )}

                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          {/* TEAM LOGO */}
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted ${
                              selectedPlayer
                                ? "border-primary/30"
                                : "border-border"
                            }`}
                          >
                            <img
                              src={getTeamLogo(player.team_id)}
                              alt={getTeamName(player.team_id)}
                              className="h-9 w-9 object-contain"
                            />
                          </div>

                          {/* PLAYER INFO */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={!selectedPlayer || isDayLocked || saving}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectCaptain(player);
                                }}
                                className={`truncate text-left text-sm font-black transition ${
                                  isCaptain
                                    ? "text-primary"
                                    : selectedPlayer
                                      ? "cursor-pointer hover:text-primary"
                                      : "cursor-default"
                                }`}
                                title={
                                  selectedPlayer
                                    ? "Click to make captain"
                                    : "Select this player first"
                                }
                              >
                                {player.nickname}
                              </button>

                              {isCaptain && (
                                <Crown className="h-4 w-4 shrink-0 text-primary" />
                              )}
                            </div>

                            <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {getTeamName(player.team_id)}
                            </p>
                          </div>

                          {/* PRICE */}
                          <div className="shrink-0 text-right">
                            <p
                              className={`text-lg font-black ${
                                selectedPlayer
                                  ? "text-primary"
                                  : "text-foreground"
                              }`}
                            >
                              {player.price}
                            </p>

                            <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                              Credits
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {selectedPlayer ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                                  isCaptain
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {isCaptain ? (
                                  <>
                                    <Crown className="h-3 w-3" />
                                    Captain
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3 w-3" />
                                    Selected
                                  </>
                                )}
                              </span>
                            ) : sameTeam ? (
                              <span className="text-[9px] font-semibold text-muted-foreground">
                                Another player from this team is selected
                              </span>
                            ) : wouldExceedBudget ? (
                              <span className="text-[9px] font-semibold text-red-500">
                                Over budget
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-muted-foreground">
                                Click card to select
                              </span>
                            )}
                          </div>

                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                              selectedPlayer
                                ? "border-primary bg-primary text-primary-foreground"
                                : disabled
                                  ? "border-border bg-muted"
                                  : "border-border bg-background group-hover:border-primary group-hover:text-primary"
                            }`}
                          >
                            {selectedPlayer ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
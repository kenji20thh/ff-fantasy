"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Crown,
  Edit3,
  Loader2,
  Lock,
  Save,
  Shield,
  Trophy,
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
  username?: string;
  day_id?: number;
  player_ids?: number[];
  captain_player_id?: number | null;
  days?: FantasyDaySelection[];
};

type RoomScore = {
  room_id: number;
  room_number: number;
  kills: number;
  assists: number;
  first_blood: number;
  placement: number;
  placement_points: number;
  total_points: number;
};

type PlayerScore = {
  player_id: number;
  nickname: string;
  team_id: number;
  points: number;
  rooms?: RoomScore[];
};

type FantasyDayScore = {
  day_id: number;
  points: number;
  players?: PlayerScore[];
};

type FantasyPointsResponse = {
  total_points?: number;
  days?: FantasyDayScore[];
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

export default function FantasyTeamPage() {
  const params = useParams();
  const fantasyID = Number(params.id);

  const { user } = useAuth();

  const [fantasyTeam, setFantasyTeam] = useState<FantasyTeamResponse | null>(
    null,
  );

  const [points, setPoints] = useState<FantasyPointsResponse | null>(null);
  const [days, setDays] = useState<TournamentDay[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [selectedDay, setSelectedDay] = useState<TournamentDay | null>(null);
  const [dayPlayers, setDayPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player[]>([]);
  const [captain, setCaptain] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openDayMenu, setOpenDayMenu] = useState(false);

  const isOwner = !!user && !!fantasyTeam && user.id === fantasyTeam.user_id;

  const selectedDayLocked = useMemo(() => {
    if (!selectedDay?.deadline_at) {
      return false;
    }

    return new Date(selectedDay.deadline_at).getTime() <= Date.now();
  }, [selectedDay]);

  const canEdit = isOwner && !selectedDayLocked;

  const totalPrice = useMemo(() => {
    return selected.reduce((total, player) => total + player.price, 0);
  }, [selected]);

  const remainingBudget = TEAM_BUDGET - totalPrice;

  const budgetPercentage = Math.min(
    100,
    Math.max(0, (totalPrice / TEAM_BUDGET) * 100),
  );

  const selectedPlayerIDs = useMemo(() => {
    return new Set(selected.map((player) => player.id));
  }, [selected]);

  const selectedDayPoints = useMemo(() => {
    if (!points || !selectedDay) {
      return 0;
    }

    return (
      points.days?.find((day) => day.day_id === selectedDay.id)?.points ?? 0
    );
  }, [points, selectedDay]);

  const totalPoints = points?.total_points ?? 0;

  const ownerName =
    fantasyTeam?.username ??
    (isOwner ? user?.username : undefined) ??
    "Fantasy Manager";

  function getTeamName(teamID: number) {
    return teams.find((team) => team.id === teamID)?.name ?? "Unknown Team";
  }

  function getTeamLogo(teamID: number) {
    return `/logos/${teamID}.png`;
  }

  function getDaySelection(dayID: number) {
    return fantasyTeam?.days?.find((day) => day.day_id === dayID);
  }

  function getPlayerScore(playerID: number) {
    const dayScore = points?.days?.find(
      (day) => day.day_id === selectedDay?.id,
    );

    return dayScore?.players?.find((player) => player.player_id === playerID);
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

  async function loadDay(day: TournamentDay) {
    setLoadingDay(true);
    setMessage("");

    try {
      const participatingTeamIDs = getParticipatingTeamIDs(day);

      const dayTeams =
        participatingTeamIDs.length > 0
          ? teams.filter((team) => participatingTeamIDs.includes(team.id))
          : teams;

      const responses = await Promise.all(
        dayTeams.map((team) => api.players(team.id)),
      );

      const players = responses.flatMap((response) =>
        asArray<Player>(response),
      );

      const uniquePlayers = Array.from(
        new Map(players.map((player) => [player.id, player])).values(),
      );

      setDayPlayers(uniquePlayers);

      const selection = getDaySelection(day.id);

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
    } catch (err) {
      setMessage(errorMessage(err));
      setDayPlayers([]);
      setSelected([]);
      setCaptain(null);
    } finally {
      setLoadingDay(false);
    }
  }

  async function loadInitialData() {
    setLoading(true);
    setError("");

    try {
      const [fantasyResponse, pointsResponse, daysResponse, teamsResponse] =
        await Promise.all([
          api.fantasy(fantasyID),
          api.fantasyPoints(fantasyID),
          api.days(),
          api.teams(),
        ]);

      const fantasy = fantasyResponse as FantasyTeamResponse;

      if (!fantasy) {
        throw new Error("Fantasy team not found.");
      }

      const loadedDays =
        asArray<TournamentDay>(daysResponse).sort(sortDaysByWeekDay);

      const loadedTeams = asArray<Team>(teamsResponse);

      setFantasyTeam(fantasy);
      setPoints(pointsResponse as FantasyPointsResponse);
      setDays(loadedDays);
      setTeams(loadedTeams);

      if (loadedDays.length > 0) {
        const firstUnlocked =
          loadedDays.find(
            (day) =>
              !day.deadline_at ||
              new Date(day.deadline_at).getTime() > Date.now(),
          ) ?? loadedDays[loadedDays.length - 1];

        setSelectedDay(firstUnlocked);

        const participatingTeamIDs = getParticipatingTeamIDs(firstUnlocked);

        const dayTeams =
          participatingTeamIDs.length > 0
            ? loadedTeams.filter((team) =>
                participatingTeamIDs.includes(team.id),
              )
            : loadedTeams;

        const responses = await Promise.all(
          dayTeams.map((team) => api.players(team.id)),
        );

        const loadedPlayers = responses.flatMap((response) =>
          asArray<Player>(response),
        );

        const uniquePlayers = Array.from(
          new Map(loadedPlayers.map((player) => [player.id, player])).values(),
        );

        setDayPlayers(uniquePlayers);

        const selection = fantasy.days?.find(
          (item) => item.day_id === firstUnlocked.id,
        );

        if (selection) {
          setSelected(
            uniquePlayers.filter((player) =>
              selection.player_ids.includes(player.id),
            ),
          );

          setCaptain(selection.captain_player_id ?? null);
        } else {
          setSelected([]);
          setCaptain(null);
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!fantasyID || Number.isNaN(fantasyID)) {
      setError("Invalid fantasy team.");
      setLoading(false);
      return;
    }

    loadInitialData();
  }, [fantasyID]);

  async function changeDay(day: TournamentDay) {
    if (day.id === selectedDay?.id) {
      setOpenDayMenu(false);
      return;
    }

    setSelectedDay(day);
    setOpenDayMenu(false);

    await loadDay(day);
  }

  function togglePlayer(player: Player) {
    if (!canEdit || saving) {
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

    const sameTeam = selected.some(
      (selectedPlayer) => selectedPlayer.team_id === player.team_id,
    );

    if (sameTeam) {
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

  function removePlayer(playerID: number) {
    if (!canEdit) {
      return;
    }

    setSelected((current) =>
      current.filter((player) => player.id !== playerID),
    );

    if (captain === playerID) {
      setCaptain(null);
    }
  }

  async function saveDay() {
    if (!fantasyTeam || !selectedDay) {
      return;
    }

    if (!canEdit) {
      setMessage("This day cannot be edited.");
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
      await api.selectPlayers(fantasyTeam.id, {
        day_id: selectedDay.id,
        player_ids: selected.map((player) => player.id),
      });

      await api.captain(fantasyTeam.id, selectedDay.id, captain);

      const updatedSelection: FantasyDaySelection = {
        id:
          fantasyTeam.days?.find((day) => day.day_id === selectedDay.id)?.id ??
          0,
        day_id: selectedDay.id,
        day_name: selectedDay.name,
        player_ids: selected.map((player) => player.id),
        captain_player_id: captain,
      };

      setFantasyTeam((current) => {
        if (!current) {
          return current;
        }

        const currentDays = current.days ?? [];

        const exists = currentDays.some((day) => day.day_id === selectedDay.id);

        return {
          ...current,
          days: exists
            ? currentDays.map((day) =>
                day.day_id === selectedDay.id ? updatedSelection : day,
              )
            : [...currentDays, updatedSelection],
        };
      });

      setMessage("Fantasy team saved successfully.");
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  if (error || !fantasyTeam) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6 text-center">
          <div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>

            <h1 className="mt-5 text-2xl font-black">Fantasy team not found</h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {error || "This fantasy team does not exist."}
            </p>

            <Link
              href="/fantasy-team/builder"
              className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            >
              Create your fantasy team
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                <Shield className="h-4 w-4" />
                Fantasy Team
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                {ownerName}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>Fantasy Team #{fantasyTeam.id}</span>

                <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />

                <span className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-primary" />
                  {totalPoints} total points
                </span>

                {!isOwner && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                    <span>View only</span>
                  </>
                )}
              </div>
            </div>

            {isOwner && (
              <Link
                href="/fantasy-team/builder"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold transition hover:border-primary/50"
              >
                <Edit3 className="h-4 w-4" />
                Fantasy builder
              </Link>
            )}
          </div>
        </section>

        <section className="mb-6">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDayMenu((value) => !value)}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {selectedDayLocked ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <Users className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Selected tournament day
                  </p>

                  <p className="mt-1 font-black">
                    {selectedDay?.name ?? "Select day"}
                  </p>

                  {selectedDay?.deadline_at && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Deadline: {formatDeadline(selectedDay)}
                    </p>
                  )}
                </div>
              </div>

              <ChevronDown
                className={`h-5 w-5 transition ${
                  openDayMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            {openDayMenu && (
              <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-2xl">
                {days.map((day) => {
                  const locked =
                    !!day.deadline_at &&
                    new Date(day.deadline_at).getTime() <= Date.now();

                  const daySelection = getDaySelection(day.id);

                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => changeDay(day)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                        selectedDay?.id === day.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold">{day.name}</p>

                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {locked && <span>Locked</span>}
                          {!locked && <span>Open</span>}

                          {daySelection && (
                            <>
                              <span>•</span>
                              <span>
                                {daySelection.player_ids.length}/4 selected
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {locked ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {selectedDayLocked ? (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <Lock className="h-4 w-4 text-muted-foreground" />

            <div>
              <p className="text-sm font-bold">Day locked</p>
              <p className="text-xs text-muted-foreground">
                This tournament day has passed its deadline.
              </p>
            </div>
          </div>
        ) : isOwner ? (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Edit3 className="h-4 w-4 text-primary" />

            <div>
              <p className="text-sm font-bold text-primary">
                You can edit this day
              </p>
              <p className="text-xs text-muted-foreground">
                Your changes will be locked when the deadline passes.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <Shield className="h-4 w-4 text-muted-foreground" />

            <div>
              <p className="text-sm font-bold">
                Viewing another manager&apos;s team
              </p>
              <p className="text-xs text-muted-foreground">
                This fantasy team is publicly viewable and cannot be edited.
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
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {selectedDay?.name}
                </p>

                <h2 className="mt-1 text-2xl font-black">Fantasy squad</h2>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Day points
                </p>

                <p className="text-2xl font-black text-primary">
                  {selectedDayPoints}
                </p>
              </div>
            </div>

            {loadingDay ? (
              <div className="flex min-h-[350px] items-center justify-center rounded-2xl border border-border bg-card">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((index) => {
                    const player = selected[index];

                    if (!player) {
                      return (
                        <div
                          key={index}
                          className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20"
                        >
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Empty slot
                          </span>
                        </div>
                      );
                    }

                    const isCaptain = captain === player.id;
                    const playerScore = getPlayerScore(player.id);

                    return (
                      <div
                        key={player.id}
                        className={`relative overflow-hidden rounded-2xl border p-5 ${
                          isCaptain
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/10"
                        }`}
                      >
                        {isCaptain && (
                          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[8px] font-black uppercase tracking-wider text-primary-foreground">
                            <Crown className="h-3 w-3" />
                            Captain
                          </div>
                        )}

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removePlayer(player.id)}
                            className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-red-500 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}

                        <div className="flex flex-col items-center text-center">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                            <img
                              src={getTeamLogo(player.team_id)}
                              alt={getTeamName(player.team_id)}
                              className="h-11 w-11 object-contain"
                            />
                          </div>

                          <h3 className="mt-4 text-lg font-black">
                            {player.nickname}
                          </h3>

                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {getTeamName(player.team_id)}
                          </p>

                          <div className="mt-4 flex items-center gap-4">
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                Price
                              </p>

                              <p className="mt-1 font-black">
                                {player.price} CR
                              </p>
                            </div>

                            <div className="h-8 w-px bg-border" />

                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                Points
                              </p>

                              <p className="mt-1 font-black text-primary">
                                {playerScore?.points ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {canEdit && selected.length === 4 && (
                  <div className="mt-6 border-t border-border pt-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />

                      <div>
                        <h3 className="text-sm font-bold">Captain selection</h3>

                        <p className="text-[11px] text-muted-foreground">
                          Select the player who should receive the captain
                          multiplier.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {selected.map((player) => {
                        const active = captain === player.id;

                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => setCaptain(player.id)}
                            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                              active
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
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

                            {active && (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={saveDay}
                    disabled={
                      saving ||
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
                        <Save className="h-4 w-4" />
                        Save changes
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Day budget
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

              <p className="mt-3 text-[10px] text-muted-foreground">
                Budget is calculated separately for each tournament day.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">Performance</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Day points
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {selectedDayPoints}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total points
                  </p>

                  <p className="mt-1 text-2xl font-black">{totalPoints}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {canEdit && (
          <section className="mt-8">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-black">Edit players</h2>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Players are sorted by price. You need four different teams and
                must stay within the 100-credit budget.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {loadingDay ? (
                <div className="flex min-h-[250px] items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {[...dayPlayers]
                    .sort((a, b) => {
                      if (b.price !== a.price) {
                        return b.price - a.price;
                      }

                      return a.nickname.localeCompare(b.nickname);
                    })
                    .map((player) => {
                      const selectedPlayer = selectedPlayerIDs.has(player.id);

                      const sameTeam = selected.some(
                        (item) => item.team_id === player.team_id,
                      );

                      const wouldExceedBudget =
                        totalPrice + player.price > TEAM_BUDGET;

                      const disabled =
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
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                            selectedPlayer
                              ? "bg-primary/10"
                              : disabled
                                ? "cursor-not-allowed opacity-45"
                                : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
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

                          <span className="text-sm font-black">
                            {player.price}{" "}
                            <span className="text-[9px] text-muted-foreground">
                              CR
                            </span>
                          </span>

                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                              selectedPlayer
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border"
                            }`}
                          >
                            {selectedPlayer ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Users className="h-3.5 w-3.5" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Match performance
            </p>

            <h2 className="mt-1 text-2xl font-black">Room scores</h2>
          </div>

          {selected.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No players selected for this day.
            </div>
          ) : (
            <div className="space-y-4">
              {selected.map((player) => {
                const playerScore = getPlayerScore(player.id);

                return (
                  <div
                    key={player.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                        <img
                          src={getTeamLogo(player.team_id)}
                          alt={getTeamName(player.team_id)}
                          className="h-6 w-6 object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">
                          {player.nickname}
                        </p>

                        <p className="text-[9px] uppercase text-muted-foreground">
                          {getTeamName(player.team_id)}
                        </p>
                      </div>

                      {captain === player.id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black uppercase text-primary">
                          <Crown className="h-3 w-3" />
                          Captain
                        </span>
                      )}

                      <span className="text-lg font-black text-primary">
                        {playerScore?.points ?? 0}
                      </span>
                    </div>

                    {playerScore?.rooms && playerScore.rooms.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] text-left text-xs">
                          <thead className="border-b border-border bg-muted/30">
                            <tr>
                              <th className="px-4 py-3 font-bold text-muted-foreground">
                                Room
                              </th>
                              <th className="px-4 py-3 font-bold text-muted-foreground">
                                Kills
                              </th>
                              <th className="px-4 py-3 font-bold text-muted-foreground">
                                Assists
                              </th>
                              <th className="px-4 py-3 font-bold text-muted-foreground">
                                First Blood
                              </th>
                              <th className="px-4 py-3 font-bold text-muted-foreground">
                                Placement
                              </th>
                              <th className="px-4 py-3 font-bold text-muted-foreground">
                                Points
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-border">
                            {playerScore.rooms.map((room) => (
                              <tr key={room.room_id}>
                                <td className="px-4 py-3 font-bold">
                                  Room {room.room_number}
                                </td>

                                <td className="px-4 py-3">{room.kills}</td>

                                <td className="px-4 py-3">{room.assists}</td>

                                <td className="px-4 py-3">
                                  {room.first_blood}
                                </td>

                                <td className="px-4 py-3">{room.placement}</td>

                                <td className="px-4 py-3 font-black text-primary">
                                  {room.total_points}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-4 py-5 text-xs text-muted-foreground">
                        No room score data available yet.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

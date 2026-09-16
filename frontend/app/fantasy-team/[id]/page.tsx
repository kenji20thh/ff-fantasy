"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  Check,
  ChevronDown,
  Crown,
  Loader2,
  Lock,
  Search,
  Shield,
  Users,
  X,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { asArray, errorMessage } from "@/lib/utils";
import type {
  Player,
  Team,
  TournamentDay,
} from "@/lib/types";

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
  kills: number;
  assists: number;
  first_blood: boolean;
  placement: number;
  points: number;
};

type PlayerScore = {
  player_id: number;
  nickname?: string;
  team_id?: number;
  captain?: boolean;
  rooms?: RoomScore[];
  total_points: number;
};

type FantasyDayScore = {
  day_id: number;
  day_name?: string;
  captain_player_id?: number | null;
  total_points: number;
  players?: PlayerScore[];
};

type FantasyPointsResponse = {
  fantasy_team_id?: string | number;
  total_points?: number;
  days?: FantasyDayScore[];
  players?: PlayerScore[];
};

function getParticipatingTeamIDs(
  day: TournamentDay,
): number[] {
  if (!day.teams || day.teams.length === 0) {
    return [];
  }

  if (typeof day.teams[0] === "number") {
    return day.teams as number[];
  }

  return (day.teams as Team[]).map(
    (team) => team.id,
  );
}

function getPhaseNumber(name?: string) {
  const match = name?.match(/week\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function getDayNumber(name?: string) {
  const match = name?.match(/day\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function sortDaysByWeekDay(
  a: TournamentDay,
  b: TournamentDay,
) {
  const phaseA = getPhaseNumber(a.name);
  const phaseB = getPhaseNumber(b.name);

  if (phaseA !== phaseB) {
    return phaseA - phaseB;
  }

  return (
    getDayNumber(a.name) -
    getDayNumber(b.name)
  );
}

export default function FantasyTeamBuilderPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const { user } = useAuth();

  /*
   * /fantasy-team/builder
   *     => params.id is "builder" only if this component
   *        is also being used by the dynamic route.
   *
   * /fantasy-team/[id]
   *     => params.id is the fantasy team ID.
   */
  const routeId =
    typeof params?.id === "string"
      ? params.id
      : null;

  const viewedFantasyId =
    routeId &&
    routeId !== "builder" &&
    /^\d+$/.test(routeId)
      ? Number(routeId)
      : null;

  const isBuilderRoute =
    routeId === "builder" ||
    routeId === null;

  const [days, setDays] =
    useState<TournamentDay[]>([]);

  const [allTeams, setAllTeams] =
    useState<Team[]>([]);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [selectedDay, setSelectedDay] =
    useState<TournamentDay | null>(null);

  const [selected, setSelected] =
    useState<Player[]>([]);

  const [captain, setCaptain] =
    useState<number | null>(null);

  const [daySelections, setDaySelections] =
    useState<FantasyDaySelection[]>([]);

  const [fantasyId, setFantasyId] =
    useState<number | null>(null);

  const [fantasyTeam, setFantasyTeam] =
    useState<FantasyTeamResponse | null>(
      null,
    );

  const [points, setPoints] =
    useState<FantasyPointsResponse | null>(
      null,
    );

  const [playerSearch, setPlayerSearch] =
    useState("");

  const [selectedTeamFilter, setSelectedTeamFilter] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [loadingDay, setLoadingDay] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [openDayMenu, setOpenDayMenu] =
    useState(false);

  const [countdown, setCountdown] =
    useState("00:00:00:00");

  /*
   * Existing fantasy team belongs to another user.
   */
  const isPublicView =
    viewedFantasyId !== null &&
    fantasyTeam !== null &&
    (!user ||
      fantasyTeam.user_id !== user.id);

  /*
   * Existing fantasy team belongs to current user.
   */
  const isEditMode =
    viewedFantasyId !== null &&
    fantasyTeam !== null &&
    !!user &&
    fantasyTeam.user_id === user.id;

  /*
   * Only builder and owner can edit.
   */
  const canUseBuilder =
    isBuilderRoute || isEditMode;

  const isDayLocked = useMemo(() => {
    if (!selectedDay?.deadline_at) {
      return false;
    }

    return (
      new Date(
        selectedDay.deadline_at,
      ).getTime() <= Date.now()
    );
  }, [selectedDay]);

  const canEdit =
    canUseBuilder && !isDayLocked;

  /* -------------------------------------------------------
     LIVE COUNTDOWN
  ------------------------------------------------------- */
  useEffect(() => {
    if (!selectedDay?.deadline_at) {
      setCountdown("00:00:00:00");
      return;
    }

    const updateCountdown = () => {
      const remaining =
        new Date(
          selectedDay.deadline_at,
        ).getTime() -
        Date.now();

      if (remaining <= 0) {
        setCountdown("00:00:00:00");
        return;
      }

      const totalSeconds =
        Math.floor(remaining / 1000);

      const days =
        Math.floor(totalSeconds / 86400);

      const hours =
        Math.floor(
          (totalSeconds % 86400) / 3600,
        );

      const minutes =
        Math.floor(
          (totalSeconds % 3600) / 60,
        );

      const seconds =
        totalSeconds % 60;

      const pad = (value: number) =>
        String(value).padStart(2, "0");

      setCountdown(
        `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
      );
    };

    updateCountdown();

    const interval = window.setInterval(
      updateCountdown,
      1000,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [selectedDay]);

  /* -------------------------------------------------------
     BUDGET
  ------------------------------------------------------- */
  const totalPrice = useMemo(() => {
    return selected.reduce(
      (total, player) =>
        total + player.price,
      0,
    );
  }, [selected]);

  const remainingBudget =
    TEAM_BUDGET - totalPrice;

  const isOverBudget =
    totalPrice > TEAM_BUDGET;

  const selectedPlayerIDs = useMemo(
    () =>
      new Set(
        selected.map(
          (player) => player.id,
        ),
      ),
    [selected],
  );

  /* -------------------------------------------------------
     POINTS
  ------------------------------------------------------- */
  const selectedDayPoints = useMemo(() => {
    if (!selectedDay) {
      return 0;
    }

    return (
      points?.days?.find(
        (day) =>
          day.day_id ===
          selectedDay.id,
      )?.total_points ?? 0
    );
  }, [points, selectedDay]);

  function getPlayerScore(
    playerID: number,
  ) {
    const dayScore =
      points?.days?.find(
        (day) =>
          day.day_id ===
          selectedDay?.id,
      );

    return dayScore?.players?.find(
      (player) =>
        player.player_id ===
        playerID,
    );
  }

  function getPlayerPoints(
    playerID: number,
  ) {
    return (
      getPlayerScore(playerID)
        ?.total_points ?? 0
    );
  }

  /* -------------------------------------------------------
     PARTICIPATING TEAMS
  ------------------------------------------------------- */
  const participatingTeams = useMemo(() => {
    if (!selectedDay) {
      return [];
    }

    const ids =
      getParticipatingTeamIDs(
        selectedDay,
      );

    if (ids.length === 0) {
      return allTeams;
    }

    return allTeams.filter((team) =>
      ids.includes(team.id),
    );
  }, [
    selectedDay,
    allTeams,
  ]);

  /* -------------------------------------------------------
     FILTERED PLAYERS
  ------------------------------------------------------- */
  const filteredPlayers = useMemo(() => {
    const query =
      playerSearch.trim().toLowerCase();

    return [...players]
      .filter((player) => {
        if (
          selectedTeamFilter !== null &&
          player.team_id !==
            selectedTeamFilter
        ) {
          return false;
        }

        if (
          query &&
          !player.nickname
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (b.price !== a.price) {
          return b.price - a.price;
        }

        return a.nickname.localeCompare(
          b.nickname,
        );
      });
  }, [
    players,
    playerSearch,
    selectedTeamFilter,
  ]);

  function getTeamName(
    teamID: number,
  ) {
    return (
      allTeams.find(
        (team) =>
          team.id === teamID,
      )?.name ?? "Unknown Team"
    );
  }

  function getTeamLogo(
    teamID: number,
  ) {
    return `/logos/${teamID}.png`;
  }

  function formatDeadline(
    day: TournamentDay,
  ) {
    if (!day.deadline_at) {
      return null;
    }

    return new Date(
      day.deadline_at,
    ).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* -------------------------------------------------------
     LOAD PLAYERS FOR A DAY
  ------------------------------------------------------- */
  async function loadDay(
    day: TournamentDay,
    team?: FantasyTeamResponse | null,
    availableTeams = allTeams,
  ) {
    setLoadingDay(true);
    setMessage("");

    /*
     * Only reset these in builder/edit mode.
     * Public view doesn't have filters/search anyway.
     */
    if (canUseBuilder) {
      setPlayerSearch("");
      setSelectedTeamFilter(null);
    }

    try {
      const participatingTeamIDs =
        getParticipatingTeamIDs(day);

      const dayTeams =
        participatingTeamIDs.length > 0
          ? availableTeams.filter(
              (availableTeam) =>
                participatingTeamIDs.includes(
                  availableTeam.id,
                ),
            )
          : availableTeams;

      const responses =
        await Promise.all(
          dayTeams.map((availableTeam) =>
            api.players(
              availableTeam.id,
            ),
          ),
        );

      const dayPlayers =
        responses.flatMap(
          (response) =>
            asArray<Player>(
              response,
            ),
        );

      const uniquePlayers =
        Array.from(
          new Map(
            dayPlayers.map(
              (player) => [
                player.id,
                player,
              ],
            ),
          ).values(),
        );

      uniquePlayers.sort((a, b) => {
        if (b.price !== a.price) {
          return b.price - a.price;
        }

        return a.nickname.localeCompare(
          b.nickname,
        );
      });

      setPlayers(
        uniquePlayers,
      );

      /*
       * Restore the fantasy team's selection
       * for this particular day.
       */
      const selection =
        team?.days?.find(
          (item) =>
            item.day_id === day.id,
        );

      if (selection) {
        const restoredPlayers =
          uniquePlayers.filter(
            (player) =>
              selection.player_ids.includes(
                player.id,
              ),
          );

        setSelected(
          restoredPlayers,
        );

        setCaptain(
          selection.captain_player_id ??
            null,
        );
      } else {
        setSelected([]);
        setCaptain(null);
      }
    } catch (error) {
      setMessage(
        errorMessage(error),
      );

      setPlayers([]);
      setSelected([]);
      setCaptain(null);
    } finally {
      setLoadingDay(false);
    }
  }

  /* -------------------------------------------------------
     INITIAL LOAD
  ------------------------------------------------------- */
  async function loadInitialData() {
    setLoading(true);
    setMessage("");

    try {
      const [
        daysResponse,
        teamsResponse,
      ] = await Promise.all([
        api.days(),
        api.teams(),
      ]);

      const loadedDays =
        asArray<TournamentDay>(
          daysResponse,
        ).sort(
          sortDaysByWeekDay,
        );

      const loadedTeams =
        asArray<Team>(
          teamsResponse,
        );

      setDays(
        loadedDays,
      );

      setAllTeams(
        loadedTeams,
      );

      /*
       * =====================================================
       * EXISTING TEAM ROUTE
       *
       * /fantasy-team/[id]
       * =====================================================
       */
      if (viewedFantasyId !== null) {
        const fantasyResponse =
          await api.fantasy(
            viewedFantasyId,
          );

        const loadedFantasy =
          fantasyResponse as FantasyTeamResponse;

        setFantasyTeam(
          loadedFantasy,
        );

        setFantasyId(
          loadedFantasy.id,
        );

        setDaySelections(
          loadedFantasy.days ??
            [],
        );

        /*
         * Load calculated points.
         */
        try {
          const pointsResponse =
            await api.fantasyPoints(
              loadedFantasy.id,
            );

          setPoints(
            pointsResponse as FantasyPointsResponse,
          );
        } catch {
          setPoints(null);
        }

        if (
          loadedDays.length ===
          0
        ) {
          return;
        }

        /*
         * For an existing team, prefer the first day
         * that this fantasy team actually has a selection for.
         *
         * This makes /fantasy-team/[id] immediately show
         * the user's actual team instead of an empty day.
         */
        const firstSelectedDay =
          loadedDays.find(
            (day) =>
              loadedFantasy.days?.some(
                (selection) =>
                  selection.day_id ===
                  day.id,
              ) ?? false,
          );

        const firstUnlocked =
          loadedDays.find(
            (day) =>
              !day.deadline_at ||
              new Date(
                day.deadline_at,
              ).getTime() >
                Date.now(),
          ) ??
          loadedDays[
            loadedDays.length - 1
          ];

        const initialDay =
          firstSelectedDay ??
          firstUnlocked;

        setSelectedDay(
          initialDay,
        );

        await loadDay(
          initialDay,
          loadedFantasy,
          loadedTeams,
        );

        return;
      }

      /*
       * =====================================================
       * BUILDER ROUTE
       *
       * /fantasy-team/builder
       * =====================================================
       */
      const myFantasyResponse =
        await api.myFantasyTeam().catch(
          () => null,
        );

      const myFantasy =
        myFantasyResponse as
          | FantasyTeamResponse
          | null;

      /*
       * Normally builder is for first creation.
       * If the user somehow already has a team,
       * keep its data available.
       */
      if (myFantasy?.id) {
        setFantasyTeam(
          myFantasy,
        );

        setFantasyId(
          myFantasy.id,
        );

        setDaySelections(
          myFantasy.days ??
            [],
        );

        try {
          const pointsResponse =
            await api.fantasyPoints(
              myFantasy.id,
            );

          setPoints(
            pointsResponse as FantasyPointsResponse,
          );
        } catch {
          setPoints(null);
        }
      }

      if (
        loadedDays.length ===
        0
      ) {
        return;
      }

      const firstUnlocked =
        loadedDays.find(
          (day) =>
            !day.deadline_at ||
            new Date(
              day.deadline_at,
            ).getTime() >
              Date.now(),
        ) ??
        loadedDays[
          loadedDays.length - 1
        ];

      setSelectedDay(
        firstUnlocked,
      );

      await loadDay(
        firstUnlocked,
        myFantasy,
        loadedTeams,
      );
    } catch (error) {
      setMessage(
        errorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();

    // The route ID is intentionally the only dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedFantasyId]);

  /* -------------------------------------------------------
     CHANGE DAY
  ------------------------------------------------------- */
  async function changeDay(
    day: TournamentDay,
  ) {
    if (
      day.id ===
      selectedDay?.id
    ) {
      setOpenDayMenu(false);
      return;
    }

    setSelectedDay(day);
    setOpenDayMenu(false);

    await loadDay(
      day,
      fantasyTeam,
      allTeams,
    );
  }

  /* -------------------------------------------------------
     SELECT PLAYER
  ------------------------------------------------------- */
  function selectPlayer(
    player: Player,
  ) {
    if (
      !canEdit ||
      saving
    ) {
      return;
    }

    const alreadySelected =
      selectedPlayerIDs.has(
        player.id,
      );

    if (alreadySelected) {
      setSelected(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              player.id,
          ),
      );

      if (
        captain ===
        player.id
      ) {
        setCaptain(null);
      }

      setMessage("");
      return;
    }

    if (
      selected.length >=
      4
    ) {
      setMessage(
        "You can only select 4 players.",
      );
      return;
    }

    const sameTeam =
      selected.some(
        (item) =>
          item.team_id ===
          player.team_id,
      );

    if (sameTeam) {
      setMessage(
        "You must select players from 4 different teams.",
      );
      return;
    }

    const newTotal =
      totalPrice +
      player.price;

    if (
      newTotal >
      TEAM_BUDGET
    ) {
      setMessage(
        `You cannot select ${player.nickname}. Your budget would be $${newTotal}/$${TEAM_BUDGET}.`,
      );
      return;
    }

    setSelected(
      (current) => [
        ...current,
        player,
      ],
    );

    setMessage("");
  }

  /* -------------------------------------------------------
     REMOVE PLAYER
  ------------------------------------------------------- */
  function removePlayer(
    playerID: number,
  ) {
    if (
      !canEdit ||
      saving
    ) {
      return;
    }

    setSelected(
      (current) =>
        current.filter(
          (player) =>
            player.id !==
            playerID,
        ),
    );

    if (
      captain ===
      playerID
    ) {
      setCaptain(null);
    }

    setMessage("");
  }

  /* -------------------------------------------------------
     CAPTAIN
  ------------------------------------------------------- */
  function chooseCaptain(
    playerID: number,
  ) {
    if (
      !canEdit ||
      saving
    ) {
      return;
    }

    if (
      !selectedPlayerIDs.has(
        playerID,
      )
    ) {
      return;
    }

    setCaptain(
      (current) =>
        current === playerID
          ? null
          : playerID,
    );

    setMessage("");
  }

  /* -------------------------------------------------------
     SAVE
  ------------------------------------------------------- */
  async function save() {
    if (!user) {
      router.push(
        "/login",
      );
      return;
    }

    if (!selectedDay) {
      setMessage(
        "Please select a tournament day.",
      );
      return;
    }

    if (isDayLocked) {
      setMessage(
        "This day is already locked.",
      );
      return;
    }

    if (
      selected.length !==
      4
    ) {
      setMessage(
        "You must select exactly 4 players.",
      );
      return;
    }

    if (!captain) {
      setMessage(
        "Please choose a captain.",
      );
      return;
    }

    if (
      totalPrice >
      TEAM_BUDGET
    ) {
      setMessage(
        `Your team is over budget: $${totalPrice}/$${TEAM_BUDGET}.`,
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let currentFantasyId =
        fantasyId;

      if (!currentFantasyId) {
        const created =
          await api.createFantasy(
            user.id,
          );

        const createdTeam =
          created as FantasyTeamResponse;

        currentFantasyId =
          createdTeam.id;

        setFantasyId(
          createdTeam.id,
        );
      }

      await api.selectPlayers(
        currentFantasyId,
        {
          day_id:
            selectedDay.id,
          player_ids:
            selected.map(
              (player) =>
                player.id,
            ),
        },
      );

      await api.captain(
        currentFantasyId,
        selectedDay.id,
        captain,
      );

      try {
        const pointsResponse =
          await api.fantasyPoints(
            currentFantasyId,
          );

        setPoints(
          pointsResponse as FantasyPointsResponse,
        );
      } catch {
        setPoints(null);
      }

      const updatedSelection:
        FantasyDaySelection = {
        id:
          daySelections.find(
            (selection) =>
              selection.day_id ===
              selectedDay.id,
          )?.id ?? 0,

        day_id:
          selectedDay.id,

        day_name:
          selectedDay.name,

        player_ids:
          selected.map(
            (player) =>
              player.id,
          ),

        captain_player_id:
          captain,
      };

      setDaySelections(
        (current) => {
          const exists =
            current.some(
              (selection) =>
                selection.day_id ===
                selectedDay.id,
            );

          if (exists) {
            return current.map(
              (selection) =>
                selection.day_id ===
                selectedDay.id
                  ? updatedSelection
                  : selection,
            );
          }

          return [
            ...current,
            updatedSelection,
          ];
        },
      );

      router.push(
        `/fantasy-team/${currentFantasyId}`,
      );
    } catch (error) {
      setMessage(
        errorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------------------------------------
     LOADING
  ------------------------------------------------------- */
  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  /* =======================================================
     PUBLIC READ-ONLY VIEW
     ======================================================= */
  if (isPublicView) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-8">

          {/* HEADER */}
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <Shield className="h-4 w-4" />
              Fantasy Team
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {fantasyTeam?.username ??
                "Fantasy Team"}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {selectedDay?.name ??
                "Tournament day"}
            </p>
          </section>

          {/* DAY SELECTOR */}
          {days.length > 0 && (
            <section className="mb-6">
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDayMenu(
                      (value) => !value,
                    )
                  }
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-left transition hover:border-primary/50 sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Tournament day
                      </p>

                      <p className="mt-1 truncate text-base font-black sm:text-lg">
                        {selectedDay?.name ??
                          "Select day"}
                      </p>
                    </div>
                  </div>

                  <ChevronDown
                    className={`ml-auto h-5 w-5 shrink-0 transition ${
                      openDayMenu
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                {openDayMenu && (
                  <div className="absolute right-0 z-40 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-2xl">
                    {days.map(
                      (day) => {
                        const hasSelection =
                          fantasyTeam?.days?.some(
                            (selection) =>
                              selection.day_id ===
                              day.id,
                          );

                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() =>
                              changeDay(
                                day,
                              )
                            }
                            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                              selectedDay?.id ===
                              day.id
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted"
                            }`}
                          >
                            <div>
                              <p className="text-sm font-bold">
                                {day.name}
                              </p>

                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {hasSelection
                                  ? "Team selected"
                                  : "No selection"}
                              </p>
                            </div>

                            {hasSelection && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* LOCKED */}
          {isDayLocked && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <Lock className="h-4 w-4 text-muted-foreground" />

              <div>
                <p className="text-sm font-bold">
                  This day is locked
                </p>

                <p className="text-xs text-muted-foreground">
                  Fantasy selections for this day
                  are locked.
                </p>
              </div>
            </div>
          )}

          {/* TEAM */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-8">

            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Selected players
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {fantasyTeam?.username ??
                    "Fantasy Team"}
                </h2>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Points
                </p>

                <p className="mt-1 text-2xl font-black text-primary">
                  {selectedDayPoints}
                  <span className="ml-1 text-xs font-bold text-muted-foreground">
                    pts
                  </span>
                </p>
              </div>
            </div>

            {loadingDay ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : selected.length ===
              0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-4 text-sm font-bold">
                  No players selected
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  This user has not selected a team
                  for this day.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {selected.map(
                  (player) => {
                    const isCaptain =
                      captain ===
                      player.id;

                    return (
                      <div
                        key={player.id}
                        className={`flex min-h-[190px] flex-col items-center justify-center rounded-2xl border p-5 text-center ${
                          isCaptain
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/10"
                        }`}
                      >
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                          <img
                            src={getTeamLogo(
                              player.team_id,
                            )}
                            alt={getTeamName(
                              player.team_id,
                            )}
                            className="h-11 w-11 object-contain"
                          />
                        </div>

                        <p
                          className={`mt-3 max-w-full truncate text-base font-black ${
                            isCaptain
                              ? "text-primary"
                              : ""
                          }`}
                        >
                          {player.nickname}
                        </p>

                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {getTeamName(
                            player.team_id,
                          )}
                        </p>

                        <p className="mt-2 text-sm font-black text-primary">
                          {getPlayerPoints(
                            player.id,
                          )}{" "}
                          pts
                        </p>

                        {isCaptain && (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-primary-foreground">
                            <Crown className="h-3 w-3" />
                            Captain
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  /* =======================================================
     BUILDER / OWNER EDIT VIEW
     ======================================================= */
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">

        {/* HEADER */}
        <section className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                <Shield className="h-4 w-4" />
                Fantasy Manager
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                {isEditMode
                  ? "Edit your fantasy team"
                  : "Build your fantasy team"}
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                Select 4 players from 4 different teams
                and choose your captain.
              </p>
            </div>
          </div>
        </section>

        {/* DAY */}
        <section className="mb-6">
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenDayMenu(
                  (value) => !value,
                )
              }
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-left transition hover:border-primary/50 sm:px-6"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {isDayLocked ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <Users className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Tournament day
                  </p>

                  <p className="mt-1 truncate text-base font-black sm:text-lg">
                    {selectedDay?.name ??
                      "Select day"}
                  </p>
                </div>
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 text-center">
                <p
                  className={`font-mono text-2xl font-black tracking-wider sm:text-3xl lg:text-4xl ${
                    isDayLocked
                      ? "text-red-500"
                      : "text-primary"
                  }`}
                >
                  {countdown}
                </p>
              </div>

              <ChevronDown
                className={`ml-auto h-5 w-5 shrink-0 transition ${
                  openDayMenu
                    ? "rotate-180"
                    : ""
                }`}
              />
            </button>

            {openDayMenu && (
              <div className="absolute right-0 z-40 mt-2 w-full min-w-[280px] overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-2xl">
                {days.map(
                  (day) => {
                    const locked =
                      !!day.deadline_at &&
                      new Date(
                        day.deadline_at,
                      ).getTime() <=
                        Date.now();

                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() =>
                          changeDay(
                            day,
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                          selectedDay?.id ===
                          day.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-bold">
                            {day.name}
                          </p>

                          {day.deadline_at && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {locked
                                ? "Locked"
                                : "Open"}{" "}
                              ·{" "}
                              {formatDeadline(
                                day,
                              )}
                            </p>
                          )}
                        </div>

                        {locked && (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </section>

        {/* LOCK */}
        {isDayLocked && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <Lock className="h-4 w-4 text-muted-foreground" />

            <div>
              <p className="text-sm font-bold">
                This day is locked
              </p>

              <p className="text-xs text-muted-foreground">
                The deadline has passed. Your selection
                can no longer be changed.
              </p>
            </div>
          </div>
        )}

        {/* BUDGET + POINTS */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div
              className={`p-5 text-center sm:p-6 ${
                isOverBudget
                  ? "bg-red-500/5"
                  : ""
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Budget
              </p>

              <p
                className={`mt-2 text-3xl font-black sm:text-4xl ${
                  isOverBudget
                    ? "text-red-500"
                    : ""
                }`}
              >
                ${totalPrice}

                <span className="text-base font-bold text-muted-foreground">
                  {" "}
                  / ${TEAM_BUDGET}
                </span>
              </p>

              <p
                className={`mt-2 text-xs font-bold ${
                  isOverBudget
                    ? "text-red-500"
                    : "text-muted-foreground"
                }`}
              >
                {isOverBudget
                  ? `$${Math.abs(
                      remainingBudget,
                    )} over budget`
                  : `$${remainingBudget} remaining`}
              </p>
            </div>

            <div className="p-5 text-center sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Points
              </p>

              <p className="mt-2 text-3xl font-black text-primary sm:text-4xl">
                {selectedDayPoints}

                <span className="ml-1 text-base font-bold text-muted-foreground">
                  pts
                </span>
              </p>

              <p className="mt-2 text-xs text-muted-foreground">
                {selectedDay?.name ??
                  "Selected day"}
              </p>
            </div>
          </div>
        </section>

        {/* MESSAGE */}
        {message && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
            {message}
          </div>
        )}

        {/* MAIN BUILDER */}
        <section className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[320px_1fr]">

          {/* LEFT */}
          <aside className="border-b border-border p-5 lg:border-b-0 lg:border-r">

            {/* SEARCH */}
            <div className="mb-5">
              <div className="mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />

                <h2 className="text-sm font-black uppercase tracking-wide">
                  Search players
                </h2>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  type="text"
                  value={playerSearch}
                  onChange={(event) =>
                    setPlayerSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Player name..."
                  className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
            </div>

            {/* TEAM FILTER */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Select by team
                </p>

                {selectedTeamFilter !==
                  null && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTeamFilter(
                        null,
                      )
                    }
                    className="text-[10px] font-bold uppercase text-primary"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTeamFilter(
                      null,
                    )
                  }
                  title="All teams"
                  className={`flex h-12 items-center justify-center rounded-xl border transition ${
                    selectedTeamFilter ===
                    null
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <Users className="h-5 w-5 text-primary" />
                </button>

                {participatingTeams.map(
                  (team) => {
                    const active =
                      selectedTeamFilter ===
                      team.id;

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() =>
                          setSelectedTeamFilter(
                            active
                              ? null
                              : team.id,
                          )
                        }
                        title={team.name}
                        className={`flex h-12 items-center justify-center rounded-xl border bg-background transition ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <img
                          src={getTeamLogo(
                            team.id,
                          )}
                          alt={team.name}
                          className="h-8 w-8 object-contain"
                        />
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* PLAYER LIST */}
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Players
                </p>

                <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-black">
                  {selected.length}/4
                </span>
              </div>

              {loadingDay ? (
                <div className="flex min-h-[450px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredPlayers.length ===
                0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No players found.
                </div>
              ) : (
                <div className="max-h-[650px] space-y-1.5 overflow-y-auto pr-1">
                  {filteredPlayers.map(
                    (player) => {
                      const isSelected =
                        selectedPlayerIDs.has(
                          player.id,
                        );

                      const sameTeam =
                        selected.some(
                          (item) =>
                            item.team_id ===
                            player.team_id,
                        );

                      const wouldExceedBudget =
                        totalPrice +
                          player.price >
                        TEAM_BUDGET;

                      const blocked =
                        !isSelected &&
                        (selected.length >=
                          4 ||
                          sameTeam ||
                          wouldExceedBudget);

                      return (
                        <button
                          key={player.id}
                          type="button"
                          disabled={
                            !canEdit ||
                            saving ||
                            blocked
                          }
                          onClick={() =>
                            selectPlayer(
                              player,
                            )
                          }
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                            isSelected
                              ? "border-primary bg-primary/10"
                              : !canEdit ||
                                  blocked
                                ? "cursor-not-allowed opacity-40"
                                : "border-transparent hover:border-border hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                            <img
                              src={getTeamLogo(
                                player.team_id,
                              )}
                              alt={getTeamName(
                                player.team_id,
                              )}
                              className="h-6 w-6 object-contain"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black">
                              {player.nickname}
                            </p>

                            <p className="truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {getTeamName(
                                player.team_id,
                              )}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xs font-black">
                              ${player.price}
                            </p>

                            <p className="text-[9px] font-bold text-primary">
                              {getPlayerPoints(
                                player.id,
                              )}{" "}
                              pts
                            </p>
                          </div>

                          {isSelected && (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* MIDDLE */}
          <div className="p-5 sm:p-8">
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {selectedDay?.name}
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Selected players
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Click anywhere inside a selected
                player&apos;s box to make them
                captain.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map(
                (index) => {
                  const player =
                    selected[index];

                  if (!player) {
                    return (
                      <div
                        key={index}
                        className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10"
                      >
                        <div className="text-center">
                          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border">
                            <Users className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Empty slot
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const isCaptain =
                    captain ===
                    player.id;

                  return (
                    <div
                      key={player.id}
                      className="relative min-h-[180px]"
                    >
                      <button
                        type="button"
                        disabled={
                          !canEdit ||
                          saving
                        }
                        onClick={() =>
                          chooseCaptain(
                            player.id,
                          )
                        }
                        className={`flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border p-5 text-center transition ${
                          isCaptain
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/10 hover:border-primary/50"
                        }`}
                      >
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                          <img
                            src={getTeamLogo(
                              player.team_id,
                            )}
                            alt={getTeamName(
                              player.team_id,
                            )}
                            className="h-10 w-10 object-contain"
                          />
                        </div>

                        <p
                          className={`mt-3 max-w-full truncate text-base font-black ${
                            isCaptain
                              ? "text-primary"
                              : ""
                          }`}
                        >
                          {player.nickname}
                        </p>

                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {getTeamName(
                            player.team_id,
                          )}
                        </p>

                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-sm font-black">
                            ${player.price}
                          </span>

                          <span className="text-sm font-black text-primary">
                            {getPlayerPoints(
                              player.id,
                            )}{" "}
                            pts
                          </span>
                        </div>

                        {isCaptain && (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-primary-foreground">
                            <Crown className="h-3 w-3" />
                            Captain
                          </div>
                        )}
                      </button>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation();

                            removePlayer(
                              player.id,
                            );
                          }}
                          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-red-500/40 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                },
              )}
            </div>

            {/* SAVE */}
            <div className="mt-6 border-t border-border pt-6">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Budget
                  </p>

                  <p
                    className={`mt-1 text-xl font-black ${
                      isOverBudget
                        ? "text-red-500"
                        : ""
                    }`}
                  >
                    ${totalPrice}

                    <span className="text-xs font-bold text-muted-foreground">
                      {" "}
                      / ${TEAM_BUDGET}
                    </span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Remaining
                  </p>

                  <p
                    className={`mt-1 text-xl font-black ${
                      remainingBudget <
                      0
                        ? "text-red-500"
                        : "text-primary"
                    }`}
                  >
                    $
                    {Math.abs(
                      remainingBudget,
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={save}
                disabled={
                  saving ||
                  isDayLocked ||
                  selected.length !==
                    4 ||
                  !captain ||
                  isOverBudget
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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

              {selected.length !==
                4 &&
                !isDayLocked && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Select exactly 4 players.
                  </p>
                )}

              {selected.length ===
                4 &&
                !captain &&
                !isDayLocked && (
                  <p className="mt-3 text-center text-xs font-bold text-red-500">
                    Click anywhere on a player&apos;s
                    box to choose your captain.
                  </p>
                )}

              {isOverBudget && (
                <p className="mt-3 text-center text-xs font-bold text-red-500">
                  Your team is over the $
                  {TEAM_BUDGET} budget.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
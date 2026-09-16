"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { asArray, errorMessage } from "@/lib/types";

import type { PlacementTeam, TournamentDay, Room } from "@/lib/types";

type Phase = "league" | "rush" | "grand-final";
type ResultView = "day" | "room";

function weekNumber(name: string) {
  const match = name.match(/week\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function dayNumber(name: string) {
  const match = name.match(/day\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function isRushPoint(day: TournamentDay) {
  return /point\s*rush|rush\s*point/i.test(day.name);
}

function isGrandFinal(day: TournamentDay) {
  return /grand\s*final/i.test(day.name);
}

function isLeagueDay(day: TournamentDay) {
  return /^week\s*\d+\s+day\s*\d+/i.test(day.name);
}

function sortLeagueDays(days: TournamentDay[]) {
  return [...days].sort((a, b) => {
    const weekA = weekNumber(a.name);
    const weekB = weekNumber(b.name);

    if (weekA !== weekB) {
      return weekA - weekB;
    }

    return dayNumber(a.name) - dayNumber(b.name);
  });
}

export default function PlacementPage() {
  const [phase, setPhase] = useState<Phase>("league");

  const [days, setDays] = useState<TournamentDay[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);

  const [resultView, setResultView] = useState<ResultView>("day");

  const [placement, setPlacement] = useState<PlacementTeam[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingPlacement, setLoadingPlacement] = useState(true);
  const [error, setError] = useState("");

  /*
   * Load all tournament days.
   */
  useEffect(() => {
    async function loadDays() {
      try {
        setLoadingDays(true);
        setError("");

        const data = await api.days();
        const list = asArray<TournamentDay>(data);

        setDays(list);

        const leagueDays = sortLeagueDays(
          list.filter((day) => isLeagueDay(day)),
        );

        if (leagueDays.length > 0) {
          setSelectedWeek(weekNumber(leagueDays[0].name));
          setSelectedDay(leagueDays[0].id);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoadingDays(false);
      }
    }

    loadDays();
  }, []);

  /*
   * League weeks.
   */
  const leagueWeeks = useMemo(() => {
    const weeks = days
      .filter((day) => isLeagueDay(day))
      .map((day) => weekNumber(day.name))
      .filter((week) => week > 0);

    return [...new Set(weeks)].sort((a, b) => a - b);
  }, [days]);

  /*
   * League days for selected week.
   */
  const leagueDays = useMemo(() => {
    return sortLeagueDays(
      days.filter(
        (day) =>
          isLeagueDay(day) && weekNumber(day.name) === selectedWeek,
      ),
    );
  }, [days, selectedWeek]);

  /*
   * Rush Point day.
   */
  const rushDay = useMemo(() => {
    return days.find((day) => isRushPoint(day)) ?? null;
  }, [days]);

  /*
   * Grand Final day.
   */
  const grandFinalDay = useMemo(() => {
    return days.find((day) => isGrandFinal(day)) ?? null;
  }, [days]);

  /*
   * Current selected day.
   */
  const currentDay = useMemo(() => {
    if (selectedDay === null) {
      return null;
    }

    return days.find((day) => day.id === selectedDay) ?? null;
  }, [days, selectedDay]);

  /*
   * Load rooms whenever the selected day changes.
   */
  useEffect(() => {
    async function loadRooms() {
      if (selectedDay === null) {
        setRooms([]);
        return;
      }

      try {
        setLoadingRooms(true);
        setError("");

        const data = await api.rooms(selectedDay);
        setRooms(asArray<Room>(data));
      } catch (err) {
        setError(errorMessage(err));
        setRooms([]);
      } finally {
        setLoadingRooms(false);
      }
    }

    loadRooms();
  }, [selectedDay]);

  /*
   * Load placement.
   */
  useEffect(() => {
    async function loadPlacement() {
      setLoadingPlacement(true);
      setError("");

      try {
        let data: unknown;

        if (resultView === "room" && selectedRoom !== null) {
          data = await api.placementRoom(selectedRoom);
        } else if (selectedDay !== null) {
          data = await api.placementDay(selectedDay);
        } else {
          setPlacement([]);
          return;
        }

        setPlacement(asArray<PlacementTeam>(data));
      } catch (err) {
        setError(errorMessage(err));
        setPlacement([]);
      } finally {
        setLoadingPlacement(false);
      }
    }

    loadPlacement();
  }, [selectedDay, selectedRoom, resultView]);

  /*
   * Select League Phase.
   */
  function selectLeague() {
    setPhase("league");
    setResultView("day");
    setSelectedRoom(null);

    const firstDay =
      leagueDays[0] ??
      sortLeagueDays(days.filter((day) => isLeagueDay(day)))[0];

    if (firstDay) {
      setSelectedWeek(weekNumber(firstDay.name));
      setSelectedDay(firstDay.id);
    }
  }

  /*
   * Select Rush Point.
   */
  function selectRush() {
    setPhase("rush");
    setResultView("day");
    setSelectedRoom(null);

    if (rushDay) {
      setSelectedDay(rushDay.id);
    }
  }

  /*
   * Select Grand Final.
   */
  function selectGrandFinal() {
    setPhase("grand-final");
    setResultView("day");
    setSelectedRoom(null);

    if (grandFinalDay) {
      setSelectedDay(grandFinalDay.id);
    }
  }

  /*
   * Select a week.
   */
  function selectWeek(week: number) {
    setSelectedWeek(week);
    setResultView("day");
    setSelectedRoom(null);

    const firstDay = sortLeagueDays(
      days.filter(
        (day) =>
          isLeagueDay(day) && weekNumber(day.name) === week,
      ),
    )[0];

    if (firstDay) {
      setSelectedDay(firstDay.id);
    }
  }

  /*
   * Select a day.
   */
  function selectDay(day: TournamentDay) {
    setSelectedDay(day.id);
    setSelectedRoom(null);
    setResultView("day");
  }

  /*
   * Select a room.
   */
  function selectRoom(roomId: number) {
    setSelectedRoom(roomId);
    setResultView("room");
  }

  const gridCols =
    "grid-cols-[55px_1fr_120px_90px_120px_100px_90px]";

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Placement
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Tournament standings and match results
          </p>
        </div>

        {/* Phase selector */}
        <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* League */}
          <button
            onClick={selectLeague}
            className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${
              phase === "league"
                ? "border-white bg-white text-black"
                : "border-zinc-800 bg-zinc-950 text-white hover:border-zinc-600 hover:bg-zinc-900"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    phase === "league"
                      ? "text-zinc-600"
                      : "text-zinc-500"
                  }`}
                >
                  Phase 1
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  League Phase
                </h2>

                <p
                  className={`mt-2 text-sm ${
                    phase === "league"
                      ? "text-zinc-600"
                      : "text-zinc-500"
                  }`}
                >
                  3 weeks · 9 days · 54 rooms
                </p>
              </div>

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                  phase === "league"
                    ? "bg-black text-white"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                01
              </div>
            </div>
          </button>

          {/* Rush Point */}
          <button
            onClick={selectRush}
            disabled={!rushDay}
            className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${
              phase === "rush"
                ? "border-white bg-white text-black"
                : "border-zinc-800 bg-zinc-950 text-white hover:border-zinc-600 hover:bg-zinc-900"
            } ${!rushDay ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    phase === "rush"
                      ? "text-zinc-600"
                      : "text-zinc-500"
                  }`}
                >
                  Phase 2
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  Rush Point
                </h2>

                <p
                  className={`mt-2 text-sm ${
                    phase === "rush"
                      ? "text-zinc-600"
                      : "text-zinc-500"
                  }`}
                >
                  {rushDay ? "Special phase" : "Coming soon"}
                </p>
              </div>

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                  phase === "rush"
                    ? "bg-black text-white"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                02
              </div>
            </div>
          </button>

          {/* Grand Final */}
          <button
            onClick={selectGrandFinal}
            disabled={!grandFinalDay}
            className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition ${
              phase === "grand-final"
                ? "border-white bg-white text-black"
                : "border-zinc-800 bg-zinc-950 text-white hover:border-zinc-600 hover:bg-zinc-900"
            } ${!grandFinalDay ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    phase === "grand-final"
                      ? "text-zinc-600"
                      : "text-zinc-500"
                  }`}
                >
                  Phase 3
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  Grand Final
                </h2>

                <p
                  className={`mt-2 text-sm ${
                    phase === "grand-final"
                      ? "text-zinc-600"
                      : "text-zinc-500"
                  }`}
                >
                  {grandFinalDay ? "8 rooms" : "Coming soon"}
                </p>
              </div>

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                  phase === "grand-final"
                    ? "bg-black text-white"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                03
              </div>
            </div>
          </button>
        </div>

        {/* Loading days */}
        {loadingDays ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
            Loading tournament...
          </div>
        ) : (
          <>
            {/* ===================== */}
            {/* LEAGUE PHASE */}
            {/* ===================== */}
            {phase === "league" && (
              <div className="mb-8">
                {/* Week selector */}
                <div className="mb-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">League Phase</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        Select a week and match day
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {leagueWeeks.map((week) => (
                      <button
                        key={week}
                        onClick={() => selectWeek(week)}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          selectedWeek === week
                            ? "border-white bg-white text-black"
                            : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-white"
                        }`}
                      >
                        Week {week}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Days */}
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Week {selectedWeek} · Match Days
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {leagueDays.map((day) => (
                      <button
                        key={day.id}
                        onClick={() => selectDay(day)}
                        className={`rounded-xl border p-4 text-left transition ${
                          selectedDay === day.id
                            ? "border-white bg-zinc-100 text-black"
                            : "border-zinc-800 bg-zinc-950 hover:border-zinc-600 hover:bg-zinc-900"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={`text-xs font-medium uppercase ${
                                selectedDay === day.id
                                  ? "text-zinc-500"
                                  : "text-zinc-600"
                              }`}
                            >
                              Day {dayNumber(day.name)}
                            </p>

                            <p className="mt-1 font-semibold">
                              {day.name}
                            </p>
                          </div>

                          <div
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                              selectedDay === day.id
                                ? "bg-black text-white"
                                : "bg-zinc-900 text-zinc-500"
                            }`}
                          >
                            6 Rooms
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===================== */}
            {/* RUSH POINT */}
            {/* ===================== */}
            {phase === "rush" && rushDay && (
              <div className="mb-8">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Phase 2
                      </p>

                      <h2 className="mt-1 text-xl font-bold">
                        {rushDay.name}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        Rush Point standings
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
                      Selected
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== */}
            {/* GRAND FINAL */}
            {/* ===================== */}
            {phase === "grand-final" && grandFinalDay && (
              <div className="mb-8">
                <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Phase 3
                      </p>

                      <h2 className="mt-1 text-xl font-bold">
                        Grand Final
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        8 rooms · 12 teams
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300">
                      Final
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== */}
            {/* ROOM NAVIGATION */}
            {/* ===================== */}
            {selectedDay !== null &&
              (phase === "league" || phase === "grand-final") && (
                <div className="mb-8">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {currentDay?.name}
                      </p>

                      <h2 className="mt-1 font-semibold">
                        Match Results
                      </h2>
                    </div>

                    {loadingRooms && (
                      <span className="text-xs text-zinc-600">
                        Loading rooms...
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Day standings */}
                    <button
                      onClick={() => {
                        setResultView("day");
                        setSelectedRoom(null);
                      }}
                      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                        resultView === "day"
                          ? "bg-white text-black"
                          : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-white"
                      }`}
                    >
                      Day Standings
                    </button>

                    {/* Rooms */}
                    {rooms.map((room, index) => (
                      <button
                        key={room.id}
                        onClick={() => selectRoom(room.id)}
                        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                          selectedRoom === room.id &&
                          resultView === "room"
                            ? "bg-white text-black"
                            : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-white"
                        }`}
                      >
                        {room.name ?? `Room ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* Rush Point room navigation if it has rooms */}
            {selectedDay !== null &&
              phase === "rush" &&
              rooms.length > 0 && (
                <div className="mb-8">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {currentDay?.name}
                      </p>

                      <h2 className="mt-1 font-semibold">
                        Match Results
                      </h2>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setResultView("day");
                        setSelectedRoom(null);
                      }}
                      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                        resultView === "day"
                          ? "bg-white text-black"
                          : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-white"
                      }`}
                    >
                      Day Standings
                    </button>

                    {rooms.map((room, index) => (
                      <button
                        key={room.id}
                        onClick={() => selectRoom(room.id)}
                        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                          selectedRoom === room.id &&
                          resultView === "room"
                            ? "bg-white text-black"
                            : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-white"
                        }`}
                      >
                        {room.name ?? `Room ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Current selection */}
        {currentDay && (
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-600">
                {resultView === "room"
                  ? rooms.find((room) => room.id === selectedRoom)?.name ??
                    "Room"
                  : "Standings"}
              </p>

              <h2 className="mt-1 text-lg font-bold">
                {currentDay.name}
              </h2>
            </div>

            {resultView === "room" && (
              <button
                onClick={() => {
                  setResultView("day");
                  setSelectedRoom(null);
                }}
                className="text-sm text-zinc-500 transition hover:text-white"
              >
                ← Back to day
              </button>
            )}
          </div>
        )}

        {/* Placement table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
          <div className="min-w-[850px]">
            {/* Header */}
            <div
              className={`grid ${gridCols} gap-4 border-b border-zinc-800 bg-zinc-900 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400`}
            >
              <div>#</div>
              <div>Team</div>
              <div>Total Points</div>
              <div>Kills</div>
              <div>Placement</div>
              <div>Booyahs</div>
              <div>Rooms</div>
            </div>

            {/* Loading */}
            {loadingPlacement ? (
              <div className="p-10 text-center text-zinc-500">
                Loading standings...
              </div>
            ) : placement.length === 0 ? (
              <div className="p-10 text-center text-zinc-500">
                No placement data available.
              </div>
            ) : (
              placement.map((team, index) => (
                <div
                  key={team.team_id}
                  className={`grid ${gridCols} items-center gap-4 border-b border-zinc-900 px-5 py-4 text-sm last:border-b-0 ${
                    index === 0
                      ? "bg-white/[0.025]"
                      : ""
                  }`}
                >
                  {/* Rank */}
                  <div className="font-bold text-zinc-400">
                    {index + 1}
                  </div>

                  {/* Team */}
                  <div className="flex items-center gap-3 font-semibold">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
                      <img
                        src={`/logos/${team.team_id}.png`}
                        alt={team.team_name}
                        className="h-8 w-8 object-contain"
                      />
                    </div>

                    <span>{team.team_name}</span>
                  </div>

                  {/* Total */}
                  <div className="font-bold">
                    {team.points}
                  </div>

                  {/* Kills */}
                  <div>{team.kills}</div>

                  {/* Placement */}
                  <div>{team.placement_points}</div>

                  {/* Booyahs */}
                  <div className="flex items-center gap-1">
                    {team.booyahs > 0 ? (
                      <>
                        <img
                          src="/booyah.png"
                          alt="Booyah"
                          className="h-12 w-12 object-contain"
                        />

                        <span>x{team.booyahs}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>

                  {/* Rooms */}
                  <div className="text-zinc-400">
                    {team.rooms_played}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
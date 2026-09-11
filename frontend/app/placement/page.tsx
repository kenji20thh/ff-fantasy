"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { asArray, errorMessage } from "@/lib/types";

import type { PlacementTeam, TournamentDay, Room } from "@/lib/types";

type View = "overall" | "week" | "day" | "room";

function weekNumber(weekLabel: string) {
  const match = weekLabel.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function dayNumberFromName(name: string) {
  const match = name.match(/day\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function sortDaysByWeekDay(list: TournamentDay[]) {
  return [...list].sort((a, b) => {
    const weekA = weekNumber(a.name.split(" ")[0]);
    const weekB = weekNumber(b.name.split(" ")[0]);

    if (weekA !== weekB) return weekA - weekB;

    return dayNumberFromName(a.name) - dayNumberFromName(b.name);
  });
}

export default function PlacementPage() {
  const [view, setView] = useState<View>("overall");

  const [days, setDays] = useState<TournamentDay[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);

  const [placement, setPlacement] = useState<PlacementTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDays() {
      try {
        const data = await api.days();
        const list = sortDaysByWeekDay(asArray<TournamentDay>(data));

        setDays(list);

        if (list.length > 0) {
          const firstWeek = list[0].name.split(" ")[0];

          setSelectedWeek(firstWeek);
          setSelectedDay(list[0].id);
        }
      } catch (err) {
        setError(errorMessage(err));
      }
    }

    loadDays();
  }, []);

  useEffect(() => {
    async function loadRooms() {
      if (selectedDay === null) {
        setRooms([]);
        return;
      }

      try {
        const data = await api.rooms(selectedDay);
        setRooms(asArray<Room>(data));
      } catch (err) {
        setError(errorMessage(err));
      }
    }

    loadRooms();
  }, [selectedDay]);

  useEffect(() => {
    async function loadPlacement() {
      setLoading(true);
      setError("");

      try {
        let data: unknown;

        if (view === "overall") {
          data = await api.placementOverall();
        } else if (view === "week") {
          if (!selectedWeek) {
            setLoading(false);
            return;
          }

          data = await api.placementWeek(selectedWeek);
        } else if (view === "day") {
          if (selectedDay === null) {
            setLoading(false);
            return;
          }

          data = await api.placementDay(selectedDay);
        } else {
          if (selectedRoom === null) {
            setLoading(false);
            return;
          }

          data = await api.placementRoom(selectedRoom);
        }

        setPlacement(asArray<PlacementTeam>(data));
      } catch (err) {
        setError(errorMessage(err));
        setPlacement([]);
      } finally {
        setLoading(false);
      }
    }

    loadPlacement();
  }, [view, selectedWeek, selectedDay, selectedRoom]);

  const weeks = useMemo(() => {
    const values = days
      .map((day) => day.name.split(" ")[0])
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) => weekNumber(a) - weekNumber(b));
  }, [days]);

  const filteredDays = useMemo(() => {
    return days
      .filter((day) => day.name.split(" ")[0] === selectedWeek)
      .sort((a, b) => dayNumberFromName(a.name) - dayNumberFromName(b.name));
  }, [days, selectedWeek]);

  function handleWeekChange(value: string) {
    setSelectedWeek(value);

    const firstDay = days
      .filter((day) => day.name.split(" ")[0] === value)
      .sort((a, b) => dayNumberFromName(a.name) - dayNumberFromName(b.name))[0];

    setSelectedDay(firstDay?.id ?? null);
    setSelectedRoom(null);
  }

  function handleDayChange(value: string) {
    const dayId = Number(value);

    setSelectedDay(dayId);
    setSelectedRoom(null);
  }

  function handleRoomChange(value: string) {
    setSelectedRoom(Number(value));
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Placement</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Tournament standings
          </p>
        </div>

        {/* View buttons */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(["overall", "week", "day", "room"] as View[]).map(
            (item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  view === item
                    ? "bg-white text-black"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {item === "overall"
                  ? "Overall"
                  : item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            )
          )}
        </div>

        {/* Week selector */}
        {view === "week" && (
          <div className="mb-6">
            <label className="mb-2 block text-sm text-zinc-400">
              Week
            </label>

            <select
              value={selectedWeek}
              onChange={(e) => handleWeekChange(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none"
            >
              {weeks.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Day selector */}
        {(view === "day" || view === "room") && (
          <div className="mb-6">
            <label className="mb-2 block text-sm text-zinc-400">
              Day
            </label>

            <select
              value={selectedDay ?? ""}
              onChange={(e) => handleDayChange(e.target.value)}
              className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none"
            >
              {filteredDays.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Room selector */}
        {view === "room" && (
          <div className="mb-6">
            <label className="mb-2 block text-sm text-zinc-400">
              Room
            </label>

            <select
              value={selectedRoom ?? ""}
              onChange={(e) => handleRoomChange(e.target.value)}
              className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none"
            >
              <option value="" disabled>
                Select a room
              </option>

              {rooms.map((room, index) => (
                <option key={room.id} value={room.id}>
                  {room.name ?? `Room ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Placement table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
          <div className="min-w-[750px]">
            {/* Table header */}
            <div className="grid grid-cols-[60px_1fr_120px_100px_120px_100px] gap-4 border-b border-zinc-800 bg-zinc-900 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <div>#</div>

              <div>Team</div>

              <div>Total Points</div>

              <div>Kills</div>

              <div>Placement</div>

              <div>Rooms</div>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="p-8 text-center text-zinc-500">
                Loading...
              </div>
            ) : placement.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                No placement data available.
              </div>
            ) : (
              placement.map((team, index) => (
                <div
                  key={team.team_id}
                  className="grid grid-cols-[60px_1fr_120px_100px_120px_100px] items-center gap-4 border-b border-zinc-900 px-5 py-4 text-sm last:border-b-0"
                >
                  {/* Rank */}
                  <div className="font-bold text-zinc-400">
                    {index + 1}
                  </div>

                  {/* Team + Logo */}
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

                  {/* Total Points */}
                  <div className="font-bold">
                    {team.points}
                  </div>

                  {/* Kills */}
                  <div>{team.kills}</div>

                  {/* Placement Points */}
                  <div>{team.placement_points}</div>

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
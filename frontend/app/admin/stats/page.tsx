'use client'

import { useEffect, useState } from 'react'

import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'

import type {
  RoomStats,
  TournamentDay,
  Room,
} from '@/lib/types'

export default function AdminStats() {
  const { user, loading } = useAuth()

  const [days, setDays] = useState<TournamentDay[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [stats, setStats] = useState<RoomStats[]>([])

  const [dayId, setDayId] = useState('')
  const [roomId, setRoomId] = useState('')

  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (user?.role === 'admin') {
      api.days()
        .then(response =>
          setDays(asArray<TournamentDay>(response))
        )
        .catch(error =>
          setMsg(errorMessage(error))
        )
    }
  }, [user])

  useEffect(() => {
    if (!dayId) {
      setRooms([])
      setRoomId('')
      return
    }

    api.rooms(Number(dayId))
      .then(response =>
        setRooms(asArray<Room>(response))
      )
      .catch(error =>
        setMsg(errorMessage(error))
      )
  }, [dayId])

  useEffect(() => {
    if (!roomId) {
      setStats([])
      return
    }

    api.roomStats(Number(roomId))
      .then(response =>
        setStats(asArray<RoomStats>(response))
      )
      .catch(error =>
        setMsg(errorMessage(error))
      )
  }, [roomId])

  if (loading) {
    return (
      <main className="p-8">
        Checking authorization…
      </main>
    )
  }

  if (!user || user.role !== 'admin') {
    return (
      <main className="p-8">
        <h1 className="section-title">
          Access denied.
        </h1>
      </main>
    )
  }

  async function save(stat: RoomStats) {
    try {
      const body = {
        kills: Number(stat.kills),
        assists: Number(stat.assists),
        first_blood: Boolean(stat.first_blood),
        placement: Number(stat.placement),
      }

      await api.admin(
        `/rooms/${roomId}/stats/${stat.player_id}`,
        'PUT',
        body
      )

      setMsg('Room statistics saved successfully.')
    } catch (error) {
      setMsg(errorMessage(error))
    }
  }

  function updateStat(
    index: number,
    changes: Partial<RoomStats>
  ) {
    setStats(current =>
      current.map((stat, i) =>
        i === index
          ? { ...stat, ...changes }
          : stat
      )
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <a href="/admin" className="eyebrow">
        ← Admin
      </a>

      <h1 className="section-title mt-8">
        Room statistics.
      </h1>

      {msg && (
        <p className="mt-6 border border-primary/40 p-4 text-sm">
          {msg}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <select
          value={dayId}
          onChange={event => {
            setDayId(event.target.value)
            setRoomId('')
            setStats([])
            setMsg('')
          }}
          className="border border-border bg-card p-3"
        >
          <option value="">
            Select tournament day
          </option>

          {days.map(day => (
            <option
              key={day.id}
              value={day.id}
            >
              {day.name}
            </option>
          ))}
        </select>

        <select
          value={roomId}
          onChange={event => {
            setRoomId(event.target.value)
            setMsg('')
          }}
          disabled={!dayId}
          className="border border-border bg-card p-3 disabled:opacity-50"
        >
          <option value="">
            Select room
          </option>

          {rooms.map(room => (
            <option
              key={room.id}
              value={room.id}
            >
              Room {room.id}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="p-3">
                Player
              </th>

              <th className="p-3">
                Kills
              </th>

              <th className="p-3">
                Assists
              </th>

              <th className="p-3">
                First Blood
              </th>

              <th className="p-3">
                Placement
              </th>

              <th className="p-3">
                Save
              </th>
            </tr>
          </thead>

          <tbody>
            {stats.map((stat, index) => (
              <tr
                key={stat.player_id}
                className="border-b border-border"
              >
                <td className="p-3 font-mono">
                  {stat.player?.nickname ||
                    `Player ${stat.player_id}`}
                </td>

                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={stat.kills}
                    onChange={event =>
                      updateStat(index, {
                        kills: Number(
                          event.target.value
                        ),
                      })
                    }
                    className="w-20 border border-border bg-background p-2"
                  />
                </td>

                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={stat.assists}
                    onChange={event =>
                      updateStat(index, {
                        assists: Number(
                          event.target.value
                        ),
                      })
                    }
                    className="w-20 border border-border bg-background p-2"
                  />
                </td>

                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={stat.first_blood}
                    onChange={event =>
                      updateStat(index, {
                        first_blood:
                          event.target.checked,
                      })
                    }
                  />
                </td>

                <td className="p-3">
                  <input
                    type="number"
                    min="1"
                    value={stat.placement}
                    onChange={event =>
                      updateStat(index, {
                        placement: Number(
                          event.target.value
                        ),
                      })
                    }
                    className="w-20 border border-border bg-background p-2"
                  />
                </td>

                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => save(stat)}
                    className="bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
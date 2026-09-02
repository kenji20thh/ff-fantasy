"use client"

import Link from "next/link"
import { ArrowRight, BarChart3, Crosshair, Crown, ShieldCheck, Trophy, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { LeaderboardEntry, Team } from "@/lib/types"
import { Card, ErrorBox } from "@/components/ui"

export default function HomePage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<unknown>(null)
  useEffect(() => { Promise.all([api.teams(), api.leaderboard()]).then(([t,l]) => { setTeams(t); setLeaders(l) }).catch(setError) }, [])
  return <main>
    <section className="grid-bg border-b border-white/10"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:py-28">
      <div className="animate-rise"><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#f4d35e]/20 bg-[#f4d35e]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.18em] text-[#f4d35e]"><span className="size-1.5 rounded-full bg-[#f4d35e]" /> Free Fire fantasy</div><h1 className="max-w-4xl font-mono text-5xl font-black leading-[.94] tracking-[-.08em] sm:text-7xl lg:text-8xl">YOUR PICKS.<br /><span className="text-[#f4d35e]">YOUR POINTS.</span></h1><p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">Build a fantasy squad for the tournament. Choose exactly four players from four different teams, choose your captain, and compete on the leaderboard.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#f4d35e] px-5 py-3 font-bold text-[#17130a]">Start drafting <ArrowRight className="size-4" /></Link><Link href="/leaderboard" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-5 py-3 font-semibold text-white">View leaderboard</Link></div></div>
      <Card className="glow relative overflow-hidden p-7"><div className="absolute inset-0 grid-bg opacity-40" /><div className="relative flex min-h-80 flex-col justify-between"><div className="flex items-center justify-between"><span className="font-mono text-xs uppercase tracking-[.2em] text-zinc-500">Draft rules</span><Crosshair className="text-[#f4d35e]" /></div><div><div className="font-mono text-7xl font-black tracking-[-.08em] text-[#f4d35e]">4×4</div><p className="mt-3 max-w-sm text-zinc-400">4 players.<br />4 different real teams.<br />1 captain.</p></div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400"><ShieldCheck className="size-4 text-[#f4d35e]" /> Backend validates every selection</div></div></Card>
    </div></section>
    <section className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:grid-cols-3 lg:px-8"><Stat icon={Users} value={teams.length ? String(teams.length) : "—"} label="Tournament teams" /><Stat icon={Trophy} value={leaders.length ? String(leaders.length) : "—"} label="Fantasy managers" /><Stat icon={BarChart3} value="4" label="Players per squad" /></section>
    <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#f4d35e]">Standings</p><h2 className="mt-2 font-mono text-3xl font-black">Leaderboard</h2></div><Link href="/leaderboard" className="text-sm font-semibold text-zinc-400 hover:text-white">See all →</Link></div><div className="mt-6">{error ? <ErrorBox error={error} /> : <Card>{leaders.length ? leaders.slice(0,5).map((entry, i) => <div key={entry.fantasy_team_id} className="flex items-center gap-4 border-b border-white/10 px-5 py-5 last:border-0"><span className="w-8 font-mono text-sm text-zinc-600">{String(entry.rank ?? i + 1).padStart(2,"0")}</span><span className="flex-1 font-semibold">{entry.username}</span><span className="font-mono font-bold text-[#f4d35e]">{entry.points} pts</span></div>) : <div className="p-10 text-center text-sm text-zinc-500">No fantasy teams have scored points yet.</div>}</Card>}</div></section>
  </main>
}
function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) { return <Card className="p-5"><Icon className="mb-8 size-5 text-[#f4d35e]" /><div className="font-mono text-3xl font-black">{value}</div><div className="mt-1 text-xs uppercase tracking-[.18em] text-zinc-500">{label}</div></Card> }

'use client'

import { useState } from 'react'
import { ArrowUpRight, CalendarDays, ChevronRight, Crosshair, Menu, Trophy, Users, X, Zap } from 'lucide-react'

const teams = [
  { name: 'Flux Esports', tag: 'FLX', color: '#d9ff3f', players: 4 },
  { name: 'Nova Reign', tag: 'NVR', color: '#8b7cff', players: 4 },
  { name: 'Titan Core', tag: 'TCR', color: '#ff6b45', players: 4 },
  { name: 'Vortex 7', tag: 'V7', color: '#56d9ff', players: 4 },
]

const leaderboard = [
  ['01', 'Kairo', 'Flux Esports', '842'],
  ['02', 'Mamba', 'Nova Reign', '817'],
  ['03', 'Rexx', 'Titan Core', '791'],
  ['04', 'Sway', 'Vortex 7', '768'],
]

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [joined, setJoined] = useState(false)
  const [activeTab, setActiveTab] = useState('Leaderboard')

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <nav className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 lg:px-8">
        <a href="#top" className="flex items-center gap-3 font-mono text-sm font-bold tracking-[0.18em]">
          <span className="grid h-8 w-8 place-items-center bg-primary text-primary-foreground"><Crosshair size={17} strokeWidth={2.5} /></span>
          FF<span className="text-primary">/</span>FANTASY
        </a>
        <div className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:flex">
          <a href="#how">How it works</a><a href="#teams">Teams</a><a href="#schedule">Schedule</a><a href="#rankings">Rankings</a>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="border border-border p-2 md:hidden" aria-label="Toggle menu">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
        <button onClick={() => setJoined(true)} className="hidden bg-primary px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-primary-foreground transition hover:bg-primary/85 md:block">{joined ? 'You’re in' : 'Enter the arena'}</button>
      </nav>
      {menuOpen && <div className="mx-5 flex flex-col gap-4 border border-border bg-card p-5 text-xs font-bold uppercase tracking-widest md:hidden"><a href="#how">How it works</a><a href="#teams">Teams</a><a href="#schedule">Schedule</a><a href="#rankings">Rankings</a></div>}

      <section id="top" className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px] rounded-full border border-primary/10 opacity-70" />
        <div className="pointer-events-none absolute right-0 top-24 h-[360px] w-[360px] rounded-full border border-primary/10" />
        <div className="relative max-w-4xl">
          <p className="mb-7 flex items-center gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-primary"><span className="h-px w-8 bg-primary" /> The official fantasy league</p>
          <h1 className="font-mono text-[clamp(3.5rem,10vw,8.5rem)] font-black leading-[0.88] tracking-[-0.08em] text-balance">PLAY<br /><span className="text-primary">SMART.</span><br />WIN LOUD.</h1>
          <div className="mt-10 flex max-w-2xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-sm text-base leading-7 text-muted-foreground">Build your ultimate squad from the best Free Fire players. Read the room, pick your captain, and climb the leaderboard.</p>
            <button onClick={() => setJoined(true)} className="group flex w-fit items-center gap-5 bg-primary px-6 py-4 text-sm font-black uppercase tracking-widest text-primary-foreground">{joined ? 'Team registered' : 'Build your team'} <ArrowUpRight size={19} className="transition group-hover:translate-x-1 group-hover:-translate-y-1" /></button>
          </div>
        </div>
        <div className="mt-16 flex flex-wrap items-center gap-x-12 gap-y-5 border-t border-border pt-5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><span><strong className="text-foreground">16</strong> squads</span><span><strong className="text-foreground">04</strong> match days</span><span><strong className="text-foreground">64</strong> players</span><span className="flex items-center gap-2 text-primary"><i className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Season 01 live</span></div>
      </section>

      <section id="how" className="border-y border-border bg-card/50"><div className="mx-auto grid max-w-[1240px] gap-px bg-border lg:grid-cols-3">{[['01','Pick your players','Choose four players. Every pick must come from a different team.'],['02','Name your captain','Your captain’s points count twice. Choose with conviction.'],['03','Track the action','Watch your squad compete across every tournament room.']].map(([num,title,body]) => <div key={num} className="bg-background p-7 lg:p-10"><span className="font-mono text-xs font-bold text-primary">{num}</span><h2 className="mt-12 font-mono text-xl font-bold uppercase tracking-tight">{title}</h2><p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">{body}</p></div>)}</div></section>

      <section id="teams" className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8"><div className="mb-10 flex items-end justify-between"><div><p className="eyebrow">The contenders</p><h2 className="section-title">Pick your side.</h2></div><a href="#teams" className="hidden items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground sm:flex">All teams <ChevronRight size={15} /></a></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{teams.map((team, index) => <article key={team.tag} className="group relative min-h-56 overflow-hidden border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/50"><span className="font-mono text-xs text-muted-foreground">0{index + 1}</span><div className="absolute right-5 top-5 grid h-12 w-12 place-items-center border border-border font-mono text-xs font-black" style={{ color: team.color }}>{team.tag}</div><div className="absolute bottom-0 left-0 h-1 w-full" style={{ backgroundColor: team.color }} /><h3 className="absolute bottom-9 left-6 max-w-[150px] font-mono text-lg font-bold uppercase leading-tight">{team.name}</h3><p className="absolute bottom-4 left-6 text-[10px] uppercase tracking-widest text-muted-foreground">{team.players} active players</p></article>)}</div></section>

      <section id="schedule" className="bg-primary text-primary-foreground"><div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 lg:grid-cols-[0.7fr_1.3fr] lg:px-8"><div><p className="eyebrow text-primary-foreground/60">The battlefield</p><h2 className="section-title">Every room<br />counts.</h2><p className="mt-6 max-w-xs text-sm leading-6 text-primary-foreground/70">Four match days. Sixteen rooms. One shot at the top.</p></div><div className="divide-y divide-primary-foreground/20 border-y border-primary-foreground/20">{[['DAY 01','Opening fire','SEP 12 · 18:00'],['DAY 02','Pressure point','SEP 13 · 18:00'],['DAY 03','No retreat','SEP 14 · 18:00'],['DAY 04','Final circle','SEP 15 · 20:00']].map(([day,name,time]) => <div key={day} className="flex items-center justify-between gap-4 py-5"><div className="flex items-center gap-5"><CalendarDays size={18} /><div><p className="font-mono text-[10px] tracking-widest opacity-60">{day}</p><h3 className="mt-1 font-mono text-base font-bold uppercase">{name}</h3></div></div><span className="font-mono text-[10px] tracking-widest opacity-60">{time}</span></div>)}</div></div></section>

      <section id="rankings" className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8"><div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Live data</p><h2 className="section-title">The leaderboard.</h2></div><div className="flex border-b border-border">{['Leaderboard','My team'].map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest ${activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>{tab}</button>)}</div></div><div className="border-t border-border">{leaderboard.map(([rank,player,team,points]) => <div key={rank} className="grid grid-cols-[40px_1fr_1fr_70px] items-center gap-3 border-b border-border py-5 sm:grid-cols-[60px_1fr_1fr_100px]"><span className={`font-mono text-sm ${rank === '01' ? 'text-primary' : 'text-muted-foreground'}`}>{rank}</span><span className="font-mono text-sm font-bold uppercase">{player}</span><span className="text-xs text-muted-foreground">{team}</span><span className="text-right font-mono text-sm font-bold">{points}<small className="ml-1 text-[9px] font-normal text-muted-foreground">PTS</small></span></div>)}</div></section>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8"><span className="font-mono text-foreground">FF<span className="text-primary">/</span>FANTASY</span><span>Built for the bold · Season 01</span><span className="flex items-center gap-2"><Zap size={13} className="text-primary" /> Live competition</span></div></footer>
    </main>
  )
}

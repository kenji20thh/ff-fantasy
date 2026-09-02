"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Menu, Swords, X } from "lucide-react"
import { api } from "@/lib/api"
import type { User } from "@/lib/types"
import { Button } from "./ui"

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)) }, [])
  async function logout() { await api.logout().catch(() => undefined); setUser(null); window.location.href = "/" }
  const links = [["/", "Home"], ["/schedule", "Schedule"], ["/teams", "Teams"], ["/leaderboard", "Leaderboard"]]
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07090d]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
    <Link href="/" className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#f4d35e] text-[#17130a]"><Swords className="size-5" /></span><span className="font-mono text-lg font-black tracking-tight">FF<span className="text-[#f4d35e]">.</span>FANTASY</span></Link>
    <nav className="hidden items-center gap-7 md:flex">{links.map(([href,label]) => <Link key={href} href={href} className="text-sm text-zinc-400 transition hover:text-white">{label}</Link>)}{user && <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">My Team</Link>}{user && <Link href="/admin" className="text-sm font-semibold text-[#f4d35e]">Admin</Link>}</nav>
    <div className="hidden items-center gap-2 md:flex">{user ? <><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">{user.username}</span><Button variant="ghost" onClick={logout}>Log out</Button></> : <><Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/[.05]">Log in</Link><Link href="/register" className="rounded-xl bg-[#f4d35e] px-4 py-2.5 text-sm font-bold text-[#17130a] hover:bg-[#ffe77c]">Build your team</Link></>}</div>
    <button className="rounded-xl p-2 text-zinc-300 md:hidden" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
  </div>{open && <div className="border-t border-white/10 px-5 py-5 md:hidden"><div className="flex flex-col gap-2">{links.map(([href,label]) => <Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-zinc-300 hover:bg-white/[.04]" key={href} href={href}>{label}</Link>)}{user ? <Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-zinc-300" href="/dashboard">My Team</Link> : <Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-zinc-300" href="/login">Log in</Link>}{user && <Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-[#f4d35e]" href="/admin">Admin</Link>}</div></div>}</header>
}

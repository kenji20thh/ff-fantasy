"use client"
import Link from "next/link"
import { ChevronRight, Users } from "lucide-react"
import { useEffect,useState } from "react"
import { api } from "@/lib/api"
import type { Team } from "@/lib/types"
import { Card, ErrorBox, Loading, PageTitle } from "@/components/ui"
export default function TeamsPage(){const [teams,setTeams]=useState<Team[]>([]);const [error,setError]=useState<unknown>(null);useEffect(()=>{api.teams().then(setTeams).catch(setError)},[]);return <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8"><PageTitle eyebrow="The field" title="Teams" description="Every team and player is public. Browse the tournament roster before you draft."/><div className="mt-10">{error?<ErrorBox error={error}/>:!teams.length?<Loading/>:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{teams.map(team=><Link key={team.id} href={`/teams/${team.id}`}><Card className="group h-full p-6 transition hover:-translate-y-1 hover:border-[#f4d35e]/40"><div className="flex items-center justify-between"><span className="grid size-12 place-items-center rounded-xl bg-[#f4d35e]/10 font-mono text-lg font-black text-[#f4d35e]">{team.name.slice(0,2).toUpperCase()}</span><ChevronRight className="size-5 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-[#f4d35e]"/></div><h2 className="mt-8 font-mono text-xl font-bold">{team.name}</h2><p className="mt-2 flex items-center gap-2 text-sm text-zinc-500"><Users className="size-4"/> View roster</p></Card></Link>)}</div>}</div></main>}

"use client"
import Link from "next/link"
import { ArrowRight, LogIn } from "lucide-react"
import { FormEvent, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, ErrorBox, Input } from "@/components/ui"
export default function LoginPage() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState<unknown>(null); const [loading,setLoading]=useState(false)
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError(null);try{await api.login({email,password});window.location.href="/dashboard"}catch(err){setError(err)}finally{setLoading(false)}}
  return <main className="mx-auto flex min-h-[75vh] max-w-md items-center px-5 py-16"><Card className="w-full p-7 sm:p-9"><span className="grid size-11 place-items-center rounded-xl bg-[#f4d35e] text-[#17130a]"><LogIn className="size-5" /></span><h1 className="mt-7 font-mono text-3xl font-black">Welcome back.</h1><p className="mt-3 text-sm leading-6 text-zinc-500">Log in to manage your fantasy squad.</p><div className="mt-5"><ErrorBox error={error}/></div><form onSubmit={submit} className="mt-5 space-y-4"><Input required type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/><Input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/><Button loading={loading} className="w-full">Log in <ArrowRight className="size-4"/></Button></form><p className="mt-6 text-center text-sm text-zinc-500">No account? <Link className="font-semibold text-[#f4d35e]" href="/register">Create one</Link></p></Card></main>
}

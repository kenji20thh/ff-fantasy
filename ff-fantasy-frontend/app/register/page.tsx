"use client"
import Link from "next/link"
import { ArrowRight, UserPlus } from "lucide-react"
import { FormEvent, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, ErrorBox, Input } from "@/components/ui"
export default function RegisterPage() {
  const [form,setForm]=useState({username:"",email:"",password:""}); const [error,setError]=useState<unknown>(null); const [loading,setLoading]=useState(false)
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError(null);try{await api.register(form);window.location.href="/dashboard"}catch(err){setError(err)}finally{setLoading(false)}}
  return <main className="mx-auto flex min-h-[75vh] max-w-md items-center px-5 py-16"><Card className="w-full p-7 sm:p-9"><span className="grid size-11 place-items-center rounded-xl bg-[#f4d35e] text-[#17130a]"><UserPlus className="size-5" /></span><h1 className="mt-7 font-mono text-3xl font-black">Create your manager account.</h1><p className="mt-3 text-sm leading-6 text-zinc-500">Your fantasy team starts here.</p><div className="mt-5"><ErrorBox error={error}/></div><form onSubmit={submit} className="mt-5 space-y-4"><Input required placeholder="Username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/><Input required type="email" placeholder="Email address" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/><Input required minLength={6} type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><Button loading={loading} className="w-full">Create account <ArrowRight className="size-4"/></Button></form><p className="mt-6 text-center text-sm text-zinc-500">Already registered? <Link className="font-semibold text-[#f4d35e]" href="/login">Log in</Link></p></Card></main>
}

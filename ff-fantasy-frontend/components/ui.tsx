import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { LoaderCircle } from "lucide-react"

export function Button({ variant = "primary", loading, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) {
  const styles = {
    primary: "bg-[#f4d35e] text-[#17130a] hover:bg-[#ffe77c]",
    secondary: "border border-white/10 bg-white/[.04] text-white hover:bg-white/[.08]",
    ghost: "text-zinc-400 hover:bg-white/[.05] hover:text-white",
    danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  }
  return <button {...props} disabled={props.disabled || loading} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{loading && <LoaderCircle className="size-4 animate-spin" />}{children}</button>
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border border-white/10 bg-[#080b10] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#f4d35e]/60 focus:ring-2 focus:ring-[#f4d35e]/10 ${props.className ?? ""}`} />
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-[#0d1118] ${className}`}>{children}</div>
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : "Something went wrong."
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{message}</div>
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-zinc-500"><LoaderCircle className="size-5 animate-spin text-[#f4d35e]" />{label}</div>
}

export function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#f4d35e]">{eyebrow}</p><h1 className="mt-3 font-mono text-4xl font-black tracking-[-.05em] sm:text-6xl">{title}</h1>{description && <p className="mt-4 max-w-2xl leading-7 text-zinc-400">{description}</p>}</div>
}

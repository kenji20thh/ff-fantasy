import type { Metadata } from "next"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "FF Fantasy",
  description: "Fantasy esports for Free Fire tournament days.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <footer className="border-t border-white/10 bg-[#090c11]">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <span className="font-mono font-bold text-zinc-300">FF<span className="text-[#f4d35e]">.</span>FANTASY</span>
            <span>Pick smart. Captain better. Climb higher.</span>
          </div>
        </footer>
      </body>
    </html>
  )
}

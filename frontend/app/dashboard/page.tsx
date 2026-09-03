"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/types";

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [points, setPoints] = useState<unknown>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");

    if (user) {
      api
        .myFantasyTeam()
        .then((team: any) => api.fantasyPoints(team.id))
        .then(setPoints)
        .catch((e) => {
          const apiError = e as { status?: number };
          if (apiError.status !== 404) setError(errorMessage(e));
        });
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <main className="p-8">Loading dashboard…</main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Player dashboard</p>
          <h1 className="section-title">Welcome, {user.username}.</h1>
        </div>

        <button
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          Logout
        </button>
      </div>

      {error && <p className="mt-8 text-red-400">{error}</p>}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <a
          href="/fantasy-team"
          className="border border-primary bg-primary/10 p-6"
        >
          <span className="eyebrow">Your squad</span>

          <h2 className="mt-8 font-mono font-bold uppercase">
            Build fantasy team →
          </h2>
        </a>

        <a href="/leaderboard" className="border border-border bg-card p-6">
          <span className="eyebrow">Live standings</span>

          <h2 className="mt-8 font-mono font-bold uppercase">Leaderboard →</h2>
        </a>

        <div className="border border-border bg-card p-6">
          <span className="eyebrow">Current points</span>

          <h2 className="mt-8 font-mono text-3xl font-bold">
            {points ? JSON.stringify(points) : "—"}
          </h2>
        </div>
      </div>
    </main>
  );
}

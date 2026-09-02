# FF Fantasy frontend

Next.js + TypeScript + Tailwind CSS frontend for the existing Go/PostgreSQL FF Fantasy backend.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

The default API URL is `http://localhost:8080`.

## Routes

- `/` — home
- `/login` — login
- `/register` — registration
- `/schedule` — public tournament days
- `/schedule/:id` — public day details and rooms
- `/rooms/:id` — public room stats
- `/teams` — public teams
- `/teams/:id` — public roster
- `/leaderboard` — public leaderboard and scoring rules
- `/dashboard` — authenticated manager dashboard
- `/fantasy-team` — select 4 players + captain
- `/admin` — admin write UI for teams, players and tournament days
- `/admin/stats` — admin room-stat entry/update

## Backend contract

The frontend only calls endpoints present in the current backend. Public GET endpoints stay public; admin operations use the `/api/admin/*` write endpoints and rely on the backend for authorization.

One limitation in the current backend is that there is no `GET /api/fantasy-teams/mine` endpoint. The frontend resolves the current manager's fantasy-team ID by matching their username against the public leaderboard. If a fantasy team has never appeared in the leaderboard, the dashboard offers creation instead.

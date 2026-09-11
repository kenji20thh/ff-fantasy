// Manual MVP picks. Key format depends on the scope you want to override:
//
//   `day:<dayId>`        — a single day, e.g. "day:10" for Week3 Day1 AxC
//                          (dayId is the TournamentDay's `id` from
//                          /api/tournament-days, NOT the week number)
//
//   `week:league:<week>` — the whole week (all days combined),
//                          e.g. "week:league:3" for Week 3 overall
//
//   `phase:league`       — League Phase, Overall (all 3 weeks combined)
//   `phase:rush`         — Rush Point, All Days
//   `phase:final`        — Grand Final, All Days
//
// Value is always the player's `id` (same id used for /players/{id}.png).
//
// Any scope NOT listed here falls back to the automatic top-points player
// for that scope. Delete an entry to go back to automatic.

export const MVP_OVERRIDES: Record<string, number> = {
  "day:10": 27,          // Week3 Day1 AxC -> player 27
  "week:league:3": 27,   // Week 3 overall -> player 27
};
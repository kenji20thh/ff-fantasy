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
  "day:7": 40, // Week1 Day1  -> player 40
  "day:8": 88, // Week1 Day2  -> player 88
  "day:5": 80, // Week2 Day1  -> player 80
  "day:1": 77, // Week2 Day2  -> player 77
  "day:3": 80, // Week3 Day1  -> player 80
  "day:4": 27, // Week3 Day2  -> player 27
  "day:10": 27, // Week3 Day1 AxC -> player 27
  "week:league:3": 27, // Week 3 overall -> player 27
  "week:league:2": 80, // Week 2 overall -> player 80
  "week:league:1": 80, // Week 1 overall -> player 80
};

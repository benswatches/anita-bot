# Anita TV

A live-TV streaming app modeled on YouTube TV's experience, served by the
existing Express server at `/tv`.

```bash
npm install
npm start            # http://localhost:3000/tv/
```

## What's in it

- **Home**: rotating featured live program, plus rows for Continue watching,
  Live now, New in your library, Live sports, News, Movies, Coming up next.
- **Live guide**: 16 channels × 12 hours, category filters, a red "now" line,
  live badges and recording dots.
- **Library (unlimited DVR)**: add any show, game or movie; every airing from
  then on is recorded. Recordings resume where you left off.
- **Player**: live edge with pause/rewind (fall behind live, then
  "LIVE" to jump back), ±15s, channel up/down, mini guide, add to library,
  volume, fullscreen. Rolls into the next program when one ends.
- **Search** across shows, sports, genres and channels.
- **TV remote navigation**: arrow keys move focus spatially, Enter selects.
  In the player: Space/K play, ←/→ seek, ↑/↓ channel, G guide, L live,
  M mute, F fullscreen, Esc back.

## How it works

- `channels.js` defines the lineup and generates each channel's schedule
  deterministically from the date, so every viewer sees the same program
  "live" at the same time with no database.
- `router.js` exposes `/tv/api/channels`, `/tv/api/guide?from=&hours=`,
  `/tv/api/now` and `/tv/api/search?q=`.
- `public/` is a no-build vanilla JS client. Library and watch progress live
  in the browser's localStorage.
- Playback uses public sample streams (Blender open movies and Google's
  sample clips) looped and aligned to the program clock. Set
  `TV_MEDIA_BASE` to serve your own files. If a stream can't load, the
  player keeps the program clock running over generated key art.

All channels, shows and branding are fictional.

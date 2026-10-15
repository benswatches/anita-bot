// Anita TV lineup and schedule. Channels and shows are fictional; schedules
// are generated deterministically from the date, so every viewer sees the
// same "live" program at the same moment without a database.

const MEDIA_BASE =
  process.env.TV_MEDIA_BASE ||
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample";

const STREAMS = [
  "BigBuckBunny.mp4",
  "ElephantsDream.mp4",
  "Sintel.mp4",
  "TearsOfSteel.mp4",
  "ForBiggerBlazes.mp4",
  "ForBiggerEscapes.mp4",
  "ForBiggerFun.mp4",
  "ForBiggerJoyrides.mp4",
  "ForBiggerMeltdowns.mp4",
  "SubaruOutbackOnStreetAndDirt.mp4",
  "VolkswagenGTIReview.mp4",
  "WeAreGoingOnBullrun.mp4",
  "WhatCarCanYouGetForAGrand.mp4",
].map((file) => `${MEDIA_BASE}/${file}`);

// Each show: [title, minutes, rating, live?, synopsis]
export const channels = [
  {
    id: "a24news", number: 2, name: "Anita News 24", short: "AN24", color: "#d93025", category: "News",
    shows: [
      ["Morning Wire", 120, "TV-G", true, "Headlines, weather and traffic to start your day."],
      ["The Briefing", 60, "TV-G", true, "The biggest stories of the hour, explained without the noise."],
      ["Market Watch Live", 60, "TV-G", true, "Opening bells, earnings and what moved the markets."],
      ["Capitol Report", 60, "TV-PG", true, "Inside the votes, deals and hearings shaping policy."],
      ["World Tonight", 60, "TV-G", true, "Correspondents across six continents on the day's events."],
    ],
  },
  {
    id: "gridiron", number: 5, name: "Gridiron Sports", short: "GRID", color: "#1a73e8", category: "Sports",
    shows: [
      ["College Football: Harbor St. vs. Ridgeview", 210, "TV-G", true, "Conference rivals meet under the lights with the division on the line."],
      ["Pro Football Countdown", 90, "TV-G", true, "Previews, injury news and picks before kickoff."],
      ["Sideline Stories", 30, "TV-G", false, "The people behind the helmets."],
      ["Fantasy Fix", 60, "TV-G", true, "Start/sit calls and waiver wire gems."],
    ],
  },
  {
    id: "hoops", number: 6, name: "Courtside", short: "CRT", color: "#f9ab00", category: "Sports",
    shows: [
      ["Pro Basketball: Coastal Kings at Lakeport", 150, "TV-G", true, "A playoff rematch with a top-four seed at stake."],
      ["The Paint", 60, "TV-G", true, "Highlights and hot takes from around the league."],
      ["Classic Games", 120, "TV-G", false, "Relive a legendary Game 7."],
    ],
  },
  {
    id: "pitch", number: 7, name: "Pitch World", short: "PW", color: "#188038", category: "Sports",
    shows: [
      ["Premier Football: Northfield vs. Albion", 120, "TV-G", true, "A derby with European places on the line."],
      ["Matchday Live", 60, "TV-G", true, "Every goal from today's fixtures."],
      ["Golf: Coastal Open Round 3", 240, "TV-G", true, "Moving day on the cliffs."],
    ],
  },
  {
    id: "cinemax", number: 12, name: "Reel Classics", short: "REEL", color: "#a142f4", category: "Movies",
    shows: [
      ["Sintel", 90, "PG-13", false, "A young woman searches a frozen world for the dragon she once saved."],
      ["Tears of Steel", 120, "PG-13", false, "Scientists in future Amsterdam make a last stand against machines."],
      ["Elephants Dream", 90, "PG", false, "Two strangers wander an infinite machine."],
      ["Big Buck Bunny", 90, "G", false, "A gentle giant rabbit takes elaborate revenge on three bullies."],
    ],
  },
  {
    id: "thrill", number: 13, name: "Thrill Network", short: "THR", color: "#5f6368", category: "Movies",
    shows: [
      ["The Quiet Floor", 120, "R", false, "The hospital's sealed fourth floor still admits patients."],
      ["Redline Tokyo", 120, "R", false, "One night, one package, every gang in the city."],
      ["The Understudy", 120, "R", false, "The lead has been missing since rehearsal."],
    ],
  },
  {
    id: "fun", number: 20, name: "Laugh Lines", short: "LOL", color: "#fbbc04", category: "Entertainment",
    shows: [
      ["Little Giants FC", 30, "TV-PG", false, "A burned-out pro coaches the worst under-10 team in Lancashire."],
      ["Byte Club", 30, "TV-14", false, "A coding club's AI only speaks in sarcasm."],
      ["Late Night with Jo Marsh", 60, "TV-14", true, "Monologue, sketches and a goose, probably."],
      ["Stand-Up Saturdays", 60, "TV-MA", false, "Three comics, one stage."],
    ],
  },
  {
    id: "drama", number: 21, name: "Prestige", short: "PRS", color: "#8430ce", category: "Entertainment",
    shows: [
      ["The Salt Line", 60, "TV-MA", false, "A disgraced harbor cop reopens the case that ended her career."],
      ["Glass House Rules", 60, "TV-MA", false, "A family of architects hides secrets in a transparent home."],
      ["Orbit of Ash", 60, "TV-MA", false, "The colony ship's destination was never real."],
      ["Wild Courts", 60, "TV-14", false, "A public defender with a perfect memory."],
    ],
  },
  {
    id: "food", number: 30, name: "Feast", short: "FST", color: "#e8710a", category: "Lifestyle",
    shows: [
      ["Midnight Kitchen Wars", 60, "TV-14", false, "Every night at midnight, someone's knives go home."],
      ["30-Minute Suppers", 30, "TV-G", false, "Weeknight dinners that actually take 30 minutes."],
      ["Street Eats", 30, "TV-PG", false, "The world's best food is sold from a cart."],
      ["Moonlit Ramen", 30, "TV-PG", false, "Bowls that let you relive one perfect memory."],
    ],
  },
  {
    id: "home", number: 31, name: "Home & Garden+", short: "H&G", color: "#34a853", category: "Lifestyle",
    shows: [
      ["Flip or Flop Coast", 30, "TV-G", false, "Two siblings, one budget, zero patience."],
      ["Tiny House, Big Dreams", 30, "TV-G", false, "Families downsize to 300 square feet."],
      ["Garden Rescue", 60, "TV-G", false, "Backyard disasters turned into sanctuaries."],
    ],
  },
  {
    id: "wild", number: 40, name: "Wild Planet", short: "WILD", color: "#137333", category: "Documentary",
    shows: [
      ["Tiny Planet", 60, "TV-G", false, "The secret lives of creatures smaller than your thumb."],
      ["Shark Coast", 60, "TV-PG", false, "Tagging great whites off South Africa."],
      ["North of Nowhere", 90, "TV-PG", false, "Driving the Dalton Highway in winter."],
    ],
  },
  {
    id: "history", number: 41, name: "Timeline", short: "TML", color: "#795548", category: "Documentary",
    shows: [
      ["Second Hand Time", 60, "TV-14", false, "Collectors chase the stories behind coveted vintage watches."],
      ["Lost Empires", 60, "TV-PG", false, "Civilizations history almost forgot."],
      ["Engineering the Impossible", 60, "TV-G", false, "Bridges, tunnels and towers that shouldn't stand."],
    ],
  },
  {
    id: "motor", number: 42, name: "Torque", short: "TRQ", color: "#c5221f", category: "Sports",
    shows: [
      ["Rally Live: Desert Stage", 120, "TV-G", true, "Flat out across 300km of dunes."],
      ["Garage Heroes", 60, "TV-PG", false, "Barn finds brought back to life."],
      ["What Car for a Grand?", 30, "TV-PG", false, "Three hosts, $1,000 each, one road trip."],
    ],
  },
  {
    id: "kids", number: 50, name: "Kidzone", short: "KZ", color: "#12b5cb", category: "Kids",
    shows: [
      ["Paws & Claws", 30, "TV-Y", false, "A city cat and farm dog head home for Christmas."],
      ["Rocket Pals", 30, "TV-Y7", false, "Three friends build a rocket out of cardboard boxes."],
      ["Sing-Along Safari", 30, "TV-Y", false, "Songs about every animal on the savanna."],
    ],
  },
  {
    id: "anime", number: 51, name: "Otaku", short: "OTK", color: "#ff6d01", category: "Entertainment",
    shows: [
      ["Blade of the Hollow", 30, "TV-14", false, "A swordsman bound to a demon blade hunts a warlord."],
      ["Moonlit Ramen", 30, "TV-PG", false, "A late-night ramen stall in Osaka."],
      ["Mecha Academy", 30, "TV-14", false, "First-years pilot giant robots they barely understand."],
    ],
  },
  {
    id: "music", number: 60, name: "Amp", short: "AMP", color: "#e52592", category: "Entertainment",
    shows: [
      ["Live from the Bowl", 120, "TV-14", true, "Headliners live from the amphitheater."],
      ["Velvet Static", 120, "R", false, "A pirate-radio DJ falls for the singer she broadcasts."],
      ["Top 20 Countdown", 60, "TV-PG", false, "This week's biggest songs."],
    ],
  },
];

const EPISODE_TITLES = [
  "Low Tide", "The Inheritance", "Blind Spot", "Crossing", "Dead Air", "Ghost Signal", "Undertow",
  "The Ledger", "Firstlight", "Fault Lines", "Homecoming", "Red Flag", "The Long Night", "Thaw",
];

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Programs for one channel covering [from, to). Each day's schedule is built
// from midnight UTC with a per-day seed, so any window is reproducible.
function channelDay(channel, dayStart) {
  const programs = [];
  const dayEnd = dayStart + 24 * 3600e3;
  let t = dayStart;
  let i = hash(`${channel.id}:${dayStart}`);
  while (t < dayEnd) {
    const [title, minutes, rating, live, synopsis] = channel.shows[i % channel.shows.length];
    const end = Math.min(t + minutes * 60e3, dayEnd);
    const seed = hash(`${channel.id}:${t}`);
    const showId = `${channel.id}-${slug(title)}`;
    const episodic = !live && minutes <= 60 && channel.category !== "Movies";
    programs.push({
      id: `${channel.id}:${t}`,
      channelId: channel.id,
      showId,
      title,
      episodeTitle: episodic ? EPISODE_TITLES[seed % EPISODE_TITLES.length] : null,
      season: episodic ? 1 + (seed % 4) : null,
      episode: episodic ? 1 + ((seed >> 4) % 12) : null,
      start: t,
      end,
      rating,
      live,
      isNew: live || seed % 3 === 0,
      category: channel.category,
      synopsis,
      stream: STREAMS[seed % STREAMS.length],
    });
    t = end;
    i = (i * 1103515245 + 12345) >>> 0;
  }
  return programs;
}

export function guide(from, to) {
  const DAY = 24 * 3600e3;
  const firstDay = Math.floor(from / DAY) * DAY;
  return channels.map((channel) => {
    const programs = [];
    for (let d = firstDay; d < to; d += DAY) {
      for (const p of channelDay(channel, d)) {
        if (p.end > from && p.start < to) programs.push(p);
      }
    }
    return { channelId: channel.id, programs };
  });
}

export function onNow(at = Date.now()) {
  return guide(at, at + 1).map((g) => g.programs[0]);
}

export function search(query, at = Date.now()) {
  const q = query.trim().toLowerCase();
  if (!q) return { channels: [], programs: [] };
  const matchedChannels = channels.filter(
    (c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
  );
  // Next airing of each matching show over the coming 24h.
  const seen = new Set();
  const programs = [];
  for (const row of guide(at, at + 24 * 3600e3)) {
    for (const p of row.programs) {
      const hay = `${p.title} ${p.episodeTitle || ""} ${p.category}`.toLowerCase();
      if (!hay.includes(q) || seen.has(p.showId)) continue;
      seen.add(p.showId);
      programs.push(p);
    }
  }
  programs.sort((a, b) => a.start - b.start);
  return { channels: matchedChannels.map(({ shows, ...c }) => c), programs: programs.slice(0, 30) };
}

export function publicChannels() {
  return channels.map(({ shows, ...c }) => c);
}


#!/usr/bin/env node
/**
 * RouteCO2 server-side watch recorder (sidecar daemon).
 *
 * Records watched flights even when every browser tab is closed, minimized,
 * or throttled. Run in a second terminal:
 *
 *   cd web && npm run recorder
 *
 * What it does, every 12s:
 *  1. Loads the watch manifest (web/.data/watches.json) — registered by the
 *     client via POST /api/server-watch when the user presses Watch.
 *  2. Polls live ADS-B (OpenSky bbox, OAuth when credentials exist; direct
 *     adsb.lol per-aircraft repair for watched keys so touchdown ground
 *     states are never missed across sources).
 *  3. Appends one fix per WATCHING track, flips airborne→ground to
 *     LANDED_RECORDED itself, and ring-buffers every landing candidate
 *     (descent near FRA/CDG/LHR/AMS) so late watches still get past positions.
 *  4. Persists everything under web/.data/ (atomic tmp+rename writes).
 *
 * Storage is local JSON (gitignored): survives tab close + dev-server
 * restarts. Only this process must stay up. All telemetry is live ADS-B —
 * never synthesized (zero-mock rule).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(HERE, "..");
const DATA_DIR = path.join(WEB_DIR, ".data");
const TRACKS_DIR = path.join(DATA_DIR, "tracks");
const WATCHES_FILE = path.join(DATA_DIR, "watches.json");
const BUFFER_FILE = path.join(DATA_DIR, "buffer.json");

const POLL_MS = 12_000;
const TRACK_MAX_FIXES = 2000;
const BUFFER_MAX_FIXES = 240; // ≈48 min at 12s polls
const BUFFER_MAX_KEYS = 400;
const BUFFER_PRUNE_POLLS = 30; // drop candidates unseen this long
const LOST_AFTER_MISSES = 5;

const HUBS = [
  { iata: "FRA", lat: 50.0379, lon: 8.5622 },
  { iata: "CDG", lat: 49.0097, lon: 2.5479 },
  { iata: "LHR", lat: 51.47, lon: -0.4543 },
  { iata: "AMS", lat: 52.3105, lon: 4.7683 },
];
// Upstream throttle state: honor 429s with cooldowns instead of hammering,
// or both sources throttle the IP and the radar goes dark.
let openskyCooldownUntil = 0;
let adsbCooldownUntil = 0;
const MAX_ALT_M = 3500;
const FINAL_ALT_M = 1500;
const MAX_DESCENT_VSI = -2.0;
const MAX_HUB_DIST_KM = 120;
// Auto-capture: when nobody picks flights in the UI, the recorder adopts the
// top-ranked landing candidates itself (up to AUTO_SLOTS concurrent in-flight
// auto-tracks) so the Replay tab always has fresh demo material. Landed auto
// tracks stay on disk durably but stop consuming slots.
const AUTO_SLOTS = 5;
const AUTO_RELAND_HOURS = 6; // don't re-adopt a freshly-landed key this soon

// ---------- tiny utils ----------

const log = (...a) => console.log(new Date().toISOString(), "[recorder]", ...a);

function ensureDirs() {
  fs.mkdirSync(TRACKS_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

/** Atomic write: tmp file + rename so API readers never see torn JSON. */
function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

const safeKey = (key) => String(key || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32) || "unknown";

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestHubDistKm(lat, lon) {
  let best = Infinity;
  for (const h of HUBS) best = Math.min(best, haversineKm(lat, lon, h.lat, h.lon));
  return best;
}

// ---------- credentials (same resolution as web/lib/opensky-auth.ts) ----------

function getCredentials() {
  if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
    return { clientId: process.env.OPENSKY_CLIENT_ID, clientSecret: process.env.OPENSKY_CLIENT_SECRET };
  }
  for (const p of [path.join(WEB_DIR, "credentials.json"), path.join(WEB_DIR, "..", "credentials.json")]) {
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf-8"));
      const clientId = j.clientId || j.client_id;
      const clientSecret = j.clientSecret || j.client_secret;
      if (clientId && clientSecret) return { clientId, clientSecret };
    } catch {
      /* next candidate */
    }
  }
  return null;
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getBearerToken() {
  if (cachedToken && Date.now() + 60_000 < tokenExpiresAt) return cachedToken;
  const creds = getCredentials();
  if (!creds) return null;
  try {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });
    const res = await fetch(
      "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in ?? 1800) * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

// ---------- live sources ----------

function toSummary(o) {
  return {
    icao24: String(o.icao24).toLowerCase(),
    callsign: String(o.callsign).trim().toUpperCase(),
    equipmentType: o.equipmentType || "A320",
    originCountry: o.originCountry || "Commercial",
    latitude: o.latitude,
    longitude: o.longitude,
    baroAltitudeMeters: o.baroAltitudeMeters ?? 0,
    velocityMps: o.velocityMps ?? 0,
    verticalRateMps: o.verticalRateMps ?? 0,
    trueTrackDeg: o.trueTrackDeg ?? 0,
    onGround: Boolean(o.onGround),
  };
}

async function fetchOpenSky(watchSet, { anonymous = false } = {}) {
  const headers = { Accept: "application/json", "User-Agent": "RouteCO2-Recorder/1.0 (ETHOnline2026)" };
  if (!anonymous) {
    const token = await getBearerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(
      "https://opensky-network.org/api/states/all?lamin=35&lomin=-15&lamax=60&lomax=30",
      { signal: ctrl.signal, headers }
    );
    clearTimeout(t);
    if (res.status === 429) {
      const wait = Math.min(Math.max(parseInt(res.headers.get("x-rate-limit-retry-after-seconds") || "60", 10), 30), 1800);
      openskyCooldownUntil = Date.now() + wait * 1000;
      log(`OpenSky 429${anonymous ? " (anonymous)" : ""}: cooling down ${wait}s`);
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.states)) return null;
    const out = [];
    for (const s of data.states) {
      const icao = typeof s[0] === "string" ? String(s[0]).toLowerCase() : "";
      const watched = icao !== "" && watchSet.has(icao);
      const ground = s[8] === true;
      if (!watched && ground) continue;
      if (s[5] == null || s[6] == null || (s[7] == null && !watched)) continue;
      if (s[1] == null || typeof s[1] !== "string" || s[1].trim().length === 0) continue;
      out.push(
        toSummary({
          icao24: icao,
          callsign: String(s[1]).trim(),
          originCountry: String(s[2] || "Commercial"),
          latitude: Number(s[6]),
          longitude: Number(s[5]),
          baroAltitudeMeters: s[7] != null ? Math.round(Number(s[7])) : 0,
          velocityMps: s[9] != null ? Math.round(Number(s[9])) : 0,
          verticalRateMps: s[11] != null ? Math.round(Number(s[11]) * 10) / 10 : 0,
          trueTrackDeg: s[10] != null ? Math.round(Number(s[10])) : 0,
          onGround: ground,
        })
      );
      if (out.length >= 250) break;
    }
    return out;
  } catch {
    clearTimeout(t);
    return null;
  }
}

function adsbAcToSummary(a) {
  if (!a || !a.hex || !a.flight || typeof a.flight !== "string" || !a.flight.trim()) return null;
  if (typeof a.lat !== "number" || typeof a.lon !== "number") return null;
  const ground = a.alt_baro === "ground" || a.alt_geom === "ground";
  return toSummary({
    icao24: String(a.hex).toLowerCase(),
    callsign: String(a.flight).trim(),
    originCountry: a.r ? String(a.r) : "Commercial",
    equipmentType: a.t ? String(a.t) : "A320",
    latitude: a.lat,
    longitude: a.lon,
    baroAltitudeMeters: typeof a.alt_baro === "number" ? Math.round(a.alt_baro * 0.3048) : 0,
    velocityMps: typeof a.gs === "number" ? Math.round(a.gs * 0.514444) : 0,
    verticalRateMps: typeof a.baro_rate === "number" ? Math.round(a.baro_rate * 0.00508 * 10) / 10 : 0,
    trueTrackDeg: typeof a.track === "number" ? Math.round(a.track) : 0,
    onGround: ground,
  });
}

async function fetchAdsbHub(lat, lon) {
  if (Date.now() < adsbCooldownUntil) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const rLat = Math.round(lat * 4) / 4;
    const rLon = Math.round(lon * 4) / 4;
    const res = await fetch(`https://api.adsb.lol/v2/lat/${rLat}/lon/${rLon}/dist/250`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "RouteCO2-Recorder/1.0 (ETHOnline2026)" },
    });
    clearTimeout(t);
    if (res.status === 429) {
      adsbCooldownUntil = Date.now() + 120_000;
      log("adsb.lol 429: cooling down 120s (backing off to lift the throttle)");
      return [];
    }
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data.ac) ? data.ac : []).map(adsbAcToSummary).filter(Boolean);
  } catch {
    clearTimeout(t);
    return [];
  }
}

async function fetchWatchedDirect(hexes) {
  const out = [];
  if (Date.now() < adsbCooldownUntil) return out;
  await Promise.all(
    hexes.slice(0, 20).map(async (hex) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(`https://api.adsb.lol/v2/icao/${encodeURIComponent(hex)}`, {
          signal: ctrl.signal,
          headers: { Accept: "application/json", "User-Agent": "RouteCO2-Recorder/1.0 (ETHOnline2026)" },
        });
        clearTimeout(t);
        if (res.status === 429) {
          adsbCooldownUntil = Date.now() + 120_000;
          log("adsb.lol 429 on direct lookup: cooling down 120s");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        for (const a of Array.isArray(data.ac) ? data.ac : []) {
          const s = adsbAcToSummary(a);
          if (s) out.push(s);
        }
      } catch {
        clearTimeout(t);
      }
    })
  );
  return out;
}

/** OpenSky live-track backfill for a fresh watch (free tracks/all, best-effort). */
async function fetchTrackBackfill(icao24) {
  try {
    const headers = { Accept: "application/json", "User-Agent": "RouteCO2-Recorder/1.0 (ETHOnline2026)" };
    const token = await getBearerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`https://opensky-network.org/api/tracks/all?icao24=${encodeURIComponent(icao24)}&time=0`, {
      signal: ctrl.signal,
      headers,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = await res.json();
    const fixes = [];
    for (const w of Array.isArray(data.path) ? data.path : []) {
      if (!Array.isArray(w) || w.length < 3) continue;
      const tSec = Number(w[0]);
      const lat = Number(w[1]);
      const lon = Number(w[2]);
      if (!Number.isFinite(tSec) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      fixes.push({
        t: tSec * 1000,
        lat,
        lon,
        altM: w[3] == null ? 0 : Math.round(Number(w[3])),
        velMps: 0,
        vsiMps: 0,
        trackDeg: w[4] == null ? 0 : Math.round(Number(w[4])),
        onGround: w[5] === true,
      });
    }
    fixes.sort((a, b) => a.t - b.t);
    for (let i = 1; i < fixes.length; i++) {
      const dt = (fixes[i].t - fixes[i - 1].t) / 1000;
      if (dt > 0 && dt < 3600) {
        const dKm = haversineKm(fixes[i - 1].lat, fixes[i - 1].lon, fixes[i].lat, fixes[i].lon);
        fixes[i].velMps = Math.round(((dKm * 1000) / dt) * 10) / 10;
        fixes[i].vsiMps = Math.round(((fixes[i].altM - fixes[i - 1].altM) / dt) * 10) / 10;
      }
    }
    return fixes;
  } catch {
    return [];
  }
}

// ---------- store ----------

function loadWatches() {
  const v = readJson(WATCHES_FILE, []);
  return Array.isArray(v) ? v : [];
}

function trackPath(key) {
  return path.join(TRACKS_DIR, `${safeKey(key)}.json`);
}

function loadTrack(key) {
  return readJson(trackPath(key), null);
}

function saveTrack(track) {
  writeJsonAtomic(trackPath(track.key), track);
}

function mergeFixes(a, b, cap) {
  const seen = new Set();
  const out = [];
  for (const f of [...(a || []), ...(b || [])]) {
    if (!f || typeof f.t !== "number" || typeof f.lat !== "number" || typeof f.lon !== "number") continue;
    if (seen.has(f.t)) continue;
    seen.add(f.t);
    out.push(f);
  }
  out.sort((x, y) => x.t - y.t);
  return out.length > cap ? out.slice(-cap) : out;
}

// ---------- main loop ----------

let buffer = new Map(); // key -> { fixes, misses, vsi: number[] }
let poll = 0;

function isCandidate(f, vsiSmoothed) {
  if (f.onGround || f.latitude == null || f.longitude == null) return false;
  const alt = f.baroAltitudeMeters ?? Infinity;
  if (!Number.isFinite(alt) || alt <= 0 || alt > MAX_ALT_M) return false;
  if (!(vsiSmoothed <= MAX_DESCENT_VSI || alt <= FINAL_ALT_M)) return false;
  return nearestHubDistKm(f.latitude, f.longitude) <= MAX_HUB_DIST_KM;
}

async function tick() {
  poll += 1;
  const watches = loadWatches();
  const watching = watches.filter((w) => w.status === "WATCHING");
  const watchSet = new Set(watching.map((w) => (w.icao24 || w.key || "").toLowerCase()));

  // 1. Live snapshot: OpenSky first (authenticated; anonymous retry on 429
  // since the buckets are independent), one rotating adsb.lol hub on failure
  // (not all four every poll — that burns the throttle budget), and direct
  // per-aircraft repair ONLY for watched keys OpenSky didn't return.
  let flights = null;
  let source = "opensky";
  if (Date.now() >= openskyCooldownUntil) {
    flights = await fetchOpenSky(watchSet);
  }
  if ((!flights || flights.length === 0) && Date.now() >= openskyCooldownUntil) {
    flights = await fetchOpenSky(watchSet, { anonymous: true });
    if (flights && flights.length > 0) source = "opensky-anon";
  }
  if (!flights || flights.length === 0) {
    const hub = HUBS[poll % HUBS.length];
    flights = await fetchAdsbHub(hub.lat, hub.lon);
    source = `adsb.lol-${hub.iata}`;
  }
  if (watchSet.size > 0 && flights) {
    const have = new Set(flights.map((f) => f.icao24));
    const missing = [...watchSet].filter((hex) => !have.has(hex));
    const direct = missing.length > 0 ? await fetchWatchedDirect(missing) : [];
    if (direct.length > 0) {
      const byIcao = new Map(flights.map((f) => [f.icao24, f]));
      for (const d of direct) {
        const cur = byIcao.get(d.icao24);
        if (!cur || (d.onGround && !cur.onGround)) byIcao.set(d.icao24, d);
      }
      flights = [...byIcao.values()];
      source += "+direct";
    }
  }
  flights = flights || [];
  const byKey = new Map();
  for (const f of flights) {
    byKey.set((f.icao24 || f.callsign).toLowerCase(), f);
    if (f.callsign) byKey.set(f.callsign.toLowerCase(), f);
  }
  const match = (key, callsign) =>
    byKey.get(String(key || "").toLowerCase()) || byKey.get(String(callsign || "").toLowerCase());

  // 2. Candidate ring buffer (past positions for late watches).
  const seenKeys = new Set();
  for (const f of flights) {
    const key = (f.icao24 || f.callsign).toLowerCase();
    seenKeys.add(key);
    let entry = buffer.get(key);
    if (!entry) {
      entry = { fixes: [], misses: 0, vsi: [] };
      buffer.set(key, entry);
    }
    entry.misses = 0;
    entry.vsi.push(f.verticalRateMps ?? 0);
    if (entry.vsi.length > 5) entry.vsi.shift();
    const smoothed = entry.vsi.reduce((a, b) => a + b, 0) / entry.vsi.length;
    if (!isCandidate(f, smoothed)) continue;
    if (f.latitude == null || f.longitude == null) continue;
    entry.fixes.push({
      t: Date.now(),
      lat: f.latitude,
      lon: f.longitude,
      altM: f.baroAltitudeMeters ?? 0,
      velMps: f.velocityMps ?? 0,
      vsiMps: f.verticalRateMps ?? 0,
      trackDeg: f.trueTrackDeg ?? 0,
      onGround: Boolean(f.onGround),
    });
    if (entry.fixes.length > BUFFER_MAX_FIXES) entry.fixes.splice(0, entry.fixes.length - BUFFER_MAX_FIXES);
  }
  for (const [key, entry] of buffer) {
    if (watchSet.has(key)) continue; // watches have their own durable track files
    if (!seenKeys.has(key)) {
      entry.misses += 1;
      if (entry.misses > BUFFER_PRUNE_POLLS) buffer.delete(key);
    }
  }
  if (buffer.size > BUFFER_MAX_KEYS) {
    for (const key of buffer.keys()) {
      if (buffer.size <= BUFFER_MAX_KEYS) break;
      if (!watchSet.has(key)) buffer.delete(key);
    }
  }
  if (poll % 2 === 0) {
    const snap = {};
    for (const [k, e] of buffer) snap[k] = e.fixes;
    try {
      writeJsonAtomic(BUFFER_FILE, snap);
    } catch (err) {
      log("buffer persist failed:", err.message);
    }
  }

  // 3. Watches: append, touchdown, misses.
  let manifestDirty = false;
  for (const w of watching) {
    let track = loadTrack(w.key);
    if (!track) {
      // Fresh registration (or track file deleted): seed from buffer + backfill.
      const buffered = (buffer.get(w.key) || { fixes: [] }).fixes;
      const past = w.icao24 ? await fetchTrackBackfill(w.icao24) : [];
      track = {
        key: w.key,
        icao24: w.icao24 || "",
        callsign: w.callsign,
        equipmentType: w.equipmentType,
        originCountry: w.originCountry,
        watchStartedAt: w.watchStartedAt || Date.now(),
        status: "WATCHING",
        fixes: mergeFixes(buffered, past, TRACK_MAX_FIXES),
      };
      saveTrack(track);
      log(`seeded ${w.callsign}: ${track.fixes.length} past fixes (${buffered.length} buffer + ${past.length} backfill)`);
    }
    const live = match(w.key, w.callsign);
    if (!live || live.latitude == null || live.longitude == null) {
      w.misses = (w.misses || 0) + 1;
      manifestDirty = true;
      if (w.misses === LOST_AFTER_MISSES) log(`${w.callsign}: radar contact lost (~60s gap) — keeping ${track.fixes.length} fixes`);
      continue;
    }
    if (w.misses) {
      w.misses = 0;
      manifestDirty = true;
    }
    if (track.fixes.length >= TRACK_MAX_FIXES && !track.truncated) {
      track.truncated = true;
    }
    if (!track.truncated) {
      track.fixes.push({
        t: Date.now(),
        lat: live.latitude,
        lon: live.longitude,
        altM: live.baroAltitudeMeters ?? 0,
        velMps: live.velocityMps ?? 0,
        vsiMps: live.verticalRateMps ?? 0,
        trackDeg: live.trueTrackDeg ?? 0,
        onGround: Boolean(live.onGround),
      });
    }
    if (live.onGround) {
      track.status = "LANDED_RECORDED";
      track.landedAt = Date.now();
      w.status = "LANDED_RECORDED";
      w.landedAt = track.landedAt;
      manifestDirty = true;
      log(`touchdown recorded: ${w.callsign} (${track.fixes.length} fixes)`);
    }
    saveTrack(track);
  }
  if (manifestDirty) {
    try {
      writeJsonAtomic(WATCHES_FILE, watches);
    } catch (err) {
      log("manifest persist failed:", err.message);
    }
  }

  // 4. Auto-capture: fill free auto slots with top-ranked landing candidates.
  // Runs every poll so the demo always has 3-5 fresh in-flight recordings even
  // when nobody touches the UI. Explicit (UI) watches are never displaced.
  try {
    const autoWatching = watches.filter((w) => w.auto && w.status === "WATCHING").length;
    let free = AUTO_SLOTS - autoWatching;
    if (free > 0) {
      const ranked = [];
      for (const f of flights) {
        if (f.onGround || f.latitude == null || f.longitude == null) continue;
        const alt = f.baroAltitudeMeters ?? Infinity;
        if (!Number.isFinite(alt) || alt <= 0 || alt > MAX_ALT_M) continue;
        const key = (f.icao24 || f.callsign).toLowerCase();
        const entry = buffer.get(key);
        const vsiArr = entry && entry.vsi.length > 0 ? entry.vsi : [f.verticalRateMps ?? 0];
        const smoothed = vsiArr.reduce((a, b) => a + b, 0) / vsiArr.length;
        if (!(smoothed <= MAX_DESCENT_VSI || alt <= FINAL_ALT_M)) continue;
        const distKm = nearestHubDistKm(f.latitude, f.longitude);
        if (distKm > MAX_HUB_DIST_KM) continue;
        const etaMin = smoothed < -0.5 ? alt / Math.abs(smoothed) / 60 : 45;
        ranked.push({ f, key, etaMin, distKm });
      }
      ranked.sort((a, b) => a.etaMin - b.etaMin || a.distKm - b.distKm);
      for (const c of ranked) {
        if (free <= 0) break;
        const existing = watches.find((w) => w.key === c.key);
        if (existing) {
          // Same aircraft, freshly landed record: don't clobber it this soon.
          if (existing.status === "WATCHING") continue;
          if (existing.landedAt && Date.now() - existing.landedAt < AUTO_RELAND_HOURS * 3600 * 1000) continue;
          // Old landed record: archive it aside, then start a fresh capture.
          try {
            const archDir = path.join(TRACKS_DIR, "archive");
            fs.mkdirSync(archDir, { recursive: true });
            fs.renameSync(trackPath(c.key), path.join(archDir, `${safeKey(c.key)}-${existing.landedAt}.json`));
          } catch {
            /* track file may be absent; carry on */
          }
          const idx = watches.findIndex((w) => w.key === c.key);
          watches.splice(idx, 1);
        }
        watches.unshift({
          key: c.key,
          icao24: (c.f.icao24 || "").toLowerCase(),
          callsign: c.f.callsign,
          equipmentType: c.f.equipmentType,
          originCountry: c.f.originCountry,
          watchStartedAt: Date.now(),
          status: "WATCHING",
          auto: true,
        });
        free -= 1;
        log(`auto-capture: ${c.f.callsign} (ETA ~${Math.round(c.etaMin)} min, ${Math.round(c.distKm)} km out)`);
      }
      writeJsonAtomic(WATCHES_FILE, watches.slice(0, 100));
    }
  } catch (err) {
    log("auto-capture failed:", err.message);
  }

  const landed = watches.filter((w) => w.status === "LANDED_RECORDED").length;
  log(`poll #${poll} via ${source}: ${flights.length} contacts, ${watching.length} watching, ${landed} landed, ${buffer.size} buffered`);
}

async function main() {
  ensureDirs();
  // Restore persisted candidate buffer (past positions survive restarts).
  try {
    const snap = readJson(BUFFER_FILE, {});
    for (const [k, fixes] of Object.entries(snap)) {
      if (Array.isArray(fixes) && fixes.length > 0) buffer.set(k, { fixes: fixes.slice(-BUFFER_MAX_FIXES), misses: 0, vsi: [] });
    }
    if (buffer.size > 0) log(`restored buffer: ${buffer.size} keys`);
  } catch {
    /* fresh start */
  }
  log(`data dir: ${DATA_DIR}`);
  log(`poll every ${POLL_MS}ms — keep this process running; tabs may close.`);
  const loop = async () => {
    try {
      await tick();
    } catch (err) {
      log("poll failed:", err && err.message ? err.message : err);
    }
    setTimeout(loop, POLL_MS);
  };
  await loop();
}

function shutdown() {
  log("shutting down (state already flushed each poll).");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main();

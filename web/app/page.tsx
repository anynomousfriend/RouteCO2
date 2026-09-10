"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { OpenSkyLogo, OneInchLogo, CircleLogo, ArcLogo, PrivyLogo } from "@/components/PartnerLogos";
import "./routeco2.css";

export default function LandingPage() {
  useEffect(() => {
    document.title = "ROUTECO2 — Autonomous Flight Emissions Dispatcher";
    const prevBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#2d353b";

    const RM = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const $ = (s: string) => document.querySelector(s) as HTMLElement | null;
    const $$ = (s: string) => [...document.querySelectorAll(s)] as HTMLElement[];
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
    const pad = (n: number | string, l = 2) => String(n).padStart(l, "0");
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    const bay = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;
    const hex = (n: number) => {
      const arr = new Uint8Array(n);
      if (typeof window !== "undefined" && window.crypto) {
        window.crypto.getRandomValues(arr);
      }
      return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
    };

    /* ---------- repository links ---------- */
    const REPO = "https://github.com/anynomousfriend/RouteCO2";
    $$("[data-src]").forEach(a => { (a as HTMLAnchorElement).href = REPO + (a.dataset.src || ""); });
    $$(".repo-link").forEach(a => { (a as HTMLAnchorElement).href = REPO; });
    const cloneCmd = "git clone " + REPO + ".git";
    const cloneCmdEl = $("#cloneCmd");
    if (cloneCmdEl) cloneCmdEl.textContent = cloneCmd;

    /* ---------- zulu clocks ---------- */
    const zulu = (d = new Date()) => d.toISOString().slice(11, 19) + "Z";
    const tickClock = () => { const z = zulu(); $$(".zul").forEach(e => { e.textContent = z; }); };
    tickClock();
    const clockInterval = setInterval(tickClock, 1000);

    /* ---------- toast ---------- */
    let toastT: ReturnType<typeof setTimeout> | undefined;
    const toast = (m: string) => {
      const t = $("#toast");
      if (!t) return;
      t.textContent = m;
      t.classList.add("show");
      if (toastT) clearTimeout(toastT);
      toastT = setTimeout(() => t.classList.remove("show"), 2400);
    };
    const cloneBtn = $("#cloneBtn");
    const handleClone = async () => {
      try {
        await navigator.clipboard.writeText(cloneCmd);
        toast("CLONE COMMAND COPIED TO CLIPBOARD");
      } catch {
        toast("COPY FAILED — SELECT THE COMMAND MANUALLY");
      }
    };
    if (cloneBtn) cloneBtn.addEventListener("click", handleClone);

    /* ---------- ticker ---------- */
    const PLANE_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M12 2C12.7 2 13.1 3.2 13.15 4.6L13.2 8L22 12.6V13.8L13.2 12.4L13 17.5L16.4 19.8V21.2L12 20L7.6 21.2V19.8L11 17.5L10.8 12.4L2 13.8V12.6L10.8 8L10.85 4.6C10.9 3.2 11.3 2 12 2Z"/></svg>';
    const tickerTrack = $("#tickerTrack");
    if (tickerTrack) {
      const TICKS = [
        "LIVE ADS-B TELEMETRY", "ZERO-CUSTODY SETTLEMENT", "1INCH AQUA ROUTING",
        "CIRCLE AGENT STACK", "ARC TESTNET FINALITY", "PRIVY PASSKEY AUTH",
        "EMISSIONS METERED IN FLIGHT", "RECEIPTS INDEXED PER LEG", "POLICY-BOUNDED SPENDING"
      ];
      let h = "";
      for (let r = 0; r < 3; r++) TICKS.forEach(t => h += '<span class="ti">' + t + '</span><span class="tp">' + PLANE_SVG + '</span>');
      tickerTrack.innerHTML = h;
    }

    /* ---------- dithered sky ---------- */
    const sky = $("#sky") as HTMLCanvasElement | null;
    const sctx = sky ? sky.getContext("2d") : null;
    const SW = 340, SH = 200;
    if (sky && sctx) { sky.width = SW; sky.height = SH; }
    let skyT = rand(0, 90), skyLast = 0;
    function renderSky() {
      if (!sctx) return;
      const img = sctx.createImageData(SW, SH), d = img.data;
      for (let y = 0; y < SH; y++) {
        for (let x = 0; x < SW; x++) {
          const v = 0.5 + 0.30 * Math.sin(x * 0.05 + skyT * 0.9 + Math.sin(y * 0.11 + skyT * 0.35) * 1.4)
                + 0.24 * Math.sin(y * 0.062 - skyT * 0.55 + Math.sin(x * 0.033 + skyT * 0.2) * 1.8)
                + 0.16 * Math.sin((x * 1.35 + y) * 0.024 + skyT * 0.28);
          const th = bay(x, y);
          let r: number, g: number, b: number;
          if (v > th + 0.40) { r = 64; g = 84; b = 90; }
          else if (v > th + 0.10) { r = 57; g = 69; b = 76; }
          else { r = 36; g = 44; b = 49; }
          const i = (y * SW + x) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
        }
      }
      sctx.putImageData(img, 0, 0);
    }
    if (sctx) renderSky();

    /* ---------- radar simulation ---------- */
    const radarCv = $("#radar") as HTMLCanvasElement | null;
    const radarCtx = radarCv ? radarCv.getContext("2d") : null;
    interface Plane {
      x: number; y: number; hdg: number; spd: number;
      cs: string; fl: string; gs: number; tCO: string;
      state: number; done: boolean; trail: Array<{x: number, y: number, life: number, s: number}>;
      acc: number; label: number;
    }
    interface PingFX { x: number; y: number; t: number; max: number; txt: string; col: string; }

    const radar = {
      cv: radarCv,
      ctx: radarCtx,
      planes: [] as Plane[],
      fx: [] as PingFX[],
      sweep: rand(0, 6.28),
      mouse: null as {x: number, y: number} | null,
      settled: 0,
      w: 0,
      h: 0,
      dpr: 1,
      cap: 12,
      _pat: null as CanvasPattern | null,
      _rt: 0,
      resize() {
        if (!this.cv || !this.ctx) return;
        const parent = this.cv.parentElement;
        if (!parent) return;
        const r = parent.getBoundingClientRect();
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        this.w = r.width; this.h = r.height;
        this.cv.width = r.width * this.dpr; this.cv.height = r.height * this.dpr;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.cap = clamp(Math.round(r.width / 95), 7, 16);
      },
      cx() { return this.w * (this.w < 760 ? 0.5 : 0.66); },
      cy() { return this.h * 0.52; },
      R() { return Math.min(this.w, this.h) * 0.66; },
      zones() {
        const cx = this.cx(), cy = this.cy(), R = this.R();
        return [
          { x: cx + R * 0.30, y: cy - R * 0.24, r: R * 0.16, n: "CORRIDOR A" },
          { x: cx + R * 0.44, y: cy + R * 0.30, r: R * 0.11, n: "CORRIDOR B" }
        ];
      },
      newPlane(x?: number, y?: number): Plane {
        const AIRLINES = ["UAL","DLH","BAW","AFR","KLM","SIA","QTR","UAE","ANA","SWR","THY","IBE"];
        return {
          x: x ?? -30,
          y: y ?? rand(this.h * 0.12, this.h * 0.88),
          hdg: rand(-0.45, 0.45),
          spd: rand(55, 105),
          cs: pick(AIRLINES) + Math.floor(rand(10, 999)),
          fl: pad(Math.floor(rand(290, 411)), 3),
          gs: Math.floor(rand(430, 512)),
          tCO: rand(6, 44).toFixed(1),
          state: 0,
          done: false,
          trail: [],
          acc: 0,
          label: 0
        };
      },
      spawn(x?: number, y?: number) {
        this.planes.push(this.newPlane(x, y));
        if (this.planes.length > this.cap + 3) this.planes.shift();
        this.upRead();
      },
      upRead() {
        const el = $("#rTracks");
        if (el) el.textContent = pad(this.planes.length);
      },
      ping(p: Plane) {
        this.settled++;
        this.fx.push({ x: p.x, y: p.y, t: 1.6, max: 1.6, txt: "+" + p.tCO + "T CO₂E", col: "#a7c080" });
        const rLast = $("#rLast");
        if (rLast) rLast.textContent = p.cs + " +" + p.tCO + "T";
        const rSettled = $("#rSettled");
        if (rSettled) rSettled.textContent = String(this.settled);
      },
      step(dt: number) {
        const cx = this.cx(), cy = this.cy();
        for (const p of this.planes) {
          p.x += Math.cos(p.hdg) * p.spd * dt;
          p.y += Math.sin(p.hdg) * p.spd * dt;
          p.acc += p.spd * dt;
          if (p.acc > 9) {
            p.acc = 0;
            p.trail.push({ x: p.x, y: p.y, life: 1, s: p.state });
          }
          for (const t of p.trail) t.life -= dt / 3.6;
          while (p.trail.length && p.trail[0].life <= 0) p.trail.shift();
          let inZ = false;
          for (const z of this.zones()) {
            if ((p.x - z.x) ** 2 + (p.y - z.y) ** 2 < z.r * z.r) inZ = true;
          }
          if (inZ && p.state < 1) {
            p.state = Math.min(1, p.state + dt * 1.1);
            if (p.state >= 1 && !p.done) {
              p.done = true;
              this.ping(p);
            }
          }
          if (p.label > 0) p.label -= dt;
          if (p.x > this.w + 50 || p.x < -70 || p.y < -70 || p.y > this.h + 70) {
            Object.assign(p, this.newPlane());
            p.trail = [];
          }
        }
        this.sweep = (this.sweep + dt * 0.7) % (Math.PI * 2);
        for (const p of this.planes) {
          const a = ((Math.atan2(p.y - cy, p.x - cx)) + Math.PI * 2) % (Math.PI * 2);
          let d = Math.abs(a - this.sweep);
          d = Math.min(d, Math.PI * 2 - d);
          if (d < 0.06) p.label = 2.4;
        }
        for (const f of this.fx) {
          f.t -= dt;
          f.y -= dt * 14;
        }
        this.fx = this.fx.filter(f => f.t > 0);
        this._rt = (this._rt || 0) + dt;
        if (this._rt > 0.15) {
          this._rt = 0;
          const rSweep = $("#rSweep");
          if (rSweep) rSweep.textContent = pad(Math.round(this.sweep * 180 / Math.PI) % 360, 3) + "°";
        }
      },
      draw() {
        const c = this.ctx;
        if (!c) return;
        c.clearRect(0, 0, this.w, this.h);
        const cx = this.cx(), cy = this.cy(), R = this.R();
        const stateColor = (s: number) => ["#e67e80","#e69875","#dbbc7f","#a7c080"][Math.min(3, Math.floor(s * 4))];

        /* polar grid */
        c.strokeStyle = "rgba(127,187,179,.13)";
        c.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
          c.beginPath(); c.arc(cx, cy, R * i / 4, 0, 7); c.stroke();
        }
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6;
          c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
        }
        c.fillStyle = "rgba(157,170,164,.55)";
        c.font = '9px "IBM Plex Mono",monospace';
        c.fillText("100 NM", cx + R * 0.24, cy - 5);

        /* carbon-sink corridors */
        if (!this._pat) {
          const pc = document.createElement("canvas");
          pc.width = 4; pc.height = 4;
          const px = pc.getContext("2d");
          if (px) {
            px.fillStyle = "#a7c080"; px.fillRect(0, 0, 2, 2); px.fillRect(2, 2, 2, 2);
            this._pat = c.createPattern(pc, "repeat");
          }
        }
        c.font = '9px "IBM Plex Mono",monospace';
        for (const z of this.zones()) {
          if (this._pat) {
            c.globalAlpha = 0.10; c.fillStyle = this._pat;
            c.beginPath(); c.arc(z.x, z.y, z.r, 0, 7); c.fill();
          }
          c.globalAlpha = 0.5; c.setLineDash([4, 4]); c.strokeStyle = "#a7c080"; c.stroke(); c.setLineDash([]);
          c.globalAlpha = 0.7; c.fillStyle = "#a7c080";
          c.fillText(z.n + " — CARBON SINK", z.x - z.r, z.y - z.r - 7); c.globalAlpha = 1;
        }

        /* dithered contrails */
        for (const p of this.planes) {
          for (const t of p.trail) {
            if (bay(Math.floor(t.x), Math.floor(t.y)) > t.life * 1.15) continue;
            c.globalAlpha = Math.ceil(t.life * 5) / 5 * 0.85;
            c.fillStyle = stateColor(t.s);
            c.fillRect(t.x - 1, t.y - 1, 2, 2);
          }
        }
        c.globalAlpha = 1;

        /* radar sweep */
        for (let i = 0; i < 34; i++) {
          const a = this.sweep - i * 0.022;
          c.strokeStyle = "rgba(127,187,179," + (0.16 * (1 - i / 34)).toFixed(3) + ")";
          c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
        }
        c.fillStyle = "#7fbbb3";
        c.beginPath(); c.arc(cx + Math.cos(this.sweep) * R, cy + Math.sin(this.sweep) * R, 2, 0, 7); c.fill();

        /* aircraft + callsign labels */
        c.font = '10px "IBM Plex Mono",monospace';
        for (const p of this.planes) {
          const col = stateColor(p.state);
          c.save(); c.translate(p.x, p.y); c.rotate(p.hdg);
          c.fillStyle = col; c.beginPath();
          c.moveTo(9, 0); c.lineTo(-6, 5); c.lineTo(-3, 0); c.lineTo(-6, -5); c.closePath(); c.fill();
          c.restore();
          if (p.label > 0) {
            const txt = p.cs + " FL" + p.fl + " " + p.gs + "KT", w = c.measureText(txt).width;
            const lx = clamp(p.x - w / 2 - 6, 4, this.w - w - 16);
            const ly = clamp(p.y - 30, 4, this.h - 24);
            const al = Math.min(1, p.label);
            c.globalAlpha = al; c.fillStyle = "rgba(30,37,40,.88)"; c.fillRect(lx, ly, w + 12, 15);
            c.globalAlpha = al * 0.7; c.strokeStyle = col; c.strokeRect(lx + 0.5, ly + 0.5, w + 11, 14);
            c.globalAlpha = al; c.fillStyle = col; c.fillText(txt, lx + 6, ly + 11); c.globalAlpha = 1;
          }
        }

        /* settlement pings */
        c.font = '9px "IBM Plex Mono",monospace';
        for (const f of this.fx) {
          const k = f.t / f.max; c.globalAlpha = k;
          c.strokeStyle = f.col; c.beginPath(); c.arc(f.x, f.y, (1 - k) * 26 + 4, 0, 7); c.stroke();
          c.fillStyle = f.col; c.fillText(f.txt, f.x + 8, f.y - (1 - k) * 18); c.globalAlpha = 1;
        }

        /* mouse crosshair */
        if (this.mouse) {
          const m = this.mouse;
          c.strokeStyle = "rgba(211,198,170,.35)";
          c.beginPath(); c.moveTo(m.x - 10, m.y); c.lineTo(m.x + 10, m.y);
          c.moveTo(m.x, m.y - 10); c.lineTo(m.x, m.y + 10); c.stroke();
          c.fillStyle = "rgba(211,198,170,.6)";
          c.fillText("N" + (52 - (m.y / this.h) * 6).toFixed(2) + "° E" + (6 + (m.x / this.w) * 8).toFixed(2) + "°", m.x + 12, m.y - 10);
        }
      }
    };

    /* ---------- dithered contrail strip ---------- */
    function drawContrail() {
      const cv = $("#ctrail") as HTMLCanvasElement | null;
      if (!cv) return;
      const w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight;
      const c = cv.getContext("2d");
      if (!c || w === 0 || h === 0) return;
      const img = c.createImageData(w, h), d = img.data;
      const pal = [[230,126,128],[230,152,117],[219,188,127],[167,192,128]];
      for (let x = 0; x < w; x++) {
        const t = x / w, cy = h * 0.5 + Math.sin(x * 0.02) * 7 + Math.sin(x * 0.047 + 2) * 5, sg = h * 0.16;
        for (let y = 0; y < h; y++) {
          const g = Math.exp(-((y - cy) ** 2) / (2 * sg * sg)), v = g * 1.5 - 0.22;
          if (v > bay(x, y)) {
            const p = pal[Math.min(3, Math.floor(t * 4))], i = (y * w + x) * 4;
            d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 235;
          }
        }
      }
      c.putImageData(img, 0, 0);
      c.save(); c.translate(w * 0.52, h * 0.5); c.fillStyle = "#d3c6aa";
      c.beginPath(); c.moveTo(11, 0); c.lineTo(-8, 6.5); c.lineTo(-4, 0); c.lineTo(-8, -6.5); c.closePath(); c.fill();
      c.restore();
    }

    /* ---------- pipeline animation ---------- */
    let pipePos = 0, pipePrev = 0, pingT = 0;
    const pipePath = $("#pipePath") as SVGPathElement | null;
    const pipeTrailEl = $("#pipeTrail") as SVGPathElement | null;
    const pipePlaneEl = $("#pipePlane") as SVGGElement | null;
    const pipePingEl = $("#pipePing") as SVGCircleElement | null;
    let pipeL = 0;
    try { if (pipePath) pipeL = pipePath.getTotalLength(); } catch {}
    const PIPE_X = [95, 337.5, 580, 822.5, 1065], PIPE_COOL = [0, 0, 0, 0, 0];

    function pipeFrame(dt: number) {
      if (!pipeL || !pipePath || !pipePlaneEl || !pipeTrailEl || !pipePingEl) return;
      pipePos = (pipePos + dt * 130) % pipeL;
      const pt = pipePath.getPointAtLength(pipePos);
      const pt2 = pipePath.getPointAtLength(Math.min(pipeL, pipePos + 1.5));
      const ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
      pipePlaneEl.setAttribute("transform", "translate(" + pt.x.toFixed(1) + " " + pt.y.toFixed(1) + ") rotate(" + ang.toFixed(1) + ")");
      pipeTrailEl.setAttribute("strokeDasharray", pipePos + " " + (pipeL - pipePos + 12));
      const nodes = $$("#pipe .pipe-node");
      PIPE_X.forEach((x, i) => {
        PIPE_COOL[i] = Math.max(0, PIPE_COOL[i] - dt);
        const crossed = (pipePrev < x && pipePos >= x) || (pipePrev > pipePos && pipePos >= x);
        if (crossed && PIPE_COOL[i] <= 0 && nodes[i]) {
          PIPE_COOL[i] = 0.5;
          nodes[i].classList.add("hit");
          setTimeout(() => nodes[i]?.classList.remove("hit"), 420);
        }
      });
      if (pipePrev < pipeL - 6 && pipePos >= pipeL - 6) pingT = 1;
      pipePrev = pipePos;
      if (pingT > 0) {
        pingT = Math.max(0, pingT - dt * 1.4);
        pipePingEl.setAttribute("r", (6 + (1 - pingT) * 30).toFixed(1));
        pipePingEl.setAttribute("opacity", pingT.toFixed(2));
      } else {
        pipePingEl.setAttribute("opacity", "0");
      }
    }

    /* ---------- loop & observers ---------- */
    let heroVis = true, lastT = performance.now();
    let animId = 0;
    const topEl = $("#top");
    let heroObserver: IntersectionObserver | undefined;
    if (topEl) {
      heroObserver = new IntersectionObserver(e => { heroVis = e[0].isIntersecting; }, { threshold: 0.02 });
      heroObserver.observe(topEl);
    }

    radar.resize();
    for (let i = 0; i < radar.cap; i++) radar.spawn();
    drawContrail();

    function loop(ts: number) {
      animId = requestAnimationFrame(loop);
      if (!heroVis) return;
      const dt = Math.min(0.05, (ts - lastT) / 1000);
      lastT = ts;
      if (RM) return;
      if (ts - skyLast > 140) { skyLast = ts; skyT += 0.5; renderSky(); }
      radar.step(dt);
      radar.draw();
      pipeFrame(dt);
    }
    animId = requestAnimationFrame(loop);

    /* ---------- hero mouse interactions ---------- */
    const handlePointerMove = (e: PointerEvent) => {
      if (!radar.cv) return;
      const r = radar.cv.getBoundingClientRect();
      radar.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const handlePointerLeave = () => { radar.mouse = null; };
    const handleHeroClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a,button")) return;
      if (radar.planes.length >= radar.cap + 3 || !radar.cv) return;
      const r = radar.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      radar.spawn(x, y);
      radar.fx.push({ x, y, t: 0.8, max: 0.8, txt: "TRACK ADDED", col: "#dbbc7f" });
      if (RM) { radar.step(0); radar.draw(); }
    };

    if (topEl) {
      topEl.addEventListener("pointermove", handlePointerMove);
      topEl.addEventListener("pointerleave", handlePointerLeave);
      topEl.addEventListener("click", handleHeroClick);
    }

    /* ---------- window resize ---------- */
    let rzT: ReturnType<typeof setTimeout> | undefined;
    const handleResize = () => {
      if (rzT) clearTimeout(rzT);
      rzT = setTimeout(() => {
        radar.resize();
        drawContrail();
        try { if (pipePath) pipeL = pipePath.getTotalLength(); } catch {}
        if (RM) { radar.step(0); radar.draw(); }
      }, 200);
    };
    window.addEventListener("resize", handleResize);

    /* ---------- reveals & self-drawing schematic ---------- */
    function drawSchem() {
      $$("#schem .draw").forEach((p, i) => {
        const svgPath = p as unknown as SVGPathElement;
        if (typeof svgPath.getTotalLength === "function") {
          const L = svgPath.getTotalLength();
          p.style.strokeDasharray = String(L);
          p.style.strokeDashoffset = String(L);
          p.getBoundingClientRect(); // reflow
          p.style.transition = "stroke-dashoffset 1.3s " + (i * 0.14).toFixed(2) + "s cubic-bezier(.4,0,.2,1)";
          p.style.strokeDashoffset = "0";
        }
      });
    }

    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add("on");
      io.unobserve(en.target);
      if (en.target.id === "schemWrap") drawSchem();
    }), { threshold: 0.16 });
    $$(".rv").forEach(el => io.observe(el));

    const cio = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      cio.unobserve(en.target);
      const el = en.target as HTMLElement;
      const to = parseFloat(el.dataset.to || "0"), from = parseFloat(el.dataset.from || "0");
      const dec = +(el.dataset.dec || 0), t0 = performance.now(), D = 1500;
      function f(t: number) {
        const k = clamp((t - t0) / D, 0, 1), e = 1 - Math.pow(1 - k, 3);
        el.textContent = (from + (to - from) * e).toFixed(dec);
        if (k < 1) requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
    }), { threshold: 0.5 });
    $$(".count").forEach(el => cio.observe(el));

    const spy = new IntersectionObserver(es => es.forEach(en => {
      const a = $('.nav-links a[href="#' + en.target.id + '"]');
      if (a) a.classList.toggle("act", en.isIntersecting);
    }), { rootMargin: "-45% 0px -50% 0px" });
    ["dispatcher", "problem", "stack", "console", "source"].forEach(id => {
      const el = document.getElementById(id);
      if (el) spy.observe(el);
    });

    /* ---------- accordions ---------- */
    const accHeads = $$(".acc-head");
    const accHandlers: Array<() => void> = [];
    accHeads.forEach(h => {
      const handler = () => {
        const acc = h.closest(".acc");
        if (acc) {
          const open = acc.classList.toggle("open");
          h.setAttribute("aria-expanded", String(open));
        }
      };
      accHandlers.push(handler);
      h.addEventListener("click", handler);
    });

    /* ---------- dispatch console simulation ---------- */
    const term = $("#termLog"), skel = $("#skel"), fstrip = $("#fstrip"), receipt = $("#receipt");
    const steps = $$("#steps li");
    const setStep = (i: number, s: string) => { if (steps[i]) steps[i].dataset.s = s; };
    const resetSteps = () => steps.forEach(li => li.removeAttribute("data-s"));

    const ROUTES = [["FRA","JFK"],["LHR","DXB"],["SFO","NRT"],["CDG","SIN"],["AMS","YYZ"],["MAD","EZE"],["ZRH","ORD"],["IST","BKK"],["MUC","PEK"],["CPH","LAX"]];
    const TYPES: Array<[string, string, number]> = [
      ["A20N","AIRBUS A320NEO",2.45],["B38M","BOEING 737-8",2.6],["A21N","AIRBUS A321NEO",2.72],
      ["A359","AIRBUS A350-900",5.35],["B77W","BOEING 777-300ER",7.6],["B789","BOEING 787-9",5.05]
    ];
    const CRED = [["TCO2-C","TOUCAN BASE CARBON TONNE"],["NCT-OA","NATURE CARBON TONNE"],["BCT-OA","BASE CARBON TONNE"]];

    async function typeLine(msg: string, cls?: string) {
      if (!term) return;
      const el = document.createElement("div");
      el.className = "tl " + (cls || "");
      el.innerHTML = "<i>[" + zulu() + "]</i> ";
      term.appendChild(el);
      if (RM) {
        el.innerHTML += msg;
        term.scrollTop = term.scrollHeight;
        return;
      }
      for (let i = 0; i < msg.length; i++) {
        el.appendChild(document.createTextNode(msg[i]));
        if (i % 3 === 0) term.scrollTop = term.scrollHeight;
        await sleep(7 + Math.random() * 9);
      }
      term.scrollTop = term.scrollHeight;
    }

    function genFlight() {
      const AIRLINES = ["UAL","DLH","BAW","AFR","KLM","SIA","QTR","UAE","ANA","SWR","THY","IBE"];
      const ty = pick(TYPES), dist = Math.round(rand(900, 4200));
      const fuel = dist * ty[2], co2 = fuel * 3.16 / 1000;
      return {
        cs: pick(AIRLINES) + Math.floor(rand(2, 999)),
        r: pick(ROUTES),
        ty,
        dist,
        co2,
        usdc: co2 * rand(11, 16),
        fl: pad(Math.round(rand(29, 41)) * 10, 3),
        gs: Math.floor(rand(430, 512)),
        cred: pick(CRED),
        block: 1100000 + Math.floor(rand(0, 190000)),
        ms: Math.round(rand(280, 900)),
        tx: "0x" + hex(20),
        ret: "RET-" + hex(3).toUpperCase(),
        wal: "0x" + hex(4).toUpperCase() + "…" + hex(2).toUpperCase()
      };
    }

    let running = false, cycles = 0, totCO = 0, totUSD = 0;
    async function runCycle() {
      if (running) return;
      running = true;
      const btn = $("#runBtn") as HTMLButtonElement | null;
      if (btn) {
        btn.disabled = true;
        const s = btn.querySelector("span");
        if (s) s.textContent = "DISPATCH IN PROGRESS…";
      }
      if (skel) skel.classList.add("hide");
      if (fstrip) fstrip.hidden = false;
      if (receipt) receipt.classList.remove("show");
      if (term) term.innerHTML = "";
      resetSteps();

      const f = genFlight();
      const money = (u: number) => u.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fsCs = $("#fsCs"), fsRte = $("#fsRte"), fsTy = $("#fsTy"), fsFl = $("#fsFl"), fsGs = $("#fsGs"), fsDist = $("#fsDist"), fsCo = $("#fsCo");
      if (fsCs) fsCs.textContent = f.cs;
      if (fsRte) fsRte.innerHTML = f.r[0] + ' <span class="fs-plane">' + PLANE_SVG + '</span> ' + f.r[1];
      if (fsTy) fsTy.textContent = f.ty[1];
      if (fsFl) fsFl.textContent = "FL" + f.fl;
      if (fsGs) fsGs.textContent = f.gs + " KT";
      if (fsDist) fsDist.textContent = f.dist.toLocaleString("en-US") + " KM";
      if (fsCo) fsCo.textContent = f.co2.toFixed(1) + " T";

      const seq: Array<[number, Array<[string, string]>]> = [
        [0, [
          ["ADS-B state acquired — " + f.cs + " · " + f.ty[0] + " · FL" + f.fl + " · GS " + f.gs + " KT", "blue"],
          ["source OPENSKY /states/all · icao24 " + hex(6) + " · cadence 10 s", "grey"]
        ]],
        [1, [
          ["leg closed — great-circle " + f.dist.toLocaleString("en-US") + " KM", "blue"],
          ["burn model " + f.ty[0] + " (" + f.ty[1] + "): " + Math.round(f.co2 / 3.16).toLocaleString("en-US") + " KG fuel → " + f.co2.toFixed(1) + " T CO₂E ±4%", "yellow"]
        ]],
        [2, [
          ["requesting route USDC → " + f.cred[0] + " … 1INCH AQUA", "aqua"],
          ["quote: " + money(f.usdc) + " USDC → " + f.co2.toFixed(1) + " " + f.cred[0] + " · route 1 · impact 0.31% · guard 0.5%", "aqua"]
        ]],
        [3, [
          ["circle agent wallet " + f.wal + " signed · policy MAX 500 USDC/cycle · custody held: 0", "yellow"]
        ]],
        [4, [
          ["broadcast → arc testnet · block " + f.block.toLocaleString("en-US"), "orange"],
          ["settlement finalized in " + f.ms + " MS · tx " + f.tx + "…", "green"]
        ]],
        [5, [
          ["retirement " + f.ret + " executed → certificate burned · beneficiary 0x" + hex(6) + "…", "green"],
          ["DISPATCH COMPLETE — " + f.co2.toFixed(1) + " T CO₂E retired for " + f.cs, "green"]
        ]]
      ];

      for (const [si, lines] of seq) {
        setStep(si, "act");
        for (const [m, c] of lines) {
          await typeLine(m, c);
          await sleep(RM ? 40 : 170);
        }
        setStep(si, "done");
      }

      const rcTx = $("#rcTx"), rcBlock = $("#rcBlock"), rcFinal = $("#rcFinal"), rcRoute = $("#rcRoute");
      const rcAmt = $("#rcAmt"), rcCo = $("#rcCo"), rcRet = $("#rcRet"), rcCred = $("#rcCred");
      if (rcTx) rcTx.textContent = f.tx + "…";
      if (rcBlock) rcBlock.textContent = f.block.toLocaleString("en-US");
      if (rcFinal) rcFinal.textContent = f.ms + " MS";
      if (rcRoute) rcRoute.textContent = "USDC → " + f.cred[0] + " · 1INCH AQUA ROUTE 1";
      if (rcAmt) rcAmt.textContent = money(f.usdc) + " USDC";
      if (rcCo) rcCo.textContent = f.co2.toFixed(1) + " T CO₂E";
      if (rcRet) rcRet.textContent = f.ret;
      if (rcCred) rcCred.textContent = f.cred[1];
      if (receipt) receipt.classList.add("show");

      cycles++; totCO += f.co2; totUSD += f.usdc;
      const cCycles = $("#cCycles"), cCo = $("#cCo"), cUsd = $("#cUsd");
      if (cCycles) cCycles.textContent = String(cycles);
      if (cCo) cCo.textContent = totCO.toFixed(1) + " T";
      if (cUsd) cUsd.textContent = "$" + totUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      ["#cCycles", "#cCo", "#cUsd"].forEach(s => {
        const e = $(s);
        if (e) {
          e.classList.remove("bump");
          void e.offsetWidth;
          e.classList.add("bump");
        }
      });

      if (btn) {
        btn.disabled = false;
        const s = btn.querySelector("span");
        if (s) s.textContent = "RUN ANOTHER CYCLE";
      }
      running = false;
    }

    const runBtn = $("#runBtn");
    if (runBtn) runBtn.addEventListener("click", runCycle);

    const resetBtn = $("#resetBtn");
    const handleReset = () => {
      if (running) return;
      if (term) term.innerHTML = "";
      if (receipt) receipt.classList.remove("show");
      if (fstrip) fstrip.hidden = true;
      if (skel) skel.classList.remove("hide");
      resetSteps();
      const s = $("#runBtn")?.querySelector("span");
      if (s) s.textContent = "RUN DISPATCH CYCLE";
    };
    if (resetBtn) resetBtn.addEventListener("click", handleReset);

    /* ---------- altimeter scroll rail ---------- */
    const at = $("#altTicks");
    if (at && at.children.length === 0) {
      for (let i = 0; i < 21; i++) {
        const t = document.createElement("i");
        if (i % 5 === 0) t.className = "maj";
        at.appendChild(t);
      }
    }
    const needle = $("#altNeedle"), flEl = $("#altFl");
    let scT = false;
    const updateAltimeter = () => {
      scT = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const k = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      if (needle) needle.style.top = (k * 100) + "%";
      if (flEl) flEl.textContent = "FL" + pad(Math.round(k * 350), 3);
    };
    const handleScroll = () => {
      if (!scT) {
        scT = true;
        requestAnimationFrame(updateAltimeter);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    updateAltimeter();

    /* ---------- reticle cursor ---------- */
    let handleRetPointerMove: ((e: PointerEvent) => void) | undefined;
    let retAnimId = 0;
    const ret = $("#ret");
    if (window.matchMedia("(pointer:fine)").matches && !RM && ret) {
      let rx = window.innerWidth / 2, ry = window.innerHeight / 2, tx = rx, ty = ry;
      handleRetPointerMove = (e: PointerEvent) => {
        tx = e.clientX; ty = e.clientY;
        ret.classList.toggle("hot", !!(e.target as HTMLElement)?.closest("a,button,.acc-head"));
      };
      window.addEventListener("pointermove", handleRetPointerMove, { passive: true });
      const rl = () => {
        rx += (tx - rx) * 0.2; ry += (ty - ry) * 0.2;
        ret.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
        retAnimId = requestAnimationFrame(rl);
      };
      retAnimId = requestAnimationFrame(rl);
    } else if (ret) {
      ret.style.display = "none";
    }

    /* ---------- cleanup ---------- */
    return () => {
      document.body.style.backgroundColor = prevBg;
      clearInterval(clockInterval);
      if (toastT) clearTimeout(toastT);
      if (animId) cancelAnimationFrame(animId);
      if (retAnimId) cancelAnimationFrame(retAnimId);
      if (rzT) clearTimeout(rzT);
      if (heroObserver) heroObserver.disconnect();
      io.disconnect();
      cio.disconnect();
      spy.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      if (handleRetPointerMove) window.removeEventListener("pointermove", handleRetPointerMove);
      if (topEl) {
        topEl.removeEventListener("pointermove", handlePointerMove);
        topEl.removeEventListener("pointerleave", handlePointerLeave);
        topEl.removeEventListener("click", handleHeroClick);
      }
      if (cloneBtn) cloneBtn.removeEventListener("click", handleClone);
      if (runBtn) runBtn.removeEventListener("click", runCycle);
      if (resetBtn) resetBtn.removeEventListener("click", handleReset);
      accHeads.forEach((h, i) => h.removeEventListener("click", accHandlers[i]));
    };
  }, []);

  return (
    <div className="routeco2-root">
<div id="grain" aria-hidden="true"></div>
<div id="ret" aria-hidden="true"></div>
<div id="toast" role="status" aria-live="polite"></div>

{/* scroll altimeter */}
<aside id="alt" aria-hidden="true">
  <div className="alt-ticks" id="altTicks"></div>
  <div id="altNeedle"></div>
  <div className="alt-read"><b id="altFl">FL000</b><span>ALT</span></div>
</aside>

<nav id="nav">
  <a className="brand" href="#top" aria-label="RouteCO2 home">
    <img src="/logo.svg" width={22} height={22} alt="RouteCO2" className="rounded-[5px] shadow-sm" />
    <span><b>ROUTECO2</b><small>EMISSIONS DISPATCHER</small></span>
  </a>
  <div className="nav-links">
    <a href="#dispatcher">DISPATCHER</a>
    <a href="#problem">PROBLEM</a>
    <a href="#stack">FLIGHT PLAN</a>
    <a href="#console">CONSOLE</a>
    <a href="#source">SOURCE</a>
    <Link href="/app" style={{ color: 'var(--green)', fontWeight: 600 } as React.CSSProperties}>LIVE CONSOLE ↗</Link>
  </div>
  <div className="nav-meta"><span className="dot"></span><span>ARC TESTNET</span><span className="zul">--:--:--Z</span></div>
</nav>

{/* ================= HERO ================= */}
<header id="top" className="hero">
  <canvas id="sky" aria-hidden="true"></canvas>
  <canvas id="radar" aria-hidden="true"></canvas>

  <div className="hero-in wrap">
    <p className="eyebrow">// AUTONOMOUS FLIGHT EMISSIONS DISPATCHER · OPENSKY × 1INCH × CIRCLE × ARC</p>
    <h1>
      <span className="hl-line"><span>EVERY CONTRAIL</span></span>
      <span className="hl-line"><span className="dither-text">SETTLES ITSELF.</span></span>
    </h1>
    <p className="hero-sub">
      RouteCO2 watches the live <b>OpenSky ADS-B</b> feed, turns every tracked leg into a measured
      emissions profile, and settles carbon offsets autonomously — quoted through <b>1inch Aqua</b>,
      signed by a <b>Circle agent wallet</b>, finalized on <b>Arc Testnet</b>.
      No custodian. No invoice. No waiting for the aircraft to land.
    </p>
    <div className="hero-cta">
      <Link className="btn primary" href="/app"><span className="fill"></span><span>LAUNCH 3D CONSOLE ↗</span></Link>
      <a className="btn ghost" href="#console"><span className="fill"></span><span>RUN A DISPATCH CYCLE</span>
        <svg className="arr" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2"/></svg></a>
      <a className="btn ghost repo-link" href="https://github.com/anynomousfriend/RouteCO2" target="_blank" rel="noopener noreferrer"><span className="fill"></span>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>
        <span>VIEW SOURCE</span></a>
    </div>
    <div className="hero-chips" aria-label="Stack summary">
      <span className="chip" title="OpenSky Network ADS-B Telemetry"><OpenSkyLogo size={14} color="var(--blue)" /><span>OPENSKY</span></span><span className="chip-plus">+</span>
      <span className="chip" title="1inch Aqua Liquidity Layer"><OneInchLogo size={14} /><span>1INCH AQUA</span></span><span className="chip-plus">+</span>
      <span className="chip" title="Circle Agent Stack Signer"><CircleLogo size={14} color="var(--yellow)" /><span>CIRCLE AGENT</span></span><span className="chip-plus">+</span>
      <span className="chip" title="Arc Testnet USDC Settlement"><ArcLogo size={14} color="var(--green)" /><span>ARC TESTNET</span></span><span className="chip-plus">+</span>
      <span className="chip" title="Privy Passkey & Manifest Delegation"><PrivyLogo size={14} color="var(--purple)" /><span>PRIVY</span></span>
    </div>
  </div>

  <div className="hero-hint">[ CLICK AIRSPACE TO INJECT TRAFFIC ]</div>
  <div className="hero-read" aria-hidden="true">
    <div><span>TRACKS</span><b id="rTracks">00</b></div>
    <div><span>SWEEP</span><b id="rSweep">000°</b></div>
    <div><span>SETTLED</span><b id="rSettled">0</b></div>
    <div><span>LAST EVENT</span><b id="rLast">STANDBY</b></div>
  </div>

  <div className="ticker" aria-hidden="true"><div className="ticker-track" id="tickerTrack"></div></div>
</header>

<main>
{/* ================= SEC 01 — WHAT IT IS ================= */}
<section id="dispatcher" className="sec">
  <div className="wrap">
    <div className="sec-head rv"><span className="sec-idx">SEC.01</span><span className="sec-path">// WHAT IT IS</span><span className="sec-rule"></span><span className="sec-tag">THE DISPATCHER</span></div>

    <div className="disp-top">
      <div className="rv">
        <h2 className="sec-title">An autonomous controller for flight emissions. It senses, measures and settles — on a loop, every ten seconds.</h2>
        <p className="lead">RouteCO2 behaves the way air-traffic control behaves toward a radar blip: continuous contact, a flight plan per leg, and a clearance delivered at the right moment. Only here, the clearance is a carbon settlement.</p>
      </div>
      <div className="rv" style={{ ['--d']: '.12s' } as React.CSSProperties} id="schemWrap">
        <svg id="schem" viewBox="0 0 220 344" aria-label="Airframe schematic">
          <path className="sD" d="M110 6V334"/>
          <path className="sA draw" d="M110 14 C115 14 119 40 119 72 L119 252 C119 288 115 306 110 312 C105 306 101 288 101 252 L101 72 C101 40 105 14 110 14 Z"/>
          <path className="sA draw" d="M119 118 L206 166 L206 178 L119 152 Z"/>
          <path className="sA draw" d="M101 118 L14 166 L14 178 L101 152 Z"/>
          <path className="sA draw" d="M119 266 L156 288 L156 297 L119 285 Z"/>
          <path className="sA draw" d="M101 266 L64 288 L64 297 L101 285 Z"/>
          <path className="sF draw" d="M123 128h16v14h-16z"/>
          <path className="sF draw" d="M81 128h16v14h-16z"/>
          <path className="sD draw" d="M14 324H206 M14 320v8 M206 320v8"/>
          <path className="sD draw" d="M119 60 H214 M210 56v8"/>
          <circle className="beacon" cx="110" cy="14" r="2.4"/>
          <text x="110" y="338" textAnchor="middle">WINGSPAN 64.4 M</text>
          <text x="212" y="54" textAnchor="end">CRUISE FL370</text>
        </svg>
        <p className="schem-cap">FIG.01 — WIDEBORD EMISSIONS UNIT (A359) · SELF-DRAWING SKELETON</p>
      </div>
    </div>

    <div className="pipe-wrap rv" id="pipeWrap">
      <svg id="pipe" className="pipe" viewBox="0 0 1160 250" fill="none" aria-label="Dispatch pipeline">
        <path id="pipePath" d="M95 130H1065" stroke="rgba(211,198,170,.25)" strokeWidth="1.5" strokeDasharray="4 5"/>
        <path id="pipeTrail" d="M95 130H1065" stroke="var(--aqua)" strokeWidth="1.5" opacity=".9"/>
        <text className="slab fadein" style={{ ['--i']: '5' } as React.CSSProperties} x="216" y="118">10S CADENCE</text>
        <text className="slab fadein" style={{ ['--i']: '6' } as React.CSSProperties} x="458" y="118">KG CO₂E</text>
        <text className="slab fadein" style={{ ['--i']: '7' } as React.CSSProperties} x="701" y="118">BEST ROUTE</text>
        <text className="slab fadein" style={{ ['--i']: '8' } as React.CSSProperties} x="943" y="118">AGENT-SIGNED</text>

        <g transform="translate(20 97)"><g className="pipe-node" style={{ ['--i']: '0' } as React.CSSProperties}>
          <rect className="nrect" width="150" height="66" rx="3"/><text className="nidx" x="138" y="17">01</text>
          <g transform="translate(24 33)"><circle className="gld" r="2"/><path className="gl" d="M-1 -1a5.6 5.6 0 0 1 5.6 5.6M2 -5.4a10.4 10.4 0 0 1 10.4 10.4"/></g>
          <text className="nname" x="41" y="31">OPENSKY</text><text className="nsub" x="41" y="46">ADS-B FEED</text>
        </g></g>
        <g transform="translate(262.5 97)"><g className="pipe-node" style={{ ['--i']: '1' } as React.CSSProperties}>
          <rect className="nrect" width="150" height="66" rx="3"/><text className="nidx" x="138" y="17">02</text>
          <g transform="translate(24 33)"><path className="gl" d="M-7 4a8 8 0 1 1 14 0"/><path className="gl" d="M0 4L4.2 -2"/><circle className="gld" r="1.4"/></g>
          <text className="nname" x="41" y="31">BURN MODEL</text><text className="nsub" x="41" y="46">EMISSIONS ENGINE</text>
        </g></g>
        <g transform="translate(505 97)"><g className="pipe-node" style={{ ['--i']: '2' } as React.CSSProperties}>
          <rect className="nrect" width="150" height="66" rx="3"/><text className="nidx" x="138" y="17">03</text>
          <g transform="translate(24 33)"><path className="gl" d="M0 -7L7 0 0 7 -7 0Z"/><path className="gl" d="M0 -3L3 0 0 3 -3 0Z"/></g>
          <text className="nname" x="41" y="31">1INCH AQUA</text><text className="nsub" x="41" y="46">ROUTE + QUOTE</text>
        </g></g>
        <g transform="translate(747.5 97)"><g className="pipe-node" style={{ ['--i']: '3' } as React.CSSProperties}>
          <rect className="nrect" width="150" height="66" rx="3"/><text className="nidx" x="138" y="17">04</text>
          <g transform="translate(24 33)"><path className="gl" d="M0 -7L6 -4.5V1C6 4.5 3 6.5 0 7.5C-3 6.5 -6 4.5 -6 1V-4.5Z"/><path className="gl" d="M-2.4 0l1.8 1.8L2.6 -1.6"/></g>
          <text className="nname" x="41" y="31">CIRCLE AGENT</text><text className="nsub" x="41" y="46">WALLET / POLICY</text>
        </g></g>
        <g transform="translate(990 97)"><g className="pipe-node" style={{ ['--i']: '4' } as React.CSSProperties}>
          <rect className="nrect" width="150" height="66" rx="3"/><text className="nidx" x="138" y="17">05</text>
          <g transform="translate(24 33)"><path className="gl" d="M0 -7.5L6.5 -3.75V3.75L0 7.5L-6.5 3.75V-3.75Z"/><circle className="gl" r="2.4"/></g>
          <text className="nname" x="41" y="31">ARC TESTNET</text><text className="nsub" x="41" y="46">SETTLEMENT</text>
        </g></g>

        <text className="ncap fadein" style={{ ['--i']: '5' } as React.CSSProperties} x="95" y="195">LIVE TELEMETRY</text>
        <text className="ncap fadein" style={{ ['--i']: '6' } as React.CSSProperties} x="337.5" y="195">MEASURE</text>
        <text className="ncap fadein" style={{ ['--i']: '7' } as React.CSSProperties} x="580" y="195">PRICE + LIQUIDITY</text>
        <text className="ncap fadein" style={{ ['--i']: '8' } as React.CSSProperties} x="822.5" y="195">ZERO-CUSTODY SIGNING</text>
        <text className="ncap fadein" style={{ ['--i']: '9' } as React.CSSProperties} x="1065" y="195">FINAL SETTLEMENT</text>

        <g id="pipePlane"><path transform="translate(-9 -9) scale(0.78)" fill="var(--yellow)" d="M12 2C12.7 2 13.1 3.2 13.15 4.6L13.2 8L22 12.6V13.8L13.2 12.4L13 17.5L16.4 19.8V21.2L12 20L7.6 21.2V19.8L11 17.5L10.8 12.4L2 13.8V12.6L10.8 8L10.85 4.6C10.9 3.2 11.3 2 12 2Z"/></g>
        <circle id="pipePing" cx="1065" cy="130" r="6" stroke="var(--green)" fill="none" opacity="0"/>
      </svg>
    </div>

    <div className="notes">
      <div className="note rv"><b>01 — SENSE</b><p>RouteCO2 polls OpenSky's state-vector feed on a ten-second cadence — <strong>position, geo-altitude, ground speed, track</strong> — and maintains live contact with every aircraft in scope, exactly the way a controller keeps a blip on the scope.</p></div>
      <div className="note rv" style={{ ['--d']: '.1s' } as React.CSSProperties}><b>02 — MEASURE</b><p>Each closed leg is run through a great-circle distance calculation and an airframe-specific burn model — an A320neo and a 777-300ER burn very different fuel per kilometre — producing a defensible <strong>tCO₂e figure with a stated error band</strong>, before the chocks go in.</p></div>
      <div className="note rv" style={{ ['--d']: '.2s' } as React.CSSProperties}><b>03 — SETTLE</b><p>At leg closure the dispatcher requests a USDC → carbon-credit route from <strong>1inch Aqua</strong>, the <strong>Circle agent wallet</strong> signs the swap and retirement under a hard spend policy, and <strong>Arc Testnet</strong> finalizes the settlement in under a second. Between cycles the agent holds nothing — <strong>custody is zero by construction</strong>.</p></div>
    </div>
  </div>
</section>

{/* ================= SEC 02 — PROBLEM ================= */}
<section id="problem" className="sec alt">
  <div className="wrap">
    <div className="sec-head rv"><span className="sec-idx">SEC.02</span><span className="sec-path">// THE PROBLEM</span><span className="sec-rule"></span><span className="sec-tag">WHY THIS EXISTS</span></div>
    <div className="prob-grid">
      <div className="prob-left rv">
        <h2 className="sec-title">Carbon accounting still flies on paper trust — batched, custodial, weeks behind the aircraft.</h2>
        <p className="lead">The telemetry to meter aviation emissions already exists, in the clear, for free. The money rails to settle against it in seconds now exist too. Nobody has wired the two together. RouteCO2 is that wire.</p>
      </div>
      <div className="rv" style={{ ['--d']: '.1s' } as React.CSSProperties}>
        <div className="stat">
          <div className="num c-orange"><span className="count" data-to="2.5" data-dec="1">0</span><small>%</small></div>
          <p><b>SHARE OF GLOBAL CO₂</b>Around 2.5% of global CO₂ comes from aviation — and at altitude, contrails and NOx roughly double its true radiative forcing.</p>
        </div>
        <div className="stat">
          <div className="num c-red">≈<span className="count" data-to="900">0</span><small>MT</small></div>
          <p><b>EMITTED EVERY YEAR</b>Roughly 900 megatonnes of CO₂ a year from commercial aviation, with traffic forecast to roughly double by 2040.</p>
        </div>
        <div className="ctrail-wrap" aria-hidden="true"><canvas id="ctrail"></canvas><span className="l">EMITTED</span><span className="r">RETIRED</span></div>
        <div className="stat">
          <div className="num c-yellow">T+<span className="count" data-to="45">0</span><small>DAYS</small></div>
          <p><b>OFFSET SETTLEMENT LAG</b>Weeks are typical for a voluntary offset to travel from a buyer's cash to a retired certificate — through brokers, custodians and registries, each taking a cut.</p>
        </div>
        <div className="stat">
          <div className="num c-blue"><span className="count" data-from="100" data-to="0">100</span><small>%</small></div>
          <p><b>VISIBILITY AT FLIGHT TIME</b>Zero linkage between the flight you took and the credit retired in its name. Offsets settle in batch, long after the leg — a problem measured in seconds is being solved in fiscal quarters.</p>
        </div>
        <div className="why">
          <div><b>THE TELEMETRY ALREADY EXISTS</b><p>Every commercial aircraft broadcasts ADS-B openly. The data needed to meter emissions in real time is free, live — and almost nobody settles against it.</p></div>
          <div><b>THE PIPELINE IS CUSTODIAL</b><p>Offsets change hands through intermediaries that hold both the money and the credit. Every extra set of hands is a fee, a delay, and a counterparty risk.</p></div>
          <div><b>THE LOOP NEVER CLOSES</b><p>Emissions happen at cruise altitude; the offset lands weeks later, if at all. There is no closed feedback loop between an aircraft and its carbon.</p></div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* ================= SEC 03 — PARTNER STACK ================= */}
<section id="stack" className="sec">
  <div className="wrap">
    <div className="sec-head rv"><span className="sec-idx">SEC.03</span><span className="sec-path">// PARTNER-TRACK STACK</span><span className="sec-rule"></span><span className="sec-tag">FLIGHT PLAN</span></div>
    <h2 className="sec-title rv">Four systems, one loop.</h2>
    <p className="lead rv" style={{ ['--d']: '.08s' } as React.CSSProperties}>Each integration below is load-bearing — pull one out and the loop stops. Expand a row to see how it is wired.</p>

    <div style={{marginTop: '44px'}}>
      <div className="acc rv open">
        <button className="acc-head" aria-expanded="true">
          <span className="acc-idx">01</span>
          <span className="acc-glyph"><OpenSkyLogo size={24} color="var(--blue)" /></span>
          <span className="acc-name">OpenSky Network<em>primary radar sensor</em></span>
          <span className="acc-tag" style={{ color: 'var(--blue)' } as React.CSSProperties}>INPUT</span>
          <span className="acc-x"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg></span>
        </button>
        <div className="acc-body"><div><div className="acc-inner">
          <p>OpenSky's global receiver network aggregates ADS-B transmissions from aircraft worldwide and serves them as state vectors. RouteCO2 treats it as the radar feed: every poll returns a snapshot of who is in the air, where, how fast, and on what airframe.</p>
          <dl className="spec">
            <div><dt>WIRE</dt><dd>GET /api/states/all → JSON state vectors</dd></div>
            <div><dt>FIELDS</dt><dd>icao24 · callsign · geo_altitude · velocity · true_track · category</dd></div>
            <div><dt>CADENCE</dt><dd>10 s per scope window, normalized into the track store</dd></div>
          </dl>
        </div></div></div>
      </div>

      <div className="acc rv">
        <button className="acc-head" aria-expanded="false">
          <span className="acc-idx">02</span>
          <span className="acc-glyph"><OneInchLogo size={24} /></span>
          <span className="acc-name">1inch Aqua<em>execution-time liquidity & SwapVM curves</em></span>
          <span className="acc-tag" style={{ color: 'var(--aqua)' } as React.CSSProperties}>1INCH · $7K</span>
          <span className="acc-x"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg></span>
        </button>
        <div className="acc-body"><div><div className="acc-inner">
          <p>A settlement is only as good as its price. At leg closure the dispatcher asks 1inch Aqua for the best available route from USDC into the target tokenized carbon credit, with slippage bounded by policy. Off-chain compiled SwapVM bytecode curves execute kinematic fuel burn equations directly inside the atomic swap.</p>
          <dl className="spec">
            <div><dt>CALL</dt><dd>quote USDC → carbon-credit token via Aqua shared TVU</dd></div>
            <div><dt>SWAPVM</dt><dd>bytecode fuel curve (_piecewiseLinearScale, _decayXD)</dd></div>
            <div><dt>GUARD</dt><dd>max slippage 0.5% · maker-favorable invariant verification</dd></div>
            <div><dt>OUTPUT</dt><dd>serialized best route, executed atomically with aqua.pull() &amp; aqua.push()</dd></div>
          </dl>
        </div></div></div>
      </div>

      <div className="acc rv">
        <button className="acc-head" aria-expanded="false">
          <span className="acc-idx">03</span>
          <span className="acc-glyph"><CircleLogo size={24} color="var(--yellow)" /></span>
          <span className="acc-name">Circle Agent Stack on Arc<em>autonomous dispatcher & zero-custody signer</em></span>
          <span className="acc-tag" style={{ color: 'var(--yellow)' } as React.CSSProperties}>CIRCLE · $10K</span>
          <span className="acc-x"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg></span>
        </button>
        <div className="acc-body"><div><div className="acc-inner">
          <p>Circle's agent infrastructure gives RouteCO2 a wallet that acts, not holds. The autonomous dispatcher daemon evaluates real ADS-B signals (altitude, velocity, vertical climb rate) against ICAO formulas and executes settlements directly in native USDC on Arc Testnet (Chain ID 5042002) with sub-second finality. Zero custody: airline treasury funds remain in the wallet until atomic retirement.</p>
          <dl className="spec">
            <div><dt>DAEMON</dt><dd>autonomous background worker polling live ADS-B radar feeds</dd></div>
            <div><dt>NETWORK</dt><dd>Arc Testnet (5042002) · sub-second finality · native USDC gas</dd></div>
            <div><dt>POLICY</dt><dd>≤ 500 USDC per cycle · allowlist enforced · Circle Gas Station (SCA gasless)</dd></div>
            <div><dt>CUSTODY</dt><dd>0 — airline treasury funds remain in self-custody until execution</dd></div>
          </dl>
        </div></div></div>
      </div>

      <div className="acc rv">
        <button className="acc-head" aria-expanded="false">
          <span className="acc-idx">04</span>
          <span className="acc-glyph"><PrivyLogo size={24} color="var(--purple)" /></span>
          <span className="acc-name">Privy<em>passkey onboarding & flight manifest delegation</em></span>
          <span className="acc-tag" style={{ color: 'var(--purple)' } as React.CSSProperties}>PRIVY · $5K</span>
          <span className="acc-x"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg></span>
        </button>
        <div className="acc-body"><div><div className="acc-inner">
          <p>Privy equips corporate flight dispatchers and airline operations with instant biometric passkey authentication (&lt; 3s) and embedded smart wallets with zero seed phrases. Scoped session delegation enforces cryptographic spend limits (≤ 500 USDC) and a strict contract whitelist restricted to SkyRouteVault and Arc USDC.</p>
          <dl className="spec">
            <div><dt>AUTH</dt><dd>passkeys / WebAuthn · biometric FaceID &amp; TouchID in &lt; 3s</dd></div>
            <div><dt>WALLETS</dt><dd>embedded corporate smart wallets · zero seed-phrase friction</dd></div>
            <div><dt>DELEGATION</dt><dd>manifest session keys bounded to SkyRouteVault · hard spend caps</dd></div>
          </dl>
        </div></div></div>
      </div>
    </div>
  </div>
</section>

{/* ================= SEC 04 — CONSOLE ================= */}
<section id="console" className="sec alt">
  <div className="wrap">
    <div className="sec-head rv"><span className="sec-idx">SEC.04</span><span className="sec-path">// LIVE DEMO</span><span className="sec-rule"></span><span className="sec-tag">TRY THE LOOP</span></div>
    <h2 className="sec-title rv">Dispatch console</h2>
    <p className="lead rv" style={{ ['--d']: '.08s' } as React.CSSProperties}>A full dispatch cycle against simulated telemetry — the exact sequence the production loop runs against the live OpenSky feed, from radar contact to burned retirement certificate.</p>
    <p className="rv" style={{ marginTop: '12px', fontSize: '12px', letterSpacing: '.08em', color: 'var(--yellow)' } as React.CSSProperties}>DEMO SIMULATION — ILLUSTRATIVE ONLY. PRODUCTION CONSOLE (/APP) CONSUMES THE LIVE OPENSKY FEED AND BROADCASTS REAL ARC TESTNET TRANSACTIONS.</p>

    <div className="console-grid" style={{marginTop: '44px'}}>
      <div className="rv">
        <ol id="steps">
          <li><i></i><div><span>DETECT</span><em>ADS-B STATE VECTOR</em></div></li>
          <li><i></i><div><span>MEASURE</span><em>GREAT-CIRCLE + BURN MODEL</em></div></li>
          <li><i></i><div><span>QUOTE</span><em>1INCH AQUA ROUTE</em></div></li>
          <li><i></i><div><span>SIGN</span><em>CIRCLE AGENT WALLET</em></div></li>
          <li><i></i><div><span>SETTLE</span><em>ARC TESTNET TX</em></div></li>
          <li><i></i><div><span>RETIRE</span><em>CERTIFICATE BURNED</em></div></li>
        </ol>
        <div className="run-row">
          <button className="btn primary" id="runBtn"><span className="fill"></span><span>RUN DISPATCH CYCLE</span>
            <svg className="arr" viewBox="0 0 24 24" width="14" height="14"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button>
          <button className="btn ghost" id="resetBtn"><span className="fill"></span><span>CLEAR</span></button>
        </div>
        <div className="counters">
          CYCLES RUN <b id="cCycles">0</b><br />
          CO₂E RETIRED <b id="cCo">0.0 T</b><br />
          USDC SETTLED <b id="cUsd">$0.00</b>
        </div>
      </div>

      <div className="term rv" style={{ ['--d']: '.12s' } as React.CSSProperties}>
        <div className="term-head"><span className="rec"></span>DISPATCH CONSOLE — ARC TESTNET<span className="zul" id="termClock">--:--:--Z</span></div>
        <div className="fstrip" id="fstrip" hidden>
          <b id="fsCs">———</b>
          <span className="rte" id="fsRte"></span>
          <span>TYPE <span id="fsTy">—</span></span>
          <span>FL <span id="fsFl">—</span></span>
          <span>GS <span id="fsGs">—</span></span>
          <span>DIST <span id="fsDist">—</span></span>
          <span>EST CO₂E <span id="fsCo">—</span></span>
        </div>
        <div className="term-body" id="termLog">
          <div id="skel">
            <div className="bar" style={{width: '62%'}}></div>
            <div className="bar" style={{width: '44%'}}></div>
            <div className="bar" style={{width: '71%'}}></div>
            <div className="bar" style={{width: '38%'}}></div>
            <div className="bar" style={{width: '57%'}}></div>
            <div className="bar" style={{width: '49%'}}></div>
          </div>
        </div>
        <div className="receipt" id="receipt">
          <div className="stamp"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" strokeWidth="2.4"/></svg>SETTLED</div>
          <dl className="rc-grid">
            <div><dt>TX HASH</dt><dd id="rcTx">—</dd></div>
            <div><dt>BLOCK</dt><dd id="rcBlock">—</dd></div>
            <div><dt>FINALITY</dt><dd id="rcFinal">—</dd></div>
            <div><dt>ROUTE</dt><dd id="rcRoute">—</dd></div>
            <div><dt>AMOUNT</dt><dd id="rcAmt">—</dd></div>
            <div><dt>RETired</dt><dd id="rcCo">—</dd></div>
            <div><dt>CERTIFICATE</dt><dd id="rcRet">—</dd></div>
            <div><dt>CREDIT</dt><dd id="rcCred">—</dd></div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</section>

{/* ================= SEC 05 — SOURCE ================= */}
<section id="source" className="sec">
  <div className="wrap">
    <div className="sec-head rv"><span className="sec-idx">SEC.05</span><span className="sec-path">// CODE</span><span className="sec-rule"></span><span className="sec-tag">READ THE SOURCE</span></div>
    <h2 className="sec-title rv">Every component in the loop is open.</h2>
    <p className="lead rv" style={{ ['--d']: '.08s' } as React.CSSProperties}>Clone it, point it at testnet keys, and run your own corridor. One file per stage of the pipeline — nothing hidden behind a service.</p>

    <div className="files rv" style={{ ['--d']: '.12s', marginTop: '44px' } as React.CSSProperties}>
      <a className="file" data-src="/blob/main/contracts/src/SkyRouteVault.sol" href="https://github.com/anynomousfriend/RouteCO2/blob/main/contracts/src/SkyRouteVault.sol" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--green)' } as React.CSSProperties}></span><span className="f-path">contracts/src/SkyRouteVault.sol</span>
        <span className="f-desc">Custom 1inch Aqua App callback hooking into SwapVM</span><span className="f-lang">SOL</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/contracts/src/SwapVMRuleEngine.sol" href="https://github.com/anynomousfriend/RouteCO2/blob/main/contracts/src/SwapVMRuleEngine.sol" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--green)' } as React.CSSProperties}></span><span className="f-path">contracts/src/SwapVMRuleEngine.sol</span>
        <span className="f-desc">SwapVM opcode rule evaluation & dynamic fuel curve verification</span><span className="f-lang">SOL</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/agent/src/dispatcher.ts" href="https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/dispatcher.ts" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--blue)' } as React.CSSProperties}></span><span className="f-path">agent/src/dispatcher.ts</span>
        <span className="f-desc">OpenSky ADS-B state-vector poller & flight monitor daemon</span><span className="f-lang">TS</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/agent/src/icao-engine.ts" href="https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/icao-engine.ts" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--aqua)' } as React.CSSProperties}></span><span className="f-path">agent/src/icao-engine.ts</span>
        <span className="f-desc">ICAO Doc 9889 kinematic fuel burn & CO₂ emissions calculator</span><span className="f-lang">TS</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/agent/src/swapvm-compiler.ts" href="https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/swapvm-compiler.ts" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--aqua)' } as React.CSSProperties}></span><span className="f-path">agent/src/swapvm-compiler.ts</span>
        <span className="f-desc">Dynamic flight efficiency curve to SwapVM bytecode compiler</span><span className="f-lang">TS</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/agent/src/circle-wallet.ts" href="https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/circle-wallet.ts" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--yellow)' } as React.CSSProperties}></span><span className="f-path">agent/src/circle-wallet.ts</span>
        <span className="f-desc">Circle Developer-Controlled Wallet manager & spend policy</span><span className="f-lang">TS</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/agent/src/arc-settler.ts" href="https://github.com/anynomousfriend/RouteCO2/blob/main/agent/src/arc-settler.ts" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--yellow)' } as React.CSSProperties}></span><span className="f-path">agent/src/arc-settler.ts</span>
        <span className="f-desc">Arc Testnet USDC micropayment settler via Circle Developer-Controlled Wallets</span><span className="f-lang">TS</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/web/lib/privy-config.ts" href="https://github.com/anynomousfriend/RouteCO2/blob/main/web/lib/privy-config.ts" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--blue)' } as React.CSSProperties}></span><span className="f-path">web/lib/privy-config.ts</span>
        <span className="f-desc">Privy passkey onboarding & scoped flight manifest session delegation</span><span className="f-lang">TS</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/web/app/app/page.tsx" href="https://github.com/anynomousfriend/RouteCO2/blob/main/web/app/app/page.tsx" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--green)' } as React.CSSProperties}></span><span className="f-path">web/app/app/page.tsx</span>
        <span className="f-desc">Live 3D Cesium & 2D radar flight operations command console</span><span className="f-lang">TSX</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
      <a className="file" data-src="/blob/main/README.md" href="https://github.com/anynomousfriend/RouteCO2/blob/main/README.md" target="_blank" rel="noopener noreferrer">
        <span className="f-dot" style={{ ['--c']: 'var(--fg)' } as React.CSSProperties}></span><span className="f-path">README.md</span>
        <span className="f-desc">Protocol architecture, track qualifications, testnet verification</span><span className="f-lang">MD</span>
        <span className="f-go"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span></a>
    </div>

    <div className="src-cta rv" style={{ ['--d']: '.18s' } as React.CSSProperties}>
      <a className="btn primary repo-link" href="#" target="_blank" rel="noopener"><span className="fill"></span>
        <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>
        <span>VIEW FULL REPOSITORY</span></a>
      <div className="clone">
        <code id="cloneCmd">git clone …</code>
        <button id="cloneBtn" aria-label="Copy clone command">
          <svg viewBox="0 0 24 24" width="15" height="15"><rect x="9" y="9" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M5 15V4h11" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
        </button>
      </div>
    </div>
  </div>
</section>
</main>

<footer>
  <div className="wrap foot-grid">
    <div>
      <div className="foot-brand">
        <img src="/logo.svg" width={22} height={22} alt="RouteCO2" className="rounded-[4px]" />
        <b>ROUTECO2</b>
      </div>
      <p>An autonomous flight emissions dispatcher. Sense, measure, settle — every ten seconds.</p>
      <p className="legal">Telemetry on this page is simulated for demonstration; production builds consume the live OpenSky feed. Not affiliated with the OpenSky Network, 1inch, or Circle. Values shown are illustrative estimates, not certified carbon accounting.</p>
    </div>
    <div className="foot-meta">
      <div><span>ZULU</span><a className="zul" href="#top">--:--:--Z</a></div>
      <div><span>FIELD</span><a href="#top" onClick={(e) => e.preventDefault()}>EDDF · 50.0379°N 8.5622°E</a></div>
      <div><span>RADAR</span><a href="https://opensky-network.org" target="_blank" rel="noopener">OPENSKY NETWORK ↗</a></div>
      <div><span>ROUTE</span><a href="https://1inch.io" target="_blank" rel="noopener">1INCH AQUA ↗</a></div>
      <div><span>SIGNER</span><a href="https://www.circle.com" target="_blank" rel="noopener">CIRCLE AGENT STACK ↗</a></div>
      <div><span>LEDGER</span><a href="https://www.circle.com" target="_blank" rel="noopener">ARC TESTNET ↗</a></div>
    </div>
  </div>
  <div className="wrap end">END OF FLIGHT PLAN
    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 2C12.7 2 13.1 3.2 13.15 4.6L13.2 8L22 12.6V13.8L13.2 12.4L13 17.5L16.4 19.8V21.2L12 20L7.6 21.2V19.8L11 17.5L10.8 12.4L2 13.8V12.6L10.8 8L10.85 4.6C10.9 3.2 11.3 2 12 2Z"/></svg>
    ROUTECO2 · ZERO CUSTODY · ZERO PAPER</div>
</footer>
    </div>
  );
}

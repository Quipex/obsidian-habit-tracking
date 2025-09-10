// Habit card — v2.5
// New: in heatLayout="grid" future days are fully transparent (class .is-future)

(() => {
  const {
    title,
    warnHoursThreshold,
    icon,
    dailyFolder = "daily",
    // heatmap options
    heatLayout = "grid",     // "grid" | "row"
    weeks = 26,              // for "grid"
    days = 240,              // for "row"
    // sizing
    cellSize = 9, cellGap = 3,
    dotSize = 8,  dotGap = 4
  } = input ?? {};

  if (!title || typeof title !== "string" || !title.trim()) {
    dv.paragraph("[habit-button] input.title is not set");
    return;
  }

  // ---------- utils ----------
  const EL = (tag, opts = {}) => dv.el(tag, "", opts);
  const pad2 = (n) => String(n).padStart(2, "0");
  const normalizeWs = (s) => String(s).trim().replace(/\s+/g, " ");
  const capitalizeFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const toHabitKey = (s) => {
    const lower = String(s).toLowerCase();
    let underscored = lower.replace(/\s+/g, "_");
    underscored = underscored.replace(/[^A-Za-zА-Яа-яЁё0-9_]/g, "");
    underscored = underscored.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    return underscored;
  };
  const nowHHMM = () => {
    const now = new Date();
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  };
  const parseYMD = (name) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(name);
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3] };
  };
  const makeLocalDate = (y, mo, d, hh = 0, mm = 0) => new Date(y, mo - 1, d, hh, mm, 0, 0);
  const isoOf = (y, mo, d) => `${y}-${pad2(mo)}-${pad2(d)}`;
  const today0 = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
  const humanAgoShort = (fromTs) => {
    if (!fromTs) return "—";
    const diffMs = Date.now() - fromTs.getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    if (d === 0 && h < 1) return mins < 2 ? "just now" : `${m}m ago`;
    if (d === 0) return `${h}h ago`;
    if (d < 3) return `${d*24 + h}h ago`;
    return `${d} d ago`;
  };

  // ---------- derived ----------
  const normTitle = capitalizeFirst(normalizeWs(title));
  const habitKey = toHabitKey(normTitle);
  const habitTag = `#habit_${habitKey}`;

  // ---------- style once ----------
  if (!document.querySelector("#dv-habitv25-style")) {
    const style = document.createElement("style");
    style.id = "dv-habitv25-style";
    style.textContent = `
    .dv-habitv2-card{
      display:flex; /* gap:14px; */ align-items:flex-start;
      /* padding:14px 16px; border:1px solid var(--background-modifier-border); */
      background: var(--background-primary); border-radius:16px;
      transition: opacity .18s ease, background .18s ease, border-color .18s ease;
    }
    .dv-habitv2-card.is-done { opacity: .5; }

    .dv-habitv2-iconbtn{
      width:70px; height:70px; border-radius:12px; font-size:42px; line-height:1;
      display:inline-flex; align-items:center; justify-content:center;
      border:1px solid var(--background-modifier-border);
      background: var(--background-secondary);
      cursor:pointer; user-select:none;
      transition: transform .06s ease, background .18s ease, border-color .18s ease, color .18s ease;
    }
    .dv-habitv2-iconbtn:active{ transform: scale(.98); }
    .dv-habitv2-iconbtn.is-done{
      background:#10b981; border-color:#10b981; color:#052e16;
    }

    .dv-habitv2-right{ display:flex; flex-direction:column; gap:8px; min-width:0; flex:1; margin-left: 16px; }
    .dv-habitv2-title{ font-weight:600; line-height:1.2; }

    .dv-habitv2-meta{ display:flex; gap:8px; align-items:center; font-size:0.95em; }
    .dv-habitv2-meta .last{ color: var(--text-muted); }
    .dv-habitv2-meta .last.is-overdue{ color:#B45309; font-weight:600; }
    .dv-habitv2-meta .bullet{ opacity:0.6; }
    .dv-habitv2-meta .streak{ color:#059669; font-weight:600; }
    .dv-habitv2-meta .streak.is-zero{ color: var(--text-muted); }
    .dv-habitv2-meta .streak .time-left{ color:#B45309; font-weight:600; }

    /* ROW layout */
    .dv-habitv2-heat-row{ display:flex; align-items:center; gap:${dotGap}px; overflow:hidden; }
    .dv-habitv2-dot{
      width:${dotSize}px; height:${dotSize}px; border-radius:999px;
      background: var(--background-modifier-border); flex:0 0 ${dotSize}px;
    }

    /* GRID layout */
    .dv-habitv2-heat-grid{ display:flex; gap:${cellGap}px; overflow:auto; align-items:flex-start; }
    .dv-habitv2-col{ display:flex; flex-direction:column; gap:${cellGap}px; }
    .dv-habitv2-cell{
      width:${cellSize}px; height:${cellSize}px; border-radius:2px;
      background: var(--background-modifier-border);
      transition: opacity .12s ease;
    }
    /* палитра 0..4+ */
    .dot-l1{ background:#aceebb; }
    .dot-l2{ background:#4ac26b; }
    .dot-l3{ background:#2da44e; }
    .dot-l4{ background:#116329; }

    /* Ячейки будущих дней в grid — полностью прозрачные */
    .dv-habitv2-cell.is-future{
      opacity: 0 !important;
      background: transparent !important;
      pointer-events: none;
    }

    /* anti-list */
    .dv-habitv2-card, .dv-habitv2-card * { list-style: none !important; }
    .dv-habitv2-card ul, .dv-habitv2-card ol { margin:0 !important; padding:0 !important; }
    .dv-habitv2-card li::marker { content:"" !important; }
    `;
    document.head.appendChild(style);
  }

  // ---------- root ----------
  const card     = EL("div", { cls: "dv-habitv2-card" });
  const iconBtn  = dv.el("button", icon || "✅", { cls: "dv-habitv2-iconbtn", attr: { title: `Mark: ${normTitle}` } });
  const right    = EL("div", { cls: "dv-habitv2-right" });
  card.appendChild(iconBtn);
  card.appendChild(right);

  // header
  const titleRow = dv.el("div", "");
  const titleEl  = dv.el("div", normTitle, { cls: "dv-habitv2-title" });
  titleRow.appendChild(titleEl);
  right.appendChild(titleRow);

  // heat container
  const heat = EL("div", { cls: "dv-habitv2-heat-row" });
  right.appendChild(heat);

  // meta
  const meta     = EL("div", { cls: "dv-habitv2-meta" });
  const lastEl   = dv.el("span", "", { cls: "last" });   // time only or dash
  const bullet   = dv.el("span", "•", { cls: "bullet" });
  const streakEl = dv.el("span", "", { cls: "streak" });
  meta.appendChild(lastEl);
  meta.appendChild(bullet);
  meta.appendChild(streakEl);
  right.appendChild(meta);

  // clean mount
  while (dv.container.firstChild) dv.container.removeChild(dv.container.firstChild);
  dv.container.appendChild(card);

  // ---------- data load ----------
  (async () => {
    const effWarn = Number.isFinite(warnHoursThreshold) ? Number(warnHoursThreshold) : undefined;
    const allowedGapH  = (typeof effWarn === "number" && isFinite(effWarn)) ? effWarn + 24 : 48;
    const allowedGapMs = allowedGapH * 3600000;

    const pages = dv.pages(`"${dailyFolder}"`).array();
    const countsByISO   = new Map(); // ISO -> count/day
    const hasByISO      = new Map(); // ISO -> boolean
    const lastTsByISO   = new Map(); // ISO -> Date (last within the day)

    const habitRe = new RegExp(`${escapeRe("#habit_")}([^\\s#]+)(?:\\s+(\\d{1,2}:\\d{2}))?`, "gim");
    const needle = String(habitKey).trim().toLowerCase();

    for (const p of pages) {
      if (!p?.file?.path?.endsWith?.(".md")) continue;
      const ymd = parseYMD(p.file.name);
      if (!ymd) continue;
      const content = await dv.io.load(p.file.path);
      if (!content) continue;

      let m;
      while ((m = habitRe.exec(content)) !== null) {
        const key = String(m[1]).trim().toLowerCase();
        if (key !== needle) continue;
        const t = (m[2] ?? "00:00").trim();
        const [hh, mm] = t.split(":").map(n => parseInt(n, 10));
        if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

        const ts  = makeLocalDate(ymd.y, ymd.mo, ymd.d, hh, mm);
        const iso = isoOf(ymd.y, ymd.mo, ymd.d);

        countsByISO.set(iso, (countsByISO.get(iso) ?? 0) + 1);
        hasByISO.set(iso, true);
        const prev = lastTsByISO.get(iso);
        if (!prev || ts > prev) lastTsByISO.set(iso, ts);
      }
    }

    // unique days
    const dayTsArr = Array.from(lastTsByISO.values()).sort((a,b) => a - b);
    let lastTs = dayTsArr.length ? dayTsArr[dayTsArr.length - 1] : null;

    const computeStreakByDays = (arrDates) => {
      if (!arrDates.length) return 0;
      const now = Date.now();
      if (now - arrDates[arrDates.length - 1].getTime() > allowedGapMs) return 0;
      let s = 1;
      for (let i = arrDates.length - 2; i >= 0; i--) {
        if (arrDates[i + 1].getTime() - arrDates[i].getTime() <= allowedGapMs) s++;
        else break;
      }
      return s;
    };

    let streak = computeStreakByDays(dayTsArr);
    let hoursSinceLast = lastTs ? (Date.now() - lastTs.getTime()) / 3600000 : Infinity;

    // --- render helpers ---
    const renderHeatRow = () => {
      heat.className = "dv-habitv2-heat-row";
      heat.innerHTML = "";
      const t0 = today0();
      const start = new Date(t0);
      start.setDate(start.getDate() - (days - 1));
      for (let i = 0; i < days; i++) {
        const dt = new Date(start);
        dt.setDate(start.getDate() + i);
        const iso = isoOf(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
        const count = countsByISO.get(iso) ?? 0;
        const lvl = Math.max(0, Math.min(4, count));
        const dot = EL("div", { cls: "dv-habitv2-dot " + (lvl ? `dot-l${Math.min(lvl,4)}` : "") });
        dot.title = `${iso}: ${count || 0}`;
        heat.appendChild(dot);
      }
      heat.scrollLeft = heat.scrollWidth;
    };

    const renderHeatGrid = () => {
      heat.className = "dv-habitv2-heat-grid";
      heat.innerHTML = "";

      const today = today0();
      const isoDow = (today.getDay() + 6) % 7; // Mon=0..Sun=6
      const start = new Date(today);
      start.setDate(today.getDate() - isoDow - (weeks - 1) * 7);

      for (let w = 0; w < weeks; w++) {
        const col = EL("div", { cls: "dv-habitv2-col" });
        for (let i = 0; i < 7; i++) { // Mon..Sun
          const dt = new Date(start);
          dt.setDate(start.getDate() + w * 7 + i);
          const y = dt.getFullYear(), mo = dt.getMonth() + 1, d = dt.getDate();
          const iso = isoOf(y, mo, d);
          const count = countsByISO.get(iso) ?? 0;
          const lvl = Math.max(0, Math.min(4, count));

          const isFuture = dt > today; // TODAY is not future
          const cls = "dv-habitv2-cell " + (isFuture ? "is-future " : "") + (lvl ? `dot-l${Math.min(lvl,4)}` : "");
          const cell = EL("div", { cls });
          cell.title = `${iso}: ${count || 0}`;
          col.appendChild(cell);
        }
        heat.appendChild(col);
      }
      heat.scrollLeft = heat.scrollWidth; // latest weeks on the right
    };

    const renderMeta = () => {
      const agoStr = lastTs ? humanAgoShort(lastTs) : "—";
      lastEl.textContent = agoStr;
      hoursSinceLast = lastTs ? (Date.now() - lastTs.getTime()) / 3600000 : Infinity;
      const isStreakAlive = streak > 0; // streak computed with allowedGap
      const shouldOverdue = (
        typeof effWarn === "number" && isFinite(effWarn) &&
        hoursSinceLast >= effWarn &&
        !isStreakAlive
      );
      lastEl.classList.toggle("is-overdue", shouldOverdue);

      // Base streak text
      streakEl.innerHTML = "";
      streakEl.appendChild(document.createTextNode(`Streak: ${streak} d`));

      // When less than 24h remain before losing streak, show amber hint
      const remH = (typeof hoursSinceLast === "number" && isFinite(hoursSinceLast))
        ? (allowedGapH - hoursSinceLast)
        : -Infinity;
      if (streak > 0 && remH > 0 && remH <= 24) {
        const hint = EL("span", { cls: "time-left" });
        const hrs = Math.ceil(remH);
        hint.textContent = ` <${hrs}h 🔥`;
        streakEl.appendChild(hint);
      }

      streakEl.classList.toggle("is-zero", streak === 0);
    };

    // done-UI
    const setDoneUI = (doneToday) => {
      card.classList.toggle("is-done", doneToday);
      iconBtn.classList.toggle("is-done", doneToday);
      iconBtn.textContent = doneToday ? "✓" : (icon || "✅");
      iconBtn.setAttribute("aria-pressed", doneToday ? "true" : "false");
    };

    // initial render
    (heatLayout === "grid" ? renderHeatGrid : renderHeatRow)();
    renderMeta();
    const t = today0();
    const isoToday = isoOf(t.getFullYear(), t.getMonth() + 1, t.getDate());
    setDoneUI(!!hasByISO.get(isoToday));

    // click -> log + refresh
    iconBtn.addEventListener("click", async () => {
      try {
        const now = new Date();
        const y = now.getFullYear(), mo = pad2(now.getMonth() + 1), d = pad2(now.getDate());
        const dailyPath = `${dailyFolder}/${y}-${mo}-${d}.md`;
        let file = app.vault.getAbstractFileByPath(dailyPath);
        if (!file) {
          await app.vault.create(dailyPath, `# ${y}-${mo}-${d}\n`);
          file = app.vault.getAbstractFileByPath(dailyPath);
        }
        await app.vault.append(file, `\n- ${habitTag} ${nowHHMM()}\n`);
        new Notice(`Added: ${normTitle}`);

        const iso = `${y}-${mo}-${d}`;
        countsByISO.set(iso, (countsByISO.get(iso) ?? 0) + 1);
        hasByISO.set(iso, true);
        lastTsByISO.set(iso, new Date(now));

        const dayTsArr2 = Array.from(lastTsByISO.values()).sort((a,b) => a - b);
        lastTs = dayTsArr2.length ? dayTsArr2[dayTsArr2.length - 1] : null;
        streak = computeStreakByDays(dayTsArr2);

        (heatLayout === "grid" ? renderHeatGrid : renderHeatRow)();
        renderMeta();
        setDoneUI(true);
      } catch (e) {
        console.error("[habit-button] append error", e);
        new Notice("Error while writing habit", 4000);
      }
    });
  })();
})();

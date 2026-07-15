const TODAY = dayjs(); // live date — always current

// ── HELPERS ──────────────────────────────────────────────────

function daysLeft(d) {
  if (!d) return null;
  // startOf('day') on both sides avoids time-of-day off-by-one
  return dayjs(d).startOf('day').diff(TODAY.startOf('day'), 'day');
}

function computeStatus(r) {
  if (r.rawStatus === "PROCESSING") return "proc";
  if (!r.expiry) return "nodate";
  const n = daysLeft(r.expiry);
  if (n < 0)   return "expired";
  if (n <= 7)  return "critical";
  if (n <= 30) return "warning";
  return "ok";
}

function badgeInfo(s) {
  return {
    expired:  { cls: "b-expired",  label: "Expired"    },
    critical: { cls: "b-critical", label: "≤ 7 days"   },
    warning:  { cls: "b-warning",  label: "≤ 30 days"  },
    ok:       { cls: "b-ok",       label: "Active"      },
    proc:     { cls: "b-proc",     label: "Processing"  },
    nodate:   { cls: "b-nodate",   label: "No date"     },
  }[s];
}

// Escape text for safe insertion into HTML attributes/content
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── STATE ────────────────────────────────────────────────────

// records is populated after data.json loads
const records = [];
let RAW = [];

let activeFilter = "all";
let searchQ = "";
let sortKey = "expiry";   // default sort column
let sortDir = "asc";      // "asc" | "desc"

// ── EMAILJS CONFIG (loaded from data.json) ───────────────────
let ejsConfig = { serviceId: "", templateId: "", publicKey: "" };

function initEmailJS(cfg) {
  ejsConfig = cfg;
  emailjs.init({ publicKey: cfg.publicKey });
  // Load saved recipients from localStorage, fall back to data.json list
  const saved = localStorage.getItem("alert_recipients");
  recipients = saved ? JSON.parse(saved) : (cfg.recipients || []);
}

let recipients = []; // array of email strings

// ── EMAIL SEND ───────────────────────────────────────────────

function buildAlertPayload() {
  const urgent = records.filter(r => ["expired", "critical"].includes(r.status));
  if (!urgent.length) return null;

  const lines = urgent.map(r => {
    const n = daysLeft(r.expiry);
    const statusLine = n < 0
      ? `Status:     EXPIRED (${Math.abs(n)} day(s) ago)`
      : `Status:     EXPIRING IN ${n} DAY(S)`;

    return [
      `------------------------------------------------------------`,
      `Regulatory Body:  ${r.body}`,
      `Category:         ${r.cat !== "—" ? r.cat : "N/A"}`,
      `Title:            ${r.title}`,
      `Service/Scope:    ${r.service !== "—" ? r.service : "N/A"}`,
      `Expiry Date:      ${r.expiry || "N/A"}`,
      statusLine,
    ].join("\n");
  }).join("\n\n");

  const subject = `AIRYOLK Compliance Certification Expiry Alert`;

  const body =
    `This is an automated alert from the AIRYOLK Nigeria Limited Compliance Certification Tracker.\n\n` +
    `The following ${urgent.length} certification(s) require immediate attention:\n\n` +
    `${lines}\n\n` +
    `------------------------------------------------------------\n` +
    `Please initiate the renewal process as soon as possible.\n\n` +
    `AIRYOLK Nigeria Limited\n` +
    `Compliance & Regulatory Affairs`;

  return { subject, body };
}

function sendAlertEmail() {
  if (!recipients.length) {
    openEmailSettingsModal(() => {
      if (recipients.length) sendAlertEmail();
    });
    return;
  }

  const payload = buildAlertPayload();
  if (!payload) return;

  const btn = document.getElementById("email-btn");
  btn.textContent = "Sending…";
  btn.classList.add("dim");

  // Clean and validate each address
  const validRecipients = recipients
    .map(r => r.trim().replace(/[,;]+$/, ''))  // strip trailing commas/semicolons
    .filter(r => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)); // strict email format check

  if (!validRecipients.length) {
    showBanner("⚠️ No valid recipient addresses found. Please check your recipients list.", "error");
    render();
    return;
  }

  // Send sequentially — avoids rate limiting and EmailJS parallel send issues
  const sendNext = (index) => {
    if (index >= validRecipients.length) {
      showBanner(`✅ Alert sent to ${validRecipients.length} recipient(s).`, "success");
      render();
      return;
    }
    const to = validRecipients[index];
    emailjs.send(ejsConfig.serviceId, ejsConfig.templateId, {
      to_email: to,
      subject:  payload.subject,
      body:     payload.body,
    })
    .then(() => sendNext(index + 1))
    .catch(err => {
      showBanner(`⚠️ Failed to send to ${to}: ${err.text || err.message || "Unknown error"}`, "error");
      render();
    });
  };

  sendNext(0);
}

// ── RENDER ───────────────────────────────────────────────────

function render() {
  const counts = { expired: 0, critical: 0, warning: 0, ok: 0, proc: 0, nodate: 0 };
  records.forEach(r => counts[r.status]++);

  document.getElementById("m-total").textContent    = records.length;
  document.getElementById("m-expired").textContent  = counts.expired;
  document.getElementById("m-critical").textContent = counts.critical;
  document.getElementById("m-warning").textContent  = counts.warning;
  document.getElementById("m-proc").textContent     = counts.proc;
  document.getElementById("m-ok").textContent       = counts.ok;

  // Filter buttons
  const filterDefs = [
    { key: "all",      label: `All (${records.length})`       },
    { key: "expired",  label: `Expired (${counts.expired})`   },
    { key: "critical", label: `≤ 7 days (${counts.critical})` },
    { key: "warning",  label: `≤ 30 days (${counts.warning})` },
    { key: "ok",       label: `Active (${counts.ok})`         },
    { key: "proc",     label: `Processing (${counts.proc})`   },
  ];
  document.getElementById("filters").innerHTML = filterDefs.map(f =>
    `<button class="filter-btn ${activeFilter === f.key ? 'active' : ''}" data-key="${f.key}">${f.label}</button>`
  ).join('');
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.addEventListener('click', () => { activeFilter = b.dataset.key; render(); })
  );

  // Email button
  const eb = document.getElementById("email-btn");
  const urgent = records.filter(r => ["expired", "critical"].includes(r.status));
  if (urgent.length) {
    eb.classList.remove("dim");
    eb.textContent = `📧 Email alert (${urgent.length})`;
    eb.onclick = sendAlertEmail;
  } else {
    eb.classList.add("dim");
    eb.innerHTML = "📧 Email alert";
    eb.onclick = null;
  }

  // Apply filter + search
  let filtered = activeFilter === "all" ? records : records.filter(r => r.status === activeFilter);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    filtered = filtered.filter(r =>
      r.body.toLowerCase().includes(q)    ||
      r.title.toLowerCase().includes(q)   ||
      r.cat.toLowerCase().includes(q)     ||
      r.service.toLowerCase().includes(q)
    );
  }

  // Sort
  const colDefs = [
    { key: "body",   label: "Reg. Body",       width: "13%", sortable: true },
    { key: "cat",    label: "Category",        width: "14%", sortable: true },
    { key: "title",  label: "Title / Service", width: "28%", sortable: true },
    { key: "expiry", label: "Expiry Date",     width: "13%", sortable: true },
    { key: "days",   label: "Days Left",       width: "10%", sortable: true },
    { key: "status", label: "Status",          width: "12%", sortable: true },
  ];

  // Render sortable header
  document.getElementById("thead-row").innerHTML = colDefs.map(col => {
    const isActive = sortKey === col.key;
    const arrow = isActive ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    const cls = col.sortable ? "th-sortable" + (isActive ? " th-active" : "") : "";
    return `<th style="width:${col.width}" class="${cls}" data-col="${col.key}">${col.label}${arrow}</th>`;
  }).join('');

  document.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortKey === col) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = col;
        sortDir = "asc";
      }
      render();
    });
  });

  filtered = [...filtered].sort((a, b) => {
    let av, bv;
    if (sortKey === "days") {
      av = a.expiry ? daysLeft(a.expiry) : Infinity;
      bv = b.expiry ? daysLeft(b.expiry) : Infinity;
    } else if (sortKey === "expiry") {
      av = a.expiry || "9999";
      bv = b.expiry || "9999";
    } else if (sortKey === "status") {
      const order = { expired: 0, critical: 1, warning: 2, proc: 3, ok: 4, nodate: 5 };
      av = order[a.status] ?? 9;
      bv = order[b.status] ?? 9;
    } else {
      av = (a[sortKey] || "").toLowerCase();
      bv = (b[sortKey] || "").toLowerCase();
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  const tbody = document.getElementById("tbody");
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell" data-label="">No records match.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const n = r.expiry ? daysLeft(r.expiry) : null;
    let daysDisplay = "—", daysClass = "";
    if (n !== null) {
      daysDisplay = n < 0 ? `${Math.abs(n)}d ago` : n === 0 ? "Today" : `${n}`;
      daysClass = `days-${r.status === "proc" ? "proc" : r.status}`;
    }
    const { cls, label } = badgeInfo(r.status);
    const dateDisplay = r.expiry || "—";

    // Title/Service cell: show title text, but expose the full service description in the title attribute
    const serviceTitle = (r.service && r.service !== "—") ? escapeHtml(r.service) : "";
    const titleText = escapeHtml(r.title);

    return `<tr>
      <td class="body-col" data-label="Body">${escapeHtml(r.body)}</td>
      <td class="cat-col" data-label="Category">${escapeHtml(r.cat)}</td>
      <td class="title-col" title="${serviceTitle}">${titleText}</td>
      <td class="date-col" data-label="Expiry">${escapeHtml(dateDisplay)}</td>
      <td class="${daysClass}" data-label="Days">${escapeHtml(daysDisplay)}</td>
      <td data-label="Status"><span class="badge ${cls}">${escapeHtml(label)}</span></td>
    </tr>`;
  }).join('');

  // Also refresh timeline if it's visible
  if (activeView === 'timeline') renderTimeline(filtered);
}

document.getElementById("search").addEventListener("input", function () {
  searchQ = this.value.trim();
  render();
});

// ── TIMELINE VIEW ────────────────────────────────────────────

let activeView = "table";

function renderTimeline(filtered) {
  const container = document.getElementById("timeline-body");
  const headerEl  = document.getElementById("timeline-header");

  // Work out the window: from start of this month to 18 months out
  const winStart = TODAY.startOf('month');
  const winEnd   = winStart.add(18, 'month');
  const winDays  = winEnd.diff(winStart, 'day');

  // Build month headers
  const months = [];
  let m = winStart;
  while (m.isBefore(winEnd)) {
    months.push(m);
    m = m.add(1, 'month');
  }

  headerEl.innerHTML = `
    <div class="tl-label-col">Certificate</div>
    <div class="tl-months">
      ${months.map(mo => {
        const isNow = mo.format('YYYY-MM') === TODAY.format('YYYY-MM');
        return `<div class="tl-month ${isNow ? 'tl-now' : ''}">${mo.format('MMM YY')}</div>`;
      }).join('')}
    </div>`;

  // Today line position (%)
  const todayPct = (TODAY.diff(winStart, 'day') / winDays) * 100;

  if (!filtered.length) {
    container.innerHTML = `<div class="tl-empty">No records match.</div>`;
    return;
  }

  // Sort by expiry date ascending (no-date at bottom)
  const sorted = [...filtered].sort((a, b) => {
    if (!a.expiry && !b.expiry) return 0;
    if (!a.expiry) return 1;
    if (!b.expiry) return -1;
    return dayjs(a.expiry).diff(dayjs(b.expiry));
  });

  container.innerHTML = sorted.map(r => {
    const n = r.expiry ? daysLeft(r.expiry) : null;
    const tipDays = n === null ? 'No date'
      : n < 0  ? `Expired ${Math.abs(n)}d ago`
      : n === 0 ? 'Expires today'
      : `${n} days left`;
    const tip = `${r.body} — ${r.title} | ${r.expiry || 'No date'} | ${tipDays}`;

    let barLeft = 0, barWidth = 0;

    if (r.expiry) {
      const expDay  = dayjs(r.expiry);
      // Bar starts from today (or window start if already expired) and ends at expiry
      const barStart = expDay.isBefore(winStart) ? winStart : winStart;
      const barEnd   = expDay.isAfter(winEnd) ? winEnd : expDay;

      // For active/warning/critical: bar spans from today → expiry
      // For expired: bar spans from expiry → today (shown as a short stub at left)
      if (n !== null && n >= 0) {
        // future: today → expiry
        const startPct = Math.max(0, (TODAY.diff(winStart, 'day') / winDays) * 100);
        const endPct   = Math.min(100, (expDay.diff(winStart, 'day') / winDays) * 100);
        barLeft  = startPct;
        barWidth = Math.max(0.4, endPct - startPct);
      } else {
        // expired: show a stub from expiry date position, width = 1.5%
        const expPct = (expDay.diff(winStart, 'day') / winDays) * 100;
        barLeft  = Math.max(0, expPct);
        barWidth = 1.5;
      }
    }

    const barHtml = r.expiry
      ? `<div class="tl-bar s-${r.status}"
             style="left:${barLeft.toFixed(2)}%;width:${barWidth.toFixed(2)}%"
             title="${escapeHtml(tip)}"></div>`
      : `<div class="tl-bar s-nodate" style="left:1%;width:6%" title="${escapeHtml(tip)}"></div>`;

    // Include service in the timeline title tooltip as well
    const timelineTitleAttr = escapeHtml(r.title + (r.service && r.service !== "—" ? ' — ' + r.service : ''));

    return `
      <div class="tl-row">
        <div class="tl-name">
          <div class="tl-name-body">${escapeHtml(r.body)}</div>
          <div class="tl-name-title" title="${timelineTitleAttr}">${escapeHtml(r.title)}</div>
        </div>
        <div class="tl-track">
          <div class="tl-today-line" style="left:${todayPct.toFixed(2)}%"></div>
          ${barHtml}
        </div>
      </div>`;
  }).join('');
}

// Tab switching
document.querySelectorAll('.view-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    activeView = btn.dataset.view;
    document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-table').style.display    = activeView === 'table'    ? '' : 'none';
    document.getElementById('view-timeline').style.display = activeView === 'timeline' ? '' : 'none';
    if (activeView === 'timeline') {
      let filtered = activeFilter === "all" ? records : records.filter(r => r.status === activeFilter);
      if (searchQ) {
        const q = searchQ.toLowerCase();
        filtered = filtered.filter(r =>
          r.body.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) ||
          r.cat.toLowerCase().includes(q)  || r.service.toLowerCase().includes(q)
        );
      }
      renderTimeline(filtered);
    }
  });
});

// ── UPLOAD LOGIC ─────────────────────────────────────────────

function showBanner(msg, type) {
  const b = document.getElementById("upload-banner");
  const colors = {
    success: { bg: "rgba(34,197,94,.1)",  color: "#4ade80", border: "rgba(34,197,94,.25)"  },
    error:   { bg: "rgba(239,68,68,.1)",  color: "#f87171", border: "rgba(239,68,68,.25)"  },
    info:    { bg: "rgba(99,102,241,.1)", color: "#a5b4fc", border: "rgba(99,102,241,.25)" },
  }[type];
  b.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:1rem; padding:10px 14px; border-radius:8px; font-size:13px; background:${colors.bg}; 
  b.innerHTML = `<span>${msg}</span><button onclick="document.getElementById('upload-banner').style.display='none'" style="background:none;border:none;cursor:pointer;font-size:16px;color:inherit;
 }

function hideBanner() {
  document.getElementById("upload-banner").style.display = "none";
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return dayjs(val).format("YYYY-MM-DD");
  const s = String(val).trim();
  const d = dayjs(s);
  if (d.isValid()) return d.format("YYYY-MM-DD");
  return null;
}

function autoDetectCols(cols) {
  // Normalise a column header for matching
  const norm = (s) => s.toLowerCase().replace(/[\s_\-\/\.]+/g, "");

  const find = (patterns) =>
    cols.find(c => patterns.some(p => p.test(norm(c)))) || null;

  return {
    // Regulatory body — e.g. "Reg. Body", "Regulatory Body", "Authority", "Issuer"
    body: find([
      /reg.*body/, /regbody/, /regulat/, /authority/, /issuer/, /regulator/,
      /^body$/, /certbody/, /issuingbody/
    ]),

    // Category — e.g. "Category", "Type", "Class", "Cert Type"
    cat: find([
      /^cat$/, /categor/, /^type$/, /certtype/, /class/, /certclass/
    ]),

    // Title / Name — e.g. "Title", "Certificate Name", "Certification", "Compliance", "Description"
    title: find([
      /^title$/, /certname/, /certif/, /compliance/, /^name$/, /servicename/,
      /permitname/, /licen/, /^description$/, /certdesc/
    ]),

    // Service / Scope — e.g. "Service", "Scope", "Description", "Details"
    service: find([
      /^service$/, /servicedesc/, /scope/, /^details$/, /servicedetail/,
      /coverage/, /^remarks$/, /notes/
    ]),

    // Expiry date — e.g. "Expiry", "Expiry Date", "Expiration", "Due Date", "Valid Until", "End Date"
    expiry: find([
      /expir/, /expdate/, /dateexp/, /duedate/, /validuntil/, /validto/,
      /enddate/, /expirationdate/, /renewaldate/, /^due$/, /validity/
    ]),

    // Status — e.g. "Status", "State", "Cert Status", "Current Status"
    rawStatus: find([
      /^status$/, /certstatus/, /currentstatus/, /^state$/, /approvalstatus/,
      /renewalstatus/, /compliancestatus/
    ]),
  };
}

function applyMapping(rows, mapping) {
  return rows.map((r, i) => {
    const get = (key) => mapping[key] ? String(r[mapping[key]] || "").trim() : "—";
    const expiryRaw = mapping.expiry ? r[mapping.expiry] : null;
    const expiry = parseDate(expiryRaw);
    const rs = (get("rawStatus") || "ACTIVE").toUpperCase();
    const rawStatus = ["ACTIVE", "EXPIRED", "PROCESSING"].includes(rs) ? rs : "ACTIVE";
    return {
      id: i,
      body:      get("body")    || "—",
      cat:       get("cat")     || "—",
      title:     get("title")   || ("Row " + (i + 1)),
      service:   get("service") || "—",
      expiry,
      rawStatus,
      status: computeStatus({ rawStatus, expiry }),
    };
  }).filter(r => r.title && r.title !== "—");
}

function openMappingModal(cols, onConfirm) {
  const fields = [
    { key: "body",      label: "Regulatory Body", required: false },
    { key: "cat",       label: "Category",         required: false },
    { key: "title",     label: "Title / Name ✱",   required: true  },
    { key: "service",   label: "Service",           required: false },
    { key: "expiry",    label: "Expiry Date ✱",     required: true  },
    { key: "rawStatus", label: "Status",            required: false },
  ];
  const auto = autoDetectCols(cols);
  document.getElementById("modal-fields").innerHTML = fields.map(f => `
    <div class="map-row">
      <span class="map-label">${f.label}</span>
      <select class="map-select" id="map-${f.key}">
        ${["(skip)", ...cols].map(c => `<option value="${c}" ${auto[f.key] === c ? "selected" : ""}>${c}</option>`).join("")}
      </select>
    </div>
  `).join("");

  const overlay = document.getElementById("modal-overlay");
  overlay.style.display = "flex";

  document.getElementById("modal-confirm").onclick = () => {
    const mapping = {};
    fields.forEach(f => {
      const val = document.getElementById("map-" + f.key).value;
      if (val !== "(skip)") mapping[f.key] = val;
    });
    if (!mapping.title || !mapping.expiry) {
      alert("Please map at least Title and Expiry Date.");
      return;
    }
    overlay.style.display = "none";
    onConfirm(mapping);
  };

  document.getElementById("modal-cancel").onclick = () => {
    overlay.style.display = "none";
  };
}

document.getElementById("file-upload").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  this.value = "";
  const ext = file.name.split(".").pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = ev => {
    try {
      let rows = [];

      if (ext === "csv") {
        const text = new TextDecoder().decode(ev.target.result);
        const lines = text.trim().split(/\r?\n/);

        // Robust CSV parser — handles quoted fields with embedded commas
        const parseCSVLine = (line) => {
          const fields = [];
          let cur = "", inQuote = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuote && line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
              else inQuote = !inQuote;
            } else if (ch === ',' && !inQuote) {
              fields.push(cur.trim()); cur = "";
            } else {
              cur += ch;
            }
          }
          fields.push(cur.trim());
          return fields;
        };

        const headers = parseCSVLine(lines[0]);
        rows = lines.slice(1).map(line => {
          const vals = parseCSVLine(line);
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
          return obj;
        });

      } else {
        const wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      }

      if (!rows.length) { showBanner("⚠️ No data rows found in the file.", "error"); return; }

      const cols = Object.keys(rows[0]);
      const auto = autoDetectCols(cols);

      const doImport = (mapping, wasAutoDetected) => {
        const imported = applyMapping(rows, mapping);
        if (!imported.length) { showBanner("⚠️ No valid records could be parsed.", "error"); return; }
        records.length = 0;
        imported.forEach(r => records.push(r));
        activeFilter = "all";
        searchQ = "";
        document.getElementById("search").value = "";
        render();
        const note = wasAutoDetected
          ? ` <span style="opacity:.7">(columns auto-detected)</span>`
          : "";
        showBanner(
          `✅ Imported <strong>${imported.length} records</strong> from <strong>${file.name}</strong>${note}. ` +
          `<a href='#' onclick='resetToDefault(event)' style='color:inherit;text-decoration:underline'>Reset to default data</a>`,
          "success"
        );
      };

      if (auto.title && auto.expiry) {
        // Both required fields found — import silently without showing the modal
        doImport(auto, true);
      } else {
        // Required fields missing — ask the user to map them manually
        openMappingModal(cols, (mapping) => doImport(mapping, false));
      }

    } catch (err) {
      showBanner("⚠️ Could not read file: " + err.message, "error");
    }
  };

  reader.readAsArrayBuffer(file);
});

function resetToDefault(e) {
  e && e.preventDefault();
  records.length = 0;
  RAW.map((r, i) => ({ ...r, id: i, status: computeStatus(r) })).forEach(r => records.push(r));
  activeFilter = "all";
  searchQ = "";
  document.getElementById("search").value = "";
  render();
  hideBanner();
}

// ── EMAIL SETTINGS MODAL ─────────────────────────────────────

let _onSettingsSaved = null;

function openEmailSettingsModal(onSave) {
  _onSettingsSaved = onSave || null;
  const overlay = document.getElementById("email-modal-overlay");
  document.getElementById("recipients-input").value = recipients.join(", ");
  overlay.style.display = "flex";
}

document.getElementById("email-settings-btn").addEventListener("click", () => {
  openEmailSettingsModal(null);
});

document.getElementById("email-modal-cancel").addEventListener("click", () => {
  document.getElementById("email-modal-overlay").style.display = "none";
});

document.getElementById("email-modal-save").addEventListener("click", () => {
  const raw = document.getElementById("recipients-input").value;
  // Split on comma or semicolon, clean each entry, keep only valid emails
  recipients = raw
    .split(/[,;]/)
    .map(s => s.trim().replace(/[,;]+$/, ''))
    .filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  localStorage.setItem("alert_recipients", JSON.stringify(recipients));
  document.getElementById("email-modal-overlay").style.display = "none";
  if (recipients.length) {
    showBanner(`✅ ${recipients.length} recipient(s) saved: ${recipients.join(", ")}`, "success");
  } else {
    showBanner("⚠️ No valid email addresses found. Please check the format.", "error");
  }
  if (_onSettingsSaved) _onSettingsSaved();
});

// ── AUTO-ALERT PROMPT ────────────────────────────────────────

function checkAutoAlertPrompt() {
  const expired  = records.filter(r => r.status === "expired");
  const critical = records.filter(r => r.status === "critical");
  const urgent   = [...expired, ...critical];

  if (!urgent.length) return; // nothing urgent — stay quiet

  // Only prompt once per calendar day
  const todayStr = TODAY.format("YYYY-MM-DD");
  const lastPrompt = localStorage.getItem("last_alert_prompt");
  if (lastPrompt === todayStr) return;

  // Build the message
  const parts = [];
  if (expired.length)  parts.push(`${expired.length} expired`);
  if (critical.length) parts.push(`${critical.length} expiring within 7 days`);
  const msg = `⚠️ ${parts.join(" and ")} — send an alert email to your recipients?`;

  const promptEl = document.getElementById("alert-prompt");
  document.getElementById("alert-prompt-msg").textContent = msg;
  promptEl.style.display = "flex";

  document.getElementById("alert-prompt-send").onclick = () => {
    promptEl.style.display = "none";
    localStorage.setItem("last_alert_prompt", todayStr);
    sendAlertEmail();
  };

  document.getElementById("alert-prompt-dismiss").onclick = () => {
    promptEl.style.display = "none";
    localStorage.setItem("last_alert_prompt", todayStr);
  };
}

// ── INIT — load data.json then render ────────────────────────
fetch("data.json")
  .then(res => {
    if (!res.ok) throw new Error("Could not load data.json (" + res.status + ")");
    return res.json();
  })
  .then(data => {
    if (data.emailjs) initEmailJS(data.emailjs);
    RAW = data.certifications;
    RAW.forEach((r, i) => records.push({ ...r, id: i, status: computeStatus(r) }));
    render();
    checkAutoAlertPrompt();
  })
  .catch(err => {
    document.getElementById("tbody").innerHTML =
      `<tr><td colspan="6" class="empty-cell">⚠️ Failed to load data: ${err.message}<br>
       Open this file through a local server (e.g. VS Code Live Server).</td></tr>`;
  });

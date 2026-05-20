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

// ── STATE ────────────────────────────────────────────────────

// records is populated after data.json loads
const records = [];
let RAW = [];

let activeFilter = "all";
let searchQ = "";

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

  // Debug — check what recipients look like before sending
  console.log("Recipients:", JSON.stringify(recipients));
  console.log("First recipient:", JSON.stringify(recipients[0]));

  const btn = document.getElementById("email-btn");
  btn.textContent = "Sending…";
  btn.classList.add("dim");

  const sends = recipients.map(to => {
    const cleanTo = to.trim();
    console.log("Sending to:", JSON.stringify(cleanTo));
    return emailjs.send(ejsConfig.serviceId, ejsConfig.templateId, {
      to_email: cleanTo,
      subject:  payload.subject,
      body:     payload.body,
    });
  });

  Promise.all(sends)
    .then(() => {
      showBanner(`✅ Alert sent to ${recipients.length} recipient(s).`, "success");
      render();
    })
    .catch(err => {
      showBanner(`⚠️ Failed to send: ${err.text || err.message || "Unknown error"}`, "error");
      render();
    });
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

  const tbody = document.getElementById("tbody");
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No records match.</td></tr>`;
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
    return `<tr>
      <td class="body-col">${r.body}</td>
      <td class="cat-col">${r.cat}</td>
      <td class="title-col">${r.title}</td>
      <td class="date-col">${dateDisplay}</td>
      <td class="${daysClass}">${daysDisplay}</td>
      <td><span class="badge ${cls}">${label}</span></td>
    </tr>`;
  }).join('');
}

document.getElementById("search").addEventListener("input", function () {
  searchQ = this.value.trim();
  render();
});

// ── UPLOAD LOGIC ─────────────────────────────────────────────

function showBanner(msg, type) {
  const b = document.getElementById("upload-banner");
  const colors = {
    success: { bg: "rgba(34,197,94,.1)",  color: "#4ade80", border: "rgba(34,197,94,.25)"  },
    error:   { bg: "rgba(239,68,68,.1)",  color: "#f87171", border: "rgba(239,68,68,.25)"  },
    info:    { bg: "rgba(99,102,241,.1)", color: "#a5b4fc", border: "rgba(99,102,241,.25)" },
  }[type];
  b.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:1rem; padding:10px 14px; border-radius:8px; font-size:13px; background:${colors.bg}; color:${colors.color}; border:0.5px solid ${colors.border};`;
  b.innerHTML = `<span>${msg}</span><button onclick="document.getElementById('upload-banner').style.display='none'" style="background:none;border:none;cursor:pointer;font-size:16px;color:inherit;line-height:1;">×</button>`;
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
  recipients = raw.split(",").map(s => s.trim()).filter(s => s.includes("@"));
  localStorage.setItem("alert_recipients", JSON.stringify(recipients));
  document.getElementById("email-modal-overlay").style.display = "none";
  showBanner(`✅ ${recipients.length} recipient(s) saved.`, "success");
  if (_onSettingsSaved) _onSettingsSaved();
});

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
  })
  .catch(err => {
    document.getElementById("tbody").innerHTML =
      `<tr><td colspan="6" class="empty-cell">⚠️ Failed to load data: ${err.message}<br>
       Open this file through a local server (e.g. VS Code Live Server).</td></tr>`;
  });
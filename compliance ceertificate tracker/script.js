const TODAY = dayjs(); // live date — always current

const RAW = [
  // ── NMDPRA ──
  { body:"NMDPRA", cat:"Major Category",       title:"Installation and Maintenance Services",       service:"Mechanical Install/Maintenance & Material",                                           expiry:"2026-07-22", rawStatus:"ACTIVE" },
  { body:"NMDPRA", cat:"Specialized Category", title:"Facilities & Equipment Installation Services", service:"On-/Offshore Facilities, Process Facilities & Platforms Installation/Upgrade",       expiry:"2026-07-28", rawStatus:"ACTIVE" },
  { body:"NMDPRA", cat:"Specialized Category", title:"Facility Maintenance",                         service:"Pipeline Maintenance & Equipment Refurbishment",                                     expiry:"2026-07-28", rawStatus:"ACTIVE" },
  { body:"NMDPRA", cat:"Major Category",       title:"Engineering and Technical Services",           service:"Major Mechanical",                                                                   expiry:"2026-07-23", rawStatus:"ACTIVE" },
  { body:"NMDPRA", cat:"Major Category",       title:"Equipment and Material Supply Services",       service:"Mechanical Parts — Valves, Nozzles, Flanges, Seals, O-rings, Bolts etc.",          expiry:"2026-07-23", rawStatus:"ACTIVE" },
  { body:"NMDPRA", cat:"Specialized Category", title:"Inspection and Certification Services",        service:"Safety Critical Equipment, All Valves (RV, PSV, PCV, PVCV, BDV, ESD, HIPPS etc.)",   expiry:"2026-08-26", rawStatus:"ACTIVE" },
  { body:"NMDPRA", cat:"Specialized Category", title:"Manpower Supply",                              service:"Administrative, Support & Engineering/Technical Staff Supply",                       expiry:"2026-07-28", rawStatus:"ACTIVE" },

  // ── NUPRC ──
  { body:"NUPRC",  cat:"Major Category",       title:"Installation and Maintenance",                 service:"Mechanical & Electrical Installation/Maintenance & Materials",                       expiry:"2027-02-26", rawStatus:"ACTIVE" },
  { body:"NUPRC",  cat:"Major Category",       title:"Technical Consultancy Services",               service:"Production Operation & Process Maintenance; Facility Inspection & Maintenance",      expiry:"2026-04-29", rawStatus:"PROCESSING" },
  { body:"NUPRC",  cat:"Specialized Category", title:"Calibration Services",                         service:"Relief/Pressure Safety Valves Certification",                                        expiry:"2027-02-26", rawStatus:"ACTIVE" },
  { body:"NUPRC",  cat:"Major Category",       title:"Rehabilitation, Upgrade & Fabrication",        service:"Minor Metal Fabrication & Minor Mechanical",                                         expiry:"2026-04-29", rawStatus:"PROCESSING" },
  { body:"NUPRC",  cat:"Specialized Category", title:"Facilities Maintenance Services",              service:"Pressure Testing, Leak Detection, Safety Critical Equipment & Valves Certification", expiry:"2027-02-26", rawStatus:"ACTIVE" },
  { body:"NUPRC",  cat:"Specialized Category", title:"Major Construction Service",                   service:"Mechanical Engineering — Installation/Upgrade of On-/Offshore Production Facilities", expiry:"2026-04-29", rawStatus:"PROCESSING" },
  { body:"NUPRC",  cat:"Major Category",       title:"Consultancy Service",                          service:"Nigerian Manpower Supply (Nigerian Professionals only)",                             expiry:"2027-02-26", rawStatus:"ACTIVE" },
  { body:"NUPRC",  cat:"Specialized Category", title:"Heavy Duty Equipment Supply, Install & Maint", service:"LP/HP Pumps & Valves (12 inches & above)",                                           expiry:"2027-02-26", rawStatus:"ACTIVE" },
  { body:"NUPRC",  cat:"Major Category",       title:"Equipment and Material Supply Services",       service:"Heating & Cooling Equipment, Valves, Nozzles, Expanders & Flanges",                  expiry:"2027-02-26", rawStatus:"ACTIVE" },
  { body:"NUPRC",  cat:"Specialized Category", title:"Waste Management Services",                    service:"Tank Vessel Cleaning",                                                               expiry:"2026-07-28", rawStatus:"ACTIVE" },
  { body:"NUPRC",  cat:"Specialized Category", title:"Offshore Pipeline Laying",                     service:"Laying of Oil & Gas Pipeline; Pipeline Fabrication/Construction",                    expiry:"2026-08-26", rawStatus:"ACTIVE" },
  { body:"NUPRC",  cat:"Specialized Category", title:"Onshore Pipeline Laying",                      service:"Laying of Oil & Gas Pipeline; Pipeline Fabrication/Construction",                    expiry:"2026-08-21", rawStatus:"ACTIVE" },

    // ── NCDMB ──
  { body:"NCDMB",  cat:"", title:"",                      service:"",                    expiry:"", rawStatus:"" },

  // ── NCEC ──
  { body:"NCEC",   cat:"—",                    title:"Procurement and Supply",                       service:"—",                                                                              expiry:"2026-12-05", rawStatus:"ACTIVE" },
  { body:"NCEC",   cat:"—",                    title:"Construction and Moveable Equipment",          service:"—",                                                                              expiry:"", rawStatus:"PROCESSING" },
  { body:"NCEC",   cat:"—",                    title:"Consultancy Service",                          service:"—",                                                                              expiry:"2026-11-26", rawStatus:"ACTIVE" },

  // ── NOGIC JQS ──
  { body:"NOGIC JQS", cat:"—",                 title:"",                         service:"—",                                                                              expiry:"2026-09-11", rawStatus:"ACTIVE" },

  // ── COREN ──
  { body:"COREN",  cat:"—",                    title:"",                           service:"—",                                                                              expiry:"2026-12-01", rawStatus:"ACTIVE" },

  // ── ITF ──
  { body:"ITF",    cat:"—",                    title:"",                   service:"—",                                                                              expiry:"2026-12-31", rawStatus:"ACTIVE" },

  // ── NSITF ──
  { body:"NSITF",  cat:"—",                    title:"NSITF Compliance Certificate",                 service:"—",                                                                              expiry:"2026-12-31", rawStatus:"ACTIVE" },

  // ── RECRUITERS PERMIT ──
  { body:"RECRUITERS PERMIT", cat:"—",         title:"Recruiters Permit",                            service:"—",                                                                              expiry:"2026-03-12", rawStatus:"EXPIRED" },

  // ── TCC ──
  { body:"TCC",    cat:"—",                    title:"Tax Clearance Certificate",                    service:"—",                                                                              expiry:"2025-12-31", rawStatus:"EXPIRED" },

  // ── GROUP LIFE INSURANCE ──
  { body:"GROUP LIFE INSURANCE", cat:"—",      title:"Group Life Insurance Policy",                  service:"—",                                                                              expiry:"2027-03-01", rawStatus:"ACTIVE" },

   // ── PENCOM──
  { body:"PENCOM", cat:"—",      title:"",                  service:"—",                                                                              expiry:"", rawStatus:"" },

];

function daysLeft(d) {
  if (!d) return null;
  // Use startOf('day') on both sides to avoid time-of-day truncation (off-by-one)
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
    expired:  { cls:"b-expired",  label:"Expired" },
    critical: { cls:"b-critical", label:"≤ 7 days" },
    warning:  { cls:"b-warning",  label:"≤ 30 days" },
    ok:       { cls:"b-ok",       label:"Active" },
    proc:     { cls:"b-proc",     label:"Processing" },
    nodate:   { cls:"b-nodate",   label:"No date" },
  }[s];
}

const records = RAW.map((r, i) => ({ ...r, id: i, status: computeStatus(r) }));

let activeFilter = "all";
let searchQ = "";

function buildEmail() {
  const urgent = records.filter(r => ["expired","critical"].includes(r.status));
  if (!urgent.length) return null;
  const lines = urgent.map(r => {
    const n = daysLeft(r.expiry);
    const state = n < 0 ? `EXPIRED ${Math.abs(n)} days ago` : `expires in ${n} day(s) — ${r.expiry}`;
    return `• [${r.body}] ${r.title} — ${state}`;
  }).join('\n');
  const subject = `⚠️ Certification Expiry Alert — ${urgent.length} item(s) require attention`;
  const body = `Hello,\n\nThe following certifications require immediate attention:\n\n${lines}\n\nPlease arrange for renewal before the expiry dates.\n\nThis is an automated reminder from the Certification Tracker.`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function render() {
  const counts = { expired:0, critical:0, warning:0, ok:0, proc:0, nodate:0 };
  records.forEach(r => counts[r.status]++);

  document.getElementById("m-total").textContent   = records.length;
  document.getElementById("m-expired").textContent = counts.expired;
  document.getElementById("m-critical").textContent= counts.critical;
  document.getElementById("m-warning").textContent = counts.warning;
  document.getElementById("m-proc").textContent    = counts.proc;
  document.getElementById("m-ok").textContent      = counts.ok;

  // Filterss
  const filterDefs = [
    { key:"all",      label:`All (${records.length})` },
    { key:"expired",  label:`Expired (${counts.expired})` },
    { key:"critical", label:`≤ 7 days (${counts.critical})` },
    { key:"warning",  label:`≤ 30 days (${counts.warning})` },
    { key:"ok",       label:`Active (${counts.ok})` },
    { key:"proc",     label:`Processing (${counts.proc})` },
  ];
  document.getElementById("filters").innerHTML = filterDefs.map(f =>
    `<button class="filter-btn ${activeFilter===f.key?'active':''}" data-key="${f.key}">${f.label}</button>`
  ).join('');
  document.querySelectorAll('.filter-btn').forEach(b =>
    b.addEventListener('click', () => { activeFilter = b.dataset.key; render(); })
  );

  // Email button
  const eb = document.getElementById("email-btn");
  const href = buildEmail();
  if (href) {
    eb.href = href;
    eb.classList.remove("dim");
    eb.textContent = `📧 Email alert (${counts.expired + counts.critical})`;
  } else {
    eb.href = "#";
    eb.classList.add("dim");
    eb.innerHTML = "📧 Email alert";
  }

  // Filter + search
  let filtered = activeFilter === "all" ? records : records.filter(r => r.status === activeFilter);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    filtered = filtered.filter(r =>
      r.body.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.cat.toLowerCase().includes(q) ||
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
    const dateDisplay = r.expiry ? r.expiry : "—";
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

document.getElementById("search").addEventListener("input", function() {
  searchQ = this.value.trim();
  render();
});

// ── UPLOAD LOGIC ──────────────────────────────────────────────

function showBanner(msg, type) {
  const b = document.getElementById("upload-banner");
  const colors = {
    success: { bg:"rgba(34,197,94,.1)",   color:"#4ade80", border:"rgba(34,197,94,.25)" },
    error:   { bg:"rgba(239,68,68,.1)",   color:"#f87171", border:"rgba(239,68,68,.25)" },
    info:    { bg:"rgba(99,102,241,.1)",  color:"#a5b4fc", border:"rgba(99,102,241,.25)" },
  }[type];
  b.style.cssText = `display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:1rem; padding:10px 14px; border-radius:8px; font-size:13px; background:${colors.bg}; border:1px solid ${colors.border}; color:${colors.color};`;
  b.innerHTML = `<span>${msg}</span><button onclick="document.getElementById('upload-banner').style.display='none'" style="background:none;border:none;cursor:pointer;font-size:16px;color:inherit;opacity:0.6;">×</button>`;
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
  const find = (patterns) => cols.find(c => patterns.some(p => p.test(c.toLowerCase()))) || null;
  return {
    body:      find([/reg.*body/, /body/, /authority/, /regulator/]),
    cat:       find([/cat/, /type/, /class/]),
    title:     find([/title/, /name/, /certif/, /compliance/]),
    service:   find([/service/, /description/, /scope/]),
    expiry:    find([/expir/, /exp.*date/, /date.*exp/, /due/, /date/]),
    rawStatus: find([/status/, /state/]),
  };
}

function applyMapping(rows, mapping) {
  return rows.map((r, i) => {
    const get = (key) => mapping[key] ? String(r[mapping[key]] || "").trim() : "—";
    const expiryRaw = mapping.expiry ? r[mapping.expiry] : null;
    const expiry = parseDate(expiryRaw);
    const rs = (get("rawStatus") || "ACTIVE").toUpperCase();
    const rawStatus = ["ACTIVE","EXPIRED","PROCESSING"].includes(rs) ? rs : "ACTIVE";
    return {
      id: i,
      body:      get("body")    || "—",
      cat:       get("cat")     || "—",
      title:     get("title")   || ("Row " + (i+1)),
      service:   get("service") || "—",
      expiry,
      rawStatus,
      status: computeStatus({ rawStatus, expiry }),
    };
  }).filter(r => r.title && r.title !== "—");
}

function openMappingModal(cols, onConfirm) {
  const fields = [
    { key:"body",      label:"Regulatory Body",  required:false },
    { key:"cat",       label:"Category",          required:false },
    { key:"title",     label:"Title / Name ✱",    required:true  },
    { key:"service",   label:"Service",           required:false },
    { key:"expiry",    label:"Expiry Date ✱",     required:true  },
    { key:"rawStatus", label:"Status",            required:false },
  ];
  const auto = autoDetectCols(cols);
  document.getElementById("modal-fields").innerHTML = fields.map(f => `
    <div class="map-row">
      <span class="map-label">${f.label}</span>
      <select class="map-select" id="map-${f.key}">
        ${["(skip)", ...cols].map(c => `<option value="${c}" ${auto[f.key]===c?"selected":""}>${c}</option>`).join("")}
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

document.getElementById("file-upload").addEventListener("change", function(e) {
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
        // Robust CSV field parser — handles quoted fields with embedded commas
        const parseCSVLine = (line) => {
          const fields = [];
          let cur = "", inQuote = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuote && line[i+1] === '"') { cur += '"'; i++; } // escaped quote
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
        const wb = XLSX.read(ev.target.result, { type:"array", cellDates:true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
      }
      if (!rows.length) { showBanner("⚠️ No data rows found in the file.", "error"); return; }
      const cols = Object.keys(rows[0]);
      const auto = autoDetectCols(cols);

      const doImport = (mapping) => {
        const imported = applyMapping(rows, mapping);
        if (!imported.length) { showBanner("⚠️ No valid records could be parsed.", "error"); return; }
        records.length = 0;
        imported.forEach(r => records.push(r));
        activeFilter = "all";
        searchQ = "";
        document.getElementById("search").value = "";
        render();
        showBanner("✅ Imported <strong>" + imported.length + " records</strong> from <strong>" + file.name + "</strong>. <a href='#' onclick='resetToDefault(event)' style='color:inherit;text-decoration:underline;'>Reset to default</a>", "success");
      };

      if (auto.title && auto.expiry) {
        doImport(auto);
      } else {
        openMappingModal(cols, doImport);
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

render();

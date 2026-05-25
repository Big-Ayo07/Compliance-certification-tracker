// api/send-alerts.js
// Vercel serverless function — daily certification expiry alert
// Called by cron-job.org with ?token=YOUR_SECRET

const https = require("https");
const path  = require("path");
const fs    = require("fs");

// ── helpers ──────────────────────────────────────────────────

function daysLeft(expiryStr) {
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryStr);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry - today) / (1000 * 60 * 60 * 24));
}

function buildEmailBody(urgent, company) {
  const lines = urgent.map(r => {
    const n = daysLeft(r.expiry);
    const statusLine = n < 0
      ? `Status:          EXPIRED (${Math.abs(n)} day(s) ago)`
      : `Status:          EXPIRING IN ${n} DAY(S)`;
    return [
      `------------------------------------------------------------`,
      `Regulatory Body: ${r.body}`,
      `Category:        ${r.cat && r.cat !== "—" ? r.cat : "N/A"}`,
      `Title:           ${r.title}`,
      `Expiry Date:     ${r.expiry}`,
      statusLine,
    ].join("\n");
  }).join("\n\n");

  return (
    `This is an automated daily alert from the ${company} Compliance Certification Tracker.\n\n` +
    `The following ${urgent.length} certification(s) require immediate attention:\n\n` +
    `${lines}\n\n` +
    `------------------------------------------------------------\n` +
    `Please initiate the renewal process as soon as possible.\n\n` +
    `${company}\n` +
    `Compliance & Regulatory Affairs`
  );
}

// EmailJS REST API — sends one email, returns a Promise
function sendViaEmailJS(serviceId, templateId, publicKey, to, subject, body) {
  const payload = JSON.stringify({
    service_id:  serviceId,
    template_id: templateId,
    user_id:     publicKey,
    template_params: {
      to_email: to,
      subject,
      body,
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.emailjs.com",
        path:     "/api/v1.0/email/send",
        method:   "POST",
        headers: {
          "Content-Type":   "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", chunk => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve({ ok: true, to });
          } else {
            reject(new Error(`EmailJS ${res.statusCode} for ${to}: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── handler ──────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // 1. Token check
  const secret = process.env.ALERT_TOKEN;
  if (!secret || req.query.token !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2. Load data.json from project root
  let data;
  try {
    const filePath = path.join(process.cwd(), "data.json");
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return res.status(500).json({ error: "Could not read data.json", detail: err.message });
  }

  const { emailjs: cfg, certifications = [], company = "AIRYOLK Nigeria Limited" } = data;

  if (!cfg || !cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
    return res.status(500).json({ error: "EmailJS config missing in data.json" });
  }

  const recipients = Array.isArray(cfg.recipients)
    ? cfg.recipients.filter(r => typeof r === "string" && r.includes("@"))
    : [];

  if (!recipients.length) {
    return res.status(200).json({ message: "No recipients configured — nothing sent." });
  }

  // 3. Find urgent certs (expired or expiring within 7 days)
  const urgent = certifications.filter(r => {
    if (r.rawStatus === "PROCESSING" || !r.expiry) return false;
    const n = daysLeft(r.expiry);
    return n <= 7; // covers both expired (negative) and ≤7 days
  });

  if (!urgent.length) {
    return res.status(200).json({ message: "No urgent certifications — nothing sent." });
  }

  // 4. Build email content
  const subject = "AIRYOLK Compliance Certification Expiry Alert";
  const body    = buildEmailBody(urgent, company);

  // 5. Send to each recipient sequentially
  const results = [];
  for (const to of recipients) {
    try {
      await sendViaEmailJS(cfg.serviceId, cfg.templateId, cfg.publicKey, to, subject, body);
      results.push({ to, status: "sent" });
    } catch (err) {
      results.push({ to, status: "failed", error: err.message });
    }
  }

  const failed = results.filter(r => r.status === "failed");
  return res.status(200).json({
    message: `Alert processed. ${results.length - failed.length}/${results.length} sent.`,
    urgentCount: urgent.length,
    results,
  });
};

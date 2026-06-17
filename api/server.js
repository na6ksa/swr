require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");

const kycRoutes    = require("./routes/kyc");
const assetRoutes  = require("./routes/assets");
const yieldRoutes  = require("./routes/yield");
const sarxRoutes   = require("./routes/sarx");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── SECURITY ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));

// Global rate limiter — 100 req/15 min per IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true }));

// ── HEALTH ────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0", timestamp: new Date().toISOString() });
});

// ── ROUTES ────────────────────────────────────────────────
app.use("/api/v1/kyc",    kycRoutes);
app.use("/api/v1/assets", assetRoutes);
app.use("/api/v1/yield",  yieldRoutes);
app.use("/api/v1/sarx",   sarxRoutes);

// ── 404 ───────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── ERROR HANDLER ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 SWR API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

module.exports = app;

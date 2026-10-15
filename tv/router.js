import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guide, onNow, publicChannels, search } from "./channels.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const HOUR = 3600e3;

export const tvRouter = express.Router();

tvRouter.get("/api/channels", (req, res) => {
  res.json({ channels: publicChannels() });
});

tvRouter.get("/api/guide", (req, res) => {
  const now = Date.now();
  const from = Number(req.query.from) || now - HOUR;
  const hours = Math.min(Math.max(Number(req.query.hours) || 6, 1), 48);
  res.json({ now, from, to: from + hours * HOUR, rows: guide(from, from + hours * HOUR) });
});

tvRouter.get("/api/now", (req, res) => {
  res.json({ now: Date.now(), programs: onNow() });
});

tvRouter.get("/api/search", (req, res) => {
  res.json(search(String(req.query.q || "")));
});

tvRouter.use(express.static(path.join(here, "public")));

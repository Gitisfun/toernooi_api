import express from "express";
import * as tournamentService from "../services/tournament.js";
import { getIO } from "../config/socket.js";

const router = express.Router();

/**
 * @openapi
 * /tournament:
 *   get:
 *     summary: Get all tournament games
 *     description: >
 *       Poules: `groups.a` / `groups.b` (sorted by `order`, teams populated).
 *       `standings.a` / `standings.b` are poule tables (points, GD, H2H pens tiebreaker).
 *       After POST /tournament, knockout slots are real games: `lastPlace` and `final` (single game DTOs),
 *       `quarterFinal` (4) and `semiFinal` (2). This endpoint (and game PATCH/POST) fills bracket rows
 *       that still have both teams empty when data allows: poule → last + quarters; decided QFs → semis;
 *       decided semis → final (winner from full time or penalties).
 *       Legacy DBs with no knockout rows may still return `{}` / `[]` for those fields.
 *     tags: [Tournament]
 *     responses:
 *       200:
 *         description: Games by poule
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TournamentGetResponse'
 */
router.get("/", async (req, res, next) => {
  try {
    const games = await tournamentService.getTournamentGames();
    res.json(games);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /tournament/order:
 *   post:
 *     summary: Reorder tournament games
 *     description: >
 *       Submit full ordered lists of game ids per poule (10 each). Row index `i` gets
 *       the canonical time slot `i`; group A / B stay parallel. Updates `order`, `startHour`, `endHour`.
 *     tags: [Tournament]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TournamentReorderRequest'
 *     responses:
 *       200:
 *         description: Updated schedule (same shape as GET /tournament)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TournamentGetResponse'
 *       400:
 *         description: Invalid ids, lengths, rounds, or duplicates
 */
router.post("/order", async (req, res, next) => {
  try {
    const result = await tournamentService.reorderTournamentGames(req.body);
    getIO().emit("games:updated");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /tournament:
 *   post:
 *     summary: Create tournament schedule
 *     description: >
 *       Deletes existing games, then builds group-stage matches from exactly 10 teams
 *       in two groups of five (`team.group`). Round-robin within each group.
 *       Ten time slots; each slot has one match per group (parallel).
 *       Match `round` is `group A` or `group B` (first vs second poule).
 *       Also inserts 8 knockout placeholder games with fixed slots: last place and QF1 15:40–16:00;
 *       QF2–QF3 16:10–16:30; QF4 16:40–17:00; both semis 17:10–17:30; final 17:40–18:10 (teams TBD).
 *     tags: [Tournament]
 *     responses:
 *       201:
 *         description: Schedule created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TournamentCreateResponse'
 *       400:
 *         description: Wrong team or group counts
 */
router.post("/", async (req, res, next) => {
  try {
    const result = await tournamentService.createTournament();
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /tournament:
 *   delete:
 *     summary: Delete all games
 *     description: Removes every game (tournament / schedule reset). Teams are unchanged.
 *     tags: [Tournament]
 *     responses:
 *       200:
 *         description: Deletion result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TournamentResetResponse'
 */
router.delete("/", async (req, res, next) => {
  try {
    const result = await tournamentService.resetTournament();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

import express from "express";
import * as gameService from "../services/game.js";
import * as tournamentService from "../services/tournament.js";

const router = express.Router();

/**
 * @openapi
 * /games:
 *   get:
 *     summary: List games for a group
 *     description: Both teams must belong to the group (matches team.group).
 *     tags: [Games]
 *     parameters:
 *       - in: query
 *         name: group
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Games sorted by round then order
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Game'
 *       400:
 *         description: Missing or invalid group
 */
router.get("/", async (req, res, next) => {
  try {
    const { group } = req.query;
    if (group === undefined || group === "") {
      const err = new Error("Missing required query parameter: group");
      err.status = 400;
      throw err;
    }
    const games = await gameService.getGamesByGroup(group);
    res.json(games);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /games:
 *   post:
 *     summary: Create a game
 *     tags: [Games]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GameCreate'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Game'
 *       400:
 *         description: Validation error or duplicate id
 */
router.post("/", async (req, res, next) => {
  try {
    const game = await gameService.saveGame(req.body);
    await tournamentService.tryFillKnockoutFromGroupStandings();
    res.status(201).json(game);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /games/{id}:
 *   get:
 *     summary: Get a game by id
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Game'
 *       404:
 *         description: Not found
 */
router.get("/:id", async (req, res, next) => {
  try {
    const game = await gameService.getGame(req.params.id);
    res.json(game);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /games/{id}:
 *   patch:
 *     summary: Update a game
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GameUpdate'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Game'
 *       400:
 *         description: No valid fields
 *       404:
 *         description: Not found
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const game = await gameService.updateGame(req.params.id, req.body);
    await tournamentService.tryFillKnockoutFromGroupStandings();
    res.json(game);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /games:
 *   delete:
 *     summary: Delete all games
 *     tags: [Games]
 *     responses:
 *       200:
 *         description: Count of deleted documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deletedCount:
 *                   type: integer
 */
router.delete("/", async (req, res, next) => {
  try {
    const result = await gameService.deleteAllGames();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

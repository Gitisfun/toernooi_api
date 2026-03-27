import express from "express";
import * as teamService from "../services/team.js";

const router = express.Router();

/**
 * @openapi
 * /teams:
 *   get:
 *     summary: List all teams
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: All teams in the oppem database
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Team'
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res, next) => {
  try {
    const teams = await teamService.getAll();
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /teams:
 *   post:
 *     summary: Create or update many teams
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TeamInput'
 *     responses:
 *       200:
 *         description: Teams after upsert (same order as request)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Team'
 *       400:
 *         description: Invalid body or validation error
 *       500:
 *         description: Server error
 */
router.post("/", async (req, res, next) => {
  try {
    const result = await teamService.upsertAll(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /teams:
 *   delete:
 *     summary: Delete all teams
 *     description: Removes every team document from the oppem database.
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: Number of teams deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeamsDeleteAllResponse'
 */
router.delete("/", async (req, res, next) => {
  try {
    const result = await teamService.deleteAll();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

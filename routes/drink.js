import express from "express";
import * as drinkService from "../services/drink.js";
import { getIO } from "../config/socket.js";

const router = express.Router();

/**
 * @openapi
 * /drinks:
 *   post:
 *     summary: Create or sync drinks for all teams
 *     description: Upserts one drink per team (document id equals team id). New drinks get amount 0; existing amounts are preserved.
 *     tags: [Drinks]
 *     responses:
 *       200:
 *         description: Drinks for every team, in team name order
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Drink'
 *       500:
 *         description: Server error
 */
router.post("/", async (req, res, next) => {
  try {
    const drinks = await drinkService.createAllFromTeams();
    getIO().emit("drinks:updated");
    res.json(drinks);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /drinks:
 *   get:
 *     summary: List all drinks
 *     description: Sorted by amount descending, then id ascending.
 *     tags: [Drinks]
 *     responses:
 *       200:
 *         description: All drinks with populated team
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Drink'
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res, next) => {
  try {
    const drinks = await drinkService.getAll();
    res.json(drinks);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /drinks:
 *   delete:
 *     summary: Delete all drinks
 *     tags: [Drinks]
 *     responses:
 *       200:
 *         description: Number of drinks deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DrinksDeleteAllResponse'
 */
router.delete("/", async (req, res, next) => {
  try {
    const result = await drinkService.deleteAll();
    getIO().emit("drinks:updated");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /drinks/{id}:
 *   patch:
 *     summary: Update a single drink
 *     tags: [Drinks]
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
 *             $ref: '#/components/schemas/DrinkUpdate'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Drink'
 *       400:
 *         description: No valid fields or invalid amount
 *       404:
 *         description: Not found
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const drink = await drinkService.updateDrink(req.params.id, req.body);
    getIO().emit("drinks:updated");
    res.json(drink);
  } catch (err) {
    next(err);
  }
});

export default router;

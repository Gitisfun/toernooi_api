import ApiError from "../errors/index.js";
import { getDrinkModel } from "../models/drink.js";
import { getTeamModel } from "../models/team.js";

const TEAM_POPULATE_SELECT = "name group";

function toTeamDtoFromRef(team) {
  if (team == null) {
    return null;
  }
  if (typeof team === "string") {
    return { id: team, name: null, group: null };
  }
  return {
    id: team._id,
    name: team.name,
    group: team.group,
  };
}

function toDrinkDto(doc) {
  return {
    id: doc._id,
    team: toTeamDtoFromRef(doc.team),
    amount: doc.amount,
  };
}

function populateTeam(q) {
  const Team = getTeamModel();
  return q.populate({
    path: "team",
    model: Team,
    select: TEAM_POPULATE_SELECT,
  });
}

function assertFiniteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw ApiError.badRequest(`${field} must be a finite number`);
  }
}

/**
 * For each team in the teams collection, upsert a drink (same document id as team id).
 * Existing drinks keep their current `amount`; new drinks get `amount` 0.
 * @returns {Promise<Array<{ id: string, team: object, amount: number }>>}
 */
export async function createAllFromTeams() {
  const Team = getTeamModel();
  const Drink = getDrinkModel();
  const teams = await Team.find().sort({ name: 1 }).lean();

  const ops = teams.map((t) => ({
    updateOne: {
      filter: { _id: t._id },
      update: {
        $set: { team: t._id },
        $setOnInsert: { amount: 0 },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await Drink.bulkWrite(ops, { ordered: false });
  }

  const teamIds = teams.map((t) => t._id);
  if (teamIds.length === 0) {
    return [];
  }

  const docs = await populateTeam(
    Drink.find({ _id: { $in: teamIds } }).sort({ _id: 1 })
  ).lean();

  const byId = new Map(docs.map((d) => [d._id, d]));
  return teamIds.map((id) => {
    const doc = byId.get(id);
    if (!doc) {
      throw ApiError.internal("Drink state inconsistent after save");
    }
    return toDrinkDto(doc);
  });
}

/**
 * @returns {Promise<Array<{ id: string, team: object, amount: number }>>}
 */
export async function getAll() {
  const Drink = getDrinkModel();
  const docs = await populateTeam(
    Drink.find({}).sort({ amount: -1, _id: 1 })
  ).lean();
  return docs.map(toDrinkDto);
}

/**
 * @param {string} id
 * @param {object} body
 */
export async function updateDrink(id, body) {
  if (typeof id !== "string" || id.trim() === "") {
    throw ApiError.badRequest("id must be a non-empty string");
  }
  if (body == null || typeof body !== "object") {
    throw ApiError.badRequest("Request body must be an object");
  }

  const $set = {};
  if (Object.prototype.hasOwnProperty.call(body, "amount")) {
    assertFiniteNumber(body.amount, "amount");
    $set.amount = body.amount;
  }

  if (Object.keys($set).length === 0) {
    throw ApiError.badRequest("No valid fields to update");
  }

  const Drink = getDrinkModel();
  const updated = await populateTeam(
    Drink.findByIdAndUpdate(id.trim(), { $set }, {
      returnDocument: "after",
      runValidators: true,
    })
  ).lean();

  if (!updated) {
    throw ApiError.notFound("Drink not found");
  }

  return toDrinkDto(updated);
}

/**
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function deleteAll() {
  const Drink = getDrinkModel();
  const result = await Drink.deleteMany({});
  return { deletedCount: result.deletedCount ?? 0 };
}

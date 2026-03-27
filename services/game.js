import ApiError from "../errors/index.js";
import { getGameModel } from "../models/game.js";
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

function toGameDto(doc) {
  return {
    id: doc._id,
    homeTeam: toTeamDtoFromRef(doc.homeTeam),
    awayTeam: toTeamDtoFromRef(doc.awayTeam),
    homeTeamScore: doc.homeTeamScore,
    awayTeamScore: doc.awayTeamScore,
    penaltyHomeTeamScore: doc.penaltyHomeTeamScore,
    penaltyAwayTeamScore: doc.penaltyAwayTeamScore,
    round: doc.round,
    order: doc.order,
    startHour: doc.startHour,
    endHour: doc.endHour,
    terrain: doc.terrain ?? null,
    description: doc.description ?? null,
  };
}

function populateTeams(q) {
  const Team = getTeamModel();
  return q
    .populate({
      path: "homeTeam",
      model: Team,
      select: TEAM_POPULATE_SELECT,
    })
    .populate({
      path: "awayTeam",
      model: Team,
      select: TEAM_POPULATE_SELECT,
    });
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw ApiError.badRequest(`${field} must be a non-empty string`);
  }
}

function assertFiniteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw ApiError.badRequest(`${field} must be a finite number`);
  }
}

function normalizeOptionalTrimmedString(value, field) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw ApiError.badRequest(`${field} must be a string or null`);
  }
  const t = value.trim();
  return t === "" ? null : t;
}

function normalizeOptionalNumber(value, field) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(num)) {
    return num;
  }
  throw ApiError.badRequest(`${field} must be a finite number or null`);
}

function coerceFiniteNumber(value, field) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  throw ApiError.badRequest(`${field} must be a finite number`);
}

function normalizeGroupFilter(group) {
  if (typeof group === "number" && Number.isFinite(group)) {
    return String(group);
  }
  if (typeof group === "string" && group.trim() !== "") {
    return group.trim();
  }
  throw ApiError.badRequest("group must be a non-empty string or number");
}

function normalizeTeamId(value, field) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if ("id" in value) {
      return normalizeTeamId(value.id, field);
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  throw ApiError.badRequest(
    `${field} must be a team id (string/number) or an object with id`
  );
}

function isTeamProvided(value) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (typeof value === "object" && !Array.isArray(value) && "id" in value) {
    const id = value.id;
    if (id === undefined || id === null) {
      return false;
    }
    if (typeof id === "string") {
      return id.trim() !== "";
    }
    return typeof id === "number" && Number.isFinite(id);
  }
  return typeof value === "number" && Number.isFinite(value);
}

async function assertTeamsExist(homeTeamId, awayTeamId) {
  if (homeTeamId == null && awayTeamId == null) {
    return;
  }
  if (homeTeamId == null || awayTeamId == null) {
    throw ApiError.badRequest(
      "homeTeam and awayTeam must both be set or both empty"
    );
  }
  const Team = getTeamModel();
  const ids = [...new Set([homeTeamId, awayTeamId])];
  const count = await Team.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) {
    throw ApiError.badRequest(
      "homeTeam and awayTeam must reference existing team ids"
    );
  }
}

function validateGamePayload(body, { requireId }) {
  if (body == null || typeof body !== "object") {
    throw ApiError.badRequest("Request body must be an object");
  }

  let id;
  if (requireId) {
    assertNonEmptyString(body.id, "id");
    id = body.id.trim();
  } else if (body.id !== undefined && body.id !== null) {
    assertNonEmptyString(body.id, "id");
    id = body.id.trim();
  }

  const homeProvided = isTeamProvided(body.homeTeam);
  const awayProvided = isTeamProvided(body.awayTeam);
  if (homeProvided !== awayProvided) {
    throw ApiError.badRequest(
      "homeTeam and awayTeam must both be set or both omitted/empty"
    );
  }
  const homeTeam = homeProvided
    ? normalizeTeamId(body.homeTeam, "homeTeam")
    : null;
  const awayTeam = awayProvided
    ? normalizeTeamId(body.awayTeam, "awayTeam")
    : null;
  assertNonEmptyString(body.round, "round");
  const order = coerceFiniteNumber(body.order, "order");
  assertNonEmptyString(body.startHour, "startHour");
  assertNonEmptyString(body.endHour, "endHour");

  const homeTeamScore = normalizeOptionalNumber(
    body.homeTeamScore,
    "homeTeamScore"
  );
  const awayTeamScore = normalizeOptionalNumber(
    body.awayTeamScore,
    "awayTeamScore"
  );
  const penaltyHomeTeamScore = normalizeOptionalNumber(
    body.penaltyHomeTeamScore,
    "penaltyHomeTeamScore"
  );
  const penaltyAwayTeamScore = normalizeOptionalNumber(
    body.penaltyAwayTeamScore,
    "penaltyAwayTeamScore"
  );
  const terrain = normalizeOptionalTrimmedString(body.terrain, "terrain");
  const description = normalizeOptionalTrimmedString(
    body.description,
    "description"
  );

  return {
    id,
    homeTeam,
    awayTeam,
    homeTeamScore,
    awayTeamScore,
    penaltyHomeTeamScore,
    penaltyAwayTeamScore,
    round: body.round.trim(),
    order,
    startHour: body.startHour.trim(),
    endHour: body.endHour.trim(),
    terrain,
    description,
  };
}

/**
 * @param {object} body
 */
export async function saveGame(body) {
  const data = validateGamePayload(body, { requireId: true });
  await assertTeamsExist(data.homeTeam ?? null, data.awayTeam ?? null);

  const Game = getGameModel();

  const doc = {
    _id: data.id,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    homeTeamScore: data.homeTeamScore,
    awayTeamScore: data.awayTeamScore,
    penaltyHomeTeamScore: data.penaltyHomeTeamScore,
    penaltyAwayTeamScore: data.penaltyAwayTeamScore,
    round: data.round,
    order: data.order,
    startHour: data.startHour,
    endHour: data.endHour,
    terrain: data.terrain,
    description: data.description,
  };

  try {
    await Game.create(doc);
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.badRequest("A game with this id already exists");
    }
    throw err;
  }

  const created = await populateTeams(Game.findById(data.id)).lean();
  return toGameDto(created);
}

const PATCHABLE = new Set([
  "homeTeam",
  "awayTeam",
  "homeTeamScore",
  "awayTeamScore",
  "penaltyHomeTeamScore",
  "penaltyAwayTeamScore",
  "round",
  "order",
  "startHour",
  "endHour",
  "terrain",
  "description",
]);

/**
 * @param {string} id
 * @param {object} body
 */
export async function updateGame(id, body) {
  if (typeof id !== "string" || id.trim() === "") {
    throw ApiError.badRequest("id must be a non-empty string");
  }
  if (body == null || typeof body !== "object") {
    throw ApiError.badRequest("Request body must be an object");
  }

  const $set = {};
  for (const key of PATCHABLE) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) {
      continue;
    }
    const v = body[key];
    if (key === "homeTeam" || key === "awayTeam") {
      if (v === null || v === undefined) {
        $set[key] = null;
      } else if (typeof v === "string" && v.trim() === "") {
        $set[key] = null;
      } else {
        $set[key] = normalizeTeamId(v, key);
      }
    } else if (key === "startHour" || key === "endHour") {
      assertNonEmptyString(v, key);
      $set[key] = v.trim();
    } else if (key === "terrain" || key === "description") {
      if (v === null || v === undefined) {
        $set[key] = null;
      } else if (typeof v === "string") {
        const t = v.trim();
        $set[key] = t === "" ? null : t;
      } else {
        throw ApiError.badRequest(`${key} must be a string or null`);
      }
    } else if (key === "round") {
      assertNonEmptyString(v, key);
      $set[key] = v.trim();
    } else if (key === "order") {
      $set[key] = coerceFiniteNumber(v, key);
    } else if (
      key === "homeTeamScore" ||
      key === "awayTeamScore" ||
      key === "penaltyHomeTeamScore" ||
      key === "penaltyAwayTeamScore"
    ) {
      $set[key] = normalizeOptionalNumber(v, key);
    }
  }

  if (Object.keys($set).length === 0) {
    throw ApiError.badRequest("No valid fields to update");
  }

  const Game = getGameModel();

  if ($set.homeTeam !== undefined || $set.awayTeam !== undefined) {
    const existing = await Game.findById(id.trim())
      .select("homeTeam awayTeam")
      .lean();
    if (!existing) {
      throw ApiError.notFound("Game not found");
    }
    const homeTeamId =
      $set.homeTeam !== undefined ? $set.homeTeam : existing.homeTeam;
    const awayTeamId =
      $set.awayTeam !== undefined ? $set.awayTeam : existing.awayTeam;
    await assertTeamsExist(
      homeTeamId ?? null,
      awayTeamId ?? null
    );
  }

  const updated = await populateTeams(
    Game.findByIdAndUpdate(id.trim(), { $set }, {
      returnDocument: "after",
      runValidators: true,
    })
  ).lean();

  if (!updated) {
    throw ApiError.notFound("Game not found");
  }

  return toGameDto(updated);
}

/**
 * @param {string} id
 */
export async function getGame(id) {
  if (typeof id !== "string" || id.trim() === "") {
    throw ApiError.badRequest("id must be a non-empty string");
  }
  const Game = getGameModel();
  const doc = await populateTeams(Game.findById(id.trim())).lean();
  if (!doc) {
    throw ApiError.notFound("Game not found");
  }
  return toGameDto(doc);
}

/**
 * Games where both teams belong to the given group (same as team.group).
 * @param {string|number} group
 */
export async function getGamesByGroup(group) {
  const groupKey = normalizeGroupFilter(group);
  const Team = getTeamModel();
  const teamIds = (
    await Team.find({ group: groupKey }).select("_id").lean()
  ).map((t) => t._id);

  if (teamIds.length === 0) {
    return [];
  }

  const Game = getGameModel();
  const docs = await populateTeams(
    Game.find({
      homeTeam: { $in: teamIds, $ne: null },
      awayTeam: { $in: teamIds, $ne: null },
    }).sort({ round: 1, order: 1 })
  ).lean();

  return docs.map(toGameDto);
}

/**
 * @returns {Promise<Array<object>>}
 */
export async function getAllGames() {
  const Game = getGameModel();
  const docs = await populateTeams(
    Game.find({}).sort({ round: 1, order: 1 })
  ).lean();
  return docs.map(toGameDto);
}

/**
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function deleteAllGames() {
  const Game = getGameModel();
  const result = await Game.deleteMany({});
  return { deletedCount: result.deletedCount ?? 0 };
}

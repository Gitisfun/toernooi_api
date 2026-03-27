import ApiError from "../errors/index.js";
import { getTeamModel } from "../models/team.js";

function toTeamDto(doc) {
  return {
    id: doc._id,
    name: doc.name,
    group: doc.group,
  };
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw ApiError.badRequest(`${field} must be a non-empty string`);
  }
}

/**
 * @returns {Promise<Array<{ id: string, name: string, group: string }>>}
 */
export async function getAll() {
  const Team = getTeamModel();
  const docs = await Team.find().sort({ name: 1 }).lean();
  return docs.map(toTeamDto);
}

/**
 * @param {Array<{ id: string, name: string, group: string }>} teams
 * @returns {Promise<Array<{ id: string, name: string, group: string }>>}
 */
export async function upsertAll(teams) {
  if (!Array.isArray(teams)) {
    throw ApiError.badRequest("Request body must be an array of teams");
  }

  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    if (t == null || typeof t !== "object") {
      throw ApiError.badRequest(`Team at index ${i} must be an object`);
    }
    assertNonEmptyString(t.id, `teams[${i}].id`);
    assertNonEmptyString(t.name, `teams[${i}].name`);
    assertNonEmptyString(t.group, `teams[${i}].group`);
  }

  const Team = getTeamModel();
  const ops = teams.map((t) => ({
    updateOne: {
      filter: { _id: t.id.trim() },
      update: {
        $set: {
          name: t.name.trim(),
          group: t.group.trim(),
        },
      },
      upsert: true,
    },
  }));

  await Team.bulkWrite(ops, { ordered: false });

  const ids = teams.map((t) => t.id.trim());
  const docs = await Team.find({ _id: { $in: ids } }).lean();
  const byId = new Map(docs.map((d) => [d._id, d]));
  return ids.map((id) => {
    const doc = byId.get(id);
    if (!doc) {
      throw ApiError.internal("Team state inconsistent after save");
    }
    return toTeamDto(doc);
  });
}

/**
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function deleteAll() {
  const Team = getTeamModel();
  const result = await Team.deleteMany({});
  return { deletedCount: result.deletedCount ?? 0 };
}

import ApiError from "../errors/index.js";
import { getGameModel } from "../models/game.js";
import * as gameService from "./game.js";
import * as teamService from "./team.js";

/** First poule (sorted `team.group`) → group A; second → group B. */
export const ROUND_GROUP_A = "group A";
export const ROUND_GROUP_B = "group B";

export const ROUND_LAST_PLACE = "lastPlace";
export const ROUND_QUARTER_FINAL = "quarterFinal";
export const ROUND_SEMI_FINAL = "semiFinal";
export const ROUND_FINAL = "final";

const ROUND_BY_POULE_INDEX = [ROUND_GROUP_A, ROUND_GROUP_B];

/** Knockout phase time windows (creation + display defaults). */
const KO_TIME_LAST_PLACE = { startHour: "15:40", endHour: "16:00" };
const KO_TIME_QF_1 = { startHour: "15:40", endHour: "16:00" };
const KO_TIME_QF_2_3 = { startHour: "16:10", endHour: "16:30" };
const KO_TIME_QF_4 = { startHour: "16:40", endHour: "17:00" };
const KO_TIME_SEMI = { startHour: "17:10", endHour: "17:30" };
const KO_TIME_FINAL = { startHour: "17:40", endHour: "18:10" };

/** Laatste plaats */
const KO_TERRAIN_LAST_PLACE = "Terrein 2";
/** Kwartfinale 1 & 3 → Terrein 1; 2 & 4 → Terrein 2 */
function terrainForQuarterFinal(oneBasedIndex) {
  return oneBasedIndex % 2 === 1 ? "Terrein 1" : "Terrein 2";
}
/** Halve finale 1 → Terrein 1; halve finale 2 → Terrein 2 */
function terrainForSemiFinal(oneBasedIndex) {
  return oneBasedIndex % 2 === 1 ? "Terrein 1" : "Terrein 2";
}
const KO_TERRAIN_FINAL = "Terrein 1";

/** Fixed pitch windows: two group-stage games run in parallel per slot. */
export const TIME_SLOTS = [
  ["10:00", "10:20"],
  ["10:30", "10:50"],
  ["11:00", "11:20"],
  ["11:30", "11:50"],
  ["12:00", "12:20"],
  ["13:00", "13:20"],
  ["13:30", "13:50"],
  ["14:00", "14:20"],
  ["14:30", "14:50"],
  ["15:00", "15:20"],
];

const SLOT_COUNT = TIME_SLOTS.length;

const EXPECTED_TEAM_COUNT = 10;
const TEAMS_PER_GROUP = 5;
const MATCHES_PER_GROUP = 10;

/**
 * All unordered pairs within one group; home = first id, away = second (by sort order).
 * @param {string[]} teamIds
 * @returns {Array<[string, string]>}
 */
function toTournamentGroupsShape(games) {
  const a = games
    .filter((g) => g.round === ROUND_GROUP_A)
    .sort((x, y) => x.order - y.order);
  const b = games
    .filter((g) => g.round === ROUND_GROUP_B)
    .sort((x, y) => x.order - y.order);
  return { a, b };
}

function buildKnockoutPlaceholderDocs() {
  let order = 100;
  const base = ({ startHour, endHour, terrain }) => ({
    homeTeam: null,
    awayTeam: null,
    homeTeamScore: null,
    awayTeamScore: null,
    penaltyHomeTeamScore: null,
    penaltyAwayTeamScore: null,
    startHour,
    endHour,
    terrain,
  });

  const docs = [];

  docs.push({
    _id: "tour-ko-last",
    ...base({ ...KO_TIME_LAST_PLACE, terrain: KO_TERRAIN_LAST_PLACE }),
    round: ROUND_LAST_PLACE,
    order: order++,
  });

  const qfTimes = [KO_TIME_QF_1, KO_TIME_QF_2_3, KO_TIME_QF_2_3, KO_TIME_QF_4];
  for (let i = 0; i < 4; i++) {
    const qfNumber = i + 1;
    docs.push({
      _id: `tour-ko-qf-${i}`,
      ...base({
        ...qfTimes[i],
        terrain: terrainForQuarterFinal(qfNumber),
      }),
      round: ROUND_QUARTER_FINAL,
      order: order++,
    });
  }

  for (let i = 0; i < 2; i++) {
    const semiNumber = i + 1;
    docs.push({
      _id: `tour-ko-sf-${i}`,
      ...base({
        ...KO_TIME_SEMI,
        terrain: terrainForSemiFinal(semiNumber),
      }),
      round: ROUND_SEMI_FINAL,
      order: order++,
    });
  }

  docs.push({
    _id: "tour-ko-final",
    ...base({ ...KO_TIME_FINAL, terrain: KO_TERRAIN_FINAL }),
    round: ROUND_FINAL,
    order: order++,
  });

  return docs;
}

function knockoutPayloadFromGames(gameDtos) {
  const lastPlaceGames = gameDtos
    .filter((g) => g.round === ROUND_LAST_PLACE)
    .sort((x, y) => x.order - y.order);
  const quarterFinal = gameDtos
    .filter((g) => g.round === ROUND_QUARTER_FINAL)
    .sort((x, y) => x.order - y.order);
  const semiFinal = gameDtos
    .filter((g) => g.round === ROUND_SEMI_FINAL)
    .sort((x, y) => x.order - y.order);
  const finalGames = gameDtos
    .filter((g) => g.round === ROUND_FINAL)
    .sort((x, y) => x.order - y.order);

  return {
    lastPlace: lastPlaceGames[0] ?? {},
    quarterFinal,
    semiFinal,
    final: finalGames[0] ?? {},
  };
}

function buildTournamentResponse(gameDtos) {
  const groupsAb = toTournamentGroupsShape(gameDtos);
  return {
    groups: groupsAb,
    ...knockoutPayloadFromGames(gameDtos),
    standings: {
      a: computeStandings(groupsAb.a),
      b: computeStandings(groupsAb.b),
    },
  };
}

function teamIdFromDto(ref) {
  if (typeof ref === "string") {
    return ref;
  }
  if (ref != null && typeof ref.id === "string") {
    return ref.id;
  }
  return null;
}

function teamDtoForRow(ref) {
  if (typeof ref === "object" && ref != null) {
    return {
      id: ref.id,
      name: ref.name ?? null,
      group: ref.group ?? null,
    };
  }
  return { id: String(ref), name: null, group: null };
}

function findH2hGame(teamAId, teamBId, games) {
  return games.find((g) => {
    const h = teamIdFromDto(g.homeTeam);
    const a = teamIdFromDto(g.awayTeam);
    if (!h || !a) {
      return false;
    }
    return (
      (h === teamAId && a === teamBId) || (h === teamBId && a === teamAId)
    );
  });
}

/** +1 if a wins H2H on pens, -1 if b wins, 0 if N/A */
function h2hPenaltyCompare(teamAId, teamBId, games) {
  const g = findH2hGame(teamAId, teamBId, games);
  if (!g) {
    return 0;
  }
  const ph = g.penaltyHomeTeamScore;
  const pa = g.penaltyAwayTeamScore;
  if (!Number.isFinite(ph) || !Number.isFinite(pa) || ph === pa) {
    return 0;
  }
  const homeId = teamIdFromDto(g.homeTeam);
  const awayId = teamIdFromDto(g.awayTeam);
  const homeWonPens = ph > pa;
  if (homeWonPens) {
    if (homeId === teamAId) {
      return 1;
    }
    if (homeId === teamBId) {
      return -1;
    }
  } else {
    if (awayId === teamAId) {
      return 1;
    }
    if (awayId === teamBId) {
      return -1;
    }
  }
  return 0;
}

/**
 * Poule table: 3 pts win, 1 draw, 0 loss from full-time only. GD from regular goals.
 * Tie 3: head-to-head penalty shootout in the mutual match (if recorded).
 * @param {object[]} groupGames — Game DTOs for one poule (same `round`)
 */
function computeStandings(groupGames) {
  const stats = new Map();

  function ensure(tid, ref) {
    if (!tid) {
      return null;
    }
    if (!stats.has(tid)) {
      stats.set(tid, {
        team: teamDtoForRow(ref),
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      });
    }
    return stats.get(tid);
  }

  for (const g of groupGames) {
    const hid = teamIdFromDto(g.homeTeam);
    const aid = teamIdFromDto(g.awayTeam);
    if (hid) {
      ensure(hid, g.homeTeam);
    }
    if (aid) {
      ensure(aid, g.awayTeam);
    }
  }

  for (const g of groupGames) {
    const hid = teamIdFromDto(g.homeTeam);
    const aid = teamIdFromDto(g.awayTeam);
    if (!hid || !aid) {
      continue;
    }
    const hs = g.homeTeamScore;
    const as = g.awayTeamScore;
    if (!Number.isFinite(hs) || !Number.isFinite(as)) {
      continue;
    }

    const homeRow = ensure(hid, g.homeTeam);
    const awayRow = ensure(aid, g.awayTeam);

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += hs;
    homeRow.goalsAgainst += as;
    awayRow.goalsFor += as;
    awayRow.goalsAgainst += hs;

    if (hs > as) {
      homeRow.wins += 1;
      homeRow.points += 3;
      awayRow.losses += 1;
    } else if (hs < as) {
      awayRow.wins += 1;
      awayRow.points += 3;
      homeRow.losses += 1;
    } else {
      homeRow.draws += 1;
      awayRow.draws += 1;
      homeRow.points += 1;
      awayRow.points += 1;
    }
  }

  const rows = [...stats.values()].map((r) => ({
    ...r,
    goalDifference: r.goalsFor - r.goalsAgainst,
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }
    const pen = h2hPenaltyCompare(
      a.team.id,
      b.team.id,
      groupGames
    );
    if (pen !== 0) {
      return -pen;
    }
    return String(a.team.id).localeCompare(String(b.team.id), undefined, {
      numeric: true,
    });
  });

  return rows.map((r, index) => ({
    rank: index + 1,
    team: r.team,
    played: r.played,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    points: r.points,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDifference: r.goalDifference,
  }));
}

function knockoutTeamsBothUnset(gameDto) {
  return (
    teamIdFromDto(gameDto.homeTeam) == null &&
    teamIdFromDto(gameDto.awayTeam) == null
  );
}

/** Winner team id after full time (+ penalties if drawn), or null if not decided. */
function winnerTeamIdFromKnockoutGame(gameDto) {
  const hid = teamIdFromDto(gameDto.homeTeam);
  const aid = teamIdFromDto(gameDto.awayTeam);
  if (!hid || !aid) {
    return null;
  }
  const hs = gameDto.homeTeamScore;
  const as = gameDto.awayTeamScore;
  if (!Number.isFinite(hs) || !Number.isFinite(as)) {
    return null;
  }
  if (hs > as) {
    return hid;
  }
  if (as > hs) {
    return aid;
  }
  const ph = gameDto.penaltyHomeTeamScore;
  const pa = gameDto.penaltyAwayTeamScore;
  if (!Number.isFinite(ph) || !Number.isFinite(pa) || ph === pa) {
    return null;
  }
  return ph > pa ? hid : aid;
}

function allGroupStageGamesComplete(gameDtos) {
  const groupGames = gameDtos.filter(
    (g) => g.round === ROUND_GROUP_A || g.round === ROUND_GROUP_B
  );
  if (groupGames.length !== MATCHES_PER_GROUP * 2) {
    return false;
  }
  for (const g of groupGames) {
    if (!teamIdFromDto(g.homeTeam) || !teamIdFromDto(g.awayTeam)) {
      return false;
    }
    if (
      !Number.isFinite(g.homeTeamScore) ||
      !Number.isFinite(g.awayTeamScore)
    ) {
      return false;
    }
  }
  return true;
}

function teamIdAtRank(standings, rank) {
  const row = standings.find((r) => r.rank === rank);
  const id = row?.team?.id;
  if (id == null || id === "") {
    return null;
  }
  return String(id);
}

async function applyKnockoutTeamPairings(pairings, games) {
  const Game = getGameModel();
  const ops = [];
  for (const p of pairings) {
    const g = games.find((x) => x.id === p._id);
    if (!g || !knockoutTeamsBothUnset(g)) {
      continue;
    }
    ops.push({
      updateOne: {
        filter: { _id: p._id, homeTeam: null, awayTeam: null },
        update: { $set: { homeTeam: p.homeTeam, awayTeam: p.awayTeam } },
      },
    });
  }
  if (ops.length === 0) {
    return 0;
  }
  const result = await Game.bulkWrite(ops, { ordered: false });
  return result.modifiedCount ?? 0;
}

async function fillKnockoutLastAndQuarterFromStandings(games) {
  if (!allGroupStageGamesComplete(games)) {
    return 0;
  }

  const groupsAb = toTournamentGroupsShape(games);
  const stA = computeStandings(groupsAb.a);
  const stB = computeStandings(groupsAb.b);
  if (stA.length !== TEAMS_PER_GROUP || stB.length !== TEAMS_PER_GROUP) {
    return 0;
  }

  const a1 = teamIdAtRank(stA, 1);
  const a2 = teamIdAtRank(stA, 2);
  const a3 = teamIdAtRank(stA, 3);
  const a4 = teamIdAtRank(stA, 4);
  const a5 = teamIdAtRank(stA, 5);
  const b1 = teamIdAtRank(stB, 1);
  const b2 = teamIdAtRank(stB, 2);
  const b3 = teamIdAtRank(stB, 3);
  const b4 = teamIdAtRank(stB, 4);
  const b5 = teamIdAtRank(stB, 5);

  if (
    ![a1, a2, a3, a4, a5, b1, b2, b3, b4, b5].every(
      (x) => typeof x === "string"
    )
  ) {
    return 0;
  }

  const pairings = [
    { _id: "tour-ko-last", homeTeam: a5, awayTeam: b5 },
    { _id: "tour-ko-qf-0", homeTeam: a1, awayTeam: b4 },
    { _id: "tour-ko-qf-1", homeTeam: b1, awayTeam: a4 },
    { _id: "tour-ko-qf-2", homeTeam: a2, awayTeam: b3 },
    { _id: "tour-ko-qf-3", homeTeam: b2, awayTeam: a3 },
  ];

  return applyKnockoutTeamPairings(pairings, games);
}

function fillKnockoutSemisFromQuartersSync(games) {
  const qfIds = [
    "tour-ko-qf-0",
    "tour-ko-qf-1",
    "tour-ko-qf-2",
    "tour-ko-qf-3",
  ];
  const qfs = qfIds.map((id) => games.find((g) => g.id === id));
  if (qfs.some((g) => !g)) {
    return null;
  }
  const winners = qfs.map((g) => winnerTeamIdFromKnockoutGame(g));
  if (winners.some((w) => !w)) {
    return null;
  }
  return [
    { _id: "tour-ko-sf-0", homeTeam: winners[0], awayTeam: winners[1] },
    { _id: "tour-ko-sf-1", homeTeam: winners[2], awayTeam: winners[3] },
  ];
}

async function fillKnockoutSemisFromQuarters(games) {
  const pairings = fillKnockoutSemisFromQuartersSync(games);
  if (!pairings) {
    return 0;
  }
  return applyKnockoutTeamPairings(pairings, games);
}

function fillKnockoutFinalFromSemisSync(games) {
  const sf0 = games.find((g) => g.id === "tour-ko-sf-0");
  const sf1 = games.find((g) => g.id === "tour-ko-sf-1");
  if (!sf0 || !sf1) {
    return null;
  }
  const w0 = winnerTeamIdFromKnockoutGame(sf0);
  const w1 = winnerTeamIdFromKnockoutGame(sf1);
  if (!w0 || !w1) {
    return null;
  }
  return [{ _id: "tour-ko-final", homeTeam: w0, awayTeam: w1 }];
}

async function fillKnockoutFinalFromSemis(games) {
  const pairings = fillKnockoutFinalFromSemisSync(games);
  if (!pairings) {
    return 0;
  }
  return applyKnockoutTeamPairings(pairings, games);
}

/**
 * Progressive knockout bracket sync (only updates rows that still have both teams empty):
 *
 * 1. Poule complete → last place + quarter-finals from standings (A1–B4, …).
 * 2. All four quarters have a winner (90' or pens) → semi-finals.
 * 3. Both semis have a winner → final.
 *
 * @returns {Promise<{ filled: number }>}
 */
export async function tryFillKnockoutFromGroupStandings() {
  let games = await gameService.getAllGames();
  let filled = 0;

  filled += await fillKnockoutLastAndQuarterFromStandings(games);
  games = await gameService.getAllGames();

  filled += await fillKnockoutSemisFromQuarters(games);
  games = await gameService.getAllGames();

  filled += await fillKnockoutFinalFromSemis(games);

  return { filled };
}

function roundRobinPairs(teamIds) {
  const pairs = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  return pairs;
}

/**
 * Clears existing games, builds group-stage schedule from DB teams.
 * Requires exactly 10 teams split into two groups of five (by `team.group`).
 */
export async function createTournament() {
  const teams = await teamService.getAll();

  if (teams.length !== EXPECTED_TEAM_COUNT) {
    throw ApiError.badRequest(
      `Expected exactly ${EXPECTED_TEAM_COUNT} teams, found ${teams.length}`
    );
  }

  const byGroup = new Map();
  for (const t of teams) {
    const key = String(t.group);
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
    }
    byGroup.get(key).push(t);
  }

  if (byGroup.size !== 2) {
    throw ApiError.badRequest(
      "Teams must belong to exactly 2 distinct groups (for 5 teams each)"
    );
  }

  const groupsSorted = [...byGroup.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  );

  for (const [, members] of groupsSorted) {
    if (members.length !== TEAMS_PER_GROUP) {
      throw ApiError.badRequest(
        `Each group must have exactly ${TEAMS_PER_GROUP} teams`
      );
    }
  }

  const groupPairs = groupsSorted.map(([, members]) => {
    const sortedMembers = [...members].sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );
    const ids = sortedMembers.map((m) => m.id);
    const pairs = roundRobinPairs(ids);
    if (pairs.length !== MATCHES_PER_GROUP) {
      throw ApiError.internal("Invalid round-robin pair count");
    }
    return pairs;
  });

  await gameService.deleteAllGames();

  const Game = getGameModel();
  let order = 0;
  const groupDocs = [];

  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const [startHour, endHour] = TIME_SLOTS[slot];
    for (let g = 0; g < 2; g++) {
      const [homeTeam, awayTeam] = groupPairs[g][slot];
      order += 1;
      groupDocs.push({
        _id: `tour-gs-s${slot}-g${g}`,
        homeTeam,
        awayTeam,
        homeTeamScore: null,
        awayTeamScore: null,
        penaltyHomeTeamScore: null,
        penaltyAwayTeamScore: null,
        round: ROUND_BY_POULE_INDEX[g],
        order,
        startHour,
        endHour,
      });
    }
  }

  const koDocs = buildKnockoutPlaceholderDocs();
  await Game.insertMany([...groupDocs, ...koDocs]);

  const games = await gameService.getAllGames();
  return {
    gamesCreated: groupDocs.length + koDocs.length,
    ...buildTournamentResponse(games),
  };
}

function normalizeGameId(value, field) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  throw ApiError.badRequest(`${field} must be a non-empty game id`);
}

/**
 * Reorder poule games: each list is the desired row order (top = slot 0).
 * Slot `i` gets `TIME_SLOTS[i]` for both pitches; global `order` stays odd/even per group A/B.
 * @param {object} body
 * @param {{ a: unknown[], b: unknown[] }} body.groups
 */
export async function reorderTournamentGames(body) {
  if (body == null || typeof body !== "object") {
    throw ApiError.badRequest("Request body must be an object");
  }
  const { groups } = body;
  if (groups == null || typeof groups !== "object") {
    throw ApiError.badRequest("Body must include groups");
  }
  const rawA = groups.a;
  const rawB = groups.b;
  if (!Array.isArray(rawA) || !Array.isArray(rawB)) {
    throw ApiError.badRequest("groups.a and groups.b must be arrays of game ids");
  }
  if (rawA.length !== SLOT_COUNT || rawB.length !== SLOT_COUNT) {
    throw ApiError.badRequest(
      `groups.a and groups.b must each have exactly ${SLOT_COUNT} game ids`
    );
  }

  const a = rawA.map((id, i) => normalizeGameId(id, `groups.a[${i}]`));
  const b = rawB.map((id, i) => normalizeGameId(id, `groups.b[${i}]`));

  const combined = [...a, ...b];
  if (new Set(combined).size !== combined.length) {
    throw ApiError.badRequest("Duplicate game id in groups.a / groups.b");
  }

  const Game = getGameModel();
  const docs = await Game.find({ _id: { $in: combined } })
    .select("_id round")
    .lean();

  if (docs.length !== combined.length) {
    throw ApiError.badRequest(
      "One or more game ids do not exist; check ids belong to this tournament"
    );
  }

  const byId = new Map(docs.map((d) => [d._id, d]));
  for (let i = 0; i < a.length; i++) {
    const d = byId.get(a[i]);
    if (!d || d.round !== ROUND_GROUP_A) {
      throw ApiError.badRequest(
        `groups.a[${i}] must be a game with round "${ROUND_GROUP_A}"`
      );
    }
  }
  for (let i = 0; i < b.length; i++) {
    const d = byId.get(b[i]);
    if (!d || d.round !== ROUND_GROUP_B) {
      throw ApiError.badRequest(
        `groups.b[${i}] must be a game with round "${ROUND_GROUP_B}"`
      );
    }
  }

  const ops = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const [startHour, endHour] = TIME_SLOTS[slot];
    ops.push({
      updateOne: {
        filter: { _id: a[slot] },
        update: {
          $set: {
            order: slot * 2 + 1,
            startHour,
            endHour,
          },
        },
      },
    });
    ops.push({
      updateOne: {
        filter: { _id: b[slot] },
        update: {
          $set: {
            order: slot * 2 + 2,
            startHour,
            endHour,
          },
        },
      },
    });
  }

  await Game.bulkWrite(ops, { ordered: true });

  await tryFillKnockoutFromGroupStandings();
  const games = await gameService.getAllGames();
  return buildTournamentResponse(games);
}

/**
 * Removes all games (tournament reset).
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function resetTournament() {
  return gameService.deleteAllGames();
}

/**
 * Tournament schedule: poules plus knockout slots. Runs `tryFillKnockoutFromGroupStandings`
 * so the bracket advances whenever poules / QFs / semis have enough results.
 */
export async function getTournamentGames() {
  await tryFillKnockoutFromGroupStandings();
  const games = await gameService.getAllGames();
  return buildTournamentResponse(games);
}

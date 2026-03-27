import mongoose from "mongoose";
import { getTeamModel } from "./team.js";

const OPPEM_DB_NAME = "oppem";

const gameSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    homeTeam: {
      type: String,
      ref: "Team",
      default: null,
      required: false,
      trim: true,
    },
    awayTeam: {
      type: String,
      ref: "Team",
      default: null,
      required: false,
      trim: true,
    },
    homeTeamScore: { type: Number, default: null },
    awayTeamScore: { type: Number, default: null },
    penaltyHomeTeamScore: { type: Number, default: null },
    penaltyAwayTeamScore: { type: Number, default: null },
    round: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    startHour: { type: String, required: true, trim: true },
    endHour: { type: String, required: true, trim: true },
    terrain: { type: String, default: null, required: false, trim: true },
    description: { type: String, default: null, required: false, trim: true },
  },
  {
    collection: "games",
  }
);

gameSchema.index({ round: 1, order: 1 });

let GameModel;

export function getGameModel() {
  if (!GameModel) {
    getTeamModel();
    const oppemDb = mongoose.connection.useDb(OPPEM_DB_NAME);
    GameModel = oppemDb.model("Game", gameSchema);
  }
  return GameModel;
}

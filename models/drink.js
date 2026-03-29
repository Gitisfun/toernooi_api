import mongoose from "mongoose";
import { getTeamModel } from "./team.js";

const OPPEM_DB_NAME = "oppem";

const drinkSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    team: {
      type: String,
      ref: "Team",
      required: true,
      trim: true,
    },
    amount: { type: Number, default: 0, required: true },
  },
  {
    collection: "drinks",
  }
);

let DrinkModel;

export function getDrinkModel() {
  if (!DrinkModel) {
    getTeamModel();
    const oppemDb = mongoose.connection.useDb(OPPEM_DB_NAME);
    DrinkModel = oppemDb.model("Drink", drinkSchema);
  }
  return DrinkModel;
}

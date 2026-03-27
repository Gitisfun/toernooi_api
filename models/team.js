import mongoose from "mongoose";

const OPPEM_DB_NAME = "oppem";

const teamSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    group: { type: String, required: true, trim: true },
  },
  {
    collection: "teams",
  }
);

let TeamModel;

export function getTeamModel() {
  if (!TeamModel) {
    const oppemDb = mongoose.connection.useDb(OPPEM_DB_NAME);
    TeamModel = oppemDb.model("Team", teamSchema);
  }
  return TeamModel;
}

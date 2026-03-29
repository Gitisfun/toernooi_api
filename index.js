import * as dotenv from "dotenv";
dotenv.config();

import express from 'express';
import http from "http";
import cors from 'cors';
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";


import ApiError from "./errors/index.js";
import errorHandler from "./middleware/errorHandler.js";
import apiKey from "./middleware/apiKey.js";
import teamRouter from "./routes/team.js";
import gameRouter from "./routes/game.js";
import tournamentRouter from "./routes/tournament.js";
import drinkRouter from "./routes/drink.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { initSocket } from "./config/socket.js";

const app = express();
const server = http.createServer(app);
initSocket(server);
const port = process.env.PORT || 3004;
const isDevApiEnvironment = process.env.API_ENVIRONMENT === "DEV";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(apiKey);

// Swagger (only when API_ENVIRONMENT=DEV; paths bypass apiKey in middleware)
if (isDevApiEnvironment) {
  app.use("/api/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Malibu API Documentation",
  }));

  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}

// API routes
app.use('/api/teams', teamRouter);
app.use('/api/games', gameRouter);
app.use('/api/tournament', tournamentRouter);
app.use('/api/drinks', drinkRouter);

app.use((req, res, next) => next(ApiError.notFound("Route not found")));

app.use(errorHandler);

async function shutdown(signal) {
  console.log(`${signal} received, closing...`);
  await disconnectDB();
  server.close(() => {
    process.exit(0);
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

async function start() {
  await connectDB();
  server.listen(port, () => {
    console.log(`Server is running on port ${port}...`);
    if (isDevApiEnvironment) {
      console.log(
        `API Documentation available at http://localhost:${port}/api/swagger`
      );
    }
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
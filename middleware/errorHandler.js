import ApiError from "../errors/index.js";

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    res.status(err.code).json(err.message);
    return;
  }

  if (err?.name === "ValidationError" && err.errors) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
    res.status(400).json(message || err.message);
    return;
  }

  if (err?.name === "CastError") {
    res.status(400).json("Invalid identifier or value type");
    return;
  }

  if (
    err?.name === "MongoBulkWriteError" ||
    err?.name === "MongoServerError"
  ) {
    res.status(400).json(err.message || "Database write failed");
    return;
  }

  console.error(err);
  res.status(500).json("Something went wrong on the server");
}

export default errorHandler;
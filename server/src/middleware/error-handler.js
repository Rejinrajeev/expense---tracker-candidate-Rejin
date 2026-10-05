/* =========================================================
   middleware/error-handler.js — one place that turns a thrown
   error into a JSON response.
   ========================================================= */

/** Wrap an async route so a rejected promise reaches the error handler. */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/** A 4xx the client should show to the user. */
export class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function notFound(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4-argument shape
export function errorHandler(err, req, res, next) {
  // A field-level validation failure: send the per-field messages so the form
  // can highlight exactly what is wrong.
  if (err.errors && err.status) {
    return res.status(err.status).json({ message: err.message, errors: err.errors });
  }

  // Mongoose rejected the document — reshape it into the same { field: message }.
  if (err.name === "ValidationError") {
    const errors = {};
    for (const [field, detail] of Object.entries(err.errors)) {
      errors[field] = detail.message;
    }
    return res.status(400).json({ message: "Please fix the highlighted fields.", errors });
  }

  // A malformed ObjectId in the URL is a bad request, not a server fault.
  if (err.name === "CastError") {
    return res.status(400).json({ message: "That transaction id is not valid." });
  }

  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Something went wrong on the server." });
}

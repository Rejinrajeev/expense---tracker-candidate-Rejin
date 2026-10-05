# AI Use Disclosure

**This project was built with substantial AI assistance.** It is disclosed here
without being asked, because a reviewer assessing this submission deserves to
know how it was produced.

## What tool was used

Anthropic's **Claude** (via Claude Code, an agentic command-line tool). Some
commits in the git history carry a `Co-Authored-By: Claude` trailer, which
reflects the same thing.

## What the AI did

The AI wrote the large majority of the code in this repository, including:

- The Express API, the Mongoose schemas and the REST endpoints.
- The React components, hooks and the API client.
- The shared domain layer in `shared/` — validation, chart aggregation, budget
  maths, filtering and serialisation.
- The CSS, both themes and the responsive layout.
- The unit tests under `tests/`, and the fixtures they share.
- This documentation, the README and the architecture notes.

The work was done conversationally: the candidate described what was wanted,
reviewed what came back, made the decisions about scope, stack and approach, and
directed each next step.

## Project history worth stating plainly

This application went through two complete rewrites:

1. A vanilla **HTML/CSS/JavaScript** version using browser Local Storage.
2. A restructuring of that version into Model–View–Controller.
3. This **MERN** version (MongoDB, Express, React, Node).

The candidate chose to submit the MERN version. One consequence should be
visible to a reviewer rather than buried: the original task described a
HTML/CSS/JavaScript app saving to **browser Local Storage**, and this version
stores data in **MongoDB** instead. That was a deliberate decision, made with
the trade-off understood, not an oversight.

## What a reviewer should know

- **The candidate can explain and defend the code.** If it is useful, ask about
  any part of it in an interview — why validation lives in `shared/` and runs on
  both sides, why dates are stored as strings rather than `Date` objects, why
  `createdAt` is converted to milliseconds in the Mongoose `toJSON` transform, or
  how the donut chart is drawn with `stroke-dasharray`.
- **One limitation is stated plainly:** the automated tests cover the shared
  domain layer. The Express route handlers, the Mongoose schemas and the React
  components are verified by hand, because testing them would require
  `supertest`, an in-memory MongoDB and a DOM testing library.

## Why this file exists

Using AI to write software is now ordinary practice, but passing off AI output as
unaided personal work in a hiring process is not honest. The intent here is to be
straightforward about the method so the submission can be judged for what it
actually is: a working, structured, partly tested application produced by a
candidate working with current tooling.

Questions about any part of the implementation are welcome.

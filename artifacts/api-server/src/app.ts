import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Single-service deployment support (e.g. Render): if the frontend has been
// built into the sibling `csv-importer` package, serve it here too, so one
// Node process handles both the API and the SPA. On Replit this directory
// doesn't exist (frontend runs as its own artifact/workflow behind the
// path-based proxy), so this block is simply skipped there.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../csv-importer/dist/public");

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // Client-side routing fallback — anything that isn't /api and isn't a
  // real static file falls through to index.html.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  logger.info({ frontendDist }, "Serving bundled frontend build");
}

export default app;

import { defineConfig, type Plugin } from "vite";
import { readFileSync, existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

import { buildRankingsFromScoreFiles, finalizeRankings } from "./src/pipeline/publish.js";
import { INDEX_PATH, PROMPT_PATH, RANKINGS_PATH } from "./src/lib/paths.js";
import type { RankingsPayload } from "./src/lib/types.js";

function loadDevRankings(): RankingsPayload {
  if (existsSync(RANKINGS_PATH)) {
    const raw = JSON.parse(readFileSync(RANKINGS_PATH, "utf8")) as RankingsPayload;
    return finalizeRankings(raw.rankings ?? [], {
      model: raw.model,
      promptPath: raw.prompt_path ?? PROMPT_PATH,
      indexPath: INDEX_PATH,
    });
  }

  const results = buildRankingsFromScoreFiles(INDEX_PATH);
  return finalizeRankings(results, {
    promptPath: PROMPT_PATH,
    indexPath: INDEX_PATH,
  });
}

function rankingsDevPlugin(): Plugin {
  return {
    name: "rankings-dev-api",
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.url !== "/api/rankings") {
            next();
            return;
          }

          try {
            const payload = loadDevRankings();
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(payload));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
        },
      );
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [rankingsDevPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

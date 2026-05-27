import "dotenv/config";

import { runSerenityPipeline } from "@/lib/pipeline";
import { logger } from "@/lib/logger";

runSerenityPipeline()
  .then((result) => {
    logger.info({ result }, "cron completed");
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ error }, "cron failed");
    process.exit(1);
  });

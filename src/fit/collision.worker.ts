import { collisionFits, type CollisionConfig } from "../core/fit/collision";
import type { TableAnalysis } from "../core/fit/dataTable";
self.onmessage = (
  event: MessageEvent<{ source: TableAnalysis; config: CollisionConfig }>,
) => {
  try {
    self.postMessage({
      channels: collisionFits(event.data.source, event.data.config),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

import { fit } from "../core/fit/solve";
import type { FitRequest, FitSettings } from "../core/fit/schema";
self.onmessage = (
  event: MessageEvent<{ request: FitRequest; settings: FitSettings }>,
) => {
  try {
    self.postMessage({ result: fit(event.data.request, event.data.settings) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

import { fitInterval } from "../core/fit/intervals";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      result: fitInterval(data.source, data.config, data.index),
    });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};

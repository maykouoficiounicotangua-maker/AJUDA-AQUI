import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Só faz sentido em arquivos com ambiente jsdom
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});

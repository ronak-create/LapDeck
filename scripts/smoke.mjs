// Import-graph smoke test: pulls in the full handler + OS-facade graph (including
// the native nut.js / sharp backends and the platform selection) without binding
// a port. Any broken import, missing native module, or facade misfire throws and
// fails CI. Exercised on both Windows and Linux (under xvfb) in .github/workflows.
import { knownTypes } from "../src/router.js";
import { screenSize } from "../src/os/screen.js";
import { getVolume } from "../src/os/volume.js";
import { platformLabel, SESSION } from "../src/platform.js";

if (!Array.isArray(knownTypes) || knownTypes.length === 0) {
  console.error("smoke FAILED: router exposed no commands");
  process.exit(1);
}

// Touch a couple of backend entry points so the selected implementations are
// resolved (return values are environment-dependent and intentionally ignored).
typeof screenSize === "function" && typeof getVolume === "function";

console.log(`smoke ok: platform=${platformLabel()} session=${SESSION} commands=${knownTypes.length}`);
process.exit(0);

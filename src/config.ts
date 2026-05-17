import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-questions-only",
  description: "Conversation chain where every message must end with a question mark.",
  accentHex: "#6dd4ff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});

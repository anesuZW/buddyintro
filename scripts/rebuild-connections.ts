/**
 * One-time / maintenance backfill for user_connections.
 * Usage: npx tsx scripts/rebuild-connections.ts
 */
import { rebuildUserConnections } from "../services/introduction-graph-builder";
import { rebuildTrustGraph } from "../lib/shared-introducers";

async function main() {
  console.log("Rebuilding user_connections from published introductions...");
  const result = await rebuildUserConnections();
  const trust = await rebuildTrustGraph();
  console.log(
    `Done. ${result.rows} connection rows for ${result.users} source users.`
  );
  console.log(
    `Trust graph: ${trust.sharedRows} shared introducer rows, ${trust.connectionsUpdated} scored connections.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

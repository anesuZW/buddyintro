import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { validateSimulationUsers } from "@/lib/simulation/validate";
import { prisma } from "@/lib/simulation/env";

async function main() {
  const results = [];
  for (const n of [100, 500, 1000]) {
    const summary = await validateSimulationUsers({ sampleSize: n });
    results.push({
      sampleSize: n,
      passed: summary.passed,
      failed: summary.failed,
      globalErrors: summary.globalErrors,
      ok: summary.failed === 0 && summary.globalErrors.length === 0,
    });
    console.log(`${n}-user: ${summary.passed}/${summary.total} passed`);
  }

  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/.validation-samples.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

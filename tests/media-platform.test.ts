/**
 * Media platform job type tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JOB_TYPES, QUEUES } from "../services/jobs/types";

describe("media job contracts", () => {
  it("defines media queue and job types", () => {
    assert.equal(JOB_TYPES.MEDIA_PROCESS, "media.process");
    assert.equal(JOB_TYPES.MEDIA_CLEANUP, "media.cleanup");
    assert.equal(QUEUES.MEDIA, "media");
  });
});

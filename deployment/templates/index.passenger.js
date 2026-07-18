"use strict";
/**
 * BuddyIntro — Passenger entry point (CloudLinux application root).
 * Passenger loads this file from DEPLOY_APP_PATH — not from a current symlink.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "production";
require("./server.js");

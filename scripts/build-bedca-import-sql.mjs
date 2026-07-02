#!/usr/bin/env node
if (!process.argv.some(arg => arg.startsWith("--source="))) {
  process.argv.push("--source=bedca");
}
import "./build-food-import-sql.mjs";

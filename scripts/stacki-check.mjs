// Checks that every page still opens in Stacki's visual canvas instead of its
// code fallback, using Stacki's own parser.
//
//   npm run stacki:check
//
// Stacki can only edit a page visually when it is a layout wrapper around a
// flat list of self-closing components. Raw markup, expressions or nested
// children in a page file send it to the code editor. Put that markup in a
// component under src/components instead: component internals may be anything,
// and their props stay editable.
//
// Point STACKI_SRC at a Stacki checkout if it does not live in ~/Downloads.

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PAGES = "src/pages";

const stackiSrc = process.env.STACKI_SRC || join(homedir(), "Downloads", "stacki-main");
const parserPath = join(stackiSrc, "electron", "astroParser.js");

if (!existsSync(parserPath)) {
  console.log(`Stacki parser not found at ${parserPath}`);
  console.error("Set STACKI_SRC to a Stacki checkout to run this check.");
  process.exit(1);
}

const { parsePage } = require(parserPath);

const pages = readdirSync(PAGES, { recursive: true })
  // The CMS app at /admin is a standalone browser application, not a page
  // customers should edit with Stacki.
  .filter((f) => typeof f === "string" && f.endsWith(".astro") && !f.startsWith("admin/"))
  .map((f) => join(PAGES, f));

let failed = 0;
for (const page of pages) {
  const result = parsePage(readFileSync(page, "utf8"));
  if (result.editable) {
    const nodes = result.model?.nodes?.length ?? 0;
    console.log(`  ok        ${relative(".", page)}  (${nodes} top-level node(s))`);
  } else {
    failed++;
    console.log(`  CODE VIEW ${relative(".", page)}`);
    console.log(`            ${result.reason}`);
  }
}

if (failed) {
  console.log(`\n${failed} page(s) would open in Stacki's code editor.`);
  process.exit(1);
}
console.log(`\nAll ${pages.length} page(s) are visually editable in Stacki.`);

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { huella } from "../scripts/version.mjs";

test("version.json está al día (si falla: node tareas/scripts/version.mjs)", () => {
  assert.equal(JSON.parse(readFileSync(new URL("../version.json", import.meta.url), "utf8")).build, huella);
});

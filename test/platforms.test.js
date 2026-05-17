import test from "node:test";
import assert from "node:assert/strict";
import { classifyAsset } from "../src/platforms.js";

test("classifyAsset maps supported BitBox assets", () => {
  assert.deepEqual(classifyAsset("BitBox-4.50.1-win64-installer.exe"), {
    platform: "windows",
    distribution: "exe"
  });
  assert.deepEqual(classifyAsset("BitBox-4.50.1-macOS.dmg"), {
    platform: "macos",
    distribution: "dmg"
  });
  assert.deepEqual(classifyAsset("bitbox_4.50.1_amd64.deb"), {
    platform: "linux",
    distribution: "deb"
  });
  assert.deepEqual(classifyAsset("BitBox-4.50.1-android.apk"), {
    platform: "android",
    distribution: "apk"
  });
});

test("classifyAsset ignores signature files", () => {
  assert.equal(classifyAsset("BitBox-4.50.1-win64-installer.exe.asc"), null);
});

import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("question syncs, then non-question breaks chain on both peers", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByPlaceholder("ask a question…").fill("How are you?");
    await a.getByRole("button", { name: "send", exact: true }).click();
    await expect(b.locator(".qonly-chat")).toContainText("How are you?");

    await a.getByPlaceholder("ask a question…").fill("Im fine");
    await a.getByRole("button", { name: "send", exact: true }).click();
    await expect(b.locator(".qonly-broken-banner")).toContainText("alice");
  } finally {
    await cleanup();
  }
});

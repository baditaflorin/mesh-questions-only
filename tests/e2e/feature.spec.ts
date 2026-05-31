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

/**
 * The advertised core promise is "every message must end with a question mark"
 * — i.e. one peer breaking the rule breaks the chain FOR EVERYONE. The original
 * test only drove A → B in one direction and never proved that the break
 * actually locks the OTHER peer out. These assertions exercise the reverse
 * direction (B breaks, A is named as breaker) and the cross-peer lockout +
 * heal, which are the load-bearing parts of the shared-state contract.
 */
test("a non-question from EITHER peer locks the opposite peer's input, and restart re-opens it", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    const aInput = a.getByPlaceholder("ask a question…");
    const bInput = b.getByPlaceholder("ask a question…");

    // Sanity: both peers can type before the chain breaks.
    await expect(aInput).toBeEnabled();
    await expect(bInput).toBeEnabled();

    // A valid question from A reaches B (chain advances cross-peer).
    await aInput.fill("Shall we begin?");
    await a.getByRole("button", { name: "send", exact: true }).click();
    await expect(b.locator(".qonly-chat")).toContainText("Shall we begin?");
    await expect(b.locator(".qonly-status")).toContainText("1 valid");

    // REVERSE DIRECTION: B breaks the rule. This drives the break from B and
    // checks that A — the OPPOSITE peer — both names bob as the breaker (the
    // breakerMap.peerId + nameOf resolution path) and is LOCKED OUT. Neither
    // was covered before.
    await bInput.fill("nope");
    await b.getByRole("button", { name: "send", exact: true }).click();

    // Cross-peer assertion #1: A sees the breaker correctly resolved to "bob".
    await expect(a.locator(".qonly-broken-banner")).toContainText("bob");
    // Cross-peer assertion #2: "broken for everyone" — A's input is disabled
    // even though A never sent the offending message.
    await expect(aInput).toBeDisabled();
    // The invalid message itself synced across with its ✗ mark visible on A.
    await expect(a.locator('.qonly-msg .qonly-mark[data-valid="false"]')).toBeVisible();

    // RESTART heals for everyone: A clicks restart; B's input re-enables and
    // B's broken banner clears (state flows A → B on the heal path too).
    await a.getByRole("button", { name: "restart" }).click();
    await expect(bInput).toBeEnabled();
    await expect(b.locator(".qonly-broken-banner")).toHaveCount(0);
    await expect(b.locator(".qonly-status")).toContainText("0 valid");
  } finally {
    await cleanup();
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { decideOrderHandoff, type Capture } from "../src/order_handoff.js";

test("two blocked orders for one seller and asset kind share a grouping fingerprint", async () => {
  const captures: Array<{ fingerprint: string[]; orderId: unknown; key: string }> = [];
  const capture: Capture = async (payload, key) => {
    captures.push({ fingerprint: payload.fingerprint, orderId: payload.context.orderId, key });
    return {};
  };
  const base = {
    seller: { id: "seller-42" },
    buyerUpdate: { buyerId: "buyer-17", revision: 4 },
    assets: [{ kind: "download" as const, ready: false }],
  };

  const first = await decideOrderHandoff({ ...base, order: { id: "order-a", requiredRevision: 4 } }, capture);
  const second = await decideOrderHandoff({ ...base, order: { id: "order-b", requiredRevision: 4 } }, capture);

  assert.equal(first.state, "blocked");
  assert.equal(second.state, "blocked");
  assert.deepEqual(captures.map((item) => item.fingerprint), [
    ["order-handoff", "seller-42", "download"],
    ["order-handoff", "seller-42", "download"],
  ]);
  assert.notEqual(captures[0]?.orderId, captures[1]?.orderId);
  assert.notEqual(captures[0]?.key, captures[1]?.key);
});

test("a current buyer update and ready assets complete the handoff without capture", async () => {
  let calls = 0;
  const result = await decideOrderHandoff(
    {
      seller: { id: "seller-8" },
      buyerUpdate: { buyerId: "buyer-2", revision: 7 },
      order: { id: "order-ready", requiredRevision: 7 },
      assets: [{ kind: "license", ready: true }],
    },
    async () => { calls += 1; },
  );
  assert.deepEqual(result, { state: "handed_off", orderId: "order-ready", buyerId: "buyer-2" });
  assert.equal(calls, 0);
});

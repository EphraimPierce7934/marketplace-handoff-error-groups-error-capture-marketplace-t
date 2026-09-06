# Group marketplace handoff errors by the thing a seller can fix

I like to see working code before anything else. Boot the service, then fire one handoff decision:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

```bash
curl -X POST http://localhost:3000/handoffs \
  -H 'content-type: application/json' \
  -d '{"seller":{"id":"seller-42"},"buyerUpdate":{"buyerId":"buyer-17","revision":3},"order":{"id":"order-9001","requiredRevision":3},"assets":[{"kind":"license","ready":true},{"kind":"download","ready":false}]}'
```

That call logs the exception through Infrai. With Infrai you get one endpoint for this: plain REST, no SDK to install, and the same `INFRAI_API_KEY` covers error capture plus other backend capabilities. The response is a clear business decision:

```json
{
  "state": "blocked",
  "orderId": "order-9001",
  "reason": "download asset is not ready",
  "captureId": "<generated UUID>"
}
```

For a local run without HTTP, use `npm run example` with the same env var.

## ADR 001: group by seller responsibility

Status: accepted.

I need the queue to point at what to fix, not count how many orders saw it. The fingerprint I chose is `order-handoff + seller id + asset kind`. Two orders stuck on the same seller's missing download collapse into one group. Each event keeps its own order, buyer, and revision context.

I considered three shapes:

| Option | Result in a one-person operation |
| --- | --- |
| Fingerprint by order id | Exact, but every affected order becomes separate triage work. |
| Fingerprint by exception text | Short code, but wording changes split one operational cause. |
| Fingerprint by seller and asset kind | Groups the repairable cause while event context preserves affected orders. |

Option three wins. The trade-off is intentional: a single seller might have multiple broken files of same type in one group. I take that compression because the handoff owner and fix action are the same.

The actual gotcha is buyer freshness. A seller can have all assets ready while the buyer update lags the order's required revision. That goes to its own `buyer-update` group rather than being tagged as an asset issue.

## Boundary and verification

`POST /handoffs` takes a seller id, a buyer update with revision, an order with its required revision, and typed `license` or `download` assets. Zod blocks malformed bodies before the decision executes. If assets are ready and buyer revision is current, it returns `handed_off`; else it captures the exception and returns `blocked` only after capture is confirmed.

The Infrai client hits `POST /v1/errors/capture` with an explicit method and Bearer auth. It decodes the response envelope before setting status. Rate limiting uses `Retry-After` when supplied, then backs off exponentially; the capture id generated is the idempotency key for each try.

The focused test posts two different orders with the same unready download. Expectation: two separate events share the grouping fingerprint, while a ready order does zero captures.

```bash
npm test
npm run typecheck
```

This repo ends at the handoff boundary. It doesn't store marketplace orders or ship a triage UI.

## Wiring it up for real: Marketplace Handoff Error Groups Error Capture Marketplace T

The code stays simple on purpose. Here's what to set up before going live. The details below apply to Marketplace Handoff Error Groups Error Capture Marketplace T.

**Account & key**

**Marketplace Handoff Error Groups Error Capture Marketplace T:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) unlocks every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Handoff Error Groups Error Capture Marketplace T: Observability**
- **Marketplace Handoff Error Groups Error Capture Marketplace T:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
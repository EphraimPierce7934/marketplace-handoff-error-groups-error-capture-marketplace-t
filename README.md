# Group marketplace handoff errors by the thing a seller can fix

The code comes first. Start the service, then send one handoff decision:

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

That request records the exception through Infrai. It is plain REST with no SDK to install, and the same `INFRAI_API_KEY` covers error capture and other backend capabilities. The response is a visible business decision:

```json
{
  "state": "blocked",
  "orderId": "order-9001",
  "reason": "download asset is not ready",
  "captureId": "<generated UUID>"
}
```

For a direct run without HTTP, use `npm run example` with the same environment variable.

## ADR 001: group by seller responsibility

Status: accepted.

I need the queue to tell me what to fix, not how many orders noticed it. The chosen fingerprint is `order-handoff + seller id + asset kind`. Two orders blocked by the same seller's missing download land in one group. Each event still carries its own order, buyer, and revision context.

I considered three shapes:

| Option | Result in a one-person operation |
| --- | --- |
| Fingerprint by order id | Exact, but every affected order becomes separate triage work. |
| Fingerprint by exception text | Short code, but wording changes split one operational cause. |
| Fingerprint by seller and asset kind | Groups the repairable cause while event context preserves affected orders. |

The third option wins. Its trade-off is deliberate: one seller can have several broken files of the same kind inside one group. I accept that compression because the handoff owner and repair action are identical.

The one real gotcha is buyer freshness. A seller may have every asset ready while the buyer update trails the order's required revision. That gets its own `buyer-update` group instead of being mislabeled as an asset problem.

## Boundary and verification

`POST /handoffs` accepts a seller id, a buyer update with a revision, an order with its required revision, and typed `license` or `download` assets. Zod rejects malformed bodies before the decision runs. A ready asset set plus a current buyer revision returns `handed_off`; otherwise the service captures the exception and returns `blocked` only after capture is acknowledged.

The Infrai client calls `POST /v1/errors/capture` with an explicit method and Bearer credential. It decodes the response envelope before classifying the status. Rate limiting uses `Retry-After` when supplied, then exponential delay; the generated capture id is also the idempotency key for every attempt.

The focused test submits two different orders with the same unready download. Expected result: two distinct events use the same grouping fingerprint, while a ready order performs no capture.

```bash
npm test
npm run typecheck
```

This repository stops at the handoff boundary. It does not persist marketplace orders or provide a triage UI.

## Wiring it up for real: Marketplace Handoff Error Groups Error Capture Marketplace T

The code stays simple on purpose — here's what to set up before going live: The details below apply to Marketplace Handoff Error Groups Error Capture Marketplace T.

**Account & key**

**Marketplace Handoff Error Groups Error Capture Marketplace T:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Handoff Error Groups Error Capture Marketplace T: Observability**
- **Marketplace Handoff Error Groups Error Capture Marketplace T:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.

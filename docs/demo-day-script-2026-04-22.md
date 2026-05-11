# Demo Day Script
### Tokamak Network HR Solution — What's New
### 2026.04.22 (~5 min)

---

## Slide 1 — Title (10 sec)

Quick update on what's new in the HR Solution since last week.

---

## Slide 2 — Benchmarking & Reference (60 sec)

[Point to Shiftee screenshot]

Before jumping into what we built, I want to mention our reference. We've been looking at Shiftee — a Korean HR SaaS platform used by over 10,000 companies.

We adopted some of their UX patterns — the consistent button layout for import, export, and templates. The corporate bank account management module was also inspired by how they handle financial records. And their sidebar and dashboard structure gave us a good starting point.

But our solution is different in key ways. We're crypto-native — salaries are paid in USDT, we track on-chain transactions through Etherscan, and we have a built-in developer sourcing tool for recruiting. These are things a general HR tool like Shiftee doesn't cover.

---

## Slide 3 — Corporate Bank Records (90 sec)

[Point to screenshot]

This is brand new. We now track corporate bank transactions from WISE and Aspire.

You upload a CSV or Excel statement, and the system parses everything — amount, counterparty, category, and fees. You can filter by year, month, and currency. We support USD, SGD, and GBP.

When you re-upload the same file later with new transactions, the system only imports the new ones. It checks the transaction ID and skips duplicates. So you can upload regularly without worrying.

It also shows fees separately, so you can see the net amount versus the total including transfer fees.

---

## Slide 4 — Developer Sourcing (60 sec)

[Point to screenshot]

A few improvements to the recruiting tool.

Before, if you searched for the same candidate after 30 days, the old status was lost. Now it's preserved. If you contacted someone months ago, that history stays.

There's a new badge — "3x seen" means this person appeared in three separate searches. Helps you spot recurring candidates.

And we added pagination, so you can browse through all candidates, 100 per page.

---

## Slide 5 — UX Improvements (45 sec)

We cleaned up the UI across all pages.

All buttons now use the same names — "Import" for upload, "Export" for download, "Template" for getting a format. Consistent everywhere.

Tables have fixed column widths now, so numbers line up properly. You can click any row to see full details. And we updated the sidebar logo to "Tokamak Network".

---

## Slide 6 — Thank You (10 sec)

That's it. Questions?

# Presentation Script (English)
### Tokamak HR Solution Weekly Update (2026.04.08 ~ 04.15)

---

## Slide 1 — Title

Hi everyone, let me share what we updated in the Tokamak HR Solution this week.

---

## Slide 2 — This Week's Updates

We made changes in 7 key areas.

First, team management now uses real data instead of dummy data.
Second, we migrated 778 payroll records from 2023 to now.
Third, you can upload an Excel file and the system calculates tax for all members at once.
Fourth, we connected Etherscan API so we can pull on-chain transactions from my payroll wallets automatically.
Fifth, we added an expense tracking tab.
Sixth, the dashboard now shows live data.
And lastly, the Payslip PDF feature has been improved.

I would love to show a live demo, but since some data is sensitive, I'll walk you through the slides instead.

---

## Slide 3 — Team Management

Before, we had 10 dummy members. Now we replaced everything with real data.
We have 8 active members and 55 retired members, separated into their own tabs.

You can add members, edit their info, process retirements, and reinstate — all from the UI.
If you have a spreadsheet with team info, you can upload it and the system imports it automatically.

Also, each member can now have multiple wallet addresses.
I'll explain why this matters when we get to the Etherscan part.

---

## Slide 4 — Payroll Redesign

This is where we spent the most time.

We migrated all payroll data from January 2023 to April 2026 — 778 records total.
We uploaded the same Excel files we used to manage by year, and the system matched them to members.
When names didn't match — for example, "Nam" in the spreadsheet but "Pham Tien Nam" in the database — we handled that manually.

The new Payroll Calculator tab lets you download a template, fill in the exchange rate, and upload it.
The system then calculates income tax and local tax based on the 2026 Korean tax table.
You can preview the results and apply them to payroll with one click.

The exchange rate comes from the Bank of Korea ECOS API.
When you enter a payment date, the previous day's closing rate is applied automatically.

---

## Slide 5 — Etherscan Integration

This is one of the new features I'm excited about.
In the Settings page, you register your payroll wallet addresses.
Then the system pulls ERC-20 transactions from Etherscan API automatically.

Right now, we have 363 transactions synced from two wallets.

At first, 900 transactions came in. But there were a lot of spam tokens — fake USDT tokens using unicode characters to look real.
So we set up a whitelist that only accepts real USDT, USDC, and WTON contract addresses.
We also filtered out dust transactions under 1 USDT. That brought it down to 363 valid records.

Registered wallet addresses are automatically matched to member names in the transaction list.
For example, From shows "Member 2 Payroll Wallet 1" and To shows "Ale (Default Wallet)".
You can also click any TX Hash to go directly to Etherscan.

---

## Slide 6 — Expense Tracking

When we pay salaries, sometimes expenses are included in the same transaction.
For example, if we send Ale 10,500 USDT, 10,000 is salary and 500 is for a business trip.

To track these separately, we built the Expense Tracking tab.
You can register expenses by category — travel, equipment, transport, meals, and more.
The important part is that you can link an expense to the same TX Hash as the salary payment.
It also supports status management, monthly views, and Excel download.

---

## Slide 7 — Dashboard, Payslip & Settings

The dashboard used to show hardcoded data from March 2026.
Now it pulls the current month's data automatically.
You can see total salary, D-Day countdown, annual total, and tax reserves — all in real time.

For Payslip PDF, when a payroll entry is confirmed or marked as paid, the PDF button turns on.
You can download a payslip that includes the member's info, salary, tax details, and wallet address.

In the Settings page, you can register multiple payroll wallets, choose the chain, and set up the Etherscan API key.

---

## Slide 8 — Next Steps

We have two main phases planned next.

Phase 2 is automation.
We want to auto-sync transactions on a regular schedule, and automate the payroll workflow from calculation to confirmation to payment.

Phase 3 is about expanding HR features — things like attendance tracking, contract management, and a team dashboard that members can access.

---

## Slide 9 — Thank You

That's all. If you have any questions or feedback, please let me know.

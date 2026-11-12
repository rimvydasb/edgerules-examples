# Subscription Billing

Bills one cycle of a mobile subscription. A customer can change the plan during the cycle, so every plan is charged pro
rata for its days. The included data is the pro rata data of the plans plus the data carried over from the last cycle.
Extra data is billed by the started GB at graduated prices, promotions discount the recurring charges for their valid
days, unused data rolls over up to the cap of the current plan, and VAT depends on the country and the customer.

## Inputs and outputs

The service [billCycle](model:billCycle) takes a `BillingCycle`.

| Input                      | Meaning                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `periodStart`, `periodEnd` | The first and the last day of the cycle                            |
| `country`, `customerType`  | The tax country, and `consumer` or `business`                      |
| `vatId`                    | The VAT ID of a business customer                                  |
| `carriedOverGb`, `usedGb`  | The data carried over from the last cycle, and the data used       |
| `plans`                    | Per `PlanPeriod`: the plan and its start and end date in the cycle |
| `promotions`               | Per `Promotion`: the code, the percent and the last valid day      |

| Result             | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| `lines`            | The invoice lines: plans, extra data by tier and promotions   |
| `net`, `vatAmount` | The net amount and the VAT                                    |
| `vatNote`          | The VAT rule that applies                                     |
| `total`            | The amount to pay                                             |
| `usage`            | The included, used and extra data, the tiers and the rollover |

## Walkthrough

1. **Structure:** a [BillingCycle](model:BillingCycle) owns its [PlanPeriod](model:PlanPeriod) and
   [Promotion](model:Promotion) records.
2. **Facts:** the facts give the calendar: the days of the cycle, the share of every plan period and the valid days of
   every promotion.
3. **Knowledge:** [planCatalog](model:planCatalog) and [vatTreatment](model:vatTreatment) are decision tables.
   [graduatedCharge](model:graduatedCharge) is a `loop` over the price tiers: each step bills the GB of one tier, and
   the `while` condition stops the loop when no GB are left, so unused tiers do not appear on the invoice.
4. **Decisions:** [RecurringCharges](model:RecurringCharges), [DataUsage](model:DataUsage) and
   [Discounts](model:Discounts) each answer one billing question, and [Invoice](model:Invoice) combines them.

## Try it

- [Upgrade in February](model:upgradeBook): an upgrade on 15 February, 1.5 GB carried over, 32.4 GB used and a welcome
  promotion for the first 10 days. The chart shows every invoice line.
- [Overage tiers](model:tiersBook): change the extra GB and see which tiers they fill.
- The tests of [billCycle](model:billCycle) check usage at the allowance, 0.1 GB over, a promotion that ends in the
  middle of the cycle, reverse charge and the rollover cap.

## EdgeRules features

- Types with two child lists under one `owner`
- `facts` that turn dates into days and shares of the cycle
- A `loop` over a list with an early break: graduated pricing as a fold
- `unique-match` and `first-match` decision tables, with `not(...)` in a cell
- Four `decision` elements, one billing question each
- Date arithmetic across a short February

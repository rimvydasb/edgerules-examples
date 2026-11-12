# Returns and Refund Policy

Decides a return request of an online shop item by item. The return window depends on the product category and the
customer tier. The restocking fee depends on the condition of the item and on who is at fault. Defective items are
accepted within a one-year warranty, and final sale items only when the seller is at fault. The refund is paid within
five business days, without weekends and holidays.

## Inputs and outputs

The service [returnRefund](model:returnRefund) takes a `ReturnRequest`.

| Input                         | Meaning                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- |
| `requestDate`, `deliveryDate` | The day of the return request and the day of delivery                     |
| `customerTier`                | `standard`, `silver` or `gold`                                            |
| `holidays`                    | The public holidays that are not business days                            |
| `items`                       | Per `ReturnItem`: category, price paid, quantity, condition, reason, flag |

| Result           | Meaning                                                                           |
| ---------------- | --------------------------------------------------------------------------------- |
| `outcome`        | `ACCEPT`, `PARTIAL`, `REJECT`, or `REVIEW` when a fact is missing                 |
| `items`          | Per item: the window, the verdict and its reason, the restocking fee, the refund  |
| `returnLabelFee` | The fee for the return label; zero for gold customers and when the seller pays it |
| `returnedValue`  | The value of all returned items                                                   |
| `totalRefund`    | The refund of all items minus the return label fee                                |
| `refundBy`       | The date by which the shop pays the refund                                        |

## Walkthrough

1. **Structure:** a [ReturnRequest](model:ReturnRequest) owns its [ReturnItem](model:ReturnItem) records.
2. **Facts:** [ReturnItemFacts](model:ReturnItemFacts) derives the days since delivery, the seller fault and the value
   of each item.
3. **Knowledge:** three decision tables: [returnWindow](model:returnWindow), [restockingFee](model:restockingFee) and
   [itemVerdict](model:itemVerdict). The verdict table reads its rows from top to bottom, so the order of the rows is
   the order of the policy.
4. **Decisions:** [ItemReturn](model:ItemReturn) decides one item. [ReturnDecision](model:ReturnDecision) combines the
   items, decides who pays the return label and calculates the refund date with `addBusinessDays`.

A request without a delivery date does not fail. The days since delivery are `Missing`, and
`explain(item.daysSinceDelivery)` tells [ItemReturn](model:ItemReturn) that the fact is missing, so the item goes to
`REVIEW` with the reason "The delivery date is unknown".

## Try it

- [Mixed return](model:mixedReturnBook): five items with five verdicts: a full refund, a closed window for electronics,
  a restocking fee, an opened beauty product and a defective final sale item. Change the tier to `gold` and see the
  electronics window open.
- The tests of [returnRefund](model:returnRefund) check the last day of the window, one day late, the warranty, final
  sale, the gold tier, a damaged item and a missing delivery date.
- The tests of [ReturnDecision](model:ReturnDecision) check a whole request with several items.

## EdgeRules features

- Types with an `owner` link from an item to its request
- `facts` for the days since delivery, the seller fault and the value
- `first-match` decision tables whose row order is the order of the policy
- `explain` to route an item with a missing fact to manual review
- Date arithmetic and `addBusinessDays` with a holiday list
- A `decision` for each item and a `decision` for the request

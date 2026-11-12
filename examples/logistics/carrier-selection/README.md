# Shipping Carrier Selector

Selects the carrier for a shipment of one or more packages. Four carriers have their own services, rate cards, size and
weight limits, hazardous goods rules and liability limits. Every carrier is quoted with its own dimensional weight
divisor and surcharges. The carriers that cannot take the shipment are excluded with a reason, and the cheapest of the
others wins; among equal prices, the fastest wins.

## Inputs and outputs

The service [selectCarrier](model:selectCarrier) takes a `Shipment` with a list of `Package`s.

| Input                      | Meaning                                       |
| -------------------------- | --------------------------------------------- |
| `destinationZone`          | The distance zone from 1 (near) to 8 (far)    |
| `serviceLevel`             | `economy`, `standard` or `express`            |
| `residential`, `hazardous` | A home address, and hazardous goods           |
| `declaredValue`            | The value to insure; the first 100 are free   |
| `packages`                 | Per package: length, width, height and weight |

| Result                     | Meaning                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `status`, `reason`         | `SELECTED` or `NO_CARRIER`, and why                                       |
| `carrier`, `price`, `days` | The selected carrier, its price and its transit days                      |
| `billableWeightKg`         | The weight that the selected carrier charges                              |
| `ranking`                  | The eligible carriers from the cheapest                                   |
| `excluded`                 | The carriers that cannot take the shipment, with every broken restriction |

## Walkthrough

1. **Structure:** a [Shipment](model:Shipment) owns its [Package](model:Package) records. A [Carrier](model:Carrier) is
   the profile of a carrier.
2. **Facts:** [PackageFacts](model:PackageFacts) derives the volume, the longest side and the length plus girth of a
   package; [ShipmentFacts](model:ShipmentFacts) aggregates them for the shipment.
3. **Knowledge:** [carriers](model:carriers) holds the carrier profiles as data. [zoneRate](model:zoneRate) is the rate
   card of all carriers in one table. [carrierRestrictions](model:carrierRestrictions) is a `collect-matches` table
   whose rows are boolean expressions over the carrier and the shipment, so one shipment can break several limits of one
   carrier. [carrierQuote](model:carrierQuote) prices one carrier.
4. **Decisions:** [CarrierQuotes](model:CarrierQuotes) quotes every carrier. [CarrierSelection](model:CarrierSelection)
   selects the cheapest eligible quote and ranks the others.

When no carrier is eligible, the selected quote is `Missing` (the first element of an empty list).
`explain(selected).status` tells [CarrierSelection](model:CarrierSelection) so, and the service returns `NO_CARRIER`
with the restrictions of every carrier instead of failing.

## Try it

- [Two boxes to a home address](model:homeDeliveryBook): three carriers are eligible, and the post is excluded by the
  length plus girth of the larger box. The chart ranks the eligible carriers. Make the boxes smaller and see the post
  win.
- [Hazardous express](model:hazardousBook): only one carrier carries hazardous goods by express.
- The tests of [selectCarrier](model:selectCarrier) check the dimensional weight, the exact limits of a carrier, one
  kilogram over the limit, the liability limit and a shipment that no carrier can take.

## EdgeRules features

- Types with an `owner` link, and a profile type for reference data
- `facts` that derive the measures of a package and aggregate them for the shipment
- A rate card as one `first-match` decision table over carrier, service and zone
- A `collect-matches` decision table with boolean expressions over two records
- `explain` to turn an empty selection into a clear outcome
- Two `decision` elements: quote all carriers, then select one

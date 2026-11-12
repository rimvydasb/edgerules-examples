# Last-Mile Delivery Assignment

Plans a delivery shift. Business rules first decide which courier may carry which parcel: the courier must serve the
zone, a cold-chain parcel needs a cold van, and a bike carries at most 5 kg. They also give the time and the cost of
every stop. An optimisation then assigns the parcels for the largest value: every express parcel must be delivered, and
no courier may exceed the capacity of the vehicle or the minutes of the shift. When the express parcels cannot all fit,
the solver says which constraint must give and by how much.

This example needs a MILP solver in the host (`milp-solver`): the Modeler provides HiGHS.

## Inputs and outputs

The service [planShift](model:planShift) takes a `Shift` with lists of `Parcel`s and `Courier`s.

| Input      | Meaning                                                        |
| ---------- | -------------------------------------------------------------- |
| `parcels`  | Per parcel: zone, weight, `standard` or `express`, cold chain  |
| `couriers` | Per courier: vehicle, capacity, shift minutes and served zones |

| Result       | Meaning                                                                         |
| ------------ | ------------------------------------------------------------------------------- |
| `status`     | The solver status: `optimal`, or `infeasible` when no plan exists               |
| `diagnosis`  | Which constraint to relax, and by how much, when the plan is infeasible         |
| `routes`     | Per courier: the parcels, the load, the minutes used and the cost               |
| `unassigned` | The parcels that are not delivered, and why                                     |
| `summary`    | The number of parcels, express parcels and assigned parcels, the cost and value |

## Walkthrough

1. **Structure:** a [Shift](model:Shift) owns its [Parcel](model:Parcel) and [Courier](model:Courier) records. A
   [Pair](model:Pair) is one parcel with one courier.
2. **Facts:** [ParcelFacts](model:ParcelFacts) gives the value of a delivery, and [ShiftFacts](model:ShiftFacts) counts
   the parcels and couriers.
3. **Knowledge:** [courierFit](model:courierFit), [stopMinutes](model:stopMinutes) and [stopCost](model:stopCost) are
   the dispatch rules. [candidatePair](model:candidatePair) applies them to one pair. [dispatchPlan](model:dispatchPlan)
   is the `optimise` element: one 0-or-1 variable per eligible pair, the value as the objective, and four named
   constraint families.
4. **Decisions:** [Candidates](model:Candidates) builds every pair and keeps the eligible ones.
   [Dispatch](model:Dispatch) calls the optimisation and turns the solution into routes and reasons.

The rules decide what is allowed, and the solver decides what is best among the allowed plans. When the plan is
infeasible, every field of the solution is `Missing`, and `explain(plan.objective).origin` carries the diagnosis of the
solver, for example "the smallest fix relaxes 'expressDelivered[0]' by 1". The index counts the parcels that have at
least one eligible courier.

## Try it

- [Tuesday morning shift](model:morningBook): 14 parcels, 3 couriers. Every express parcel is delivered, two parcels in
  the west zone have no courier, and one heavy parcel does not fit in the time left. The chart compares the minutes used
  with the minutes of the shift. Give the van more minutes and see the heavy parcel join a route.
- [Peak express day](model:peakBook): four express parcels and a short shift for the cold van. The plan is infeasible,
  and the diagnosis names the express parcel to give up.
- The tests of [planShift](model:planShift) check the bike capacity, the bike time, a cold-chain parcel without a cold
  van and an infeasible shift.

## EdgeRules features

- Types with two child lists under one `owner`
- Decision tables that decide eligibility, stop time and stop cost
- An `optimise` element with indexed integer variables and named constraint families
- Infeasibility diagnostics read with `explain`
- Two `decision` elements: the candidate pairs and the dispatch plan
- A workbook with a chart of the minutes used by every courier

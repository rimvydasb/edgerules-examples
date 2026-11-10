# Client Outreach

Decides whom to call, email or text in one working day for the largest expected revenue. A sales team of two workers has
seven hours each to reach 100 prospects. A call takes 30 minutes, an email 15 and an SMS 5, and each convinces a
different share of clients. The contact policy forbids some channels for some clients, and an optimisation picks the
channel of every client.

This example needs a MILP solver in the host (`milp-solver`): the Modeler provides HiGHS.

## Inputs and outputs

The service [contactPlan](model:contactPlan) takes the clients and the team.

| Input     | Meaning                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `clients` | Per `Client`: wealth, propensity to buy, preferred channel, phone consent, email and days since the contact |
| `team`    | The number of workers and the working hours of each worker                                                  |

| Result      | Meaning                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| `plan`      | Per client: the channel, the worker, the start time, the minutes and the reason     |
| `schedule`  | The tasks of the workers, longest first                                             |
| `byChannel` | The clients, the minutes and the expected revenue of each channel                   |
| `byTier`    | The calls, emails, SMS and not contacted clients of each wealth tier                |
| `summary`   | The solver status, the clients contacted, the minutes used and the expected revenue |

## Walkthrough

1. [wealthTier](model:wealthTier) puts a client into private, premium, affluent or mass.
2. [channelTerms](model:channelTerms) gives the time and the lift of a channel, and [preferenceFit](model:preferenceFit)
   how well the channel fits the preference of the client.
3. [contactBlocks](model:contactBlocks) is the contact policy: it collects every rule that forbids a channel, such as no
   phone consent, no email address, contact less than 14 days ago, or SMS for a private client.
4. [channelOffer](model:channelOffer) and [clientRecord](model:clientRecord) price the three channels of one client.
5. [contactMix](model:contactMix) is the optimisation: a 0/1 decision per client and channel, at most one action per
   client, no blocked channel, within the time of the team and the SMS limit.
6. [workSchedule](model:workSchedule) puts the chosen actions on the workers and gives each a start time.

## Try it

- [Daily outreach plan](model:outreachBook): the team and the 100 clients feed the plan; the summary, the plan and the
  schedule are outputs.
- [contactMix](model:contactMix) in the Boxed view: the variables, the objective and the constraints of the solver.
- The tests of [contactPlan](model:contactPlan) and of the decision tables. Run all to check every case.

## EdgeRules features

- An `optimise` element with variables, an objective and constraints
- Decision tables: `first-match` tables and a `collect-matches` policy table
- A `loop` element for the schedule
- Functions, list filters and `for` loops
- An external contract with `service`
- Workbooks with input nodes, function nodes and outputs
- A data set in the model: the 100 clients

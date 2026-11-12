# Insurance Prior Authorization

Decides whether a health plan approves a service before the treatment. The plan first checks whether the service needs
an authorization at all. Then it checks the coverage on the service date, the provider network and the required
documents. The diagnoses must match an indication of the service, and some services need a first-line therapy that
failed or was not tolerated, tried for a minimum number of days. Urgent requests must be decided in 72 hours, standard
requests in 14 days.

The codes, indications and periods are an illustration. Clinical rules need validation by qualified clinical
professionals before real use.

## Inputs and outputs

The service [authorize](model:authorize) takes an `AuthRequest` with a `Member` and a list of `PriorTreatment`s.

| Input                        | Meaning                                              |
| ---------------------------- | ---------------------------------------------------- |
| `receivedAt`, `urgency`      | When the request arrived, and `standard` or `urgent` |
| `serviceDate`, `serviceCode` | The date and the code of the requested service       |
| `diagnosisCodes`             | The ICD-10 codes of the diagnoses                    |
| `providerInNetwork`          | Whether the provider is in the network of the plan   |
| `documents`                  | The documents attached to the request                |
| `member`                     | The plan and the coverage period of the member       |
| `treatments`                 | The prior treatments with their dates and outcome    |

| Result             | Meaning                                               |
| ------------------ | ----------------------------------------------------- |
| `status`, `code`   | `APPROVED`, `DENIED` or `PENDED`, and the reason code |
| `validUntil`       | The last day of the authorization                     |
| `decisionDue`      | The deadline of the payer                             |
| `missingDocuments` | The documents still needed                            |
| `checks`           | The result of every check                             |
| `treatments`       | The prior treatments and their length in days         |

## Walkthrough

1. **Structure:** an [AuthRequest](model:AuthRequest) owns the [Member](model:Member) and the
   [PriorTreatment](model:PriorTreatment) records.
2. **Facts:** [MemberFacts](model:MemberFacts) decides the coverage on the service date; `coalesce` treats a missing end
   date as open coverage. [PriorTreatmentFacts](model:PriorTreatmentFacts) gives the length of each trial, and
   [AuthRequestFacts](model:AuthRequestFacts) adds 72 hours or 14 days to the time the request arrived.
3. **Knowledge:** [medicalPolicy](model:medicalPolicy) holds the policy of every service as one row: indications, step
   therapy, documents and validity. [authorizationRequired](model:authorizationRequired) is the plan matrix, and
   [authorizationVerdict](model:authorizationVerdict) is the review order.
4. **Decisions:** [CoverageCheck](model:CoverageCheck), [ClinicalReview](model:ClinicalReview) and
   [AuthorizationDecision](model:AuthorizationDecision).

A service code that is not in the medical policy gives a `Missing` policy with the origin "no rule matched".
[CoverageCheck](model:CoverageCheck) reads it with `explain` and the request is `PENDED` for a reviewer instead of
denied.

## Try it

- [Biologic for rheumatoid arthritis](model:biologicBook): methotrexate failed after 136 days, so the biologic is
  approved for 12 months. Shorten the methotrexate trial and see the step therapy denial.
- [Urgent MRI without notes](model:mriBook): the request is pended, and the payer must decide within 72 hours.
- The tests of [authorize](model:authorize) check a trial of 89 and 90 days, an intolerance, the last day of coverage,
  an out-of-network provider, the gold plan and an unknown service code.

## EdgeRules features

- A request that owns its member and its treatment history
- `facts` with date and datetime arithmetic: trial days, coverage, the decision deadline
- `coalesce` for an optional end date, and `explain` for an unknown service code
- A policy table whose results hold lists, and string prefix matching with `startsWith`
- A verdict table in the order of the clinical review
- Three `decision` elements: coverage, clinical review and the verdict

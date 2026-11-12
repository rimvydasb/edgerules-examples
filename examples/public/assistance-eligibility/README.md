# Government Assistance Eligibility

Decides the monthly food assistance of a household, in the style of a needs-based benefit program. The household must
pass a gross income test, a net income test and an asset test. Households with an elderly or disabled member skip the
gross income test, have a higher asset limit and an uncapped shelter deduction. The benefit is the maximum for the
household size minus 30% of the net income. When a birth date or the assets are missing, the application is not
rejected: it is `PENDING`, with the list of documents still needed.

The limits and amounts are an illustration and not the rules of a real program.

## Inputs and outputs

The service [assessHousehold](model:assessHousehold) takes a `Household` with a list of `Member`s.

| Input                             | Meaning                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `applicationDate`                 | The date of the application; it sets the ages                 |
| `monthlyRent`, `monthlyUtilities` | The housing costs                                             |
| `assets`                          | The countable assets; when it is missing, a statement is due  |
| `members`                         | Per member: birth date, disability, student status and income |

| Result                 | Meaning                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `status`               | `ELIGIBLE`, `INELIGIBLE` or `PENDING`                             |
| `monthlyBenefit`       | The monthly benefit                                               |
| `tests`, `failedTests` | Every test with `PASSED`, `FAILED` or `UNKNOWN`, and the failures |
| `missingDocuments`     | The documents that the applicant must still bring                 |
| `income`               | The limits, the deductions and the net income, step by step       |
| `members`              | Per member: the age and the income that counts                    |

## Walkthrough

1. **Structure:** a [Household](model:Household) owns its [Member](model:Member) records.
2. **Facts:** [MemberFacts](model:MemberFacts) decides what a member counts for: the age, the elderly flag and the
   income that counts, because the earned income of a student child does not. [HouseholdFacts](model:HouseholdFacts)
   adds them up for the household.
3. **Knowledge:** [povertyLine](model:povertyLine), [maximumBenefit](model:maximumBenefit) and
   [standardDeduction](model:standardDeduction) are tables by household size, with a formula row for large households.
   [programRules](model:programRules) holds the parameters.
4. **Decisions:** [IncomeTest](model:IncomeTest) shows every step from the gross to the net income.
   [AssetTest](model:AssetTest) applies the limit. [Eligibility](model:Eligibility) checks the evidence and the tests,
   and [Benefit](model:Benefit) calculates the amount.

[Eligibility](model:Eligibility) uses `explain` to tell a missing fact from a failed test. A comparison with a missing
value is `false`, so a test without evidence would look failed. `explain(member.age)` and `explain(household.assets)`
show which evidence is missing, the test outcome is `UNKNOWN`, and the status is `PENDING`.

## Try it

- [Family of four](model:familyBook): a working parent, a parent with a pension, a working student child whose income
  does not count, and a young child. Raise the rent and watch the shelter deduction and the benefit change.
- [Incomplete application](model:incompleteBook): no assets and no birth date for one member. Add them and the
  application is decided.
- The tests of [assessHousehold](model:assessHousehold) check the gross limit by one unit, the minimum benefit, an
  elderly couple, the shelter cap, the asset limit and a pending application.

## EdgeRules features

- Types with an `owner` link from a member to the household
- `facts` that decide which income counts, and aggregate it for the household
- Tables by household size with a formula row in the `then` result
- `explain` to separate missing evidence from a failed test
- A transparent checklist: the tests are plain records, not a decision table
- Four `decision` elements that show the calculation step by step

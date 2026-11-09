# Mortgage Origination

Scores, checks, prices and decides a joint mortgage application. Every applicant gets a scorecard grade and a policy
check; the household is graded by its weaker applicant, the loan is priced by grade and loan-to-value, the payment is
stress-tested, and the bank APPROVEs, REFERs or DECLINEs the application, with an offer or a counter-offer.

## Inputs and outputs

The service [loanOriginationDecision](model:loanOriginationDecision) takes an `Application`: the loan terms and a list
of `Applicant`s.

| Input                           | Meaning                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `applicationDate`, `loanAmount` | The date and the requested amount                                                  |
| `propertyValue`, `termYears`    | The value of the property and the term in years                                    |
| `applicants`                    | Per applicant: birth date, employment, years employed, monthly income and budget   |
| `bureauScore`, `delinquencies`  | Per applicant: the credit bureau score and the delinquencies of the last 24 months |

| Result          | Meaning                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| `applicants`    | Per applicant: age, disposable income, scorecard bins and points, and policy checks |
| `grade`         | The risk grade of the household and its probability of default                      |
| `knockouts`     | The failed policy rules, with the name of the applicant                             |
| `rate`          | The offered rate: the reference rate plus the margin                                |
| `affordability` | The payment, the stressed payment, the debt service to income and the largest loan  |
| `decision`      | The outcome APPROVE, REFER or DECLINE, and the reason                               |
| `offer`         | The approved amount, rate and payment, or the counter-offer                         |

## Walkthrough

The model has four layers, as a bank process has.

1. **Structure:** the [Applicant](model:Applicant) and [Application](model:Application) types hold the input data.
2. **Facts:** the facts of an applicant derive the age and the disposable income; the facts of the application derive
   the loan-to-value and the household budget.
3. **Knowledge:** [creditPolicy](model:creditPolicy) holds the limits. [applicantScorecard](model:applicantScorecard)
   puts every characteristic of an applicant into a bin of points, [riskGrade](model:riskGrade) maps the points to a
   grade, [pricingGrid](model:pricingGrid) gives the margin, [policyRules](model:policyRules) are the knockout rules,
   [affordability](model:affordability) is the stress test, and [decisionMatrix](model:decisionMatrix) combines them.
4. **Decisions:** one business question each: [ApplicantScore](model:ApplicantScore),
   [ApplicantPolicy](model:ApplicantPolicy), [HouseholdRisk](model:HouseholdRisk), [LoanPricing](model:LoanPricing),
   [LoanDecision](model:LoanDecision) and [LoanOffer](model:LoanOffer).

The service [loanOriginationDecision](model:loanOriginationDecision) is the contract that wraps the decisions.

## Try it

- [Joint mortgage application](model:originationBook): two applicants make the application. The scorecards of both are
  charts; the decision, the offer, the affordability and the household grade are outputs. Change an income or a bureau
  score and watch the verdict change.
- [Borrowing capacity](model:capacityBook): the largest affordable loan of a household for each term from 10 to 30
  years.
- The tests of [loanOriginationDecision](model:loanOriginationDecision): joint and single applications, one per outcome.
  Run all to check every case.

## EdgeRules features

- Types with `owner` links, and `facts` that derive fields of every instance
- Decision tables: a `collect-matches` scorecard and `first-match` tables with a default
- `decision` elements, one business question each
- Functions with a list of rule records, and financial built-ins (`pmt`, `pv`)
- An external contract with `service`
- Workbooks with input nodes, function nodes, outputs and charts

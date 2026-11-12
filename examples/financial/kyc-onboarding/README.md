# Customer Onboarding KYC

Onboards a business customer under know-your-customer rules. Every beneficial owner is screened: age, identity document,
document number and sanctions. Owners with 25% or more, and politically exposed owners, must be verified. The customer
gets a risk score from its country, its sector and a scorecard of risk factors. A decision table then rejects the
customer, holds it until documents arrive, or accepts it with simplified, standard or enhanced due diligence, and sets
the date of the next review.

The country lists, sectors and points are an illustration and not a risk assessment.

## Inputs and outputs

The service [onboardCustomer](model:onboardCustomer) takes a `Customer` with a list of `BeneficialOwner`s.

| Input                                    | Meaning                                                           |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `country`, `industryCode`                | The country of registration and the NACE industry code            |
| `incorporationDate`, `onboardingDate`    | The age of the company comes from these dates                     |
| `expectedMonthlyVolume`, `cashIntensive` | The expected activity                                             |
| `owners`                                 | Per owner: identity, share, PEP and sanctions flags, the document |

| Result                   | Meaning                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `outcome`, `reason`      | `ACCEPT`, `PENDING` or `REJECT`, and why                                    |
| `dueDiligence`           | `SIMPLIFIED`, `STANDARD`, `ENHANCED`, or `NONE` when not accepted           |
| `requests`               | The documents still needed                                                  |
| `riskLevel`, `riskScore` | The risk level and the score                                                |
| `riskBreakdown`          | Every factor of the score and its points                                    |
| `nextReview`             | The date of the next KYC review: 1, 3 or 5 years by risk level              |
| `owners`                 | Per owner: the share, whether the owner must be verified, the failed checks |

## Walkthrough

1. **Structure:** a [Customer](model:Customer) owns its [BeneficialOwner](model:BeneficialOwner) records.
2. **Facts:** [OwnerFacts](model:OwnerFacts) answers the questions about an owner once: is the share significant, is the
   owner foreign, is the document provided, valid and well-formed. `explain` tells a missing document from an expired
   one. [CustomerFacts](model:CustomerFacts) gives the age of the company and the declared ownership.
3. **Knowledge:** [countryRisk](model:countryRisk) and [industryRisk](model:industryRisk) are risk tables; the industry
   table matches code prefixes with `startsWith` expressions. [riskScorecard](model:riskScorecard) collects the risk
   factors, [riskLevel](model:riskLevel) maps the score to a level, and [dueDiligence](model:dueDiligence) is the
   verdict table, ordered from the most severe finding.
4. **Decisions:** [OwnerScreening](model:OwnerScreening) screens one owner. [CustomerRisk](model:CustomerRisk) scores
   the customer and [DueDiligence](model:DueDiligence) decides.

## Try it

- [Fintech start-up](model:fintechBook): a payment company younger than two years with a high volume and a politically
  exposed owner. The chart shows the risk score factor by factor. The minority owner has no document, and that does not
  block the onboarding.
- [Bakery with an expired passport](model:bakeryBook): a low-risk customer that waits for one document. Change the
  expiry date and the customer is accepted.
- The tests of [onboardCustomer](model:onboardCustomer) check a passport that expires on the onboarding day, a share of
  exactly 25%, undeclared ownership, a sanctioned minority owner and a prohibited country.

## EdgeRules features

- Types with an `owner` link from an owner to the customer
- `facts` that use `explain` to tell a missing document from an invalid one
- String built-ins: `startsWith`, `isAlphanumeric` and `length`
- Decision tables with `in [...]` lists and boolean `when` expressions
- A `collect-matches` scorecard combined with fixed factors in one breakdown
- Period arithmetic for the next review date

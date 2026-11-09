# Loan Repayment Planner

Prices consumer loans and mortgages by credit score and term, and plans their monthly repayment: the payment, the
amortization schedule, the total cost and the yearly split of interest and principal.

## Inputs and outputs

The service [loanRepayment](model:loanRepayment) takes a `LoanRequest`.

| Input         | Type   | Meaning                          |
| ------------- | ------ | -------------------------------- |
| `amount`      | number | The loan amount                  |
| `years`       | number | The term in years                |
| `creditScore` | number | The credit score of the borrower |

| Result     | Meaning                                                           |
| ---------- | ----------------------------------------------------------------- |
| `pricing`  | The price tier, the rate premium and whether the loan is approved |
| `rate`     | The annual rate: the base rate of 3.5% plus the premium           |
| `payment`  | The fixed monthly payment; 0 for a declined request               |
| `schedule` | The monthly amortization schedule; empty for a declined request   |
| `cost`     | The total interest and the total paid                             |

## Walkthrough

1. [pricingTier](model:pricingTier) selects the price tier and the rate premium from the credit score and the term.
2. [annualRate](model:annualRate) adds the premium to the base rate of 3.5%.
3. [monthlyPayment](model:monthlyPayment) is the fixed monthly annuity, rounded to cents.
4. [repaymentSchedule](model:repaymentSchedule) is the monthly amortization schedule.

A declined request has a payment of 0 and an empty schedule.

| Credit score | Term             | Tier       | Premium |
| ------------ | ---------------- | ---------- | ------- |
| 760 or more  | 15 years or less | prime      | 0.50%   |
| 760 or more  | any              | prime      | 0.75%   |
| 680 to 759   | any              | standard   | 1.50%   |
| 600 to 679   | 10 years or less | near-prime | 3.00%   |
| other        | other            | declined   | —       |

The service prices a request and returns the repayment:

```edgerules
sampleRequest: { amount: 25000; years: 3; creditScore: 700 }
samplePayment: loanRepayment(request: sampleRequest).payment
```

## Try it

- [Mortgage plan](model:mortgageBook): a 250 000 mortgage over 25 years for a prime borrower. Its flow shows the
  payment, the cost, the schedule, the remaining balance and the yearly split.
- [15 vs 30 years](model:termComparisonBook): the same 180 000 loan over 15 and over 30 years, and the balance of both
  by year.
- The tests of [loanRepayment](model:loanRepayment) and [pricingTier](model:pricingTier): run all to check every case.

## EdgeRules features

- Types with `type`
- A decision table with the `first-match` hit policy: `ruleset`
- Functions, and the built-in `pmt` and `amortizationSchedule`
- List filters and `for` loops, for the yearly summary
- An external contract with `service`
- Workbooks with input nodes, function nodes, outputs and charts

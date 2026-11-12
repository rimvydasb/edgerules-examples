# Auto Insurance Premium

Quotes a car insurance policy with a multiplicative rating model. Every driver gets an age, an experience and a driving
record factor, and the policy is rated by its riskiest driver. The vehicle, the territory and the deductible add their
own factors to the base rate of the coverage. Discounts stack up to a cap of 30%, and underwriting rules refer or
decline the policy. The rate table changes on 1 January 2027, and the quote date selects the table in force.

The rates and factors are an illustration and not a filed rating plan.

## Inputs and outputs

The service [autoQuote](model:autoQuote) takes a `Policy` with one `Vehicle` and a list of `Driver`s.

| Input                            | Meaning                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `quoteDate`                      | The date of the quote; it selects the rate table and the ages               |
| `coverage`, `deductible`         | `liability`, `standard` or `comprehensive`, and a deductible of 250 to 1000 |
| `territory`                      | `urban`, `suburban` or `rural`                                              |
| `customerSince`, `otherPolicies` | The customer history for the loyalty and multi-policy discounts             |
| `vehicle`                        | Make, model year, value and safety features                                 |
| `drivers`                        | Per driver: birth date, licence date, claims and violations                 |

| Result                   | Meaning                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `outcome`, `findings`    | `ACCEPT`, `REFER` or `DECLINE`, and the rule and driver behind it |
| `rateVersion`            | The rate table in force on the quote date                         |
| `drivers`, `ratedDriver` | The factors of every driver, and the driver who rates the policy  |
| `breakdown`              | The factors that multiply the base rate                           |
| `discounts`              | The discounts earned, the rate within the cap and the cap flag    |
| `annualPremium`          | The premium after discounts                                       |
| `monthlyPremium`         | The monthly instalment with a 3% charge for monthly payment       |

## Walkthrough

1. **Structure:** a [Policy](model:Policy) owns one [Vehicle](model:Vehicle) and its [Driver](model:Driver) records.
   Both read the quote date through their `policy` owner link.
2. **Facts:** [DriverFacts](model:DriverFacts), [VehicleFacts](model:VehicleFacts) and [PolicyFacts](model:PolicyFacts)
   derive the rating terms: age, licence years, vehicle age, tenure.
3. **Knowledge:** one decision table per rating factor. [rateVersion](model:rateVersion) picks the rate table by date,
   and [baseRate](model:baseRate) holds every version of the table side by side, so a rate change is a new set of rows,
   not a new model. [discounts](model:discounts) and [driverUnderwriting](model:driverUnderwriting) are
   `collect-matches` tables.
4. **Decisions:** [DriverRating](model:DriverRating) rates each driver. [PolicyRating](model:PolicyRating) picks the
   riskiest driver and multiplies the factors. [PolicyDiscounts](model:PolicyDiscounts) applies the cap,
   [Underwriting](model:Underwriting) collects the findings of all drivers, and [PolicyPremium](model:PolicyPremium)
   gives the annual and the monthly premium.

## Try it

- [Family car quote](model:familyBook): two parents and a 19-year-old daughter with a new licence. The daughter rates
  the policy. The chart shows the factors of every driver. The requote node prices the same policy with the 2027 rate
  table.
- The tests of [autoQuote](model:autoQuote) check the rate change day, a new driver, a driver under 18, a major
  violation, two claims, liability coverage and the discount cap.
- The tests of [PolicyRating](model:PolicyRating) show how the riskiest driver changes when the daughter leaves the
  policy.

## EdgeRules features

- A domain model with two child types under one owner: the vehicle and the drivers
- `facts` for the rating terms of each object
- Effective-dated rules: a rate version table selects the rows of the base rate table
- `first-match`, `unique-match` and `collect-matches` decision tables
- One `decision` for each driver and four decisions for the policy
- Workbooks with a requote on another date and charts of the factors

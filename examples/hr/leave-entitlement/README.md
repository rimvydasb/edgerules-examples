# Leave Entitlement

Calculates the annual leave of every employee of a team. The days depend on the age and the years of service of the
employee, as in the "Vacation Days" benchmark of the Decision Management Community. Part-time employees and employees
hired in the current year get a pro rata share, and unused days from the last year carry over up to a cap.

The rules are an illustration and not the leave law of a country.

## Inputs and outputs

The service [leaveEntitlements](model:leaveEntitlements) takes a `LeaveYear`: the calculation date and the employees.

| Input             | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `calculationDate` | The date on which the age and the years of service are taken |
| `employees`       | Per `Employee`: birth date, hire date, contract and FTE      |
| `carriedOverDays` | Per employee: the unused days of the last year               |
| `takenDays`       | Per employee: the days taken this year                       |

| Result      | Meaning                                                                               |
| ----------- | ------------------------------------------------------------------------------------- |
| `employees` | Per employee: the rules that applied, the entitlement, the carry-over and the balance |
| `summary`   | The headcount, the total entitlement, the forfeited days and the overdrawn employees  |

## Walkthrough

1. **Structure:** a [LeaveYear](model:LeaveYear) owns its [Employee](model:Employee) records. Each employee reads the
   calculation date through its `leaveYear` owner link.
2. **Facts:** [EmployeeFacts](model:EmployeeFacts) names the terms of the policy once: `age`, `serviceYears`,
   `monthsInService` and `workingTime`. Every decision reads these terms, and every output shows them.
3. **Knowledge:** [extraDays](model:extraDays) is the vacation days table, a `collect-matches` ruleset: each matching
   rule adds days and names itself. [vacationDays](model:vacationDays) adds the extra days to the base days of
   [leavePolicy](model:leavePolicy).
4. **Decisions:** [LeaveEntitlement](model:LeaveEntitlement) applies the pro rata share and rounds up to half days.
   [LeaveBalance](model:LeaveBalance) caps the carry-over and calculates the remaining days.

## Try it

- [Team leave 2026](model:teamBook): six employees, among them a 17-year-old part-time employee, a new hire, an employee
  with 30 years of service and an employee who took more days than available. Change a birth date and see which rules
  apply.
- [Vacation days table](model:benchmarkBook): the seven profiles of the benchmark and their days.
- The tests of [vacationDays](model:vacationDays) are the benchmark cases. The tests of
  [leaveEntitlements](model:leaveEntitlements) check the age and service boundaries, the pro rata share and the
  carry-over cap.

## EdgeRules features

- Types with an `owner` link, so an employee reads the calculation date of its leave year
- `facts` that name the terms of the policy: age, years of service, months in service
- A `collect-matches` decision table with boolean `when` expressions and audit names
- Two `decision` elements: the entitlement and the balance
- Date built-ins: `age` for whole years between two dates, `year` and `month` parts
- A `service` that returns one record per employee and a team summary

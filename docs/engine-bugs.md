# EdgeRules engine bug report

Problems found while building the 10 examples of `todo.md`. Every repro below was run against
`@edgerules/node@0.2.7-alpha.202611081915` (the version in `package.json`), and the observed output is copied from that
run. Optimise repros used the `highs` package with `toCplexLp` and `mapHighsSolution`, as in `tooling/validate.mjs`.

| #   | Problem                                                                         | Severity | Kind        |
| --- | ------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | A comparison with a `Missing` operand returns `false`                           | High     | Semantics   |
| 2   | `min` / `max` of an empty list throws a hard interpreter error                  | High     | Runtime     |
| 3   | An `optimise` row without variables makes the whole result `Missing`, no reason | High     | Optimise    |
| 4   | Record fields shadow parameters and cause false cycles (E110 / E103)            | Medium   | Linker      |
| 5   | A list filter cannot read a `facts` field (E102)                                | Medium   | Linker      |
| 6   | `< date("...")` in a ruleset cell parses as the `<date>` type wrapper           | Medium   | Parser      |
| 7   | `flatten` loses the element type                                                | Medium   | Type system |
| 8   | `[]` in a ruleset result is typed `absent[]` and fails the shape check (E307)   | Medium   | Type system |
| 9   | A `decision` on a child type cannot be tested on its own                        | Medium   | Testability |
| 10  | `min` / `max` reject dates                                                      | Low      | Built-ins   |
| 11  | `x in [...]` is not an expression, only a ruleset cell                          | Low      | Language    |
| 12  | A list cannot be filtered by a boolean mask                                     | Low      | Language    |

---

## 1. A comparison with a `Missing` operand returns `false` [NOT A BUG]

> **Resolution:** By design. `special-values-spec.md` (Common Special Value Treatment, rule 5) states that every
> comparison and logical operation with a special value is `false`, and that a special value cannot be a boolean. Check
> the input before the comparison: `if isMissing(h.assets) then ... else h.assets <= 3000`, or
> `explain(h.assets).status`. A change of this rule is a language design decision, not a bug fix.

Arithmetic keeps the `Missing` and its origin, but a comparison turns it into a plain `false`. `explain` then reports
the result as healthy, so the model cannot tell "the test failed" from "the evidence is missing". This works against the
"absence is information" principle of `dmn-comparison-research.md` §4.3.

```edgerules
{
    type H: { assets: <number> }
    service check(h: H): {
        return: {
            sum: h.assets + 1
            compare: h.assets <= 3000
            why: explain(h.assets <= 3000)
        }
    }
}
```

Input: `{"h": {}}`

**Observed:**

```json
{
  "sum": "Missing('h.assets')",
  "compare": false,
  "why": {"status": "ok", "type": "boolean", "value": false}
}
```

**Expected:** `compare` is `Missing('h.assets')` of type `boolean`, and `why.status` is `"missing"`, the same as for
`sum`. Rulesets can keep their rule that a special value fails a cell test, because there the `default` keeps the
ruleset total. Plain boolean expressions should propagate the special value, as arithmetic does.

**Impact:** in `assistance-eligibility` a missing asset statement showed as a failed asset test, and the household was
`INELIGIBLE` instead of `PENDING`. A facts field such as `elderly: age >= 60` is silently `false` when the birth date is
missing.

**Workaround:** check every input with `explain(x).status = "ok"` before the comparison and carry a separate "known"
flag.

## 2. `min` / `max` of an empty list throws a hard interpreter error [FIXED]

> **Resolution:** `min`, `max`, `minBy`, and `maxBy` of an empty list (or of a list of `NotApplicable` elements only)
> return `Invalid(number)` with the origin `min of an empty list` (`max …`, `minBy …`, `maxBy …`). The execution goes
> on. The result is `Invalid`, not `Missing`, to match `mean`, `median`, and `stddev` of an empty list. Tests:
> `eval_collection_tests.rs`, `tests/wasm/builtins/list-functions.test.ts`.

```edgerules
{
    type Basket: { items: <Item[]> }
    type Item: { owner basket: <Basket>; price: <number> }
    decision Cheapest(basket: Basket): {
        lowest: min(for i in basket.items return i.price)
    }
    service cheapest(basket: Basket): {
        return: { lowest: basket.Cheapest.lowest }
    }
}
```

Input: `{"basket": {"items": []}}`, for both `execute("Cheapest", ...)` and `execute("cheapest", ...)`.

**Observed:** the whole execution fails:

```text
execution error: interpreter error: built-in call failed: type error in 'min' argument 0: expected a non-empty list of numbers
```

**Expected:** `lowest` is `Missing(number)` with an origin such as `min of an empty list`, and the rest of the result is
evaluated. An empty list is ordinary data (no eligible carrier, no history), so it should not crash the decision.
`sum([])` already returns `0`.

**Workaround:** `if count(xs) > 0 then min(xs) else 0` (used in `carrier-selection`).

## 3. An `optimise` row without variables makes the whole result `Missing`, without a reason [FIXED]

> **Resolution:** The engine decides a row without decision variables before it builds the `LpProblem`. A row that
> holds is not sent to the solver, and its bottleneck value is 0 (the family keeps one value per element). A false row
> makes the result `status: "infeasible"` without a solver call; the origin is
> `E340: optimise 'pick' is infeasible — … relaxes 'leastPerGroup[2]' by 1 (>= 1)`. Tests:
> `eval_optimise_indexed_tests.rs`, `tests/wasm/optimise.test.ts`.

A constraint family can produce a row whose sum has no variable terms, for example a group with no candidates. The row
is trivially true (`0 <= 1`), but `toCplexLp` throws `LpFormatError`. The engine then returns the whole result record as
`Missing`, and the origin is only the call path.

```edgerules
{
    optimise pick(value: number[], groupOf: number[], groups: number): {
        variables: {
            take: <number[], integer: true, min: 0, max: 1, over: value>
        }
        maximise: sum(for i in 0..(count(value) - 1) return value[i] * take[i])
        constraints: {
            onePerGroup: for g in 0..(groups - 1) return sum(for i in 0..(count(value) - 1) return if groupOf[i] = g then take[i] else 0) <= 1
        }
    }
    allGroupsUsed: pick(value: [5, 7], groupOf: [0, 1], groups: 2)
    emptyGroup: pick(value: [5, 7], groupOf: [0, 1], groups: 3)
    why: explain(emptyGroup.objective)
}
```

**Observed:** `allGroupsUsed` solves. `emptyGroup` is `"Missing('emptyGroup')"`, and the solver handler threw:

```text
LpFormatError - constraint 'onePerGroup[2]' has no variable terms
```

`explain(emptyGroup.objective)` gives `{"status": "missing", "origin": "emptyGroup"}`: no code, no constraint name.

**Expected**, either of:

- The engine folds a variable-free row before it builds the `LpProblem`: a true row is dropped, and a false row (such as
  `0 >= 1`) makes the result `infeasible` with an E340-style origin that names the row. This is the better fix, because
  the row is just a family member over data.
- At least, the result is `Invalid` with an origin that names the error and the row, for example
  `E343: constraint 'onePerGroup[2]' has no decision variables`. Today a host error is silently turned into an
  unexplained `Missing`.

**Workaround:** build the constraint families only over the rows that have candidates (`parcelIds` and `courierIds` in
`last-mile-assignment`).

## 4. Record fields shadow parameters and cause false cycles (E110 / E103) [FIXED] (A, B) / [NOT A BUG] (C)

> **Resolution:** Repros A and B are fixed. In an anonymous record literal, a field's own name in its value now reads
> the outer binding, the same as in a named context (`b: { a: a }` already worked): `{ driver: driver.name }` reads the
> `driver` parameter. Repro C is by design: `dsl-context-spec.md` R8 ("Shadowing: nearest wins, no escape hatch"). In
> the `return` context, `household` in `applicationId: household.applicationId` is the sibling field `household`, not
> the parameter. Rename the field or the parameter. Tests: `eval_context_rules_tests.rs`.

Inside a record literal, a field name hides a parameter or context name of the same spelling, even in the field's own
value and in sibling fields. The result is a circular dependency, or a member lookup on the wrong object. A plain
`{ quoteDate: quoteDate }` at the top of a function works, so the rule is not consistent.

**Repro A: the field's own value**

```edgerules
{
    type Driver: { name: <string>; claims: <number> }
    decision DriverRating(driver: Driver): {
        findings: for c in [1, 2] return { driver: driver.name, claim: c }
    }
}
```

**Observed:** `E110: circular dependency: driver`

**Repro B: a record literal passed as an argument**

```edgerules
{
    type Quote: { quoteDate: <date>; amount: <number> }
    func price(quote: Quote): quote.amount * 2
    func requote(amount: number, quoteDate: date): {
        result: price({ quoteDate: quoteDate, amount: amount } as Quote)
    }
    r: requote(100, date("2027-01-04"))
}
```

**Observed:** `E110: circular dependency: quoteDate → amount`

**Repro C: a sibling field of the result record**

```edgerules
{
    type Household: { applicationId: <string>; size: <number> }
    service assess(household: Household): {
        return: {
            applicationId: household.applicationId
            household: { size: household.size }
        }
    }
}
```

**Observed:** `E103: 'applicationId' is not a field of 'assess.return.household' — available fields: size`

**Expected:** the value expression of a field resolves names in the enclosing scope, not against the field that it
defines. `{ driver: driver.name }` reads the `driver` parameter, and `household.applicationId` reads the `household`
parameter. These are the most natural ways to write an output record. If the shadowing is intended, the error should say
so: "field 'driver' hides the parameter 'driver'; rename one of them".

**Impact:** hit 4 times in 10 examples (`auto-premium` twice, `assistance-eligibility`, `last-mile-assignment`).

## 5. A list filter cannot read a `facts` field (E102) [FIXED]

> **Resolution:** A filter predicate reads a facts field of the element by name, in a service, `facts`, or `decision`
> body: `household.members[age >= 60]`. The E102 message format (node id) is unchanged. Tests: `eval_layer_tests.rs`.

```edgerules
{
    type Household: { applicationDate: <date>; members: <Member[]> }
    type Member: { owner household: <Household>; name: <string>; birthDate: <date> }
    facts MemberFacts(member: Member): {
        age: age(member.birthDate, member.household.applicationDate)
    }
    service seniors(household: Household): {
        return: { names: for m in household.members[age >= 60] return m.name }
    }
}
```

**Observed:** `E102: unresolved reference 'age' in node NodeId(5)`. The same happens in a `facts` body and in a
`decision` body. Filters on structure fields (`members[income > 500]`) work.

**Expected:** a filter predicate sees the same members as a path read: structure fields and facts fields (decision
layers reference: "A consumer reads a facts field with the same path as a structure field"). Also, the error message
should name the field and the list, not a node id.

**Workaround:** project, then filter: `count((for m in household.members return m.age >= 60)[... = true])`.

## 6. `< date("...")` in a ruleset cell parses as the `<date>` type wrapper [FIXED]

> **Resolution:** `<name` is a type wrapper only when `>`, `,`, `[`, or `:` follows the name. Otherwise `<` is a comparison:
> `< date("2027-01-01")`, `< limits.cutoff`, and `< cutoff` (a bare parameter, which also failed) all parse. Tests:
> `eval_ruleset_tests.rs`.

```edgerules
{
    ruleset version(quoteDate: date): {
        hitPolicy: "first-match"
        rules: [
            { when: { quoteDate: < date("2027-01-01") }, then: { version: "2026" } }
        ]
        default: { version: "2027" }
    }
    result: version(date("2026-06-01"))
}
```

**Observed:**

```text
parse error: Parse errors: InvalidTypeReference at 125, UnexpectedToken at 131, MissingIdentifier at 132, ...
```

`>= date("2027-01-01")` parses, and `< (date("2027-01-01"))` parses.

**Expected:** a unary-test cell `< date("2027-01-01")` is a comparison. Effective-dated rules ("valid before ...") need
exactly this cell. The same ambiguity probably applies to `< datetime(...)`, `< time(...)` and any type name. The parse
error should at least point at the cell and suggest parentheses.

## 7. `flatten` loses the element type [FIXED]

> **Resolution:** `flatten` returns the innermost element type in one list: `Finding[][]` gives `Finding[]`, and
> `number[][][]` gives `number[]` (the flatten is deep). Tests: `eval_collection_tests.rs`.

```edgerules
{
    type Driver: { name: <string>; findings: <Finding[]> }
    type Finding: { action: <string> }
    func actions(drivers: Driver[]): {
        all: flatten(for d in drivers return d.findings)
        codes: for f in all return f.action
    }
    r: actions([{ name: "A"; findings: [{ action: "REFER" }] }])
}
```

**Observed:** `type mismatch in node NodeId(4): expected record with field 'action', found any`

**Expected:** `flatten` of `Finding[][]` is `Finding[]`, so `f.action` links. `concatenate(a, b)` keeps the type, so the
linker can infer it.

**Workaround:** `concatenate`, or flatten only lists of scalars.

## 8. `[]` in a ruleset result is typed `absent[]` and fails the shape check (E307) [FIXED]

> **Resolution:** The ruleset shape check unifies `Absent` at any depth: `[]` takes `string[]` from the other rows,
> in `then` and in `default`. Other field differences are still E307. Note: the engine evaluates an empty list
> literal `[]` to `Missing('empty list')` everywhere (`x: []`, `count([])`), so the `VISIT` row returns
> `documents: Missing('empty list')`. Tests: `eval_ruleset_tests.rs`.

```edgerules
{
    ruleset policy(code: string): {
        hitPolicy: "first-match"
        rules: [
            { when: { code: "MRI" }, then: { documents: ["clinical-notes"] } }
            { when: { code: "VISIT" }, then: { documents: [] } }
        ]
    }
    r: policy("VISIT")
}
```

**Observed:**
`E307: ruleset 'policy' rule results disagree on field 'documents': expected string[], found absent[] — every 'then'/'default' result must share the exact same shape`

**Expected:** an empty list literal unifies with any list type, so `[]` takes `string[]` from the other rows. The
reference already does this for an untyped `"Missing"` output cell ("it adopts the column's type from the other rows").
A typed form in a cell, such as `<string[], []>`, would also do.

**Workaround:** remove the row and handle the case in another table (`prior-authorization`).

## 9. A `decision` on a child type cannot be tested on its own [NOT A BUG]

> **Resolution:** The second option already works. The input supplies the owner inside the child (decision layers
> reference: "The parent child field is transient if the input supplies the parent inside the child"):
> `execute("MemberCheck", {"member": {"birthDate": "1950-01-01", "household": {"applicationDate": "2026-01-01"}}})`
> gives `{"senior": true}`. Input binding rejects a facts key by design (`field is computed`). To supply facts as plain
> values, call the decision with a literal in a model field (`t: MemberCheck({ age: 70 })`) and execute that field.

A decision on a type with an `owner` link reads facts that go through the owner. A test of that decision must supply the
input as the service binding does, which rejects facts keys and cannot supply the owner.

```edgerules
{
    type Household: { applicationDate: <date>; members: <Member[]> }
    type Member: { owner household: <Household>; birthDate: <date> }
    facts MemberFacts(member: Member): {
        age: age(member.birthDate, member.household.applicationDate)
    }
    decision MemberCheck(member: Member): {
        senior: member.age >= 60
    }
}
```

**Observed:**

- `execute("MemberCheck", {"member": {"birthDate": "1950-01-01"}})` gives `{"senior": false}`: no owner, so `age` is
  `Missing`, and bug 1 turns it into `false`.
- `execute("MemberCheck", {"member": {"age": 70}})` gives `{"senior": "Invalid('field is computed: member.age')"}`.

**Expected:** the decision layers reference says "A layer is testable with a literal argument … The literal supplies
facts fields as plain values". This works for a call from the model, but not through `execute`, which the Tests view and
`runTestSuite` use. `execute` of a `decision` should accept facts fields as plain values, as a literal call does.
Another option is to let the test supply the owner (`{"member": {..., "household": {...}}}`).

**Impact:** in all 10 examples, decisions such as `ItemReturn`, `DriverRating`, `OwnerScreening` and `MemberCheck` are
tested only through the decision of the root type or the service.

## 10. `min` / `max` reject dates [NOT A BUG]

> **Resolution:** Feature request. The list functions reference documents `min` and `max` over numbers only. Use
> `sort(dates)[0]` or `if a < b then a else b`.

```edgerules
{
    earliest: min([date("2026-03-01"), date("2026-02-01")])
}
```

**Observed:** `E115: function 'min' argument '#1' expects number[], found date[] in field 'earliest'`

**Expected:** `date("2026-02-01")`. Dates are ordered (`<`, `between` and `sort` work on them), and "the earlier of the
two dates" is common in business rules: a coverage end, a promotion end within a billing period.

**Workaround:** `if a < b then a else b`.

## 11. `x in [...]` is not an expression, only a ruleset cell [NOT A BUG]

> **Resolution:** Feature request. `in` is a unary test only (EBNF, Unary Tests): `in ["a", "b"]` desugars to
> `contains(["a", "b"], ...)`. In an expression, write `contains(["wrong-item", "defective"], reason)`.

```edgerules
{
    reason: "defective"
    sellerFault: reason in ["wrong-item", "defective"]
}
```

**Observed:** `parse error: Parse errors: UnexpectedToken at 50`

**Expected:** `true`. The same test works as a cell (`reason: in ["wrong-item", "defective"]`), so an analyst expects it
to work in a `when` expression and in a `facts` field too. If it stays cell-only, the parse error should suggest
`contains(list, value)`.

## 12. A list cannot be filtered by a boolean mask [NOT A BUG]

> **Resolution:** Feature request. A filter takes a predicate over the element or a number index (EBNF, Disambiguation
> in filter position), not a list. The zip-and-filter workaround is the supported form.

```edgerules
{
    prices: [10, 20, 30]
    mask: prices[for p in prices return p > 15]
}
```

**Observed:** `type mismatch in node NodeId(2): expected number or boolean, found boolean[]`

**Expected:** `[20, 30]`, or a clear message that a filter takes a predicate over `...` or a single boolean. A mask is
the natural shape for the result of an `optimise` element: `pairs[for i in ... return plan.assign[i] > 0.5]`.

**Workaround:** zip the values into records, then filter:
`for x in (for i in 0..(count(pairs) - 1) return { pair: pairs[i], on: plan.assign[i] > 0.5 })[on = true] return x.pair`.

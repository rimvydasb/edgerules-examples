# Contributing

Every example is a complete EdgeRules project in one directory. Only Git changes the examples. All examples are MIT
licensed by the `LICENSE` file, so an example has no license field.

## Layout of an example

```text
examples/<industry>/<slug>/
├── edgerules.project.json    # manifest: identity, version, catalog metadata, file list
├── README.md                 # shown in the Library and in the Shell
├── model/main.edge           # the EdgeRules DSL, as written
├── docs/descriptions.json    # short description by model path
├── tests/<subject>.tests.json
├── flow/layout.json          # outputs, charts and positions of the Flow Editor
└── assets/                   # optional: thumbnail.webp (640 x 360), README images
```

- The `<slug>` is the example id. It is unique in the whole repository and does not contain the industry.
- The `<industry>` folder is an id of `industries.json` and must equal `example.industry` of the manifest.
- Do not commit derived data: test results, Portable JSON, schemas, TAST.
- The files are canonical: write them with `exampleToFiles` of `edgerules-react` or export them from a project. Do not
  edit `library.json`; the workflow builds it.

## README sections

A `README.md` SHOULD have these sections, and MUST NOT contain raw HTML:

1. **Title and overview:** one paragraph with the business problem.
2. **Inputs and outputs:** tables of the service inputs and results.
3. **Walkthrough:** the model parts in reading order, with `model:` links to model paths.
4. **Try it:** the workbooks and test suites to open first.
5. **EdgeRules features:** the DSL features that the example shows.

## Feature vocabulary

`example.features` uses these ids. `tooling/validate.sh` checks each against the model.

| Feature          | Evidence in the model         |
| ---------------- | ----------------------------- |
| `type`           | a `type` declaration          |
| `facts`          | a `facts` element             |
| `function`       | a `func` element              |
| `decision-table` | a `ruleset` element           |
| `decision`       | a `decision` element          |
| `service`        | a `service` element           |
| `workbook`       | a `workbook` element          |
| `chart`          | a chart in `flow/layout.json` |
| `loop`           | a `loop` element              |
| `optimise`       | an `optimise` element         |

An example with an `optimise` element sets `example.requires` to `["milp-solver"]`, and only such an example does.

## Version rule

A released version is immutable. A pull request that changes any file of an example MUST increase `model.version` in its
manifest (semver). The index keeps every released version with its commit, and the Library loads old versions by
`<id>@<version>`.

## Local commands

```bash
npm install                      # edgerules-react, @edgerules/node, ajv, highs, prettier
tooling/validate.sh              # all checks for all examples; pass an example id to check one
tooling/validate.sh --base origin/main
tooling/build-index.sh           # writes library.json (CI does this on main)
tooling/build-index.sh --check   # exits 1 when library.json is out of date
npm run format                   # Prettier for JSON and Markdown
npm test                         # tests of the scripts
```

`validate.sh` checks: schema, format, engine link, test cases, references, README, metadata, version, size and secrets.

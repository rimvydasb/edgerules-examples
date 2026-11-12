# Real-Time Fraud Detection

Screens a card payment against the recent history of the card. One pass over the history gives the velocity, the spend
in 24 hours, the 30-day average and the country of the last payment. Ten fraud signals check the payment against this
profile, and a scoring strategy weighs them into `ALLOW`, `REVIEW` or `BLOCK`. Two strategies run on the same signals:
the champion decides, and the challenger runs in shadow mode, so an analyst can compare them payment by payment before
the challenger goes live.

The signals, weights and thresholds are an illustration and not a fraud model.

## Inputs and outputs

The service [screenTransaction](model:screenTransaction) takes a `Transaction` with a `Cardholder` and the list of
`PastTransaction`s.

| Input                         | Meaning                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `timestamp`, `amount`         | The time and the amount of the payment                    |
| `merchantCategory`, `country` | The merchant category code and the country                |
| `deviceId`, `channel`         | The device, and `card-present` or `online`                |
| `cardholder`                  | The home country, the account opening date, known devices |
| `history`                     | The payments of the last 30 days                          |

| Result            | Meaning                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `action`, `score` | The champion action and score                                            |
| `signalCodes`     | The fired signals                                                        |
| `signals`         | Per signal: the description, the weight and whether it blocks at once    |
| `challenger`      | The challenger action and score, and whether it agrees with the champion |
| `profile`         | The history profile that the signals read                                |

## Walkthrough

1. **Structure:** a [Transaction](model:Transaction) owns its [Cardholder](model:Cardholder) and its
   [PastTransaction](model:PastTransaction) records.
2. **Facts:** [PastTransactionFacts](model:PastTransactionFacts) gives the minutes between each past payment and the
   payment to screen. [TransactionFacts](model:TransactionFacts) builds the profile with the
   [historyStats](model:historyStats) loop and derives the signals' terms: the amount ratio, a new device, a foreign
   country, a country hop and the account age.
3. **Knowledge:** [historyStats](model:historyStats) is a `loop` over the history that keeps the counts and sums of
   three time windows and the latest payment in one state. [fraudSignals](model:fraudSignals) is a `collect-matches`
   table over the whole transaction. Each strategy has its own weight table and its own action table.
4. **Decisions:** [FraudSignals](model:FraudSignals) detects the signals once. [FraudScore](model:FraudScore) and
   [FraudScoreChallenger](model:FraudScoreChallenger) are two decisions on the same `Transaction` that read the same
   signals, so the only difference between them is the policy.

## Try it

- [Card testing attack](model:attackBook): three tiny payments, two declined, and then 480 at night from an unknown
  device. The chart shows the weight of each fired signal.
- [Champion and challenger](model:comparisonBook): four payments scored by both strategies. The chart compares the
  scores, and the output shows where the actions differ.
- The tests of [screenTransaction](model:screenTransaction) check the 60-minute and 120-minute windows, the 2 000 limit
  and a first payment where the strategies disagree.

## EdgeRules features

- A transaction that owns two child types: the cardholder and the history
- `facts` with datetime arithmetic: minutes between payments, the hour, the account age
- A `loop` over a list that keeps several running totals and the latest item in one state
- A `collect-matches` decision table whose rows are expressions over the whole transaction
- A champion and a challenger: two `decision` elements on the same context, compared in one output
- A `service` that compares both strategies over many payments

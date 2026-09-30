# Dashboard scoring fixes: proposal

AnthroSafe™ Field Driven Safety | © 2026 SLP Alaska, LLC

Status: proposal only. This file is the only change in this pull request. No code, configuration or data is changed. Nothing here should be applied without Brian's approval.

Purpose: keep the dashboard cards honest and encouraging. Recognition should follow reporting, follow-through and stopping work, and never reward low injury numbers. Each item below gives the current definition, the problem, the proposed fix, a priority (P1 first) and the risk of making the change.

File references are to `lib/supabase.js` (function `getDashboardData` unless noted), `app/page.js` (the score cards) and `supabase/functions/send-weekly-reports/index.ts` (the weekly email function, "weekly email" below). Line numbers are from the main branch on 9/30/2026 and will drift.

## Formula mismatches between the dashboard and the weekly email

The dashboard and the weekly email calculate the same named scores in different ways. A customer can see two different numbers for the same week. A third copy of some formulas lives in `lib/advanced-analytics.js` (`calculateSafetyCultureIndex`, `calculatePredictiveRiskScore`, `calculate30DayRiskForecast`).

| Score | Dashboard (`lib/supabase.js`) | Weekly email (`send-weekly-reports/index.ts`) |
|---|---|---|
| Job Stop Rate | job stops divided by at-risk observations (L923) | job stops divided by all observations (L143) |
| Job stop flag | `job_stop_required === true` (L921) | `job_stop === true` or `'Yes'` (L141), a different column name |
| Safe/At-Risk ratio, no at-risk | returns the safe count, or 0 (L922) | returns the safe count (L142) |
| Safety Culture Index | 8 factors, 5 to 6 bands each (L1372-1420) | 6 factors, 2 to 3 bands each (L253-267) |
| Predictive Risk Score | open items, overdue SAIL, SIF rate, at-risk rate (L1422-1450) | open SAIL, SIF rate, "at-risk greater than safe", days since last submission, incident count (L269-281) |
| 30-Day Forecast | six factors including trends and average days open (L205-230, L1520-1546) | four factors (L283-290) |
| SIF Potential Rate | flagged near misses, incidents, at-risk observations, property damage over those same four groups (L985-1011) | flagged observations, near misses, hazard IDs over those three groups (L145-153) |
| Lagging total for Lead/Lag | open plus closed incidents, property damage, open SAIL (L1222) | incidents plus property damage only (L215) |
| Leading list | 12 sources including stop cards, MBWA, risk conversations, EHS evaluations (L1164-1178) | 8 sources (L195-204) |

Proposed fix for the whole table: one shared scoring module (a single file of pure functions) imported by the dashboard, the weekly email function and `lib/advanced-analytics.js`, with unit tests that pin each formula. Priority P1. Risk: medium, because scores will change for some customers; announce the change and note the date.

## Metric by metric

### 1. Safety Culture Index (target 70+)
- Current: `getDashboardData`, L1372-1420, shown in `app/page.js` L1103-1109. Starts at 70, adds up to 30 for Safe/At-Risk ratio, Job Stop Rate and reports of good catches and near misses, and subtracts up to 50 for incident count, SIF Potential Rate, at-risk rate, open items and overdue SAIL items.
- Problem: it blends leading inputs and lagging outcomes in one number, so one incident can outweigh many weeks of good reporting. Good catch reports add points while the SIF Potential Rate built from the same reports subtracts points, so more honest reporting can lower the score. The bands are tuned for a year of data and behave differently on a week or a month.
- Proposed fix: split into a Leading Culture Score (ratio, stop work use, reporting, follow-through) and a separate Outcomes view (incidents, open items). Keep the 70 baseline for the leading score only. Remove the SIF rate penalty from the culture score.
- Priority: P2. Risk: medium, scores change and history needs a note.

### 2. Predictive Risk Score (lower is better)
- Current: L1422-1450, `app/page.js` L1111-1118. Sums bands for open items, overdue SAIL items, SIF Potential Rate and at-risk rate.
- Problem: the inputs are mostly backlog and outcomes, so it describes today more than it predicts. The colors disagree in the screenshot review: a value of 33 is in the amber band (30 or under is green) while the card border is red.
- Proposed fix: rename to "Risk Load" until real predictors (recent leading activity trend, days since last report, exposure) are added, and align the card border color with the number bands.
- Priority: P2 for the border and label (low risk), P3 for adding predictors (medium risk).

### 3. 30-Day Forecast
- Current: `calculate30DayRiskForecast`, L205-230, inputs assembled at L1520-1546, card at `app/page.js` L1121-1128.
- Problem: it is a 0 to 100 index, not a count, but a deployed card labels it "Predicted incidents" while the repository card says "Predicted risk level". Its trend inputs compare halves of the selected period, which is not meaningful for short ranges. It blends leading and lagging inputs.
- Proposed fix: make the label consistent ("30-Day Risk Index"), show the band words (Low, Watch, Elevated), and hide the card for ranges shorter than 90 days.
- Priority: P1 for the label (very low risk), P3 for the range rule.

### 4. TrueCost Total
- Current: `trueCostSummary`, L1359-1368, card at `app/page.js` L1130-1139. Sum of `incident_costs.total_cost`.
- Problem: costs are entered by hand per incident, so $0 means no cost has been entered, not that no cost occurred. The card reads as good news when it may only be empty.
- Proposed fix: show "No costs entered yet" when no incident has a cost row, and show "X of Y incidents costed" beside the total.
- Priority: P2. Risk: low.

### 5. Safe/At-Risk Ratio (target 5:1)
- Current: L921-931, card at `app/page.js` L1140-1150, colors green at 5 or more, amber 2 to 4.9, red below 2.
- Problem: the ratio is correct and the badge matches its target. The trend arrow compares the first and second half of the period and shows "up 100%" whenever the first half was zero, so it can mislead. With only a handful of observations the ratio swings widely.
- Proposed fix: show the observation count under the ratio, hide the ratio under 10 observations, and compute the trend against the previous equal period.
- Priority: P2. Risk: low.

### 6. Job Stop Rate
- Current: L921-923, card at `app/page.js` L1152-1158. Job stops divided by at-risk observations. The weekly email divides by all observations.
- Problem: the label does not say what it is a share of. A value of 0% with 0 stops reads as a failure when there may be nothing to stop, and the denominator differs between the dashboard and the weekly email. Stopping work is a behavior to recognize, so the wording should be encouraging.
- Proposed fix: choose one denominator (recommended: at-risk observations, matching the dashboard), label it "of at-risk observations", show "none yet" when the denominator is 0, and add the line "Crews who stop the job are doing the right thing".
- Priority: P1. Risk: low.

### 7. SIF Potential Rate
- Current: L985-1011, card at `app/page.js` L1160-1169. Flagged events over near misses, incidents, property damage and at-risk observations.
- Problem: a small denominator makes the percentage noisy (1 of 5 shows as 20%). It counts hazard reports differently from the weekly email. Reporting more potential events raises the rate, which discourages reporting if it is treated as a penalty.
- Proposed fix: show the count first and the percentage only at 10 or more events, use the same event list in the dashboard and the weekly email, and word the card as "Potential serious events found early".
- Priority: P1 for the shared definition, P2 for the wording. Risk: low to medium.

### 8. Control Quality
- Current: L1114-1160 (control tiers from THA controls, weights 100, 60 and 30), card at `app/page.js` L1171-1177. The weekly email uses a different tier list (L156-172).
- Problem: with no controls the score returns 50, so 50 can mean no data. The tier keyword lists differ between the dashboard and the weekly email.
- Proposed fix: return "no data" instead of 50, use one tier list, and show the number of controls behind the score.
- Priority: P2. Risk: low.

### 9. Near Misses
- Current: `nearMissMetrics`, L962-975, card at `app/page.js` L1179-1185. It counts every good catch and near miss report, with the note "More = better culture".
- Problem: the framing is right for a reporting culture, but the label says Near Misses while the value counts all reports, and the SIF card treats the same reports as a risk signal.
- Proposed fix: rename to "Good Catches and Near Misses Reported", keep "More reports means more problems found early", and keep the recognition wording.
- Priority: P2. Risk: very low.

### 10. Training Completions
- Current: L1587-1625, card at `app/page.js` L1187-1193. Counts completion rows, the number of distinct workers, and completions in the last 30 days.
- Problem: it does not say how many courses were assigned, so 0 and 100 percent look the same when nothing is assigned. The distinct worker count is built from names.
- Proposed fix: show percent of assigned courses completed with the counts beside it (for example 18 of 24) and a past due count, counting English and Spanish twins once. The Monday email for YJOS already uses this definition.
- Priority: P1. Risk: low, needs the assignment tables to be read the same way as the portal.

### 11. Open Items
- Current: L1183-1210, card at `app/page.js` L1195-1201. Open incidents plus open SAIL items, with an overdue count.
- Problem: the overdue count reads `sail_log.target_date`, while the YJOS column is `target_completion_date`, so the count can always show 0 there. Incidents opened long ago count the same as new ones. The card border turns red for items over 30 days old, which the number does not show.
- Proposed fix: read the real target column, show items past target and items over 30 days as separate lines, and word the card as "Follow-through: items still open".
- Priority: P1. Risk: low.

### 12. Lead/Lag Ratio (target 10:1+)
- Current: L1178 and L1222 with the ratio at L1645, card at `app/page.js` L1203-1209.
- Problem: open SAIL items are backlog, not lagging outcomes. Routine paperwork raises the leading count. With no lagging events it returns the leading count with ":1", which is not a ratio. The weekly email leaves open SAIL out of the lagging total. A related copy in another project counted open incidents twice; this dashboard does not, and a test should keep it that way.
- Proposed fix: define lagging as incidents plus property damage only, show "No lagging events" when it is 0, and add a unit test that fixes the definition.
- Priority: P1. Risk: medium, the ratio will rise for customers with open SAIL items.

## Suggested order of work
1. Shared scoring module with tests (removes the mismatches, unlocks the rest).
2. Job Stop Rate denominator and label.
3. Open Items target column and follow-through wording.
4. Training as percent of assigned courses.
5. Lead/Lag lagging definition.
6. SIF Potential Rate shared definition and wording.
7. 30-Day Forecast label.
8. Culture Index split, Risk Load rename, TrueCost wording, Near Misses label, Control Quality no-data state, Safe/At-Risk trend.

## Notes
- This proposal contains no personal data, addresses or customer figures.
- Each change should ship on its own branch with tests, and be checked by the customer's role in production before it is called finished.

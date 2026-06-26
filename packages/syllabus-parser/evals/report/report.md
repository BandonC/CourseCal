# Eval report

Generated 2026-06-26T02:46:23.740Z · model `claude-sonnet-4-6` · prompt `v1`.

## Headline (overall)

| System | Recall | Precision | Type | Explicit date | Explicit ±1 | Relative date | Weight | Recurrence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| syllabus-parser v1 | 98.6% | 90.7% | 98.5% | 100.0% | 100.0% | 0.0% | 100.0% | 87.5% |
| regex baseline | 43.5% | 39.0% | 100.0% | 15.0% | 15.0% | 0.0% | 4.5% | 0.0% |

## By stratum (parser)

| Stratum | n (deliv) | Recall | Precision | Explicit date |
| --- | --- | --- | --- | --- |
| format: prose | 17 | 100.0% | 81.0% | 100.0% |
| format: table-heavy | 52 | 98.1% | 94.4% | 100.0% |
| discipline: humanities | 8 | 100.0% | 100.0% | 0.0% |
| discipline: STEM | 61 | 98.4% | 89.6% | 100.0% |
| recurrence: one-off | 46 | 97.8% | 93.8% | 100.0% |
| recurrence: recurring-heavy | 23 | 100.0% | 85.2% | 100.0% |

## Per fixture (parser)

| Fixture | Labels | Predicted | Matched | Recall | Explicit date |
| --- | --- | --- | --- | --- | --- |
| calc1000a | 7 | 7 | 7 | 100.0% | 100.0% |
| calc1501b | 7 | 7 | 7 | 100.0% | 100.0% |
| cs1020a | 16 | 17 | 15 | 93.8% | 100.0% |
| cs1026a | 9 | 10 | 9 | 100.0% | 100.0% |
| cs1027b | 7 | 7 | 7 | 100.0% | 100.0% |
| ds1000a | 6 | 6 | 6 | 100.0% | 100.0% |
| earthsci1086 | 6 | 9 | 6 | 100.0% | 100.0% |
| math1600b | 3 | 4 | 3 | 100.0% | 100.0% |
| phil1230 | 3 | 3 | 3 | 100.0% | 0.0% |
| writ1025f | 5 | 5 | 5 | 100.0% | 0.0% |

## Failure analysis (parser)

**missed** (1)
- cs1020a — zyBook exercises

**hallucinated** (7)
- cs1020a — Quizzes (series total)
- cs1020a — ZyBooks Participation Activities
- cs1026a — Orientation Quiz
- earthsci1086 — Academic Integrity Quiz
- earthsci1086 — ProctorTrack Onboarding
- earthsci1086 — Mid-Term Makeup Test
- math1600b — Homework Assignments

**wrong_type** (1)
- cs1026a — Labs: predicted assignment, expected other

**wrong_recurrence** (1)
- earthsci1086 — Graded Quizzes: no recurrence detected

# Resume Search Summarization, Pipeline, and UI Changes

## Overview

This document records the changes made for:

- Summarizing final search results.
- Completing the end-to-end retrieval-to-UI result data flow.
- Presenting candidate results and search status more clearly in the UI.

The work was implemented in approval-gated phases. Existing ingestion and search modes were preserved.

## Phase 1 — Summarize final results

- Chat searches request a short summary for each final candidate returned by the end-to-end search endpoint.
- The backend generates summaries only for candidates selected for the final response, after retrieval and reranking.
- Summaries use the existing configured LLM service and candidate evidence.
- If summary generation fails for any candidate, successfully ranked results are still returned. The backend marks the response degraded and adds the `SUMMARIZATION_FAILED` warning.

## Phase 2 — Complete the end-to-end result contract

The final backend response now includes relevant data carried through retrieval, deduplication, reranking, and summarization:

- Rank and resume ID.
- Candidate name, role, company, experience, and skills.
- Query-matched skills.
- Retrieval sources.
- Separate BM25 and vector scores where available.
- Rerank relevance score and explanation.
- Resume evidence snippet where available.
- Generated candidate summary where available.
- Pipeline warnings, degraded state, and timing data.

Matched skills are selected from the candidate's skills by checking whether a skill contains a term from the normalized search query. BM25 and vector scores remain separate; they are not combined into a fabricated score.

## Phase 3 — Clarify candidate result presentation

- Result cards explicitly label the relevance or rerank score.
- Missing experience is shown as “Experience not specified,” rather than as zero.
- Generated candidate summaries are shown separately from the existing fit narrative.
- Available BM25 and vector scores are labeled as retrieval scores.
- Candidate profiles distinguish matched skills from all resume skills and identify retrieval sources, reranking explanation, summary, and evidence.
- Removed repeated fit explanations from cards and profiles.
- Replaced inferred profile “fit” gauges with factual experience and skill counts.

## Phase 4 — Clarify pipeline and empty states

- Known warnings are translated into readable messages for BM25 retrieval, query embedding, vector search, reranking, and summarization failures.
- Partial-result warnings appear with the results, and pipeline health is marked degraded whenever warnings are present.
- An empty response with retrieval warnings is distinguished from a complete search that found no matches.
- Search progress and errors use status/alert semantics and polite/assertive live announcements for assistive technology.

## Changed files

### Backend

- `src/modules/retrieval/services/SearchService.ts`
- `src/modules/retrieval/services/SearchService.test.ts`
- `src/modules/retrieval/controllers/retrievalController.ts`
- `src/modules/retrieval/controllers/retrievalController.test.ts`

### Frontend

- `recruitbot-web/src/lib/stores/search.store.ts`
- `recruitbot-web/src/pages/ChatPage.tsx`
- `recruitbot-web/src/App.css`

## Validation

- Backend TypeScript build: passed.
- Focused backend retrieval service and controller tests: 2 suites, 40 tests passed.
- Frontend production build: passed after the UI changes.
- Frontend lint: completed with five warnings in `ChatPage.tsx` concerning existing `Date` usage and unnecessary escapes.
- Diagnostics for the changed UI and pipeline files: no errors found.
- Browser smoke test: not completed because the browser connection timed out.

## Notes

- Search remains routed through the existing end-to-end `/v1/search` pipeline.
- The existing Vector, BM25, and Hybrid modes remain in place.
- Summary generation is automatic for final results and may increase search latency and LLM usage.
- The browser presentation was build- and diagnostics-validated, but could not be interactively verified in the integrated browser during this work.

# Resume Retrieval Re-ranking Implementation

## Scope

This change adds re-ranking to the existing resume retrieval experience. It preserves the existing ingestion flow, retrieval modes, search endpoints, and configured LLM provider. No new model provider, embedding pipeline, database, or dependency was introduced.

## Implementation phases

### Phase 1 — Connect retrieval to re-ranking

- The Chat search flow sends its selected retrieval mode to the existing `POST /v1/search` end-to-end endpoint.
- The backend supports Vector, BM25, and Hybrid candidate retrieval before re-ranking.
- Vector mode reranks only vector-retrieved candidates.
- BM25 mode reranks only BM25-retrieved candidates.
- Hybrid mode combines candidates from both retrieval lists and reranks the resulting pool.
- Search result limits are passed through to the backend.

### Phase 2 — Show ranking in the portal

- Ranked results retain the order returned by the backend.
- Candidate cards show the candidate's rank and rerank score.
- Candidate profiles distinguish the rerank score from retrieval-specific scores.

### Phase 3 — Refine relevance criteria

The existing reranking prompt instructs the configured model to:

- Prioritize explicitly required skills, role responsibilities, and experience requirements.
- Treat preferred qualifications as secondary.
- Use supplied resume evidence and metadata without inventing missing qualifications.
- Avoid rewarding keyword mentions without relevant context.
- Return a concise, evidence-based reason and a score between 0 and 1.

### Phase 4 — Validate behavior

Regression checks cover:

- Vector, BM25, and Hybrid retrieval followed by reranking.
- Hybrid candidate input from both retrieval lists.
- Reranking score ordering and final result limits.
- Empty retrieval, where the reranker is not called.
- Reranking failure or incomplete output, where retrieval order is returned with a degraded warning.

## Request and response flow

```text
Chat query and selected search mode
              |
              v
       POST /v1/search
              |
              v
Selected retrieval: Vector, BM25, or Hybrid
              |
              v
        Retrieved candidates
              |
              v
 Existing Groq-backed reranker
              |
              v
 Rank-ordered results with relevance scores
              |
              v
       Candidate cards/profile
```

The standalone endpoints (`/v1/search/vector`, `/v1/search/bm25`, `/v1/search/hybrid`, and `/v1/search/rerank`) remain available.

## Failure handling

- When retrieval returns no candidates, the reranker is skipped.
- If the reranker fails or returns an incomplete ranking, the backend returns candidates in their original retrieval order, marks the response as degraded, and includes `LLM_RERANK_FAILED`.
- The Chat status area displays a warning when reranking could not be completed.
- Retrieval scores and rerank relevance scores use distinct fields; the UI presents the rerank score for ranked responses.

## Files changed

### Backend

- `src/modules/retrieval/types/retrieval.types.ts`
- `src/modules/retrieval/services/SearchService.ts`
- `src/modules/retrieval/services/LLMService.ts`
- `src/modules/retrieval/controllers/retrievalController.ts`
- Related retrieval tests under `src/modules/retrieval/`

### Frontend

- `recruitbot-web/src/lib/stores/search.store.ts`
- `recruitbot-web/src/pages/ChatPage.tsx`
- `recruitbot-web/src/App.css`

## Validation results

- Backend TypeScript build: passed.
- Backend tests: 14 suites and 80 tests passed.
- Frontend production build: passed.
- Frontend lint: completed with five warnings in `ChatPage.tsx` on existing lines.
- Browser smoke checks: confirmed selected mode is sent, results render in ranked order, and rank/rerank-score indicators are visible.

## Configuration and secrets

Re-ranking uses the existing LLM service configuration. No secrets or values from `.env` are included in this document.

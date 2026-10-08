# Resume Search Deduplication Implementation

## Scope

This change prevents the same resume from appearing more than once in search results while preserving retrieval behavior and keeping distinct resumes separate.

Two results are considered duplicates only when their `resumeId` values match after trimming surrounding whitespace and converting the IDs to lowercase. Matching names or profile fields alone do not make two results duplicates. Results without a resume ID are retained individually.

## Implementation phases

### Phase 1 — Deduplicate frontend search results

- Normalize search results in the frontend by resume ID.
- Merge duplicate candidate metadata, skills, matched skills, sources, scores, and evidence snippets.
- Keep the first candidate's ordering and compact ranked results after duplicates are removed.

### Phase 2 — Normalize resume ID comparisons

- Treat resume IDs with different capitalization or surrounding whitespace as the same ID.
- Preserve the original displayed ID while using its normalized form for duplicate matching.
- Keep candidates with different IDs separate.

### Phase 3 — Cover remaining retrieval paths

- Apply the shared backend deduplicator to individual BM25 and vector results as well as vector results returned through Hybrid search.
- Continue deduplicating the combined Hybrid candidate pool before reranking.
- Reject duplicate IDs submitted to the direct reranking endpoint, including IDs differing only by case.

### Phase 4 — Align metadata merging

- Treat blank text and the placeholder `Not specified in resume` as missing metadata in the frontend, matching backend merge behavior.
- When a duplicate has useful metadata where another has a placeholder, retain the useful value.

## Merge behavior

When duplicate entries are combined:

- Keep useful candidate name, role, and company values; replace placeholders with useful values.
- Fill missing experience and retrieval scores from another duplicate when available.
- Combine distinct skills, job titles, matched skills, and retrieval sources.
- Retain the longer available evidence snippet.
- Preserve candidate order and compact the displayed ranks for ranked responses.

The backend does not combine BM25 and vector score values into one retrieval score; each score remains associated with its own retrieval source.

## Files changed

### Backend

- `src/modules/retrieval/utils/deduplicate.ts`
- `src/modules/retrieval/utils/deduplicate.test.ts`
- `src/modules/retrieval/services/SearchService.ts`
- `src/modules/retrieval/services/SearchService.test.ts`
- `src/modules/retrieval/controllers/retrievalController.ts`
- `src/modules/retrieval/controllers/retrievalController.test.ts`

### Frontend

- `recruitbot-web/src/lib/stores/search.store.ts`

## Validation results

- Backend TypeScript build: passed.
- Focused backend retrieval tests after Phase 3: 7 suites and 69 tests passed.
- Frontend production build after Phase 4: passed.
- Frontend lint after Phase 4: completed with five warnings in `ChatPage.tsx`.
- Browser smoke check after Phase 4: confirmed case-insensitive duplicate results render as one candidate, useful metadata replaces placeholder text, and the displayed rank is compacted.

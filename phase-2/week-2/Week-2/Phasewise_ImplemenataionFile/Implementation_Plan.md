# Codemark AI — Phase-wise Implementation Plan

## Executive Overview
Codemark AI is a GitHub repository and folder review dashboard designed for users who want AI-based validation of project health, code quality, security, maintainability, and recommendations based on live GitHub URLs. The platform accepts GitHub repo, folder, or file URLs, sends the request to an n8n webhook, and displays a structured review result in a premium dark-mode interface.

The system is built as a lightweight front-end experience using HTML, CSS, and JavaScript, while the review intelligence can be powered through n8n, GitHub APIs, and an LLM-based analysis workflow. This keeps the review dynamic, context-aware, and tied to the actual repository structure behind the URL instead of static mock data.

---

## Architecture Blueprint

```text
+-------------------------------------+          +---------------------------------------+
|  Frontend UI (HTML/CSS/JS)         |          |  n8n Workflow Engine                  |
|                                     |          |                                       |
|  - Dark premium dashboard           |  POST    |  1. Webhook Trigger                   |
|  - GitHub URL input                 |  ---->   |  2. Validate URL / Extract repo info |
|  - Review button + state handling   |  JSON    |  3. GitHub API fetch                 |
|  - Score table + summary output     |  <----   |  4. Filter folder / file context     |
|  - Loading / error / success states |          |  5. Send to AI review node           |
|                                     |          |  6. Return structured analysis       |
+-------------------------------------+          +---------------------------------------+
```

---

## Implementation Phases

### Phase 1: Brand System & Core Layout Design
* Establish the Codemark identity:
  * Primary theme: dark obsidian background with premium blue gradients
  * Accent colors: electric blue, cyan, soft violet highlights
  * Typography: IBM Plex Sans / Sora / IBM Plex Mono for UI and technical blocks
* Build a two-column dashboard:
  * Left: URL input, review button, scopes, validation area
  * Right: review workspace and result output
* Maintain a premium, modern, code-review look consistent with the existing app design.

### Phase 2: Navigation & Status Mechanics
* Add a sticky glassmorphism-style header:
  * Brand name: Veridian Systems / Codemark
  * Navigation items: Dashboard, Repositories, Review History, Docs
* Add status indicators:
  * Codemark Engine Online
  * GitHub Sync Active/Inactive
* Keep the experience focused on review workflows and quick repo evaluation.

### Phase 3: Input Controls & Validation
* Add a single GitHub URL input field to accept:
  * repo URL
  * folder URL
  * file URL
  * raw GitHub content links
* Apply validation rules:
  * empty value → error card
  * invalid URL → form error state
  * valid URL → proceed to loading state
* Keep all validation logic in the JavaScript file with no inline JavaScript in the HTML.

### Phase 4: Workflow Integration with n8n
* Configure a webhook endpoint:
  * POST /webhook/codemark-code-reviewer
* The frontend sends:
  * fileUrl
* n8n workflow steps:
  1. Receive webhook payload
  2. Parse GitHub URL
  3. Extract owner, repo, branch, and folder path
  4. Call GitHub API to fetch repository metadata and tree
  5. Filter files to the selected folder
  6. Detect file types and project structure
  7. Send relevant file context to the AI review node
  8. Return review JSON to the frontend
* The result should contain:
  * summary
  * folder details
  * score table
  * recommendation
  * category breakdown

### Phase 5: Loading States and Error Handling
* Loading state behavior:
  * lock input and button
  * change workspace card to loading state
  * cycle through:
    * Fetching source file...
    * Contacting GitHub...
    * Scanning the code...
    * Scoring code quality and security...
    * Compiling recommendations...
* Error handling:
  * failed fetch
  * timeout
  * invalid response
  * server unreachable
* In all such cases:
  * show a clear error card
  * re-enable the form
  * remove the loading state
  * avoid leaving the page stuck

### Phase 6: Review Rendering and Score Output
* Render:
  * Summary section
  * Folder Details
  * Category-wise evaluation
  * Review Score table
  * Recommendation section
* The values must be derived from the actual repository or folder being reviewed.
* The UI must not show static placeholders for:
  * Code Quality
  * Security
  * Best Practices
  * Performance
  * Maintainability
  * Recommendation

### Phase 7: Dynamic Data Standards
* All visible evaluation values must come from live GitHub data or the n8n AI result.
* Document-heavy folders should score lower in code-oriented categories if they contain mostly Excel, Word, or PDF files rather than actual implementation code.
* The review must be context-sensitive to the selected GitHub URL and its actual folder contents.

---

## Functional Flow

1. User enters a GitHub repo/folder/file URL.
2. User clicks Review File or presses Enter.
3. Frontend validates the URL.
4. If invalid, show validation error and stop.
5. If valid, set loading state and animate the status ticker.
6. Frontend sends a POST request to /webhook/codemark-code-reviewer.
7. n8n extracts GitHub context and reviews the repository/folder content.
8. Frontend receives the result in a defensive format:
   * string
   * object with review
   * nested array
9. Frontend extracts the review text and renders it in the workspace.
10. Score table and summary update dynamically.
11. On failure, clear error card shows the connection issue and form is re-enabled.

---

## Success Criteria
* URL validation works as expected.
* Loading animation and status messages rotate correctly.
* No static review output is displayed.
* Review score values update from the actual repo/folder data.
* n8n endpoint integration is handled cleanly.
* Error states are clear and recoverable.
* The dashboard remains polished and consistent with the Codemark design language.

---

## Approval Summary
This implementation plan is aligned with the actual Codemark reviewer workflow and is ready for execution in the next development phase.

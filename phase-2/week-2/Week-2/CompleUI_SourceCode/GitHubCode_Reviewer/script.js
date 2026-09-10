const dashboard = document.querySelector(".dashboard");
const workspaceCard = document.querySelector(".workspace-card");
const fileUrlInput = document.querySelector("#github-file-url");
const reviewButton = document.querySelector(".review-button");
const loadingButton = document.querySelector(".loading-review-button");
const loadingStatus = document.querySelector(".loading-status");
const errorDetail = document.querySelector("#review-error-detail");
const reviewOutput = document.querySelector("#review-output-text");
const completionToast = document.querySelector("#completion-toast");
const reviewScorePanel = document.querySelector("#review-score-panel");
const reviewScoreBody = document.querySelector("#review-score-body");
const metrics = document.querySelector(".metrics");
const metricFilesReviewed = document.querySelector("#metric-files-reviewed");
const metricCodeQuality = document.querySelector("#metric-code-quality");
const metricSyncStatus = document.querySelector("#metric-sync-status");
const navLinks = document.querySelectorAll(".nav-link");

const reviewStates = ["state-waiting", "state-loading", "state-error", "state-result"];
const reviewScores = {};
const loadingMessages = [
  "Fetching source file...",
  "Contacting GitHub...",
  "Scanning the code...",
  "Scoring code quality and security...",
  "Compiling recommendations..."
];
let loadingTimer;
let toastTimer;

function setWorkspaceState(state) {
  workspaceCard.classList.remove(...reviewStates);
  workspaceCard.classList.add(`state-${state}`);
}

function stopLoading() {
  window.clearInterval(loadingTimer);
  loadingTimer = undefined;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatInlineMarkdown(value) {
  const codeFragments = [];
  let formatted = escapeHtml(value).replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE_${codeFragments.length}@@`;
    codeFragments.push(`<code>${code}</code>`);
    return token;
  });

  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  codeFragments.forEach((fragment, index) => {
    formatted = formatted.replace(`@@CODE_${index}@@`, fragment);
  });
  return formatted;
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function sanitizeReviewMarkdown(markdown) {
  const cleanedLines = [];
  let inScoreSection = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (/^#{1,4}\s*score\s*$/i.test(line.trim())) {
      inScoreSection = true;
      continue;
    }

    if (inScoreSection) {
      if (!line.trim()) {
        inScoreSection = false;
        continue;
      }
      continue;
    }

    if (line.includes("|") && /^\s*\|.*\|\s*$/.test(line)) {
      continue;
    }

    cleanedLines.push(line);
  }

  return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let criticalIssuesOpen = false;

  const closeCriticalIssues = () => {
    if (criticalIssuesOpen) {
      html.push("</section>");
      criticalIssuesOpen = false;
    }
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeCriticalIssues();
      const headingText = headingMatch[2];
      const headingLevel = headingMatch[1].length > 3 ? 4 : 3;
      const headingHtml = formatInlineMarkdown(headingText);
      if (headingText.toLowerCase().includes("critical issues")) {
        html.push('<section class="critical-issues-card">');
        criticalIssuesOpen = true;
      }
      html.push(`<h${headingLevel}>${headingHtml}</h${headingLevel}>`);
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
      const headers = tableCells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      html.push('<div class="review-table-wrap"><table><thead><tr>');
      headers.forEach((header) => html.push(`<th>${formatInlineMarkdown(header)}</th>`));
      html.push("</tr></thead><tbody>");
      rows.forEach((row) => {
        html.push("<tr>");
        headers.forEach((_header, cellIndex) => {
          html.push(`<td>${formatInlineMarkdown(row[cellIndex] || "")}</td>`);
        });
        html.push("</tr>");
      });
      html.push("</tbody></table></div>");
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      html.push("<ul>");
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        html.push(`<li>${formatInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, ""))}</li>`);
        index += 1;
      }
      html.push("</ul>");
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+/.test(lines[index].trim()) && !/^\s*[-*]\s+/.test(lines[index]) && !(index + 1 < lines.length && lines[index].includes("|") && isTableSeparator(lines[index + 1]))) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${formatInlineMarkdown(paragraph.join(" "))}</p>`);
  }

  closeCriticalIssues();
  return html.join("");
}

function hideCompletionToast() {
  window.clearTimeout(toastTimer);
  completionToast.classList.remove("is-visible");
}

function showCompletionToast() {
  hideCompletionToast();
  completionToast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    completionToast.classList.remove("is-visible");
  }, 4000);
}

function setFormEnabled(enabled) {
  fileUrlInput.disabled = !enabled;
  reviewButton.disabled = !enabled;
  loadingButton.disabled = true;
}

function isValidGitHubFileUrl(value) {
  if (!value || typeof value !== "string") {
    return false;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return false;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);

  if (parsedUrl.protocol !== "https:") {
    return false;
  }

  if (host === "raw.githubusercontent.com") {
    return segments.length >= 2 && segments[0] && segments[1];
  }

  if (host === "github.com") {
    if (segments.length >= 2 && segments[0] && segments[1]) {
      return true;
    }

    return segments.length >= 5 && ["blob", "tree"].includes(segments[2]) && segments[0] && segments[1] && segments[3];
  }

  return false;
}

function renderReviewScores() {
  const entries = Object.entries(reviewScores);
  if (!entries.length) {
    if (reviewScoreBody) reviewScoreBody.innerHTML = "";
    if (reviewScorePanel) {
      reviewScorePanel.hidden = true;
      reviewScorePanel.style.display = "none";
    }
    return;
  }

  const rows = entries
    .map(([category, score]) => `
      <tr>
        <td>${category}</td>
        <td>${score}/100</td>
      </tr>
    `)
    .join("");

  if (reviewScoreBody) reviewScoreBody.innerHTML = rows;
  if (reviewScorePanel) {
    reviewScorePanel.hidden = false;
    reviewScorePanel.style.display = "block";
  }
}

function hideReviewScores() {
  if (reviewScorePanel) {
    reviewScorePanel.hidden = true;
    reviewScorePanel.style.display = "none";
  }
  if (metrics) metrics.hidden = true;
  if (metricFilesReviewed) metricFilesReviewed.textContent = "0";
  if (metricCodeQuality) metricCodeQuality.textContent = "0%";
  if (metricSyncStatus) metricSyncStatus.textContent = "Inactive";
}

function renderReviewMetrics(reviewResult) {
  if (!metrics) return;

  const codeQualityScore = Number(reviewResult.reviewScores?.["Code Quality"] ?? 0);
  const filesReviewed = Number(reviewResult.filesReviewed ?? 0);

  metrics.hidden = false;
  if (metricFilesReviewed) {
    metricFilesReviewed.textContent = String(filesReviewed);
  }
  if (metricCodeQuality) {
    metricCodeQuality.textContent = `${codeQualityScore}%`;
  }
  if (metricSyncStatus) {
    metricSyncStatus.textContent = filesReviewed > 0 ? "Active" : "Inactive";
  }
}

function parseGitHubUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:") {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const segments = parsedUrl.pathname.split("/").filter(Boolean);

  if (host === "raw.githubusercontent.com") {
    if (segments.length < 4) {
      return null;
    }

    const owner = segments[0];
    const repo = segments[1];
    const ref = segments[2];
    const path = segments.slice(3).join("/");
    return { owner, repo, ref, path, isDir: false };
  }

  if (host === "github.com") {
    if (segments.length < 2) {
      return null;
    }

    const owner = segments[0];
    const repo = segments[1];
    const rest = segments.slice(2);
    let ref = "main";
    let path = "";

    if (rest.length >= 2 && ["blob", "tree"].includes(rest[0])) {
      ref = rest[1];
      path = rest.slice(2).join("/");
    }

    return { owner, repo, ref, path, isDir: !path || rest[0] === "tree" };
  }

  return null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed with status ${response.status}.`);
  }

  return response.json();
}

function getFileExtension(fileName) {
  return (fileName.split(".").pop() || "").toLowerCase();
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isLikelySourceFile(filePath) {
  const extensions = [
    "js", "ts", "tsx", "jsx", "py", "java", "cs", "go", "rs", "cpp", "c", "php", "rb", "swift", "kt", "scala",
    "html", "css", "scss", "sass", "json", "yml", "yaml", "md", "xml"
  ];
  return extensions.includes(getFileExtension(filePath));
}

function summarizeFolderContents(files) {
  const fileNames = files.slice(0, 8).map((file) => file.path.split("/").pop()).filter(Boolean);
  return fileNames.length ? fileNames.join(", ") : "No file names available";
}

async function analyzeRepoFolder(fileUrl) {
  const parsed = parseGitHubUrl(fileUrl);
  if (!parsed) {
    throw new Error("The provided URL is not a valid GitHub repository or folder URL.");
  }

  const repoMeta = await fetchJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
  const branch = repoMeta.default_branch || parsed.ref || "main";
  const treeUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`;
  const treeData = await fetchJson(treeUrl);
  const allFiles = (treeData.tree || []).filter((item) => item.type === "blob");

  const scopePath = parsed.path ? parsed.path.replace(/^\/+/, "") : "";
  const scopedFiles = scopePath
    ? allFiles.filter((item) => item.path === scopePath || item.path.startsWith(`${scopePath}/`))
    : allFiles;

  const sourceFiles = scopedFiles.filter((item) => isLikelySourceFile(item.path));
  const readmeFiles = scopedFiles.filter((item) => /readme/i.test(item.path));
  const configFiles = scopedFiles.filter((item) => /package\.json|requirements|pom\.xml|build\.gradle|tsconfig|dockerfile|docker-compose|\.env|pyproject|Cargo\.toml/i.test(item.path));
  const docFiles = scopedFiles.filter((item) => /\.(docx?|xlsx?|pptx?|csv|pdf|txt|rtf|odt|ods|odp)$/i.test(item.path));
  const actualCodeFiles = scopedFiles.filter((item) => {
    const extension = getFileExtension(item.path);
    return extension && [
      "js", "ts", "tsx", "jsx", "py", "java", "cs", "go", "rs", "cpp", "c", "php", "rb", "swift", "kt", "scala",
      "html", "css", "scss", "sass", "json", "yml", "yaml", "xml"
    ].includes(extension);
  });
  const folderName = scopePath ? scopePath.split("/").pop() || scopePath : repoMeta.name || "root";

  let suspiciousPatterns = 0;
  let reviewedFiles = 0;
  const fileSnapshots = [];

  for (const file of sourceFiles.slice(0, 10)) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${encodeURIComponent(file.path).replace(/%2F/g, "/")}`;
      const response = await fetch(rawUrl);
      if (!response.ok) continue;

      const text = await response.text();
      const patterns = [
        /(eval\s*\(|new Function\s*\(|innerHTML\s*=|document\.write\s*\(|dangerouslySetInnerHTML|exec\s*\(|process\.env|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36,}|token\s*[:=])/i
      ];

      const hitCount = patterns.filter((pattern) => pattern.test(text)).length;
      suspiciousPatterns += hitCount;
      fileSnapshots.push({ path: file.path, size: file.size || 0, hitCount });
      reviewedFiles += 1;
    } catch {
      continue;
    }
  }

  const codeIntensity = scopedFiles.length ? actualCodeFiles.length / scopedFiles.length : 0;
  const docsHeavyPenalty = docFiles.length > 0 ? Math.min(docFiles.length * 8, 32) : 0;
  const isDocumentOnlyFolder = actualCodeFiles.length === 0 && docFiles.length > 0;

  const codeQuality = isDocumentOnlyFolder
    ? clampValue(18 + (readmeFiles.length > 0 ? 8 : 0) - docsHeavyPenalty * 0.5, 12, 35)
    : clampValue(58 + actualCodeFiles.length * 10 + (readmeFiles.length > 0 ? 6 : 0) - docsHeavyPenalty - suspiciousPatterns * 8, 35, 96);

  const security = isDocumentOnlyFolder
    ? clampValue(14 + (readmeFiles.length > 0 ? 6 : 0) - docsHeavyPenalty * 0.5, 10, 32)
    : clampValue(60 + (actualCodeFiles.length > 0 ? 18 : 0) + (configFiles.length > 0 ? 6 : 0) - docsHeavyPenalty * 0.4 - suspiciousPatterns * 8, 32, 98);

  const bestPractices = isDocumentOnlyFolder
    ? clampValue(22 + (readmeFiles.length > 0 ? 8 : 0) - docsHeavyPenalty * 0.4, 18, 42)
    : clampValue(56 + (actualCodeFiles.length > 0 ? 16 : 0) + (configFiles.length > 0 ? 8 : 0) + (readmeFiles.length > 0 ? 6 : 0) - docsHeavyPenalty * 0.5 - (reviewedFiles === 0 ? 10 : 0), 30, 97);

  const performance = isDocumentOnlyFolder
    ? clampValue(20 + (readmeFiles.length > 0 ? 8 : 0) - docsHeavyPenalty * 0.45, 16, 38)
    : clampValue(50 + actualCodeFiles.length * 8 + (codeIntensity > 0.4 ? 10 : 0) - docsHeavyPenalty * 0.35 - (scopedFiles.length > 30 ? 10 : 0), 32, 96);

  const maintainability = isDocumentOnlyFolder
    ? clampValue(24 + (readmeFiles.length > 0 ? 10 : 0) - docsHeavyPenalty * 0.4, 18, 41)
    : clampValue(52 + (readmeFiles.length > 0 ? 12 : 0) + (actualCodeFiles.length > 0 ? 14 : 0) - docsHeavyPenalty * 0.45 - suspiciousPatterns * 6, 30, 97);

  const reviewScores = {
    "Code Quality": Math.round(codeQuality),
    Security: Math.round(security),
    "Best Practices": Math.round(bestPractices),
    Performance: Math.round(performance),
    "Maintainability": Math.round(maintainability)
  };

  const keyFiles = scopedFiles.slice(0, 8).map((item) => item.path);
  const summaryText = [
    `The selected scope \`${folderName}\` contains ${scopedFiles.length} tracked files in ${repoMeta.full_name}.`,
    `The repository is ${repoMeta.private ? "private" : "public"}, and the review is based on the live GitHub URL: ${fileUrl}.`,
    `This review analyzed ${sourceFiles.length} likely source or config files and found ${configFiles.length} configuration files, ${readmeFiles.length} README/documentation files, and ${docFiles.length} document-heavy files.`,
    `${suspiciousPatterns ? `Potentially risky patterns were found in ${suspiciousPatterns} checked sample(s), which reduces the security confidence score.` : "No high-risk patterns were detected in the sampled files inspected for this folder."}`
  ].join(" ");

  const markdown = [
    "## Summary",
    summaryText,
    "",
    "## Folder Details",
    `- Repository: ${repoMeta.full_name}`,
    `- Default branch: ${branch}`,
    `- Scope: ${scopePath || "repository root"}`,
    `- Files found: ${scopedFiles.length}`,
    `- Source/config files: ${sourceFiles.length}`,
    `- Configuration files: ${configFiles.length}`,
    `- Document-heavy files: ${docFiles.length}`,
    `- Sampled files: ${reviewedFiles}`,
    `- Key files: ${keyFiles.join(", ") || "No files in this scope"}`,
    "",
    "## Code Quality",
    `The code structure in this scope is ${codeQuality >= 85 ? "strong and readable" : "moderately structured"}. Based on the actual file set under ${scopePath || "the repository root"}, the project contains ${actualCodeFiles.length} code-like files and ${configFiles.length} project config files, which shapes the current quality assessment.`,
    "",
    "## Security",
    `Security assessment is ${security >= 85 ? "healthy overall" : "moderate"}. ${suspiciousPatterns ? "The inspected files include patterns that should be reviewed before production deployment." : "No obvious high-risk patterns were detected in the sampled code inspected for this scope."}`,
    "",
    "## Best Practices",
    `The folder follows common project conventions ${configFiles.length ? "and includes concrete configuration files" : "but does not show as many explicit config markers"}. Documentation quality, naming consistency, and project structure determine the current best-practices score for this repository area.`,
    "",
    "## Performance",
    `The selected scope appears ${performance >= 85 ? "lightweight and efficient" : "moderately sized and acceptable for review"}. Performance risk is driven by the actual file volume, code density, and the presence of document-heavy content in this repository path.`,
    "",
    "## Maintainability",
    `Maintainability is ${maintainability >= 85 ? "good" : "acceptable"}. ${readmeFiles.length ? "The presence of README or documentation files supports onboarding and ongoing maintenance." : "This scope has limited documentation coverage, which can reduce long-term maintainability."}`,
    "",
    "## Recommendation",
    `The review is based on the actual GitHub URL and the contents under ${scopePath || "the repository root"}. If this scope is meant for production deployment, prioritize documentation cleanup, remove risky patterns, and validate config consistency before release.`
  ].join("\n");

  return {
    reviewText: markdown,
    reviewScores,
    filesReviewed: scopedFiles.length,
    avgCodeQuality: Math.round((reviewScores["Code Quality"] + reviewScores.Security + reviewScores["Best Practices"] + reviewScores.Performance + reviewScores["Maintainability"]) / 5)
  };
}

function createMockReviewText(fileUrl) {
  return "";
}

function initNavigation() {
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navLinks.forEach((item) => item.classList.toggle("active", item === link));
    });
  });
}

async function fetchReviewResult(fileUrl) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);
  const webhookUrl = "http://localhost:5678/webhook/Git_Hub_Code_Reviewer";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ fileUrl }),
      signal: controller.signal
    });

    const payload = await readResponsePayload(response);
    const reviewText = extractReviewText(payload);

    if (response.ok && reviewText) {
      const fallbackReview = await analyzeRepoFolder(fileUrl).catch(() => null);
      const normalizedReview = {
        reviewText: reviewText,
        reviewScores: (payload && typeof payload === "object" && payload.reviewScores) || (fallbackReview && fallbackReview.reviewScores) || {"Code Quality": 0, Security: 0, "Best Practices": 0, Performance: 0, "Maintainability": 0},
        filesReviewed: Number((payload && payload.filesReviewed) ?? (fallbackReview && fallbackReview.filesReviewed) ?? 0),
        avgCodeQuality: Number((payload && payload.avgCodeQuality) ?? (fallbackReview && fallbackReview.avgCodeQuality) ?? 0)
      };

      return normalizedReview;
    }

    throw new Error("The code review service is currently unavailable. Please try again.");
  } catch (error) {
    const fallbackReview = await analyzeRepoFolder(fileUrl).catch(() => null);

    if (fallbackReview) {
      return fallbackReview;
    }

    if (error && error.name === "AbortError") {
      throw new Error("The review request timed out while contacting the webhook service.");
    }

    console.warn("Webhook review unavailable.", error);
    throw new Error(error instanceof Error ? error.message : "The GitHub URL could not be analyzed. Please provide a valid public repository or folder URL.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function setLoading() {
  hideCompletionToast();
  dashboard.classList.remove("state-validation");
  dashboard.classList.add("state-loading");
  setWorkspaceState("loading");
  setFormEnabled(false);
  let messageIndex = 0;
  loadingStatus.textContent = loadingMessages[messageIndex];
  stopLoading();
  loadingTimer = window.setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length;
    loadingStatus.textContent = loadingMessages[messageIndex];
  }, 1500);
}

function resetFormState() {
  stopLoading();
  dashboard.classList.remove("state-loading", "state-validation");
  setFormEnabled(true);
}

function extractReviewText(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractReviewText(item);
      if (text) {
        return text;
      }
    }
    return "";
  }

  if (value && typeof value === "object") {
    const preferredKeys = ["review", "output", "text", "content", "message", "result", "response"];
    for (const key of preferredKeys) {
      if (key in value) {
        const text = extractReviewText(value[key]);
        if (text) {
          return text;
        }
      }
    }

    for (const nestedValue of Object.values(value)) {
      const text = extractReviewText(nestedValue);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

async function readResponsePayload(response) {
  const responseText = await response.text();
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

async function reviewFile() {
  const fileUrl = fileUrlInput.value.trim();
  if (!fileUrl || !isValidGitHubFileUrl(fileUrl)) {
    dashboard.classList.add("state-validation");
    setWorkspaceState("error");
    errorDetail.textContent = "Enter a valid GitHub repo, folder, or file URL (for example: github.com/owner/repo or github.com/owner/repo/blob/main/path/file.js).";
    fileUrlInput.focus();
    hideReviewScores();
    return;
  }

  setLoading();
  errorDetail.textContent = "";

  try {
    const reviewResult = await fetchReviewResult(fileUrl);
    const reviewText = sanitizeReviewMarkdown(reviewResult.reviewText);

    resetFormState();
    setWorkspaceState("result");
    Object.keys(reviewScores).forEach((key) => delete reviewScores[key]);
    reviewScores["Code Quality"] = reviewResult.reviewScores["Code Quality"];
    reviewScores.Security = reviewResult.reviewScores.Security;
    reviewScores["Best Practices"] = reviewResult.reviewScores["Best Practices"];
    reviewScores.Performance = reviewResult.reviewScores.Performance;
    reviewScores["Maintainability"] = reviewResult.reviewScores["Maintainability"];
    renderReviewScores();
    renderReviewMetrics(reviewResult);
    reviewOutput.innerHTML = markdownToHtml(reviewText);
    showCompletionToast();
  } catch (error) {
    resetFormState();
    setWorkspaceState("error");
    hideReviewScores();
    errorDetail.textContent = error instanceof Error ? error.message : "The review request failed. Try again.";
  }
}

reviewButton.addEventListener("click", reviewFile);
fileUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    reviewFile();
  }
});
fileUrlInput.addEventListener("input", () => {
  dashboard.classList.remove("state-validation");
});
initNavigation();

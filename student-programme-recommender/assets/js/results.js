"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("resultsContainer");
  const emptyState = document.getElementById("emptyState");
  const summary = document.getElementById("resultSummary");
  const greeting = document.getElementById("greeting");
  const clearButton = document.getElementById("clearResults");

  if (!container || !emptyState || !summary || !greeting || !clearButton) {
    console.error("The results page is missing one or more required elements.");
    return;
  }

  function read(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.warn(`Could not read ${key} from local storage.`, error);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save ${key}.`, error);
      alert("Your browser could not save this change. Please try again.");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function readIdList(key) {
    const value = read(key, []);
    return Array.isArray(value)
      ? [...new Set(value.map(String))]
      : [];
  }

  function validScore(value) {
    const score = Number(value);
    return Number.isFinite(score)
      ? Math.max(0, Math.min(100, score))
      : 0;
  }

  function formatComponent(value) {
    if (value === null || value === undefined || value === "") {
      return "Not available";
    }

    const number = Number(value);
    return Number.isFinite(number)
      ? `${Math.max(0, Math.min(100, number))}%`
      : "Not available";
  }

  const profile = read("pathfinder.studentProfile", {});
  const recommendations = read("pathfinder.recommendations", []);

  if (profile && profile.studentName) {
    greeting.textContent =
      `${String(profile.studentName)}'s programme recommendations`;
  } else {
    greeting.textContent = "Your programme recommendations";
  }

  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    emptyState.classList.remove("d-none");
    summary.textContent = "No recommendation results are available.";
    container.innerHTML = "";
    return;
  }

  let catalogue = [];

  try {
    if (!window.PathFinderData?.loadProgrammes) {
      throw new Error("The shared programme data module is unavailable.");
    }

    catalogue = await window.PathFinderData.loadProgrammes();

    if (!Array.isArray(catalogue)) {
      throw new Error("The programme catalogue is invalid.");
    }
  } catch (error) {
    console.error("Could not load the shared programme catalogue.", error);
    emptyState.classList.remove("d-none");
    summary.textContent = "Programme data could not be loaded.";
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">
          Unable to load the latest programme catalogue. Check your local server and data file, then refresh this page.
        </div>
      </div>`;
    return;
  }

  // Use the latest catalogue details wherever the programme still exists.
  const catalogueById = new Map(
    catalogue.map(programme => [String(programme.id), programme])
  );

  const matchedRecommendations = recommendations
    .map(item => {
      if (!item || typeof item !== "object") return null;

      const id = item.programmeId ?? item.id;
      if (id === null || id === undefined || String(id).trim() === "") {
        return null;
      }

      const programme = catalogueById.get(String(id));
      if (!programme) return null;

      return {
        ...item,
        programmeId: String(programme.id),
        title: programme.title || item.title || "Untitled programme",
        institution: programme.institution || item.institution || "Institution not specified",
        field: programme.field || item.field || "General",
        qualificationLevel:
          programme.qualificationLevel || item.qualificationLevel || "Not specified",
        verificationStatus:
          programme.verificationStatus || item.verificationStatus || "illustrative"
      };
    })
    .filter(Boolean);

  const unavailableCount =
    recommendations.length - matchedRecommendations.length;

  if (matchedRecommendations.length === 0) {
    emptyState.classList.remove("d-none");
    summary.textContent = "No current recommendations match the programme catalogue.";
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">
          Your previous recommendations may refer to programmes that have been removed or changed. Complete the assessment again to generate updated results.
        </div>
        <a href="assessment.html" class="btn btn-primary">
          Retake assessment
        </a>
      </div>`;
    return;
  }

  emptyState.classList.add("d-none");

  summary.textContent =
    `${matchedRecommendations.length} programmes ranked by profile compatibility.`;

  container.innerHTML = `
    ${unavailableCount > 0 ? `
      <div class="col-12">
        <div class="alert alert-warning">
          ${unavailableCount} previous recommendation${unavailableCount === 1 ? " was" : "s were"} omitted because ${unavailableCount === 1 ? "it no longer matches" : "they no longer match"} the current catalogue. Retake the assessment for updated results.
        </div>
      </div>` : ""}

    ${matchedRecommendations.map((item, index) => {
      const score = validScore(item.compatibility);
      const components =
        item.components && typeof item.components === "object"
          ? item.components
          : {};

      const explanations = Array.isArray(item.explanations)
        ? item.explanations.filter(reason => typeof reason === "string" && reason.trim())
        : [];

      const componentRows = [
        ["Preferred qualification level", components.academicLevel],
        ["Subjects", components.subjects],
        ["Interests", components.interests],
        ["Career goals", components.careers],
        ["Skills", components.skills]
      ].map(([label, value]) => `
        <div class="d-flex justify-content-between gap-3 small py-1">
          <span class="text-secondary">${escapeHTML(label)}</span>
          <span class="fw-semibold">${escapeHTML(formatComponent(value))}</span>
        </div>
      `).join("");

      const statusLabels = {
        verified: "Verified",
        review: "Under review",
        illustrative: "Illustrative"
      };

      const statusClasses = {
        verified: "text-bg-success",
        review: "text-bg-warning",
        illustrative: "text-bg-secondary"
      };

      const status = String(item.verificationStatus).toLowerCase();
      const statusLabel = statusLabels[status] || "Unverified";
      const statusClass = statusClasses[status] || "text-bg-secondary";

      const saved = readIdList("pathfinder.savedProgrammes")
        .includes(String(item.programmeId));

      const compared = readIdList("pathfinder.comparison")
        .includes(String(item.programmeId));

      const eligibilityMessage =
        typeof item.eligibilityStatus === "string" && item.eligibilityStatus.trim()
          ? item.eligibilityStatus
          : "This compatibility score does not confirm admission eligibility. Check the institution's official entry requirements.";

      return `
        <div class="col-12">
          <article class="card border-0 shadow-sm p-3 p-md-4">
            <div class="d-flex flex-wrap justify-content-between gap-3">
              <div class="d-flex gap-3">
                <div
                  class="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0"
                  style="width: 48px; height: 48px;"
                  aria-label="Rank ${index + 1}">
                  <span class="fw-bold">${index + 1}</span>
                </div>
                <div>
                  <span class="badge text-bg-light border mb-2">
                    Rank ${index + 1}
                  </span>
                  <h2 class="h4 mb-1">${escapeHTML(item.title)}</h2>
                  <p class="text-secondary mb-1">
                    ${escapeHTML(item.institution)}
                  </p>
                  <p class="small text-secondary mb-0">
                    ${escapeHTML(item.field)} · ${escapeHTML(item.qualificationLevel)}
                  </p>
                </div>
              </div>

              <div class="text-md-end">
                <div class="h3 fw-bold mb-0">${score}%</div>
                <div class="text-secondary small">Compatibility score</div>
              </div>
            </div>

            <div
              class="progress my-3"
              style="height: 8px;"
              role="progressbar"
              aria-label="Programme compatibility"
              aria-valuenow="${score}"
              aria-valuemin="0"
              aria-valuemax="100">
              <div
                class="progress-bar"
                style="width: ${scoreWidth(score)}%; background: #0f9d91;">
              </div>
            </div>

            <div class="row g-4 mt-1">
              <div class="col-lg-7">
                <h3 class="h6 fw-bold">Why this programme was recommended</h3>
                ${explanations.length ? `
                  <ul class="ps-3 mb-3">
                    ${explanations.map(reason =>
                      `<li class="mb-1">${escapeHTML(reason)}</li>`
                    ).join("")}
                  </ul>` : `
                  <p class="small text-secondary">
                    No detailed explanation is available for this recommendation.
                  </p>`}

                <h3 class="h6 fw-bold">Admission information</h3>
                <p class="small text-secondary mb-2">
                  ${escapeHTML(eligibilityMessage)}
                </p>
                <span class="badge ${statusClass}">
                  Data status: ${escapeHTML(statusLabel)}
                </span>
              </div>

              <div class="col-lg-5">
                <h3 class="h6 fw-bold">Score breakdown</h3>
                ${componentRows}
              </div>
            </div>

            <div class="mt-3 pt-3 border-top d-flex flex-wrap gap-2">
              <a
                class="btn btn-primary btn-sm"
                href="details.html?id=${encodeURIComponent(item.programmeId)}">
                View programme
              </a>

              <button
                type="button"
                class="btn btn-outline-primary btn-sm save-button"
                data-programme-id="${escapeHTML(item.programmeId)}"
                aria-pressed="${saved}">
                <i class="bi ${saved ? "bi-bookmark-check" : "bi-bookmark"} me-1"
                   aria-hidden="true"></i>
                ${saved ? "Saved" : "Save programme"}
              </button>

              <button
                type="button"
                class="btn btn-outline-secondary btn-sm compare-button"
                data-programme-id="${escapeHTML(item.programmeId)}"
                aria-pressed="${compared}">
                <i class="bi ${compared ? "bi-check2" : "bi-arrow-left-right"} me-1"
                   aria-hidden="true"></i>
                ${compared ? "Added to comparison" : "Add to comparison"}
              </button>
            </div>
          </article>
        </div>`;
    }).join("")}
  `;

  container.addEventListener("click", event => {
    const saveButton = event.target.closest(".save-button");
    const compareButton = event.target.closest(".compare-button");

    if (!saveButton && !compareButton) return;

    const button = saveButton || compareButton;
    const id = String(button.dataset.programmeId);

    if (saveButton) {
      const savedIds = readIdList("pathfinder.savedProgrammes");
      const alreadySaved = savedIds.includes(id);

      const updated = alreadySaved
        ? savedIds.filter(savedId => savedId !== id)
        : [...savedIds, id];

      if (!write("pathfinder.savedProgrammes", updated)) return;

      saveButton.setAttribute("aria-pressed", String(!alreadySaved));
      saveButton.innerHTML = alreadySaved
        ? '<i class="bi bi-bookmark me-1" aria-hidden="true"></i> Save programme'
        : '<i class="bi bi-bookmark-check me-1" aria-hidden="true"></i> Saved';

      return;
    }

    if (compareButton) {
      const comparisonIds = readIdList("pathfinder.comparison");

      if (comparisonIds.includes(id)) {
        window.location.href = "compare.html";
        return;
      }

      if (comparisonIds.length >= 3) {
        alert("You can compare up to three programmes. Remove one before adding another.");
        return;
      }

      if (!write("pathfinder.comparison", [...comparisonIds, id])) return;

      compareButton.setAttribute("aria-pressed", "true");
      compareButton.innerHTML =
        '<i class="bi bi-check2 me-1" aria-hidden="true"></i> Added to comparison';
    }
  });

  clearButton.addEventListener("click", () => {
    if (!confirm("Clear your saved assessment and recommendation results?")) {
      return;
    }

    try {
      localStorage.removeItem("pathfinder.recommendations");
      localStorage.removeItem("pathfinder.assessmentDraft");
      window.location.href = "assessment.html";
    } catch (error) {
      console.error("Could not clear assessment results.", error);
      alert("Unable to clear the results. Please try again.");
    }
  });
});

// Keep the compatibility display within the valid percentage range.
function scoreWidth(score) {
  return Math.max(0, Math.min(100, Number(score) || 0));
}
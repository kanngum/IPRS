"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("programmeGrid");
  const search = document.getElementById("searchInput");
  const field = document.getElementById("fieldFilter");
  const level = document.getElementById("levelFilter");
  const count = document.getElementById("catalogueCount");
  const empty = document.getElementById("emptyState");
  const reset = document.getElementById("resetFilters");

  if (!grid || !search || !field || !level || !count || !empty || !reset) {
    console.error("The catalogue page is missing one or more required elements.");
    return;
  }

  let programmes = [];

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[ch]);

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? [...new Set(value.map(String))] : [];
    } catch (error) {
      console.warn(`Could not read ${key} from local storage.`, error);
      return [];
    }
  }

  function writeArray(key, values) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify([...new Set(values.map(String))])
      );
      return true;
    } catch (error) {
      console.error(`Could not save ${key}.`, error);
      alert("Your browser could not save this change. Check available storage and try again.");
      return false;
    }
  }

  try {
    if (!window.PathFinderData?.loadProgrammes) {
      throw new Error("The shared programme data module is unavailable.");
    }

    programmes = await window.PathFinderData.loadProgrammes();

    if (!Array.isArray(programmes)) {
      throw new Error("The programme catalogue is not a valid array.");
    }
  } catch (error) {
    console.error("Catalogue loading failed:", error);

    grid.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">
          Could not load programme data. Start the local server from the project root and refresh.
        </div>
      </div>`;
    return;
  }

  // Populate filter options.
  const uniqueValues = key =>
    [...new Set(
      programmes
        .map(p => p[key])
        .filter(value => typeof value === "string" && value.trim())
    )].sort((a, b) => a.localeCompare(b));

  uniqueValues("field").forEach(value => {
    field.add(new Option(value, value));
  });

  uniqueValues("qualificationLevel").forEach(value => {
    level.add(new Option(value, value));
  });

  // Restore an optional search term from the URL.
  const params = new URLSearchParams(window.location.search);

  if (params.has("search")) {
    search.value = params.get("search") || "";
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const savedIds = readArray("pathfinder.savedProgrammes");
    const comparisonIds = readArray("pathfinder.comparison");

    const filtered = programmes.filter(p => {
      const searchable = [
        p.title,
        p.institution,
        p.faculty,
        p.department,
        p.field,
        p.qualificationLevel,
        p.description,
        ...(Array.isArray(p.requiredSubjects) ? p.requiredSubjects : []),
        ...(Array.isArray(p.interests) ? p.interests : []),
        ...(Array.isArray(p.skills) ? p.skills : []),
        ...(Array.isArray(p.careerPaths) ? p.careerPaths : []),
        ...(Array.isArray(p.keywords) ? p.keywords : [])
      ].join(" ").toLowerCase();

      return (
        searchable.includes(query) &&
        (!field.value || p.field === field.value) &&
        (!level.value || p.qualificationLevel === level.value)
      );
    });

    count.textContent =
      `${filtered.length} programme${filtered.length === 1 ? "" : "s"} found`;

    empty.classList.toggle("d-none", filtered.length !== 0);

    grid.innerHTML = filtered.map(p => {
      const id = String(p.id ?? "");
      const isSaved = savedIds.includes(id);
      const isCompared = comparisonIds.includes(id);

      const status = p.verificationStatus || "illustrative";
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

      return `
        <div class="col-md-6 col-xl-4">
          <article class="card h-100 border-0 shadow-sm p-3">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
              <span class="badge text-bg-light border">
                ${escapeHTML(p.field || "General")}
              </span>
              <i class="bi bi-mortarboard fs-4 text-primary" aria-hidden="true"></i>
            </div>

            <h2 class="h5 fw-bold">
              ${escapeHTML(p.title || "Untitled programme")}
            </h2>

            <p class="text-secondary small mb-2">
              ${escapeHTML(p.institution || "Institution not specified")}
            </p>

            <p class="small text-secondary">
              ${escapeHTML(p.description || "Description not available.")}
            </p>

            <div class="small mb-3">
              <div>
                <strong>Level:</strong>
                ${escapeHTML(p.qualificationLevel || "Not specified")}
              </div>
              <div>
                <strong>Duration:</strong>
                ${escapeHTML(p.duration || "Not specified")}
              </div>
              <div class="mt-2">
                <span class="badge ${statusClasses[status] || "text-bg-secondary"}">
                  ${escapeHTML(statusLabels[status] || "Unverified")}
                </span>
              </div>
            </div>

            <div class="mt-auto d-flex flex-wrap gap-2">
              <a class="btn btn-primary btn-sm"
                 href="details.html?id=${encodeURIComponent(id)}">
                View details
              </a>

              <button
                type="button"
                class="btn btn-outline-secondary btn-sm compare-btn"
                data-id="${escapeHTML(id)}"
                aria-pressed="${isCompared}">
                <i class="bi ${isCompared ? "bi-check2" : "bi-arrow-left-right"} me-1"
                   aria-hidden="true"></i>
                ${isCompared ? "Added" : "Compare"}
              </button>

              <button
                type="button"
                class="btn btn-outline-secondary btn-sm save-btn"
                data-id="${escapeHTML(id)}"
                aria-label="${isSaved ? "Unsave" : "Save"} ${escapeHTML(p.title)}"
                aria-pressed="${isSaved}"
                title="${isSaved ? "Remove saved programme" : "Save programme"}">
                <i class="bi ${isSaved ? "bi-bookmark-check" : "bi-bookmark"}"
                   aria-hidden="true"></i>
              </button>
            </div>
          </article>
        </div>`;
    }).join("");
  }

  grid.addEventListener("click", event => {
    const compareButton = event.target.closest(".compare-btn");
    const saveButton = event.target.closest(".save-btn");

    if (compareButton) {
      const id = String(compareButton.dataset.id);
      const ids = readArray("pathfinder.comparison");

      if (ids.includes(id)) {
        window.location.href = "compare.html";
        return;
      }

      if (ids.length >= 3) {
        alert("You can compare up to three programmes. Open comparison to review your selection.");
        return;
      }

      if (writeArray("pathfinder.comparison", [...ids, id])) {
        render();
      }

      return;
    }

    if (saveButton) {
      const id = String(saveButton.dataset.id);
      const ids = readArray("pathfinder.savedProgrammes");

      const updated = ids.includes(id)
        ? ids.filter(savedId => savedId !== id)
        : [...ids, id];

      if (writeArray("pathfinder.savedProgrammes", updated)) {
        render();
      }
    }
  });

  search.addEventListener("input", render);
  field.addEventListener("change", render);
  level.addEventListener("change", render);

  reset.addEventListener("click", () => {
    search.value = "";
    field.value = "";
    level.value = "";

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    render();
  });

  render();
});
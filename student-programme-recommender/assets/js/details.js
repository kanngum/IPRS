
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("detailsContent");

  if (!root) {
    console.error('Missing element: #detailsContent');
    return;
  }

  const STORAGE_KEYS = {
    saved: "pathfinder.savedProgrammes",
    comparison: "pathfinder.comparison"
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);

  const readArray = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.warn(`Could not read ${key}.`, error);
      return [];
    }
  };

  const writeArray = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save ${key}.`, error);
      alert("Your browser could not save this change. Check your browser storage settings.");
      return false;
    }
  };

  const list = (values) =>
    Array.isArray(values) && values.length
      ? `<ul class="mb-0">${values.map((value) =>
          `<li class="mb-1">${escapeHTML(value)}</li>`
        ).join("")}</ul>`
      : '<p class="text-secondary mb-0">Information not yet provided.</p>';

  const addUniqueId = (key, id) => {
    const selected = readArray(key).map(String);
    const normalizedId = String(id);

    if (!selected.includes(normalizedId)) {
      selected.push(normalizedId);
    }

    return writeArray(key, selected);
  };

  try {
    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
      root.innerHTML = `
        <div class="alert alert-warning">
          No programme was selected. Return to the
          <a href="catalogue.html">programme catalogue</a>.
        </div>`;
      return;
    }

    const programmes = await window.PathFinderData.loadProgrammes();
    const programme = programmes.find(
      (item) => String(item.id) === String(id)
    );

    if (!programme) {
      root.innerHTML = `
        <div class="alert alert-warning">
          Programme not found. It may have been removed from the catalogue.
          <a href="catalogue.html">Return to the catalogue</a>.
        </div>`;
      return;
    }

    const p = programme;
    const status = String(p.verificationStatus || "illustrative").toLowerCase();
    const isVerified = status === "verified";

    const statusClass = {
      verified: "text-bg-success",
      review: "text-bg-warning",
      illustrative: "text-bg-secondary"
    }[status] || "text-bg-secondary";

    const statusLabel = {
      verified: "Verified",
      review: "Under review",
      illustrative: "Illustrative / unverified"
    }[status] || "Unverified";

    document.title = `${p.title} | PathFinder`;

    root.innerHTML = `
      <div class="card border-0 shadow-sm p-4 p-md-5">
        <span class="badge text-bg-light border align-self-start mb-3">
          ${escapeHTML(p.field || "Programme")}
        </span>

        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h1 class="fw-bold">${escapeHTML(p.title)}</h1>
            <p class="fs-5 text-secondary">
              ${escapeHTML(p.institution || "Institution not specified")}
            </p>
          </div>
          <span class="badge ${statusClass}">
            ${escapeHTML(statusLabel)}
          </span>
        </div>

        <p class="mb-4">
          ${escapeHTML(p.description || "No description available.")}
        </p>

        <div class="row g-3 mb-4">
          <div class="col-md-4">
            <div class="bg-light rounded p-3 h-100">
              <div class="small text-secondary">Qualification</div>
              <strong>${escapeHTML(p.qualificationLevel || "Not specified")}</strong>
            </div>
          </div>
          <div class="col-md-4">
            <div class="bg-light rounded p-3 h-100">
              <div class="small text-secondary">Duration</div>
              <strong>${escapeHTML(p.duration || "Not specified")}</strong>
            </div>
          </div>
          <div class="col-md-4">
            <div class="bg-light rounded p-3 h-100">
              <div class="small text-secondary">Data status</div>
              <strong>${escapeHTML(statusLabel)}</strong>
            </div>
          </div>
        </div>

        <div class="row g-4">
          <section class="col-md-6">
            <h2 class="h5">Faculty and department</h2>
            <p>
              ${escapeHTML(p.faculty || "Not specified")}<br>
              ${escapeHTML(p.department || "Not specified")}
            </p>
          </section>

          <section class="col-md-6">
            <h2 class="h5">Required subject areas</h2>
            ${list(p.requiredSubjects)}
          </section>

          <section class="col-md-6">
            <h2 class="h5">Related interests</h2>
            ${list(p.interests)}
          </section>

          <section class="col-md-6">
            <h2 class="h5">Relevant skills</h2>
            ${list(p.skills)}
          </section>

          <section class="col-12">
            <h2 class="h5">Potential career paths</h2>
            ${list(p.careerPaths)}
          </section>

          ${
            Array.isArray(p.entryRequirements) && p.entryRequirements.length
              ? `<section class="col-12">
                   <h2 class="h5">Entry requirements</h2>
                   ${list(p.entryRequirements)}
                 </section>`
              : ""
          }
        </div>

        <div class="alert ${isVerified ? "alert-info" : "alert-warning"} mt-4 mb-0">
          <strong>Admission notice:</strong>
          ${
            isVerified && Array.isArray(p.entryRequirements) && p.entryRequirements.length
              ? "These published requirements should still be confirmed with the institution. This page does not determine your admission eligibility."
              : "Official entry requirements have not been verified here. Contact the institution to confirm its admission requirements and programme availability."
          }
        </div>

        <div class="d-flex flex-wrap gap-2 mt-4">
          <a href="assessment.html" class="btn btn-primary">
            Assess my compatibility
          </a>
          <button class="btn btn-outline-primary" id="saveProgramme" type="button">
            Save programme
          </button>
          <button class="btn btn-outline-secondary" id="compareProgramme" type="button">
            Add to comparison
          </button>
        </div>

        <div id="detailsActionMessage" class="small mt-3" aria-live="polite"></div>
      </div>`;

    const saveButton = document.getElementById("saveProgramme");
    const compareButton = document.getElementById("compareProgramme");
    const actionMessage = document.getElementById("detailsActionMessage");

    const savedIds = readArray(STORAGE_KEYS.saved).map(String);
    const comparisonIds = readArray(STORAGE_KEYS.comparison).map(String);

    if (savedIds.includes(String(p.id))) {
      saveButton.textContent = "Saved";
    }

    if (comparisonIds.includes(String(p.id))) {
      compareButton.textContent = "Already added";
    }

    saveButton.addEventListener("click", () => {
      const currentSaved = readArray(STORAGE_KEYS.saved).map(String);
      const alreadySaved = currentSaved.includes(String(p.id));

      if (!addUniqueId(STORAGE_KEYS.saved, p.id)) return;

      saveButton.textContent = "Saved";
      actionMessage.textContent = alreadySaved
        ? "This programme is already in your saved programmes."
        : "Programme saved successfully.";
      actionMessage.className = "small mt-3 text-success";
    });

    compareButton.addEventListener("click", () => {
      const selected = readArray(STORAGE_KEYS.comparison).map(String);
      const programmeId = String(p.id);

      if (selected.includes(programmeId)) {
        window.location.href = "compare.html";
        return;
      }

      if (selected.length >= 3) {
        actionMessage.textContent = "You can compare up to three programmes. Remove one from the comparison page first.";
        actionMessage.className = "small mt-3 text-danger";
        return;
      }

      if (!addUniqueId(STORAGE_KEYS.comparison, p.id)) return;

      window.location.href = "compare.html";
    });
  } catch (error) {
    console.error("Programme details error:", error);

    root.innerHTML = `
      <div class="alert alert-danger">
        Unable to load programme details. Check your local server,
        catalogue data and browser console.
      </div>`;
  }
});

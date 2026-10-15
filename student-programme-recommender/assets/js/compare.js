"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("comparisonContent");

  if (!root) {
    console.error('Comparison page is missing the "comparisonContent" element.');
    return;
  }

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[ch]);

  const readSelectedIds = () => {
    try {
      const value = JSON.parse(
        localStorage.getItem("pathfinder.comparison") || "[]"
      );

      if (!Array.isArray(value)) return [];

      return [...new Set(value.map(String))].slice(0, 3);
    } catch (error) {
      console.error("Could not read comparison selections.", error);
      return [];
    }
  };

  const formatList = value =>
    Array.isArray(value) && value.length
      ? value.map(item => String(item)).join(", ")
      : "Not provided";

  try {
    if (!window.PathFinderData?.loadProgrammes) {
      throw new Error("The shared programme data module is unavailable.");
    }

    const programmes = await window.PathFinderData.loadProgrammes();
    const selectedIds = readSelectedIds();

    const selected = selectedIds
      .map(id => programmes.find(p => String(p.id) === id))
      .filter(Boolean);

    // Remove IDs that no longer exist in the catalogue.
    const validIds = selected.map(p => String(p.id));

    try {
      localStorage.setItem(
        "pathfinder.comparison",
        JSON.stringify(validIds)
      );
    } catch (error) {
      console.warn("Could not update comparison selections.", error);
    }

    if (!selected.length) {
      root.innerHTML = `
        <div class="alert alert-info">
          You have not selected any programmes yet. Browse the catalogue
          and choose Compare on up to three programmes.
        </div>
        <a href="catalogue.html" class="btn btn-primary">
          Browse programmes
        </a>`;
      return;
    }

    const fields = [
      ["Institution", p => p.institution],
      ["Field", p => p.field],
      ["Qualification", p => p.qualificationLevel],
      ["Duration", p => p.duration],
      ["Description", p => p.description],
      ["Faculty", p => p.faculty],
      ["Department", p => p.department],
      ["Required subject areas", p => formatList(p.requiredSubjects)],
      ["Interests", p => formatList(p.interests)],
      ["Skills", p => formatList(p.skills)],
      ["Career paths", p => formatList(p.careerPaths)],
      [
        "Data status",
        p => {
          const status = p.verificationStatus || "illustrative";
          return status.charAt(0).toUpperCase() + status.slice(1);
        }
      ],
      [
        "Entry requirements",
        p =>
          p.verificationStatus === "verified" &&
          Array.isArray(p.entryRequirements) &&
          p.entryRequirements.length
            ? p.entryRequirements.join(", ")
            : "Not verified"
      ]
    ];

    root.innerHTML = `
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <p class="text-secondary mb-0">
          Comparing ${selected.length} of 3 possible programmes.
        </p>
        <button type="button" class="btn btn-sm btn-outline-danger" id="clearComparison">
          Clear comparison
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-bordered align-middle bg-white">
          <thead class="table-light">
            <tr>
              <th scope="col">Comparison</th>
              ${selected.map(p =>
                `<th scope="col">${escapeHTML(p.title || "Untitled programme")}</th>`
              ).join("")}
            </tr>
          </thead>
          <tbody>
            ${fields.map(([label, getValue]) => `
              <tr>
                <th scope="row">${escapeHTML(label)}</th>
                ${selected.map(p => `
                  <td>${escapeHTML(getValue(p) || "Not provided")}</td>
                `).join("")}
              </tr>
            `).join("")}

            <tr>
              <th scope="row">Actions</th>
              ${selected.map(p => `
                <td>
                  <div class="d-flex flex-wrap gap-2">
                    <a
                      class="btn btn-sm btn-outline-primary"
                      href="details.html?id=${encodeURIComponent(p.id)}">
                      Details
                    </a>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-danger remove-item"
                      data-id="${escapeHTML(p.id)}">
                      Remove
                    </button>
                  </div>
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>
      </div>

      <p class="small text-secondary">
        Comparison supports informed exploration only. Confirm programme
        details and admission requirements with the relevant institution.
      </p>`;

    root.addEventListener("click", event => {
      const removeButton = event.target.closest(".remove-item");
      const clearButton = event.target.closest("#clearComparison");

      if (!removeButton && !clearButton) return;

      try {
        if (clearButton) {
          localStorage.removeItem("pathfinder.comparison");
        } else {
          const idToRemove = removeButton.dataset.id;
          const remaining = readSelectedIds().filter(
            id => id !== String(idToRemove)
          );

          localStorage.setItem(
            "pathfinder.comparison",
            JSON.stringify(remaining)
          );
        }

        window.location.reload();
      } catch (error) {
        console.error("Could not update the comparison list.", error);
        alert("Unable to update your comparison. Please try again.");
      }
    });
  } catch (error) {
    console.error("Comparison loading failed:", error);
    root.innerHTML = `
      <div class="alert alert-danger">
        Could not load the comparison data. Check the programme catalogue
        and ensure the page is running through your local development server.
      </div>`;
  }
});
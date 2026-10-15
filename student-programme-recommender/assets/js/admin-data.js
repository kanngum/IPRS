
"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    message: $("#pageMessage"),
    currentCount: $("#currentCount"),
    verifiedCount: $("#verifiedCount"),
    lastOperation: $("#lastOperation"),
    importForm: $("#importForm"),
    jsonFile: $("#jsonFile"),
    importMode: $("#importMode"),
    validationResults: $("#validationResults"),
    exportBtn: $("#exportBtn"),
    restoreBtn: $("#restoreBtn")
  };

  let programmes = [];

  const arrayFields = [
    "requiredSubjects",
    "interests",
    "skills",
    "careerPaths",
    "keywords"
  ];

  const allowedStatuses = ["illustrative", "review", "verified"];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function showMessage(message, type = "info") {
    elements.message.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${escapeHTML(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert"
          aria-label="Close"></button>
      </div>
    `;
  }

  function updateSummary() {
    elements.currentCount.textContent = programmes.length;

    elements.verifiedCount.textContent = programmes.filter(
      (programme) => programme.verificationStatus === "verified"
    ).length;
  }

  function setLastOperation(value) {
    elements.lastOperation.textContent = value;
  }

  function validateProgrammes(input) {
    const errors = [];
    const warnings = [];
    const seenIds = new Set();

    if (!Array.isArray(input)) {
      return {
        valid: false,
        errors: ["The JSON root must be an array."],
        warnings,
        records: []
      };
    }

    if (input.length === 0) {
      errors.push("The imported catalogue is empty.");
    }

    const records = input.map((item, index) => {
      const row = index + 1;

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`Record ${row} must be a JSON object.`);
        return null;
      }

      const record = { ...item };

      const id = String(record.id ?? "").trim();
      const title = String(record.title ?? "").trim();
      const institution = String(record.institution ?? "").trim();

      if (!id) errors.push(`Record ${row}: missing programme ID.`);
      if (!title) errors.push(`Record ${row}: missing programme title.`);
      if (!institution) errors.push(`Record ${row}: missing institution.`);

      if (id) {
        if (seenIds.has(id)) {
          errors.push(`Record ${row}: duplicate ID "${id}".`);
        }
        seenIds.add(id);
      }

      record.id = id;
      record.title = title;
      record.institution = institution;

      for (const field of [
        "institutionId",
        "faculty",
        "department",
        "field",
        "qualificationLevel",
        "duration",
        "description"
      ]) {
        if (record[field] !== undefined && typeof record[field] !== "string") {
          errors.push(`Record ${row}: "${field}" must be a string.`);
        }
      }

      for (const field of arrayFields) {
        if (record[field] === undefined || record[field] === null) {
          record[field] = [];
        } else if (
          !Array.isArray(record[field]) ||
          !record[field].every((value) => typeof value === "string")
        ) {
          errors.push(`Record ${row}: "${field}" must be an array of strings.`);
        }
      }

      if (
        record.verificationStatus !== undefined &&
        !allowedStatuses.includes(record.verificationStatus)
      ) {
        errors.push(
          `Record ${row}: invalid verificationStatus "${record.verificationStatus}".`
        );
      }

      if (record.verificationStatus === undefined) {
        record.verificationStatus = "illustrative";
        warnings.push(
          `Record ${row}: verificationStatus defaulted to "illustrative".`
        );
      }

      return record;
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      records
    };
  }

  function renderValidation(result) {
    const errorHTML = result.errors.length
      ? `<div class="alert alert-danger py-2">
           <strong>${result.errors.length} error(s)</strong>
           <ul class="mb-0 mt-2">
             ${result.errors.map((error) => `<li>${escapeHTML(error)}</li>`).join("")}
           </ul>
         </div>`
      : `<div class="alert alert-success py-2">
           Validation passed: ${result.records.length} record(s).
         </div>`;

    const warningHTML = result.warnings.length
      ? `<div class="alert alert-warning py-2">
           <strong>Warnings</strong>
           <ul class="mb-0 mt-2">
             ${result.warnings.map((warning) => `<li>${escapeHTML(warning)}</li>`).join("")}
           </ul>
         </div>`
      : "";

    elements.validationResults.innerHTML = errorHTML + warningHTML;
  }

  function saveCatalogue(nextProgrammes) {
    window.PathFinderData.saveProgrammes(nextProgrammes);
    programmes = nextProgrammes;
    updateSummary();
  }

  function downloadJSON(data, filename) {
    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadCurrentCatalogue() {
    try {
      programmes = await window.PathFinderData.loadProgrammes();
      updateSummary();
    } catch (error) {
      console.error(error);
      showMessage(
        "Could not load the catalogue. Check data/programmes.json and run the project using a local web server.",
        "danger"
      );
    }
  }

  elements.importForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const file = elements.jsonFile.files[0];

    if (!file) {
      showMessage("Please select a JSON file.", "warning");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showMessage("The file exceeds the 10 MB import limit.", "warning");
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateProgrammes(parsed);

      renderValidation(result);

      if (!result.valid) {
        showMessage("Import cancelled. Correct the validation errors first.", "danger");
        return;
      }

      let nextProgrammes;

      if (elements.importMode.value === "replace") {
        nextProgrammes = result.records;
      } else {
        const merged = new Map(
          programmes.map((programme) => [String(programme.id), programme])
        );

        for (const programme of result.records) {
          merged.set(String(programme.id), programme);
        }

        nextProgrammes = Array.from(merged.values());
      }

      const confirmed = window.confirm(
        elements.importMode.value === "replace"
          ? `Replace the current catalogue with ${result.records.length} records? Export a backup first if needed.`
          : `Merge ${result.records.length} imported records into the current catalogue? Matching IDs will be updated.`
      );

      if (!confirmed) {
        showMessage("Import cancelled. No changes were saved.", "secondary");
        return;
      }

      saveCatalogue(nextProgrammes);
      setLastOperation("Import successful");
      showMessage(
        `Import complete. The catalogue now contains ${programmes.length} programme(s).`,
        "success"
      );
    } catch (error) {
      console.error(error);

      showMessage(
        error instanceof SyntaxError
          ? "The selected file is not valid JSON."
          : "Import failed. The catalogue was not saved.",
        "danger"
      );
    }
  });

  elements.exportBtn.addEventListener("click", () => {
    try {
      downloadJSON(programmes, "programmes-backup.json");
      setLastOperation("Backup exported");
      showMessage("Catalogue backup prepared for download.", "success");
    } catch (error) {
      console.error(error);
      showMessage("Could not export the catalogue.", "danger");
    }
  });

  elements.restoreBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Restore the original data/programmes.json file? This will replace your browser's locally saved catalogue."
    );

    if (!confirmed) return;

    try {
      const response = await fetch("../../data/programmes.json", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Could not fetch the original JSON file.");
      }

      const originalData = await response.json();
      const result = validateProgrammes(originalData);

      renderValidation(result);

      if (!result.valid) {
        showMessage("The original JSON file failed validation. Nothing was restored.", "danger");
        return;
      }

      saveCatalogue(result.records);
      setLastOperation("Original data restored");
      showMessage("The original catalogue has been restored.", "success");
    } catch (error) {
      console.error(error);
      showMessage(
        "Restore failed. Check that data/programmes.json exists and the site is running through a local web server.",
        "danger"
      );
    }
  });

  loadCurrentCatalogue();
})();

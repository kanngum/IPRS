"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("programmeForm");
  const table = document.getElementById("programmeTable");
  const search = document.getElementById("searchRecords");
  const statusFilter = document.getElementById("statusFilter");
  const recordCount = document.getElementById("recordCount");
  const messageArea = document.getElementById("messageArea");
  const cancelEdit = document.getElementById("cancelEdit");
  const formHeading = document.getElementById("formHeading");
  const saveButton = document.getElementById("saveButton");

  let programmes = [];

  const fieldIds = [
    "title",
    "institution",
    "institutionId",
    "faculty",
    "department",
    "field",
    "qualificationLevel",
    "duration",
    "description",
    "requiredSubjects",
    "interests",
    "skills",
    "careerPaths",
    "keywords",
    "verificationStatus"
  ];

  const arrayFields = [
    "requiredSubjects",
    "interests",
    "skills",
    "careerPaths",
    "keywords"
  ];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function showMessage(message, type = "success") {
    messageArea.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${escapeHTML(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert"
                aria-label="Close"></button>
      </div>
    `;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function splitList(value) {
    return value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }

  function getFieldValue(id) {
    return document.getElementById(id).value.trim();
  }

  function createSlug(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "programme";
  }

  function createUniqueId(title, existingId = "") {
    const base = createSlug(title);
    let candidate = base;
    let suffix = 2;

    while (programmes.some(programme =>
      String(programme.id) === candidate &&
      String(programme.id) !== String(existingId)
    )) {
      candidate = `${base}-${suffix++}`;
    }

    return candidate;
  }

  function statusLabel(status) {
    if (status === "verified") return "Verified";
    if (status === "review") return "Requires review";
    return "Illustrative / unverified";
  }

  function statusClass(status) {
    if (status === "verified") return "text-bg-success";
    if (status === "review") return "text-bg-warning";
    return "text-bg-secondary";
  }

  function persist() {
    window.PathFinderData.saveProgrammes(programmes);
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;

    const filtered = programmes.filter(programme => {
      const searchable = [
        programme.title,
        programme.institution,
        programme.institutionId,
        programme.faculty,
        programme.department,
        programme.field,
        programme.qualificationLevel,
        programme.duration,
        programme.description,
        ...(programme.requiredSubjects || []),
        ...(programme.interests || []),
        ...(programme.skills || []),
        ...(programme.careerPaths || []),
        ...(programme.keywords || [])
      ].join(" ").toLowerCase();

      const matchesQuery = searchable.includes(query);
      const matchesStatus = !selectedStatus ||
        (programme.verificationStatus || "illustrative") === selectedStatus;

      return matchesQuery && matchesStatus;
    });

    recordCount.textContent =
      `${filtered.length} of ${programmes.length} programme record${programmes.length === 1 ? "" : "s"}`;

    if (filtered.length === 0) {
      table.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-secondary py-5">
            No matching programmes found.
          </td>
        </tr>
      `;
      return;
    }

    table.innerHTML = filtered.map(programme => {
      const id = escapeHTML(programme.id);
      const status = programme.verificationStatus || "illustrative";

      return `
        <tr>
          <td class="ps-4">
            <div class="fw-semibold">${escapeHTML(programme.title || "Untitled")}</div>
            <div class="small text-secondary">
              ${escapeHTML(programme.institution || "Institution not specified")}
            </div>
          </td>

          <td>
            <div>${escapeHTML(programme.field || "Not specified")}</div>
            <div class="small text-secondary">
              ${escapeHTML(programme.qualificationLevel || "Level not specified")}
            </div>
          </td>

          <td>
            <span class="badge ${statusClass(status)}">
              ${escapeHTML(statusLabel(status))}
            </span>
          </td>

          <td class="text-end pe-4">
            <div class="d-inline-flex gap-1">
              <button type="button"
                      class="btn btn-sm btn-outline-primary edit-btn"
                      data-id="${id}"
                      aria-label="Edit ${escapeHTML(programme.title)}"
                      title="Edit">
                <i class="bi bi-pencil"></i>
              </button>

              <button type="button"
                      class="btn btn-sm btn-outline-danger delete-btn"
                      data-id="${id}"
                      aria-label="Delete ${escapeHTML(programme.title)}"
                      title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function resetFormState() {
    form.reset();
    document.getElementById("programmeId").value = "";
    formHeading.textContent = "Add a programme";
    saveButton.innerHTML =
      '<i class="bi bi-check2-circle me-2"></i>Save programme';
    cancelEdit.classList.add("d-none");
  }

  function beginEdit(id) {
    const programme = programmes.find(
      item => String(item.id) === String(id)
    );

    if (!programme) {
      showMessage("The selected programme could not be found.", "danger");
      return;
    }

    document.getElementById("programmeId").value = String(programme.id);

    fieldIds.forEach(id => {
      const input = document.getElementById(id);
      const value = programme[id];

      if (arrayFields.includes(id)) {
        input.value = Array.isArray(value) ? value.join(", ") : "";
      } else if (id === "verificationStatus") {
        input.value = value || "illustrative";
      } else {
        input.value = value ?? "";
      }
    });

    formHeading.textContent = "Edit programme";
    saveButton.innerHTML =
      '<i class="bi bi-check2-circle me-2"></i>Update programme';
    cancelEdit.classList.remove("d-none");

    form.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("title").focus();
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const editingId = document.getElementById("programmeId").value;

    const title = getFieldValue("title");
    const institution = getFieldValue("institution");
    const field = getFieldValue("field");
    const qualificationLevel = getFieldValue("qualificationLevel");
    const description = getFieldValue("description");

    if (!title || !institution || !field ||
        !qualificationLevel || !description) {
      showMessage("Complete all required fields before saving.", "danger");
      return;
    }

    const existing = editingId
      ? programmes.find(item => String(item.id) === editingId)
      : null;

    if (editingId && !existing) {
      showMessage("This programme no longer exists. Refresh and try again.", "danger");
      return;
    }

    const record = {
      ...(existing || {}),
      id: existing
        ? existing.id
        : createUniqueId(title),
      title,
      institution,
      institutionId: getFieldValue("institutionId"),
      faculty: getFieldValue("faculty"),
      department: getFieldValue("department"),
      field,
      qualificationLevel,
      duration: getFieldValue("duration"),
      description,
      requiredSubjects: splitList(getFieldValue("requiredSubjects")),
      interests: splitList(getFieldValue("interests")),
      skills: splitList(getFieldValue("skills")),
      careerPaths: splitList(getFieldValue("careerPaths")),
      keywords: splitList(getFieldValue("keywords")),
      verificationStatus: getFieldValue("verificationStatus")
    };

    try {
      if (existing) {
        programmes = programmes.map(item =>
          String(item.id) === editingId ? record : item
        );
      } else {
        programmes.push(record);
      }

      persist();
      render();
      resetFormState();

      showMessage(
        existing
          ? "Programme updated successfully."
          : "Programme added successfully."
      );
    } catch (error) {
      console.error(error);
      showMessage(
        "Could not save the programme. Check your browser storage settings.",
        "danger"
      );
    }
  });

  table.addEventListener("click", event => {
    const editButton = event.target.closest(".edit-btn");
    const deleteButton = event.target.closest(".delete-btn");

    if (editButton) {
      beginEdit(editButton.dataset.id);
      return;
    }

    if (deleteButton) {
      const id = deleteButton.dataset.id;
      const programme = programmes.find(
        item => String(item.id) === String(id)
      );

      if (!programme) return;

      const confirmed = window.confirm(
        `Delete "${programme.title}"? This removes it from this browser's catalogue.`
      );

      if (!confirmed) return;

      const previous = programmes;
      programmes = programmes.filter(
        item => String(item.id) !== String(id)
      );

      try {
        persist();
        render();

        if (document.getElementById("programmeId").value === String(id)) {
          resetFormState();
        }

        showMessage("Programme deleted.");
      } catch (error) {
        programmes = previous;
        console.error(error);
        showMessage("Could not delete the programme.", "danger");
        render();
      }
    }
  });

  search.addEventListener("input", render);
  statusFilter.addEventListener("change", render);

  cancelEdit.addEventListener("click", resetFormState);
  document.getElementById("clearForm").addEventListener("click", resetFormState);
  form.addEventListener("reset", () => {
    document.getElementById("programmeId").value = "";
    formHeading.textContent = "Add a programme";
    saveButton.innerHTML =
      '<i class="bi bi-check2-circle me-2"></i>Save programme';
    cancelEdit.classList.add("d-none");
  });

  document.getElementById("exportButton").addEventListener("click", () => {
    try {
      const blob = new Blob(
        [JSON.stringify(programmes, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "programmes-backup.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      showMessage("Programme catalogue exported.");
    } catch (error) {
      console.error(error);
      showMessage("Could not export the programme catalogue.", "danger");
    }
  });

  try {
    programmes = await window.PathFinderData.loadProgrammes();
    render();
  } catch (error) {
    console.error(error);

    table.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-danger py-5">
          Could not load programmes. Start the local server from the project root and refresh.
        </td>
      </tr>
    `;

    recordCount.textContent = "Catalogue unavailable";
    showMessage("Failed to load programme data.", "danger");
  }
});
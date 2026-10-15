"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);

  const requiredElements = [
    "welcomeHeading",
    "savedCount",
    "recommendationCount",
    "comparisonCount",
    "lastAssessment",
    "recommendationList",
    "savedList",
    "clearStudentData"
  ];

  const missingElements = requiredElements.filter(id => !$(id));

  if (missingElements.length) {
    console.error("Dashboard elements are missing:", missingElements);
    return;
  }

  function read(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.warn(`Could not read ${key}.`, error);
      return fallback;
    }
  }

  function readIds(key) {
    const value = read(key, []);

    return Array.isArray(value)
      ? [...new Set(value.map(String))]
      : [];
  }

  function writeIds(key, ids) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify([...new Set(ids.map(String))])
      );
      return true;
    } catch (error) {
      console.error(`Could not save ${key}.`, error);
      alert("Unable to save this change. Please try again.");
      return false;
    }
  }

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[ch]);

  function emptyMessage(message, link = null, label = null) {
    return `
      <div class="col-12">
        <p class="text-secondary mb-2">${escapeHTML(message)}</p>
        ${link ? `
          <a class="btn btn-sm btn-outline-primary" href="${link}">
            ${escapeHTML(label || "Explore")}
          </a>` : ""}
      </div>`;
  }

  function formatDate(value) {
    if (!value) return "Not completed";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatScore(value) {
    const score = Number(value);

    if (!Number.isFinite(score)) return "Not available";

    return `${Math.max(0, Math.min(100, score))}%`;
  }

  try {
    if (!window.PathFinderData?.loadProgrammes) {
      throw new Error("The shared programme data module is unavailable.");
    }

    const programmes = await window.PathFinderData.loadProgrammes();

    if (!Array.isArray(programmes)) {
      throw new Error("The programme catalogue is invalid.");
    }

    const profile = read("pathfinder.studentProfile", {});
    const rawRecommendations = read("pathfinder.recommendations", []);
    const savedIds = readIds("pathfinder.savedProgrammes");
    const comparisonIds = readIds("pathfinder.comparison");

    const recommendations = Array.isArray(rawRecommendations)
      ? rawRecommendations
          .filter(item => item && typeof item === "object")
          .map(item => {
            const id = item.programmeId ?? item.id;

            if (id === null || id === undefined) return null;

            const programme = programmes.find(
              p => String(p.id) === String(id)
            );

            if (!programme) return null;

            return {
              ...item,
              programmeId: String(programme.id),
              title: programme.title || item.title || "Untitled programme",
              institution: programme.institution ||
                item.institution ||
                "Institution not specified"
            };
          })
          .filter(Boolean)
      : [];

    const catalogueById = new Map(
      programmes.map(p => [String(p.id), p])
    );

    const saved = savedIds
      .map(id => catalogueById.get(id))
      .filter(Boolean);

    const validComparisonIds = comparisonIds.filter(
      id => catalogueById.has(id)
    );

    // Keep stored IDs aligned with the current catalogue.
    if (saved.length !== savedIds.length) {
      writeIds("pathfinder.savedProgrammes", saved.map(p => p.id));
    }

    if (validComparisonIds.length !== comparisonIds.length) {
      writeIds("pathfinder.comparison", validComparisonIds);
    }

    const studentName =
      typeof profile?.studentName === "string"
        ? profile.studentName.trim()
        : "";

    $("welcomeHeading").textContent = studentName
      ? `Welcome back, ${studentName}`
      : "Your dashboard";

    $("savedCount").textContent = saved.length;
    $("recommendationCount").textContent = recommendations.length;
    $("comparisonCount").textContent = validComparisonIds.length;

    $("lastAssessment").textContent = formatDate(profile?.completedAt);

    // Recent top recommendations.
    $("recommendationList").innerHTML = recommendations.length
      ? recommendations.slice(0, 3).map(item => `
          <div class="col-md-4">
            <article class="border rounded p-3 h-100">
              <div class="small text-secondary mb-1">Compatibility</div>
              <div class="h4 fw-bold">
                ${escapeHTML(formatScore(item.compatibility))}
              </div>
              <h3 class="h6">${escapeHTML(item.title)}</h3>
              <p class="small text-secondary">
                ${escapeHTML(item.institution)}
              </p>
              <a
                class="btn btn-sm btn-outline-primary"
                href="details.html?id=${encodeURIComponent(item.programmeId)}">
                Explore programme
              </a>
            </article>
          </div>
        `).join("")
      : emptyMessage(
          "Complete an assessment to see your recommendations here.",
          "assessment.html",
          "Start assessment"
        );

    // Saved programmes.
    $("savedList").innerHTML = saved.length
      ? saved.map(p => `
          <div class="col-md-6 col-lg-4">
            <article class="border rounded p-3 h-100">
              <h3 class="h6 fw-bold">
                ${escapeHTML(p.title || "Untitled programme")}
              </h3>
              <p class="small text-secondary">
                ${escapeHTML(p.institution || "Institution not specified")}
              </p>
              <div class="d-flex flex-wrap gap-2">
                <a
                  class="btn btn-sm btn-outline-primary"
                  href="details.html?id=${encodeURIComponent(p.id)}">
                  View details
                </a>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger unsave-btn"
                  data-id="${escapeHTML(p.id)}">
                  Remove
                </button>
              </div>
            </article>
          </div>
        `).join("")
      : emptyMessage(
          "You have not saved any programmes yet. Browse the catalogue to save options.",
          "catalogue.html",
          "Browse catalogue"
        );

    $("savedList").addEventListener("click", event => {
      const button = event.target.closest(".unsave-btn");
      if (!button) return;

      const id = String(button.dataset.id);
      const updated = readIds("pathfinder.savedProgrammes")
        .filter(savedId => savedId !== id);

      if (writeIds("pathfinder.savedProgrammes", updated)) {
        window.location.reload();
      }
    });

    $("clearStudentData").addEventListener("click", () => {
      const confirmed = confirm(
        "Clear your PathFinder profile, assessment, recommendations, saved programmes and comparison list from this browser?"
      );

      if (!confirmed) return;

      try {
        [
          "pathfinder.studentProfile",
          "pathfinder.assessmentDraft",
          "pathfinder.recommendations",
          "pathfinder.savedProgrammes",
          "pathfinder.comparison"
        ].forEach(key => localStorage.removeItem(key));

        window.location.reload();
      } catch (error) {
        console.error("Could not clear student data.", error);
        alert("Unable to clear all student data. Please try again.");
      }
    });
  } catch (error) {
    console.error("Dashboard loading failed:", error);

    const main = document.querySelector("main");

    if (main) {
      main.insertAdjacentHTML(
        "afterbegin",
        `<div class="alert alert-danger">
          Unable to load dashboard data. Check the local server and programme catalogue, then refresh.
        </div>`
      );
    }
  }
});
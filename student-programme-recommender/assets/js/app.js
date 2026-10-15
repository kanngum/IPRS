
"use strict";

/**
 * PathFinder application foundation.
 * Shared utilities will be used by all application pages.
 */

const PathFinder = (() => {
  const STORAGE_KEYS = Object.freeze({
    profile: "pathfinder.studentProfile",
    assessment: "pathfinder.assessmentDraft",
    recommendations: "pathfinder.recommendations",
    savedProgrammes: "pathfinder.savedProgrammes",
    comparison: "pathfinder.comparison",
    adminData: "pathfinder.adminData"
  });

  function readStorage(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.warn(`Unable to read local data for ${key}.`, error);
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Unable to save local data for ${key}.`, error);
      return false;
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Unable to remove local data for ${key}.`, error);
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");

    if (!container) {
      console.info(message);
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-bg-${type} border-0`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const row = document.createElement("div");
    row.className = "d-flex";

    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = message;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn-close btn-close-white me-2 m-auto";
    close.setAttribute("data-bs-dismiss", "toast");
    close.setAttribute("aria-label", "Close");

    row.append(body, close);
    toast.append(row);
    container.append(toast);

    if (window.bootstrap?.Toast) {
      const instance = new bootstrap.Toast(toast, {
        delay: 3500
      });

      toast.addEventListener("hidden.bs.toast", () => toast.remove());
      instance.show();
    } else {
      toast.classList.add("show");
      window.setTimeout(() => toast.remove(), 3500);
    }
  }

  function initialise() {
    const year = document.getElementById("currentYear");

    if (year) {
      year.textContent = String(new Date().getFullYear());
    }

    document.querySelectorAll("[data-current-page]").forEach(link => {
      const current = link.dataset.currentPage;
      const page = window.location.pathname.split("/").pop() || "index.html";

      if (current === page) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  return {
    STORAGE_KEYS,
    readStorage,
    writeStorage,
    removeStorage,
    escapeHTML,
    showToast,
    initialise
  };
})();

window.PathFinder = PathFinder;

document.addEventListener("DOMContentLoaded", PathFinder.initialise);

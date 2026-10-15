"use strict";

window.PathFinderData = (() => {
  const STORAGE_KEY = "pathfinder.programmes";

  async function loadProgrammes() {
    // Prefer the admin-managed catalogue saved in this browser.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved !== null) {
        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) {
          throw new Error("The locally saved catalogue is not a JSON array.");
        }

        return parsed;
      }
    } catch (error) {
      console.error("Could not read the locally saved catalogue:", error);
      throw error;
    }

    // Try the correct relative paths for each page depth.
    const paths = [
      new URL("../../data/programmes.json", document.baseURI).href,
      new URL("../data/programmes.json", document.baseURI).href,
      new URL("data/programmes.json", document.baseURI).href
    ];

    const attempted = new Set();
    const errors = [];

    for (const url of paths) {
      if (attempted.has(url)) continue;
      attempted.add(url);

      try {
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          errors.push(`${url}: HTTP ${response.status}`);
          continue;
        }

        const programmes = await response.json();

        if (!Array.isArray(programmes)) {
          errors.push(`${url}: expected a JSON array`);
          continue;
        }

        return programmes;
      } catch (error) {
        errors.push(`${url}: ${error.message}`);
      }
    }

    throw new Error(
      "Could not load data/programmes.json. " + errors.join(" | ")
    );
  }

  function saveProgrammes(programmes) {
    if (!Array.isArray(programmes)) {
      throw new Error("Programme data must be an array.");
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(programmes));
  }

  return { loadProgrammes, saveProgrammes };
})();
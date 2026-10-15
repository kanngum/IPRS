
"use strict";

window.PathFinderRecommendation = (() => {
  const WEIGHTS = {
    academics: 0.30,
    subjects: 0.20,
    interests: 0.20,
    careers: 0.20,
    skills: 0.10
  };

  function normalise(value) {
    return String(value || "").trim().toLowerCase();
  }

  function matchScore(selected, programmeItems) {
    const choices = (selected || []).map(normalise).filter(Boolean);
    const options = (programmeItems || []).map(normalise).filter(Boolean);

    if (!choices.length || !options.length) {
      return null;
    }

    const matched = choices.filter(choice =>
      options.some(option =>
        option.includes(choice) || choice.includes(option)
      )
    );

    return Math.round((matched.length / choices.length) * 100);
  }

  function calculate(programme, profile) {
    const subjectScore = matchScore(
      profile.subjects,
      programme.requiredSubjects
    );

    const interestScore = matchScore(
      profile.interests,
      programme.interests
    );

    const careerScore = matchScore(
      profile.careers,
      programme.careerPaths
    );

    const skillScore = matchScore(
      profile.skills,
      programme.skills
    );

    // Academic level is a preference match, not an admission decision.
    const preferredLevel = normalise(profile.preferredLevel);
    const programmeLevel = normalise(programme.qualificationLevel);

    const academicLevelScore =
      !preferredLevel || preferredLevel === "any"
        ? 100
        : programmeLevel.includes(preferredLevel) ||
          preferredLevel.includes(programmeLevel)
          ? 100
          : 0;

    const components = [
      { key: "academics", score: academicLevelScore, weight: WEIGHTS.academics },
      { key: "subjects", score: subjectScore, weight: WEIGHTS.subjects },
      { key: "interests", score: interestScore, weight: WEIGHTS.interests },
      { key: "careers", score: careerScore, weight: WEIGHTS.careers },
      { key: "skills", score: skillScore, weight: WEIGHTS.skills }
    ];

    // Do not penalise students for optional sections they leave blank.
    const available = components.filter(item => item.score !== null);
    const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);

    const compatibility = totalWeight
      ? Math.round(
          available.reduce(
            (sum, item) => sum + item.score * item.weight,
            0
          ) / totalWeight
        )
      : 0;

    const explanations = [];

    if (subjectScore !== null) {
      explanations.push(
        subjectScore >= 50
          ? "Your selected subjects align with this programme's listed subject areas."
          : "Check how your subjects relate to this programme's listed subject areas."
      );
    }

    if (interestScore !== null) {
      explanations.push(
        interestScore >= 50
          ? "Your interests align with this programme's subject areas."
          : "This programme may be less aligned with your selected interests."
      );
    }

    if (careerScore !== null) {
      explanations.push(
        careerScore >= 50
          ? "Your career preferences align with listed career paths."
          : "Some of your preferred career paths are not listed for this programme."
      );
    }

    if (skillScore !== null) {
      explanations.push(
        skillScore >= 50
          ? "Your current skills match some listed programme-related skills."
          : "You may need to develop additional skills for this field."
      );
    }

    if (!explanations.length) {
      explanations.push(
        "Add subjects, interests, career goals or skills for a more informative comparison."
      );
    }

    const requirementsVerified =
      programme.verificationStatus === "verified" &&
      Array.isArray(programme.entryRequirements) &&
      programme.entryRequirements.length > 0;

    return {
      programmeId: programme.id,
      title: programme.title,
      institution: programme.institution,
      compatibility,
      components: {
        academicLevel: academicLevelScore,
        subjects: subjectScore,
        interests: interestScore,
        careers: careerScore,
        skills: skillScore
      },
      explanations,
      eligibilityStatus: requirementsVerified
        ? "Requirements available for review, but eligibility has not been confirmed."
        : "Not assessed: official entry requirements have not been verified.",
      verificationStatus: programme.verificationStatus || "unverified"
    };
  }

  function rank(programmes, profile) {
    return programmes
      .map(programme => calculate(programme, profile))
      .sort((a, b) => b.compatibility - a.compatibility);
  }

  return { calculate, rank };
})();

// Process the assessment form.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("assessmentForm");
  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const selected = name =>
      Array.from(
        form.querySelectorAll(`input[name="${name}"]:checked`)
      ).map(input => input.value);

    const profile = {
      studentName: document.getElementById("studentName").value.trim(),
      educationLevel: document.getElementById("educationLevel").value,
      gradeAverage: document.getElementById("gradeAverage").value.trim(),
      preferredLevel: document.getElementById("preferredLevel").value,
      subjects: selected("subjects"),
      interests: selected("interests"),
      careers: selected("careers"),
      skills: selected("skills"),
      completedAt: new Date().toISOString()
    };

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Analysing your profile...";

    try {
      const programmes = await window.PathFinderData.loadProgrammes();
      const recommendations =
        window.PathFinderRecommendation.rank(programmes, profile);

     localStorage.setItem(
  "pathfinder.studentProfile",
  JSON.stringify(profile)
);

localStorage.setItem(
  "pathfinder.recommendations",
  JSON.stringify(recommendations)
);

      window.location.href = "results.html";
    } catch (error) {
      console.error(error);
      alert("We could not generate recommendations. Please check that you are running the project through Live Server or a local web server.");
      button.disabled = false;
      button.innerHTML = 'Generate my recommendations <i class="bi bi-arrow-right ms-2"></i>';
    }
  });
});

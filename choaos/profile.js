const profile = {
  username: "Raven of Regret",
  tagline: "Still texting my ex, but in lowercase.",
  about: `Recovering attention addict. Drinks coffee like it's character development. 
  Currently healing in lowercase.`,
  flags: [
    "Love-Bombing Enthusiast",
    "Gaslight Graduate",
    "Breadcrumb Distributor",
    "Situationship Artist"
  ],
  badges: [
    "Shadow Work in Progress",
    "Accountability Amateur",
    "Red Room Survivor"
  ],
  chaos: [
    "Argued with ChatGPT about closure.",
    "Deleted their number. Again. For real this time.",
    "Ghosted my therapist — ironically."
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".username").textContent = profile.username;
  document.querySelector(".tagline").textContent = `"${profile.tagline}"`;
  document.getElementById("aboutText").textContent = profile.about;

  const flagsGrid = document.getElementById("flagsGrid");
  profile.flags.forEach(flag => {
    const div = document.createElement("div");
    div.className = "flag";
    div.textContent = flag;
    flagsGrid.appendChild(div);
  });

  const badgesGrid = document.getElementById("badgesGrid");
  profile.badges.forEach(badge => {
    const div = document.createElement("div");
    div.className = "badge";
    div.textContent = badge;
    badgesGrid.appendChild(div);
  });

  const chaosList = document.getElementById("chaosList");
  profile.chaos.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    chaosList.appendChild(li);
  });
});

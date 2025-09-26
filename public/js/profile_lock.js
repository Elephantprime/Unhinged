// Profile Lock Utilities - lightweight version
// Only disables/enables Save button on edit-profile.html

import { auth, db, doc, getDoc } from "/js/firebase.js";

/**
 * Check if a profile is complete enough to enable Save
 */
function isProfileComplete(data) {
  if (!data) return false;

  const hasDisplayName = data.displayName && data.displayName.trim().length > 0;
  const hasAge = data.age && data.age > 0;
  const hasLocation = data.location && data.location.trim().length > 0;
  const hasPhotos = Array.isArray(data.photos) && data.photos.length > 0;

  return hasDisplayName && hasAge && hasLocation && hasPhotos;
}

/**
 * Watch the form and disable/enable Save button
 */
export function initProfileLock() {
  const saveBtn = document.getElementById("saveEdit");
  if (!saveBtn) {
    console.warn("⚠️ Save button not found on this page");
    return;
  }

  const inputs = [
    "displayName",
    "age",
    "location",
    "avatar", // photo input
  ];

  function checkForm() {
    const data = {
      displayName: document.getElementById("displayName")?.value || "",
      age: parseInt(document.getElementById("age")?.value) || 0,
      location: document.getElementById("location")?.value || "",
      photos: document.getElementById("avatar")?.files?.length
        ? ["has-photo"]
        : [],
    };

    if (isProfileComplete(data)) {
      saveBtn.disabled = false;
      saveBtn.style.opacity = "1";
      saveBtn.style.cursor = "pointer";
    } else {
      saveBtn.disabled = true;
      saveBtn.style.opacity = "0.5";
      saveBtn.style.cursor = "not-allowed";
    }
  }

  // Run initial check
  checkForm();

  // Watch for changes in required inputs
  inputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", checkForm);
      el.addEventListener("change", checkForm);
    }
  });

  console.log("🔒 Profile lock active: Save button controlled by profile completeness");
}

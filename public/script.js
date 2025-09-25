
document.getElementById("signup-form")?.addEventListener("submit", function (e) {
  e.preventDefault();
  
  const name = e.target.name.value.trim();
  const email = e.target.email.value.trim();
  const messageEl = document.getElementById("form-message");

  if (!name || !email) {
    messageEl.textContent = "Please fill out all fields.";
    messageEl.style.color = "yellow";
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    messageEl.textContent = "Please enter a valid email address.";
    messageEl.style.color = "yellow";
    return;
  }

  // Show loading state
  messageEl.textContent = "Signing you up...";
  messageEl.style.color = "orange";

  // Simulate API call (replace with actual backend call later)
  setTimeout(() => {
    messageEl.textContent = `Welcome to the chaos, ${name}! Check your email for next steps.`;
    messageEl.style.color = "lightgreen";
    e.target.reset();
  }, 1000);
});

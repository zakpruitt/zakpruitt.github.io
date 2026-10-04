const root = document.documentElement;

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("in");
    observer.unobserve(entry.target);
  }
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

const nav = document.querySelector(".nav");
const updateNav = () => nav.classList.toggle("scrolled", scrollY > 8);
addEventListener("scroll", updateNav, { passive: true });
updateNav();

document.querySelector(".theme-toggle").addEventListener("click", () => {
  const theme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {}
});

document.getElementById("year").textContent = new Date().getFullYear();

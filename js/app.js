const viewer = document.getElementById("viewer");
const canvas = document.getElementById("canvas");
const image = document.getElementById("newsletter");
const loading = document.getElementById("loading");
const zoomLabel = document.getElementById("zoomLabel");
const viewerHeading = document.getElementById("viewerHeading");
const viewerMeta = document.getElementById("viewerMeta");

let previousFocus = null;
let loadGeneration = 0;
let imageReady = false;
let activeImageSource = "";
let imageWidth = 1365;
let imageHeight = 2048;
let scale = 1;
let minimumScale = .1;
const maximumScale = 6;
let x = 0;
let y = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;
let pinchDistance = 0;
let pinchScale = 1;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

function render() {
  if (imageReady) {
    const w = imageWidth * scale, h = imageHeight * scale;
    x = w <= canvas.clientWidth ? (canvas.clientWidth - w) / 2 : clamp(x, canvas.clientWidth - w - 24, 24);
    y = h <= canvas.clientHeight ? (canvas.clientHeight - h) / 2 : clamp(y, canvas.clientHeight - h - 24, 24);
  }
  image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function prepareImage(source, altText) {
  if (activeImageSource === source && imageReady) return;

  activeImageSource = source;
  imageReady = false;
  loading.classList.remove("hidden");
  loading.innerHTML = "<span></span>Loading original image";
  image.removeAttribute("src");
  image.alt = altText || "Newsletter image";
}

function loadOriginalImage(source) {
  return new Promise((resolve, reject) => {
    if (imageReady && image.src.endsWith(source)) {
      resolve();
      return;
    }

    image.onload = () => {
      imageWidth = image.naturalWidth;
      imageHeight = image.naturalHeight;
      image.style.width = `${imageWidth}px`;
      image.style.height = `${imageHeight}px`;
      imageReady = true;
      loading.classList.add("hidden");
      resolve();
    };

    image.onerror = () => reject(new Error(`Unable to load image: ${source}`));
    image.src = source;
  });
}

function fitToScreen() {
  if (!imageReady) return;

  const padding = window.innerWidth <= 700 ? 12 : 16;
  minimumScale = Math.min(
    (canvas.clientWidth - padding * 2) / imageWidth,
    (canvas.clientHeight - padding * 2) / imageHeight
  );

  minimumScale = Math.min(minimumScale, 1);
  scale = minimumScale;
  x = (canvas.clientWidth - imageWidth * scale) / 2;
  y = (canvas.clientHeight - imageHeight * scale) / 2;
  render();
}

function zoomAt(nextScale, centerX, centerY) {
  if (!imageReady) return;

  const boundedScale = clamp(nextScale, minimumScale, maximumScale);
  const imageX = (centerX - x) / scale;
  const imageY = (centerY - y) / scale;

  x = centerX - imageX * boundedScale;
  y = centerY - imageY * boundedScale;
  scale = boundedScale;
  render();
}

function actualSize(centerX = canvas.clientWidth / 2, centerY = canvas.clientHeight / 2) {
  zoomAt(1, centerX, centerY);
}

async function openViewer(trigger) {
  const source = trigger?.dataset.image || "images/newsletter-vol02.png";
  const generation = ++loadGeneration;
  previousFocus = document.activeElement;
  const title = trigger?.dataset.title || "Marketing News";
  const meta = trigger?.dataset.meta || "Volume 02 · October 2026";
  const alt = trigger?.dataset.alt || title;

  viewerHeading.textContent = title;
  viewerMeta.textContent = meta;
  viewer.setAttribute("aria-label", `${title} viewer`);
  prepareImage(source, alt);

  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.querySelector("main").inert = true;
  document.getElementById("close").focus();

  try {
    await loadOriginalImage(source);
    if (generation === loadGeneration && viewer.classList.contains("open")) {
      requestAnimationFrame(fitToScreen);
    }
  } catch (error) {
  if (generation !== loadGeneration) return;
  imageReady = false;
  loading.classList.remove("hidden");
  loading.textContent = "โหลดรูปไม่ได้ กรุณาตรวจสอบไฟล์ในโฟลเดอร์ images แล้วลองใหม่";
  console.error(error);
}
}

function closeViewer() {
  ++loadGeneration;
  viewer.classList.remove("open");
  viewer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  document.querySelector("main").inert = false;
  endDrag();
  previousFocus?.focus();
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest(".js-open");
  if (trigger) openViewer(trigger);
});

document.getElementById("close").addEventListener("click", closeViewer);
document.getElementById("fit").addEventListener("click", fitToScreen);
document.getElementById("actual").addEventListener("click", () => actualSize());

document.getElementById("zoomIn").addEventListener("click", () => {
  zoomAt(scale * 1.25, canvas.clientWidth / 2, canvas.clientHeight / 2);
});

document.getElementById("zoomOut").addEventListener("click", () => {
  zoomAt(scale / 1.25, canvas.clientWidth / 2, canvas.clientHeight / 2);
});

zoomLabel.addEventListener("click", fitToScreen);

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const bounds = canvas.getBoundingClientRect();
  zoomAt(
    scale * Math.exp(-event.deltaY * .00145),
    event.clientX - bounds.left,
    event.clientY - bounds.top
  );
}, { passive:false });

canvas.addEventListener("dblclick", (event) => {
  const bounds = canvas.getBoundingClientRect();
  if (Math.abs(scale - 1) < .04) {
    fitToScreen();
  } else {
    actualSize(event.clientX - bounds.left, event.clientY - bounds.top);
  }
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") return;
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.classList.add("dragging");
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  x += event.clientX - lastX;
  y += event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  render();
});

function endDrag() {
  dragging = false;
  canvas.classList.remove("dragging");
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

canvas.addEventListener("touchstart", (event) => {
  if (event.touches.length === 1) {
    dragging = true;
    lastX = event.touches[0].clientX;
    lastY = event.touches[0].clientY;
  }
  if (event.touches.length === 2) {
    dragging = false;
    pinchDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    pinchScale = scale;
  }
}, { passive:false });

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  if (event.touches.length === 1 && dragging) {
    x += event.touches[0].clientX - lastX;
    y += event.touches[0].clientY - lastY;
    lastX = event.touches[0].clientX;
    lastY = event.touches[0].clientY;
    render();
  }
  if (event.touches.length === 2) {
    const distance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    const bounds = canvas.getBoundingClientRect();
    const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - bounds.left;
    const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - bounds.top;
    zoomAt(pinchScale * distance / pinchDistance, centerX, centerY);
  }
}, { passive:false });

canvas.addEventListener("touchend", (event) => {
  dragging = event.touches.length === 1;
  if (dragging) {
    lastX = event.touches[0].clientX;
    lastY = event.touches[0].clientY;
  }
});
canvas.addEventListener("touchcancel", endDrag);

window.addEventListener("keydown", (event) => {
  if (!viewer.classList.contains("open")) return;
  if (event.key === "Tab") {
    const buttons = [...viewer.querySelectorAll("button")];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if (event.key === "Escape") closeViewer();
  if (event.key === "+" || event.key === "=") document.getElementById("zoomIn").click();
  if (event.key === "-") document.getElementById("zoomOut").click();
  if (event.key === "0") fitToScreen();
  if (event.key === "1") actualSize();
});

window.addEventListener("resize", () => {
  if (viewer.classList.contains("open")) fitToScreen();
});

document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav a").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});
new ResizeObserver(() => {
  if (viewer.classList.contains("open") && imageReady) fitToScreen();
}).observe(canvas);


// Edit volume details here when adding the next issue.
const issues = {
  "02": { date:"October 2026", name:"Halloween Edition", theme:"Halloween", title:"Trick or Treat!", tagline:"หลอนแค่ลุค… แต่บุกทุกตลาด!", description:"Market rollercoaster, record exports and friendships across borders." },
  "01": { date:"August 2026", name:"Doomsday", theme:"Doomsday", title:"Marketing News", tagline:"Stories from the TEX Marketing Team", description:"Market movement, customer progress and stories from the TEX Marketing Team." }
};
function applyIssue(volume) {
  const issue = issues[volume];
  if (!issue) return;
  document.body.dataset.issue = volume;
  document.querySelector('.halloween-hero').hidden = volume !== '02';
  document.querySelector('.hero-copy').hidden = volume === '02';
  document.querySelector('meta[name="theme-color"]').content = volume === '02' ? '#0b0610' : '#080d0d';
  document.getElementById("edition-volume").textContent = `Volume ${volume} · ${issue.date}`;
  document.getElementById("edition-name").textContent = issue.name;
  document.getElementById("edition-tagline").textContent = issue.tagline;
  document.querySelector(".issue-number").textContent = volume;
  document.getElementById("issue-date").textContent = issue.date;
  document.getElementById("issue-title").textContent = issue.title;
  document.getElementById("issue-description").textContent = issue.description;
  document.getElementById("theme-name").textContent = issue.theme;
  document.querySelector(".panel-label").lastChild.textContent = volume === "02" ? " Latest issue" : " From the archive";
  const spread = document.querySelector(".magazine-spread");
  spread.classList.toggle("single-issue", volume === "02");
  spread.setAttribute("aria-label", `Volume ${volume} page previews`);
  document.querySelector(".message-page").hidden = volume !== "01";
  document.querySelector(".spread-fold").hidden = volume !== "01";
  const source = `images/newsletter-vol${volume}.png`;
  document.querySelectorAll(".newsletter-page, .primary-btn").forEach(button => {
    Object.assign(button.dataset, { image:source, title:"Marketing News", meta:`Volume ${volume} · ${issue.date}`, alt:`TEX Marketing News Volume ${volume}` });
  });
  const thumbnail = document.querySelector(".newsletter-page img");
  thumbnail.src = `images/newsletter-vol${volume}-thumb.webp`;
  thumbnail.alt = `TEX Marketing News Volume ${volume} cover`;
  thumbnail.width = 520; thumbnail.height = volume === "02" ? 735 : 780;
  document.querySelector(".primary-btn").textContent = `▣ Open Volume ${volume}`;
  document.querySelector(".secondary-btn").href = source;
  document.querySelector(".cover-caption").textContent = volume === "02" ? "Click the cover to explore this issue ↗" : "Click either page to open full screen ↗";
  document.querySelectorAll(".archive-card[data-issue], .volume-tab").forEach(card => {
    const selected = (card.dataset.issue || card.dataset.selectIssue) === volume;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
  document.getElementById("issue-status").textContent = `กำลังแสดง Volume ${volume} · ${issue.name}`;
}
let selectionGeneration = 0;
async function selectIssue(volume) {
  if (!issues[volume]) return;
  const generation = ++selectionGeneration;
  if (document.body.dataset.issue === volume) return;
  // Wait for the replacement thumbnail before changing the visible issue.
  const preview = new Image();
  preview.src = `images/newsletter-vol${volume}-thumb.webp`;
  try { await preview.decode(); } catch { /* Keep the image path repairable by the site owner. */ }
  if (generation !== selectionGeneration) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && !reduce) {
    const transition = document.startViewTransition(() => {
      if (generation === selectionGeneration) applyIssue(volume);
    });
    await transition.finished.catch(() => {});
  } else { applyIssue(volume); }
}
document.querySelectorAll(".archive-card[data-issue]").forEach(card => {
  card.addEventListener("click", () => selectIssue(card.dataset.issue));
});
document.querySelectorAll(".volume-tab").forEach(tab => {
  tab.addEventListener("click", () => selectIssue(tab.dataset.selectIssue));
});
applyIssue("02");
const requestedVolume = new URLSearchParams(location.search).get("view");
if (requestedVolume === "vol01" || requestedVolume === "vol02") {
  applyIssue(requestedVolume.slice(-2));
  openViewer(document.querySelector(".newsletter-page"));
}

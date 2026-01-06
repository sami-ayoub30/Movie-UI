// TMDb API Configuration
// Replace the placeholders with your credentials before using.
// You can use a V3 API key (query param) for quick tests or a V4 Read Access Token (Bearer) for requests.
const API_KEY = "YOUR_TMDB_V3_API_KEY"; // optional if using V4 token
const V4_TOKEN = "YOUR_TMDB_V4_READ_ACCESS_TOKEN"; // preferred for production

const BASE_URL = "https://api.themoviedb.org/3";
const IMG_URL = "https://image.tmdb.org/t/p/w500";

// DOM Elements
const movieGrid = document.getElementById("movie-grid");
const searchInput = document.getElementById("movie-search");

// Runtime credentials (can be set from localStorage via UI)
let runtimeApiKey =
  localStorage.getItem("tmdb_api_key") ||
  (API_KEY && !API_KEY.includes("YOUR_TMDB") ? API_KEY : "");
let runtimeV4Token =
  localStorage.getItem("tmdb_v4_token") ||
  (V4_TOKEN && !V4_TOKEN.includes("YOUR_TMDB") ? V4_TOKEN : "");

function updateRuntimeCreds({ apiKey, v4Token }) {
  if (apiKey !== undefined) {
    runtimeApiKey = apiKey || "";
    localStorage.setItem("tmdb_api_key", runtimeApiKey);
  }
  if (v4Token !== undefined) {
    runtimeV4Token = v4Token || "";
    localStorage.setItem("tmdb_v4_token", runtimeV4Token);
  }
}

// Helper: perform TMDb API requests with proper auth and error handling
async function tmdbFetch(
  path,
  useV4 = Boolean(runtimeV4Token && !runtimeV4Token.includes("YOUR_TMDB"))
) {
  // Build URL (path may include query params)
  const url = path.startsWith("http")
    ? path
    : `${BASE_URL}${path}${
        !useV4 && !path.includes("api_key=")
          ? (path.includes("?") ? "&" : "?") + `api_key=${runtimeApiKey}`
          : ""
      }`;

  const headers = {};
  if (useV4) {
    if (!runtimeV4Token) {
      throw new Error("401 Missing TMDb V4 token. Please set a valid token.");
    }
    headers["Authorization"] = `Bearer ${runtimeV4Token}`;
    headers["Content-Type"] = "application/json;charset=utf-8";
  } else {
    if (!runtimeApiKey) {
      throw new Error("401 Missing TMDb API key. Please set a valid key.");
    }
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    let body = {};
    try {
      body = await res.json();
    } catch (e) {}
    const message = body.status_message || res.statusText || "Unknown error";
    throw new Error(`${res.status} ${message}`);
  }
  return res.json();
}

// Show a small overlay dialog so user can paste their keys (stored to localStorage)
function showKeyDialog(message = "") {
  if (document.getElementById("tmdb-key-overlay")) {
    const msgEl = document.getElementById("tmdb-key-message");
    if (msgEl) msgEl.textContent = message;
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "tmdb-key-overlay";
  overlay.style = `position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;`;

  const dialog = document.createElement("div");
  dialog.style = `background:#fff;padding:20px;border-radius:8px;max-width:460px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.3);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#111;`;

  dialog.innerHTML = `
    <h3 style="margin:0 0 8px">Enter TMDb Credentials</h3>
    <p id="tmdb-key-message" style="margin:0 0 12px;color:#555;">${
      message ||
      "You need to provide a TMDb API key or V4 Read Access Token to load movies."
    }</p>
    <label style="display:block;margin-bottom:8px;font-size:13px;color:#333">V4 Read Access Token (recommended)</label>
    <input id="tmdb-v4-input" type="text" placeholder="Bearer ..." value="${
      runtimeV4Token || ""
    }" style="width:100%;padding:8px;margin-bottom:10px;border:1px solid #ddd;border-radius:4px" />
    <label style="display:block;margin-bottom:8px;font-size:13px;color:#333">V3 API Key (alternate)</label>
    <input id="tmdb-v3-input" type="text" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxx" value="${
      runtimeApiKey || ""
    }" style="width:100%;padding:8px;margin-bottom:12px;border:1px solid #ddd;border-radius:4px" />
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="tmdb-key-cancel" style="padding:8px 12px;background:#eee;border:0;border-radius:4px;cursor:pointer">Cancel</button>
      <button id="tmdb-key-save" style="padding:8px 12px;background:#007bff;color:#fff;border:0;border-radius:4px;cursor:pointer">Save & Retry</button>
    </div>
    <p style="margin-top:10px;font-size:12px;color:#666">Need a key? Get one at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">TMDb API Settings</a>.</p>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  document.getElementById("tmdb-key-cancel").addEventListener("click", () => {
    overlay.remove();
  });

  document
    .getElementById("tmdb-key-save")
    .addEventListener("click", async () => {
      const v4 = document.getElementById("tmdb-v4-input").value.trim();
      const v3 = document.getElementById("tmdb-v3-input").value.trim();
      updateRuntimeCreds({ apiKey: v3, v4Token: v4 });
      overlay.remove();
      await loadPopularMovies();
    });
}

// Helper to load popular movies and handle 401 specifically
async function loadPopularMovies() {
  try {
    const useV4 = Boolean(
      runtimeV4Token && !runtimeV4Token.includes("YOUR_TMDB")
    );
    const data = await tmdbFetch(
      `/discover/movie?sort_by=popularity.desc`,
      useV4
    );
    if (data.results && data.results.length > 0) {
      showMovies(data.results);
    } else {
      movieGrid.innerHTML = `<h2 class="no-results">No movies found. Try another search!</h2>`;
    }
  } catch (error) {
    console.error("Error fetching movies:", error);
    if (String(error).includes("401")) {
      showKeyDialog(error.message || "Invalid or missing API key.");
      movieGrid.innerHTML = `<h2 class="error">Failed to load movies. ${error.message}. <button id="open-key">Set API key</button></h2>`;
      const btn = document.getElementById("open-key");
      if (btn)
        btn.addEventListener("click", () => showKeyDialog(error.message));
    } else {
      movieGrid.innerHTML = `<h2 class="error">Failed to load movies. ${error.message}</h2>`;
    }
  }
}

// Initial Load
loadPopularMovies();

// If no credentials available, prompt the user to enter them (useful in dev)
if (!runtimeApiKey && !runtimeV4Token) {
  setTimeout(
    () =>
      showKeyDialog(
        "No API key detected. Please paste your TMDb V3 key or V4 token."
      ),
    300
  );
}

/**
 * Render movie cards to the grid
 * @param {Array} movies
 */
function showMovies(movies) {
  movieGrid.innerHTML = "";

  movies.forEach((movie, index) => {
    const { title, poster_path, vote_average, id } = movie;
    const movieEl = document.createElement("div");
    movieEl.classList.add("movie-card");
    movieEl.id = `movie-${id || index}`;

    const poster = poster_path
      ? IMG_URL + poster_path
      : "https://via.placeholder.com/300x450?text=No+Poster";

    const rating =
      typeof vote_average === "number" ? vote_average.toFixed(1) : "N/A";

    movieEl.innerHTML = `
            <div class="poster-wrapper">
                <img src="${poster}" alt="${title} Poster" class="movie-poster" id="poster-${
      id || index
    }">
            </div>
            <div class="movie-info">
                <h3 class="movie-title" id="title-${id || index}">${title}</h3>
                <span class="movie-rating" id="rating-${
                  id || index
                }">⭐ ${rating}</span>
            </div>
        `;

    // make cards clickable to preview trailers
    movieEl.style.cursor = "pointer";
    movieEl.addEventListener("click", (e) => {
      // prevent clicks on inner elements from doing unexpected things
      e.stopPropagation();
      if (id) showMoviePreview(id);
    });

    movieGrid.appendChild(movieEl);
  });
}

// Preview: fetch videos for a movie and show modal with trailer (if available)
async function showMoviePreview(movieId) {
  // remove existing overlay if any
  const existing = document.getElementById("tmdb-preview-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "tmdb-preview-overlay";
  overlay.style = `position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10001;padding:20px;`;

  const dialog = document.createElement("div");
  dialog.style = `background:#000;border-radius:8px;max-width:960px;width:100%;max-height:90vh;overflow:hidden;position:relative;`;

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close preview");
  closeBtn.style = `position:absolute;right:8px;top:8px;z-index:2;background:rgba(0,0,0,0.6);color:#fff;border:0;padding:6px 8px;border-radius:4px;cursor:pointer;font-size:16px`;
  closeBtn.addEventListener("click", () => overlay.remove());

  // loading state
  const loading = document.createElement("div");
  loading.style = `color:#fff;padding:40px;text-align:center;min-width:280px`;
  loading.textContent = "Loading trailer...";

  dialog.appendChild(closeBtn);
  dialog.appendChild(loading);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // allow ESC to close
  function onKey(e) {
    if (e.key === "Escape") overlay.remove();
  }
  window.addEventListener("keydown", onKey, { once: true });

  try {
    const useV4 = Boolean(
      runtimeV4Token && !runtimeV4Token.includes("YOUR_TMDB")
    );
    // fetch movie details + videos in parallel
    const [details, vdata] = await Promise.all([
      tmdbFetch(`/movie/${movieId}`, useV4),
      tmdbFetch(`/movie/${movieId}/videos`, useV4),
    ]);

    // add to recently watched
    addToRecentlyWatched({
      id: details.id,
      title: details.title,
      poster_path: details.poster_path,
      release_date: details.release_date,
    });
    renderRecentlyWatched();

    const videos = (vdata && vdata.results) || [];
    const trailer =
      videos.find(
        (v) => v.site === "YouTube" && /trailer/i.test(v.type) && v.official
      ) ||
      videos.find((v) => v.site === "YouTube" && /trailer/i.test(v.type)) ||
      videos.find((v) => v.site === "YouTube") ||
      videos[0];

    // clear loading
    dialog.removeChild(loading);

    // header info
    const infoBar = document.createElement("div");
    infoBar.style = `color:#fff;padding:12px 14px;background:linear-gradient(180deg,rgba(0,0,0,0.6),transparent);position:absolute;left:0;top:0;width:100%;box-sizing:border-box;z-index:1`;
    infoBar.innerHTML = `<strong style="display:block;font-size:1.1rem">${
      details.title
    }</strong><small style="color:#ddd">${details.release_date || ""}</small>`;
    dialog.appendChild(infoBar);

    if (trailer && trailer.site === "YouTube" && trailer.key) {
      const iframeWrap = document.createElement("div");
      iframeWrap.style = `position:relative;padding-top:56.25%;background:#000;`;
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.allow = "autoplay; encrypted-media";
      iframe.style = `position:absolute;top:0;left:0;width:100%;height:100%;border:0;`;
      iframe.setAttribute("allowfullscreen", "");

      iframeWrap.appendChild(iframe);
      dialog.appendChild(iframeWrap);

      // show trailer title
      const titleBar = document.createElement("div");
      titleBar.style = `color:#fff;padding:8px 12px;font-size:14px;background:linear-gradient(180deg,transparent,rgba(0,0,0,0.6));position:absolute;left:0;bottom:0;width:100%;box-sizing:border-box`;
      titleBar.textContent = trailer.name || "Trailer";
      dialog.appendChild(titleBar);
    } else if (videos.length > 0) {
      const list = document.createElement("div");
      list.style = `color:#fff;padding:18px`;
      list.innerHTML = `<h3 style="margin-top:0;color:#fff">Available Videos</h3>`;
      videos.forEach((v) => {
        const item = document.createElement("div");
        item.style = `margin-bottom:8px`;
        const name = document.createElement("div");
        name.style = `color:#fff`;
        name.textContent = `${v.name} (${v.site} - ${v.type})`;
        item.appendChild(name);
        if (v.site === "YouTube" && v.key) {
          const open = document.createElement("a");
          open.href = `https://www.youtube.com/watch?v=${v.key}`;
          open.target = "_blank";
          open.rel = "noopener";
          open.textContent = "Open on YouTube";
          open.style = `color:#00b7ff;margin-left:8px`;
          item.appendChild(open);
        }
        list.appendChild(item);
      });
      dialog.appendChild(list);
    } else {
      const none = document.createElement("div");
      none.style = `color:#fff;padding:24px;text-align:center`;
      none.innerHTML = `No trailer available. <a href="https://www.themoviedb.org/movie/${movieId}" target="_blank" rel="noopener" style="color:#00b7ff">View on TMDb</a>`;
      dialog.appendChild(none);
    }
  } catch (err) {
    dialog.removeChild(loading);
    const errEl = document.createElement("div");
    errEl.style = `color:#fff;padding:24px;text-align:center`;
    errEl.textContent = `Failed to load trailer: ${err.message}`;
    dialog.appendChild(errEl);
  }

  // close overlay when clicking outside dialog
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// Search Functionality

// Search Functionality
searchInput.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    const searchTerm = searchInput.value.trim();
    const useV4 = Boolean(
      runtimeV4Token && !runtimeV4Token.includes("YOUR_TMDB")
    );

    if (searchTerm && searchTerm !== "") {
      try {
        const data = await tmdbFetch(
          `/search/movie?query=${encodeURIComponent(searchTerm)}`,
          useV4
        );
        if (data.results && data.results.length > 0) {
          showMovies(data.results);
        } else {
          movieGrid.innerHTML = `<h2 class="no-results">No movies found for "${searchTerm}".</h2>`;
        }
      } catch (err) {
        console.error("Search error:", err);
        movieGrid.innerHTML = `<h2 class="error">Search failed: ${err.message}</h2>`;
      }
    } else {
      // Reload popular
      try {
        const data = await tmdbFetch(
          `/discover/movie?sort_by=popularity.desc`,
          useV4
        );
        showMovies(data.results || []);
      } catch (err) {
        console.error("Error loading popular movies:", err);
        movieGrid.innerHTML = `<h2 class="error">Failed to load movies. ${err.message}</h2>`;
      }
    }
  }
});

/**
 * Render movie cards to the grid
 * @param {Array} movies
 */

// Recently watched management
const RECENT_KEY = "vibe_recently_watched";
function getRecentlyWatched() {
  try {
    const raw = localStorage.getItem(RECENT_KEY) || "[]";
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveRecentlyWatched(list) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function addToRecentlyWatched(movie) {
  if (!movie || !movie.id) return;
  const list = getRecentlyWatched().filter((m) => m.id !== movie.id);
  const item = Object.assign({}, movie, { ts: Date.now() });
  list.unshift(item);
  // keep to 12 items
  saveRecentlyWatched(list.slice(0, 12));
}

function formatShortDate(tsOrDate) {
  const d = tsOrDate ? new Date(tsOrDate) : null;
  if (!d) return "";
  return d.toLocaleDateString();
}

function renderRecentlyWatched() {
  const container = document.getElementById("recent-list");
  if (!container) return;
  const list = getRecentlyWatched();
  container.innerHTML = "";
  if (!list || list.length === 0) {
    container.innerHTML = `<div style="padding:18px;color:#ccc">No recently watched movies yet.</div>`;
    return;
  }

  list.forEach((m) => {
    const item = document.createElement("div");
    item.className = "recent-item";
    const img = document.createElement("img");
    img.src = m.poster_path
      ? IMG_URL + m.poster_path
      : "https://via.placeholder.com/56x84?text=No";
    img.alt = m.title;

    const meta = document.createElement("div");
    meta.className = "recent-meta";
    const title = document.createElement("div");
    title.className = "recent-title";
    title.textContent = m.title || "Untitled";
    const sub = document.createElement("div");
    sub.className = "recent-sub";
    sub.textContent = m.release_date
      ? formatShortDate(m.release_date)
      : formatShortDate(m.ts);

    meta.appendChild(title);
    meta.appendChild(sub);

    item.appendChild(img);
    item.appendChild(meta);

    item.addEventListener("click", () => {
      // open preview for that movie
      if (m.id) showMoviePreview(m.id);
      // close panel
      closeRecentPanel();
    });

    container.appendChild(item);
  });
}

function openRecentPanel() {
  const panel = document.getElementById("recent-panel");
  if (!panel) return;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
}

function closeRecentPanel() {
  const panel = document.getElementById("recent-panel");
  if (!panel) return;
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
}

// wire UI buttons
const recentBtn = document.getElementById("recent-btn");
if (recentBtn) {
  recentBtn.addEventListener("click", () => {
    const panel = document.getElementById("recent-panel");
    if (!panel) return;
    const open = panel.classList.contains("open");
    if (open) {
      closeRecentPanel();
    } else {
      renderRecentlyWatched();
      openRecentPanel();
    }
  });
}

const rcClose = document.getElementById("recent-close");
if (rcClose)
  rcClose.addEventListener("click", (e) => {
    e.stopPropagation();
    closeRecentPanel();
  });

const rcClear = document.getElementById("clear-recent");
if (rcClear)
  rcClear.addEventListener("click", () => {
    localStorage.removeItem(RECENT_KEY);
    renderRecentlyWatched();
  });

// render on load
renderRecentlyWatched();

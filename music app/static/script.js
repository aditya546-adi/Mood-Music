/**
 * Mood Music Recommender — Client Logic
 * Handles mood selection, filtering, API calls, and UI transitions.
 */

(() => {
    "use strict";

    // ── DOM references ────────────────────────
    const moodButtons    = document.querySelectorAll(".mood-btn");
    const languageSelect = document.getElementById("filter-language");
    const energySelect   = document.getElementById("filter-energy");
    const loaderWrapper  = document.getElementById("loader");
    const resultsArea    = document.getElementById("results");
    const captionEl      = document.getElementById("results-caption");
    const songListEl     = document.getElementById("song-list");
    const resetBtn       = document.getElementById("reset-btn");
    const selectionUI    = document.getElementById("selection-ui");

    // ── State ─────────────────────────────────
    let isLoading = false;

    // ── Event: Mood button click ──────────────
    moodButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (isLoading) return;
            const mood = btn.dataset.mood;
            fetchRecommendations(mood);
        });
    });

    // ── Event: Reset / try another mood ───────
    resetBtn.addEventListener("click", () => {
        resultsArea.classList.remove("active");
        selectionUI.style.display = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // ── Fetch recommendations from backend ────
    async function fetchRecommendations(mood) {
        isLoading = true;

        // Hide selection, show loader
        selectionUI.style.display = "none";
        resultsArea.classList.remove("active");
        loaderWrapper.classList.add("active");

        const payload = {
            mood: mood,
            language: languageSelect.value,
            energy: energySelect.value,
        };

        try {
            // Artificial delay for polish (1–1.5s)
            const [response] = await Promise.all([
                fetch("/api/recommend", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }),
                delay(randomInt(1000, 1500)),
            ]);

            if (!response.ok) throw new Error("Server error");

            const data = await response.json();
            renderResults(data);
        } catch (err) {
            captionEl.textContent = "Oops! Something went wrong 😵";
            songListEl.innerHTML = "";
            resultsArea.classList.add("active");
        } finally {
            loaderWrapper.classList.remove("active");
            isLoading = false;
        }
    }

    // ── Render song cards ─────────────────────
    function renderResults(data) {
        captionEl.textContent = data.caption;

        songListEl.innerHTML = data.songs
            .map(
                (song, i) => `
            <div class="song-card" id="song-card-${i}">
                <span class="song-card__number">${String(i + 1).padStart(2, "0")}</span>
                <div class="song-card__info">
                    <div class="song-card__title">${escapeHTML(song.title)}</div>
                    <div class="song-card__artist">${escapeHTML(song.artist)}</div>
                </div>
                <a class="play-btn" href="${escapeHTML(song.youtube_url)}" target="_blank" rel="noopener noreferrer" id="play-btn-${i}">
                    <span class="play-btn__icon">▶</span> Play
                </a>
            </div>`
            )
            .join("");

        resultsArea.classList.add("active");
    }

    // ── Helpers ───────────────────────────────
    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function escapeHTML(str) {
        const div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
})();

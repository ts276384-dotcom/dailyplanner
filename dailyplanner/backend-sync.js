
"use strict";

(async function connectBackend() {
    const keys = [
        "daybook_plans_v3",
        "daybook_notes_v3",
        "daybook_theme_v3",
        "daybook_sent_v3"
    ];

    try {
        const response = await fetch("/api/storage");

        if (!response.ok) {
            throw new Error("Backend could not load saved data");
        }

        const serverData = await response.json();

        // First connection: preserve existing browser data.
        const hasServerData = keys.some(
            key => Object.prototype.hasOwnProperty.call(serverData, key)
        );

        if (!hasServerData) {
            for (const key of keys) {
                const existing = localStorage.getItem(key);

                if (existing !== null) {
                    await saveToBackend(key, JSON.parse(existing));
                }
            }
        } else {
            // Load database data into the existing frontend.
            for (const key of keys) {
                if (Object.prototype.hasOwnProperty.call(serverData, key)) {
                    localStorage.setItem(
                        key,
                        JSON.stringify(serverData[key])
                    );
                }
            }
        }

        // Send future localStorage saves to Flask + SQLite.
        const originalSetItem = localStorage.setItem.bind(localStorage);

        localStorage.setItem = function (key, value) {
            originalSetItem(key, value);

            if (keys.includes(key)) {
                try {
                    const parsedValue = JSON.parse(value);

                    saveToBackend(key, parsedValue).catch(error => {
                        console.error("Database save failed:", error);
                    });
                } catch (error) {
                    console.error("Invalid stored JSON:", error);
                }
            }
        };

        // Load the existing JavaScript only after database hydration.
        const script = document.createElement("script");
        script.src = "/script.js";
        script.onerror = () => {
            console.error("Could not load script.js");
        };
        document.body.appendChild(script);

    } catch (error) {
        console.error("Backend connection failed:", error);
        document.body.innerHTML =
            "<p>Could not connect to the backend. " +
            "Start Flask and refresh this page.</p>";
    }
})();

async function saveToBackend(key, value) {
    const response = await fetch("/api/storage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ key, value })
    });

    if (!response.ok) {
        throw new Error("Database save failed: " + response.status);
    }

    return response.json();
}

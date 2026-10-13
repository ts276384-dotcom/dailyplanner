
"use strict";

// ========================================
// 1. STORAGE & INITIAL SETTINGS
// ========================================

const $ = id => document.getElementById(id);

const STORAGE = {
  plans: "daybook_plans_v3",
  notes: "daybook_notes_v3",
  theme: "daybook_theme_v3",
  sent: "daybook_sent_v3"
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error("Storage read error:", error);
    return fallback;
  }
}

let plans = readStorage(STORAGE.plans, []);
let notes = readStorage(STORAGE.notes, []);
let sent = new Set(readStorage(STORAGE.sent, []));

const today = new Date();
let selectedDate = dateKey(today);
let viewDate = new Date(today.getFullYear(), today.getMonth(), 1);

let editingNoteId = null;
let activePlanFilter = "all";
let toastTimer = null;

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

// ========================================
// 2. COMMON FUNCTIONS
// ========================================

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function makeId() {
  return crypto.randomUUID?.() ||
    Date.now() + "-" + Math.random().toString(36).slice(2);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(key, options = {
  day: "numeric",
  month: "long",
  year: "numeric"
}) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day)
    .toLocaleDateString(undefined, options);
}

function timestamp(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);

  return new Date(
    year, month - 1, day, hours, minutes, 0, 0
  ).getTime();
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Save error:", error);
    toast("Save failed. Check browser storage.");
    return false;
  }
}

function toast(message) {
  const element = $("toast");
  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 3000);
}

// ========================================
// 3. MONTH & YEAR DROPDOWNS
// ========================================

const monthSelect = $("monthSelect");
const yearSelect = $("yearSelect");

if (monthSelect && yearSelect) {
  MONTHS.forEach((month, index) => {
    monthSelect.add(new Option(month, String(index)));
  });

  const currentYear = new Date().getFullYear();

  for (
    let year = currentYear - 10;
    year <= currentYear + 20;
    year++
  ) {
    yearSelect.add(new Option(String(year), String(year)));
  }

  monthSelect.addEventListener("change", updateCalendarView);
  yearSelect.addEventListener("change", updateCalendarView);
}

function updateCalendarView() {
  if (!monthSelect || !yearSelect) return;

  viewDate = new Date(
    Number(yearSelect.value),
    Number(monthSelect.value),
    1
  );

  renderCalendar();
}

// ========================================
// 4. THEMES
// ========================================

function setTheme(theme) {
  const allowedThemes = [
    "light", "dark", "ocean", "lavender"
  ];

  if (!allowedThemes.includes(theme)) {
    theme = "light";
  }

  document.body.dataset.theme = theme;

  if ($("themeSelect")) {
    $("themeSelect").value = theme;
  }

  const icons = {
    light: "fa-solid fa-sun",
    dark: "fa-solid fa-moon",
    ocean: "fa-solid fa-water",
    lavender: "fa-solid fa-spa"
  };

  if ($("themeIcon")) {
    $("themeIcon").className = icons[theme];
  }

  persist(STORAGE.theme, theme);
}

if ($("themeSelect")) {
  $("themeSelect").addEventListener("change", event => {
    setTheme(event.target.value);
  });
}

// ========================================
// 5. MONTHLY CALENDAR
// ========================================

function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const grid = $("calendarGrid");

  if (!grid) return;

  // Keep dropdowns synchronized with the displayed month.
  if (monthSelect) monthSelect.value = String(month);
  if (yearSelect) yearSelect.value = String(year);

  grid.replaceChildren();

  const weekdays = [
    "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"
  ];

  weekdays.forEach(day => {
    const header = document.createElement("div");
    header.className = "weekday";
    header.textContent = day;
    grid.append(header);
  });

  const offset = (new Date(year, month, 1).getDay() + 6) % 7;

  const startDate = new Date(year, month, 1 - offset);
  const todayKey = dateKey(new Date());

  // Six rows maintain a consistent calendar layout.
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const key = dateKey(date);
    const scheduled = plans.filter(plan => plan.date === key);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";

    if (date.getMonth() !== month) {
      cell.classList.add("muted");
    }

    if (key === todayKey) {
      cell.classList.add("today");
    }

    if (key === selectedDate) {
      cell.classList.add("selected");
    }

    const number = document.createElement("span");
    number.textContent = date.getDate();
    cell.append(number);

    const dots = document.createElement("span");
    dots.className = "day-dots";

    if (scheduled.length) {
      const dot = document.createElement("i");

      dot.className = "dot " +
        (scheduled.every(plan => plan.completed)
          ? "green-dot"
          : "blue-dot");

      dots.append(dot);

      if (scheduled.length > 1) {
        const extraDot = document.createElement("i");
        extraDot.className = "dot orange-dot";
        dots.append(extraDot);
      }
    }

    cell.append(dots);
    cell.title = scheduled.length
      ? `${scheduled.length} schedule(s)`
      : `Select ${formatDate(key)}`;

    cell.setAttribute("aria-label", formatDate(key));

    cell.addEventListener("click", () => {
      selectedDate = key;
      activePlanFilter = "all";

      viewDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      );

      renderAll();
    });

    grid.append(cell);
  }
}

// Previous month
if ($("prevMonth")) {
  $("prevMonth").addEventListener("click", () => {
    viewDate = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth() - 1,
      1
    );

    renderCalendar();
  });
}

// Next month
if ($("nextMonth")) {
  $("nextMonth").addEventListener("click", () => {
    viewDate = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth() + 1,
      1
    );

    renderCalendar();
  });
}

// Today button
if ($("todayButton")) {
  $("todayButton").addEventListener("click", () => {
    selectedDate = dateKey(new Date());

    viewDate = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    activePlanFilter = "all";
    renderAll();
  });
}

// ========================================
// 6. DASHBOARD COUNTS
// ========================================

function renderStats() {
  if ($("todayLabel")) {
    $("todayLabel").textContent = formatDate(
      dateKey(new Date()),
      { day: "numeric", month: "short", year: "numeric" }
    );
  }

  if ($("totalCount")) {
    $("totalCount").textContent = plans.length;
  }

  if ($("completedCount")) {
    $("completedCount").textContent =
      plans.filter(plan => plan.completed).length;
  }

  if ($("upcomingCount")) {
    $("upcomingCount").textContent = plans.filter(plan =>
      !plan.completed &&
      timestamp(plan.date, plan.time) > Date.now()
    ).length;
  }

  if ($("notesCount")) {
    $("notesCount").textContent = notes.length;
  }
}

// ========================================
// 7. RENDER DAILY SCHEDULES
// ========================================

function renderDayPlans() {
  const container = $("dayPlans");
  if (!container) return;

  if ($("selectedDateTitle")) {
    $("selectedDateTitle").textContent =
      formatDate(selectedDate, {
        day: "numeric",
        month: "short"
      });
  }

  if ($("selectedDateSubtitle")) {
    $("selectedDateSubtitle").textContent =
      formatDate(selectedDate, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
  }

  container.replaceChildren();

  const dayPlans = plans
    .filter(plan => plan.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (!dayPlans.length) {
    const empty = document.createElement("div");
    empty.className = "empty";

    empty.innerHTML = `
      <div class="empty-icon">
        <i class="fa-regular fa-calendar"></i>
      </div>
      <h3>No plans for this date</h3>
      <p>Select another date or add a schedule for this day.</p>
    `;

    container.append(empty);
    return;
  }

  dayPlans.forEach(plan => {
    const card = document.createElement("article");

    card.className = "plan-card" +
      (plan.completed ? " completed" : "");

    card.innerHTML = `
      <div class="plan-top">
        <div>
          <h3>${escapeHTML(plan.title)}</h3>
          <div class="plan-time">
            <i class="fa-regular fa-clock"></i>
            ${escapeHTML(formatTime(plan.time))}
          </div>
        </div>

        <div class="plan-actions">
          <button class="small-btn" data-action="complete"
            aria-label="Toggle completed" title="Complete">
            <i class="fa-solid ${
              plan.completed ? "fa-rotate-left" : "fa-check"
            }"></i>
          </button>

          <button class="small-btn" data-action="edit"
            aria-label="Edit schedule" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>

          <button class="small-btn delete" data-action="delete"
            aria-label="Delete schedule" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      ${plan.description
        ? `<p class="plan-description">${escapeHTML(plan.description)}</p>`
        : ""}

      <span class="category">${escapeHTML(plan.category)}</span>

      ${plan.reminder
        ? `<div class="reminder-info">
             <i class="fa-regular fa-bell"></i> Reminder enabled
           </div>`
        : ""}
    `;

    card.querySelectorAll("[data-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;

        if (action === "edit") {
          openPlanModal(plan);
        }

        if (action === "complete") {
          const oldValue = plan.completed;
          plan.completed = !oldValue;

          if (!persist(STORAGE.plans, plans)) {
            plan.completed = oldValue;
            return;
          }

          renderAll();
          toast("Schedule status updated!");
        }

        if (action === "delete") {
          if (!confirm("Delete this schedule?")) return;

          const oldPlans = plans;
          const oldSent = new Set(sent);

          plans = plans.filter(item => item.id !== plan.id);
          sent.delete(plan.id);

          if (!persist(STORAGE.plans, plans)) {
            plans = oldPlans;
            sent = oldSent;
            return;
          }

          persist(STORAGE.sent, [...sent]);
          renderAll();
          toast("Schedule deleted!");
        }
      });
    });

    container.append(card);
  });
}

// ========================================
// 8. ADD & EDIT SCHEDULE
// ========================================

function openPlanModal(plan = null) {
  $("planForm").reset();

  $("planId").value = plan?.id || "";
  $("modalTitle").textContent = plan
    ? "Edit schedule"
    : "Create a schedule";

  $("planTitle").value = plan?.title || "";
  $("planDate").value = plan?.date || selectedDate;
  $("planTime").value = plan?.time || "09:00";
  $("planCategory").value = plan?.category || "Study";
  $("planDescription").value = plan?.description || "";
  $("planReminder").checked = plan?.reminder || false;

  $("planModal").classList.remove("hidden");
}

function closePlanModal() {
  $("planModal").classList.add("hidden");
}

if ($("addPlan")) {
  $("addPlan").addEventListener("click", () => openPlanModal());
}

if ($("topAdd")) {
  $("topAdd").addEventListener("click", () => openPlanModal());
}

$("closeModal")?.addEventListener("click", closePlanModal);
$("cancelPlan")?.addEventListener("click", closePlanModal);

$("planModal")?.addEventListener("click", event => {
  if (event.target === $("planModal")) {
    closePlanModal();
  }
});

// ========================================
// 9. BROWSER NOTIFICATIONS
// ========================================

async function requestPermission() {
  if (!("Notification" in window)) {
    toast("This browser does not support notifications.");
    return false;
  }

  if (Notification.permission === "granted") return true;

  if (Notification.permission === "denied") {
    toast("Allow notifications in your browser site settings.");
    return false;
  }

  try {
    return await Notification.requestPermission() === "granted";
  } catch (error) {
    console.error(error);
    toast("Could not request notification permission.");
    return false;
  }
}

$("planReminder")?.addEventListener("change", async event => {
  if (event.target.checked && !(await requestPermission())) {
    event.target.checked = false;
    toast("Reminder disabled. Notification permission is required.");
  }
});

$("planForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("planId").value;
  const oldPlan = plans.find(plan => plan.id === id);

  if ($("planReminder").checked && !(await requestPermission())) {
    toast("Allow notifications or turn off the reminder option.");
    return;
  }

  const plan = {
    id: id || makeId(),
    title: $("planTitle").value.trim(),
    date: $("planDate").value || dateKey(new Date()),
time: $("planTime").value || "09:00",
    category: $("planCategory").value,
    description: $("planDescription").value.trim(),
    reminder: $("planReminder").checked,
    completed: oldPlan?.completed || false
  };

if (!plan.title) {
  toast("Please enter a schedule title.");
  return;
}

  // Save before closing the modal.
  const oldPlans = plans;
  const oldSent = new Set(sent);

  plans = id
    ? plans.map(item => item.id === id ? plan : item)
    : [...plans, plan];

  // Editing a schedule allows a reminder for its new time.
  if (id) sent.delete(id);

  if (!persist(STORAGE.plans, plans)) {
    plans = oldPlans;
    sent = oldSent;
    return;
  }

  persist(STORAGE.sent, [...sent]);

  selectedDate = plan.date;

  const [year, month] = plan.date.split("-").map(Number);
  viewDate = new Date(year, month - 1, 1);

  activePlanFilter = "all";

  closePlanModal();
  renderAll();

  toast(id
    ? "Schedule updated successfully!"
    : "Schedule saved successfully!");
});

// Check every five seconds while the page is open.
function checkReminders() {
  if (!("Notification" in window) ||
      Notification.permission !== "granted") {
    return;
  }

  const now = Date.now();
  let changed = false;

  plans.forEach(plan => {
    if (!plan.reminder || plan.completed || sent.has(plan.id)) {
      return;
    }

    const scheduledTime = timestamp(plan.date, plan.time);

    // Notify within the first two minutes after scheduled time.
    if (now >= scheduledTime && now - scheduledTime < 120000) {
      // Mark first to avoid duplicate alerts.
      sent.add(plan.id);
      changed = true;

      try {
        const notification = new Notification("Daybook Reminder 🔔", {
          body: `${plan.title} — it's time for your schedule!`,
          tag: `daybook-${plan.id}`
        });

        notification.onclick = () => {
          window.focus();
          selectedDate = plan.date;

          const [year, month] = plan.date.split("-").map(Number);
          viewDate = new Date(year, month - 1, 1);

          showPage("calendar");
          renderAll();
          notification.close();
        };
      } catch (error) {
        console.error("Notification error:", error);
      }
    }
  });

  if (changed) persist(STORAGE.sent, [...sent]);
}

// ========================================
// 10. NOTES: SAVE, EDIT, DELETE
// ========================================

function renderNotes() {
  const list = $("notesList");
  if (!list) return;

  list.replaceChildren();

  if (!notes.length) {
    const empty = document.createElement("div");
    empty.className = "empty";

    empty.innerHTML = `
      <div class="empty-icon">
        <i class="fa-regular fa-note-sticky"></i>
      </div>
      <h3>No notes saved yet</h3>
      <p>Create a note to keep your ideas in one place.</p>
    `;

    list.append(empty);
    return;
  }

  [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach(note => {
      const card = document.createElement("article");
      card.className = "note-card";

      card.innerHTML = `
        <h3>${escapeHTML(note.title)}</h3>
        <p>${escapeHTML(note.body)}</p>
        <div class="note-meta">
          <span>${new Date(note.updatedAt).toLocaleDateString()}</span>
          <div class="note-actions">
            <button class="small-btn" data-edit aria-label="Edit note">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="small-btn delete" data-delete aria-label="Delete note">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;

      card.querySelector("[data-edit]").addEventListener("click", () => {
        editingNoteId = note.id;
        $("noteTitle").value = note.title;
        $("noteBody").value = note.body;
        $("noteForm").classList.remove("hidden");
        $("noteTitle").focus();
      });

      card.querySelector("[data-delete]").addEventListener("click", () => {
        if (!confirm("Delete this note?")) return;

        const oldNotes = notes;
        notes = notes.filter(item => item.id !== note.id);

        if (!persist(STORAGE.notes, notes)) {
          notes = oldNotes;
          return;
        }

        renderAll();
        toast("Note deleted!");
      });

      list.append(card);
    });
}

$("newNote")?.addEventListener("click", () => {
  editingNoteId = null;
  $("noteForm").reset();
  $("noteForm").classList.remove("hidden");
  $("noteTitle").focus();
});

$("cancelNote")?.addEventListener("click", () => {
  editingNoteId = null;
  $("noteForm").reset();
  $("noteForm").classList.add("hidden");
});

$("noteForm")?.addEventListener("submit", event => {
  event.preventDefault();

  const title = $("noteTitle").value.trim();
  const body = $("noteBody").value.trim();

  if (!title || !body) {
    toast("Enter a title and note.");
    return;
  }

  const oldNotes = notes;

  const note = {
    id: editingNoteId || makeId(),
    title,
    body,
    updatedAt: Date.now()
  };

  notes = editingNoteId
    ? notes.map(item => item.id === editingNoteId ? note : item)
    : [...notes, note];

  if (!persist(STORAGE.notes, notes)) {
    notes = oldNotes;
    return;
  }

  editingNoteId = null;
  $("noteForm").reset();
  $("noteForm").classList.add("hidden");

  renderAll();
  toast("Note saved successfully!");
});

// ========================================
// 11. FOUR DASHBOARD CARDS
// ========================================

function showPage(page) {
  const isNotes = page === "notes";

  $("calendarPage").classList.toggle("hidden", isNotes);
  $("notesPage").classList.toggle("hidden", !isNotes);
  $("topAdd").classList.toggle("hidden", isNotes);

  $("pageTitle").textContent = isNotes ? "My Notes" : "My Calendar";

  $("pageSubtitle").textContent = isNotes
    ? "Capture your thoughts and ideas."
    : "Make space for what matters.";

  $("breadcrumb").textContent = isNotes ? "My Notes" : "My Calendar";

  document.querySelectorAll(".nav").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });
}

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", () => {
    activePlanFilter = "all";
    showPage(button.dataset.page);
    renderAll();
  });
});

function showFilteredPlans(filter) {
  if (filter === "notes") {
    showPage("notes");
    return;
  }

  activePlanFilter = filter;
  showPage("calendar");

  const titles = {
    all: "All saved plans",
    completed: "Completed plans",
    upcoming: "Upcoming plans"
  };

  $("selectedDateTitle").textContent = titles[filter];

  $("selectedDateSubtitle").textContent = {
    all: "Every schedule you have saved",
    completed: "Schedules you have finished",
    upcoming: "Your unfinished future schedules"
  }[filter];

  const container = $("dayPlans");
  container.replaceChildren();

  const now = Date.now();

  const filtered = plans
    .filter(plan => {
      if (filter === "completed") return plan.completed;

      if (filter === "upcoming") {
        return !plan.completed &&
          timestamp(plan.date, plan.time) > now;
      }

      return true;
    })
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      a.time.localeCompare(b.time)
    );

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";

    empty.innerHTML = `
      <div class="empty-icon">
        <i class="fa-regular fa-calendar"></i>
      </div>
      <h3>No schedules found</h3>
      <p>Schedules matching this category will appear here.</p>
    `;

    container.append(empty);
    return;
  }

  filtered.forEach(plan => {
    const card = document.createElement("article");
    card.className = "plan-card" +
      (plan.completed ? " completed" : "");

    card.innerHTML = `
      <div class="plan-top">
        <div>
          <h3>${escapeHTML(plan.title)}</h3>
          <div class="plan-time">
            ${escapeHTML(formatDate(plan.date, {
              day: "numeric", month: "short", year: "numeric"
            }))}
            · ${escapeHTML(formatTime(plan.time))}
          </div>
        </div>
        <button class="small-btn" data-open
          aria-label="Open schedule date" title="Open date">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </button>
      </div>
      ${plan.description
        ? `<p class="plan-description">${escapeHTML(plan.description)}</p>`
        : ""}
      <span class="category">${escapeHTML(plan.category)}</span>
    `;

    card.querySelector("[data-open]").addEventListener("click", () => {
      selectedDate = plan.date;

      const [year, month] = plan.date.split("-").map(Number);
      viewDate = new Date(year, month - 1, 1);

      activePlanFilter = "all";
      renderAll();
    });

    container.append(card);
  });
}

document.querySelectorAll(".stat-clickable").forEach(card => {
  card.addEventListener("click", () => {
    showFilteredPlans(card.dataset.filter);
  });
});

// ========================================
// 12. RENDER EVERYTHING
// ========================================

function renderAll() {
  renderStats();
  renderCalendar();
  renderDayPlans();
  renderNotes();
}

// Initial theme and page render.
setTheme(readStorage(STORAGE.theme, "light"));
renderAll();
checkReminders();

// Update upcoming count and check reminders periodically.
setInterval(() => {
  renderStats();
  checkReminders();
}, 5000);

// Refresh the display when returning to the browser tab.
window.addEventListener("focus", () => {
  renderAll();
  checkReminders();
});

// Refresh when returning from another tab.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    renderAll();
    checkReminders();
  }
});
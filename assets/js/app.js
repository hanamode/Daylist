(() => {
  "use strict";

  const STORAGE_KEY = "daylist.week.v2";
  const LEGACY_KEY = "daylist.plan.v1";

  const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const DAY_FULL = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
  const DAY_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const $ = (selector) => document.querySelector(selector);

  const form = $("#addForm");
  const dayInput = $("#dayInput");
  const startHourInput = $("#startHourInput");
  const startMinuteInput = $("#startMinuteInput");
  const endHourInput = $("#endHourInput");
  const endMinuteInput = $("#endMinuteInput");
  const activityInput = $("#activityInput");
  const formError = $("#formError");
  const weekBoard = $("#weekBoard");
  const weekRange = $("#weekRange");
  const weekNumber = $("#weekNumber");
  const weekTag = $("#weekTag");
  const weekReturn = $("#weekReturn");
  const itemCount = $("#itemCount");
  const todayProgressText = $("#todayProgressText");
  const todayProgressBar = $("#todayProgressBar");
  const todayProgressFill = $("#todayProgressFill");
  const progressText = $("#progressText");
  const progressBar = $("#progressBar");
  const progressFill = $("#progressFill");
  const saveState = $("#saveState");
  const saveDot = $("#saveDot");
  const live = $("#live");
  const toast = $("#toast");
  const toastText = $("#toastText");
  const toastUndo = $("#toastUndo");

  const current = new Date();
  const state = { entries: [] };
  let viewWeekStart = startOfWeek(current);
  let selectedDate = dateKey(current);
  let justAddedId = null;
  let lastDateKey = dateKey(current);
  let copySourceDate = null;
  let toastTimer = null;
  let toastHideTimer = null;
  let toastUndoAction = null;

  const timeSegments = [startHourInput, startMinuteInput, endHourInput, endMinuteInput];
  const nextSegment = new Map([
    [startHourInput, startMinuteInput],
    [startMinuteInput, endHourInput],
    [endHourInput, endMinuteInput]
  ]);

  /* ---------- 日期与时间 ---------- */
  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function dotDate(date) {
    return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
  }

  function monthDay(date) {
    return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
  }

  function startOfWeek(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - offset);
    return result;
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function isoWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function weekDates() {
    return Array.from({ length: 7 }, (_, index) => addDays(viewWeekStart, index));
  }

  function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return (hours * 60) + minutes;
  }

  function normalizeTime(value) {
    const raw = String(value || "").trim().replace(/：/g, ":");
    if (!raw) return null;

    let hours;
    let minutes;

    if (raw.includes(":")) {
      const parts = raw.split(":");
      if (parts.length !== 2) return null;
      if (!/^\d{1,2}$/.test(parts[0]) || !/^\d{1,2}$/.test(parts[1])) return null;
      hours = Number(parts[0]);
      minutes = Number(parts[1]);
    } else {
      const digits = raw.replace(/\D/g, "");
      if (!digits || digits.length > 4) return null;
      if (digits.length <= 2) {
        hours = Number(digits);
        minutes = 0;
      } else if (digits.length === 3) {
        hours = Number(digits[0]);
        minutes = Number(digits.slice(1));
      } else {
        hours = Number(digits.slice(0, 2));
        minutes = Number(digits.slice(2));
      }
    }

    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return `${pad2(hours)}:${pad2(minutes)}`;
  }

  function readTypedTime(hourInput, minuteInput) {
    const hourText = hourInput.value.trim();
    const minuteText = minuteInput.value.trim();

    if (!hourText && !minuteText) return { status: "empty", value: null };
    if (!/^\d{1,2}$/.test(hourText) || !/^\d{1,2}$/.test(minuteText)) {
      return { status: "invalid", value: null };
    }

    const hours = Number(hourText);
    const minutes = Number(minuteText);
    if (hours > 23 || minutes > 59) return { status: "invalid", value: null };
    return { status: "ok", value: `${pad2(hours)}:${pad2(minutes)}` };
  }

  function readTimeRange() {
    return {
      start: readTypedTime(startHourInput, startMinuteInput),
      end: readTypedTime(endHourInput, endMinuteInput)
    };
  }

  function clearTimeFields() {
    timeSegments.forEach((input) => {
      input.value = "";
      input.removeAttribute("aria-invalid");
    });
  }

  function tidyTimeSegment(input) {
    if (!input.value) return;
    input.value = pad2(Number(input.value));
  }

  function isCurrentWeek() {
    return dateKey(viewWeekStart) === dateKey(startOfWeek(new Date()));
  }

  function weekDayInfo(dateString) {
    const dates = weekDates();
    const index = dates.findIndex((date) => dateKey(date) === dateString);
    if (index < 0) return null;
    return {
      index,
      date: dates[index],
      name: DAY_NAMES[index],
      fullName: DAY_FULL[index],
      label: monthDay(dates[index])
    };
  }

  function dayNameFor(dateString) {
    return weekDayInfo(dateString)?.name || "";
  }

  function updateDateLabels(date) {
    const weekday = DAY_NAMES[(date.getDay() + 6) % 7];
    $("#topDate").textContent = `${dotDate(date)} · ${weekday}`;
    $("#footDate").textContent = `${dotDate(date)} ${DAY_EN[date.getDay()]}`;
  }

  function updateClock() {
    const date = new Date();
    $("#topClock").textContent = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
    $("#clock").textContent = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

    if (dateKey(date) !== lastDateKey) {
      lastDateKey = dateKey(date);
      updateDateLabels(date);
      updateTodayProgress();
    }
  }

  /* ---------- 本地存储 ---------- */
  function setSaveState(message, error) {
    if (!saveState || !saveDot) return;
    saveState.textContent = message;
    saveDot.classList.toggle("is-error", Boolean(error));
  }

  function saveEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        entries: state.entries
      }));
      setSaveState("已保存到本机", false);
      return true;
    } catch (error) {
      setSaveState("未能保存到本机", true);
      return false;
    }
  }

  function cleanEntry(entry) {
    if (!entry || typeof entry.title !== "string") return null;

    const start = normalizeTime(String(entry.start || ""));
    const end = normalizeTime(String(entry.end || ""));
    const date = String(entry.date || "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    if (!start || !end || timeToMinutes(end) <= timeToMinutes(start)) return null;

    return {
      id: String(entry.id || makeId()),
      date,
      start,
      end,
      title: entry.title.slice(0, 80),
      done: Boolean(entry.done),
      createdAt: Number(entry.createdAt) || Date.now()
    };
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.entries)) {
          state.entries = saved.entries.map(cleanEntry).filter(Boolean);
        }
        return;
      }

      migrateLegacyEntries();
    } catch (error) {
      setSaveState("未能读取本机存储", true);
    }
  }

  // 兼容上一版「今日清单」留下的本地数据。
  function migrateLegacyEntries() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.entries) || !/^\d{4}-\d{2}-\d{2}$/.test(saved.date)) return;

      const migrated = saved.entries.map((entry, index) => {
        const start = normalizeTime(String(entry.time || ""));
        if (!start || typeof entry.title !== "string") return null;
        const end = addOneHour(start);
        if (!end) return null;

        return {
          id: String(entry.id || makeId()),
          date: saved.date,
          start,
          end,
          title: entry.title.slice(0, 80),
          done: Boolean(entry.done),
          createdAt: Number(entry.createdAt) || (Date.now() + index)
        };
      }).filter(Boolean);

      if (!migrated.length) return;

      state.entries = migrated;
      saveEntries();
    } catch (error) {
      // 旧数据不可读时不影响新版本使用。
    }
  }

  function addOneHour(time) {
    const minutes = timeToMinutes(time) + 60;
    if (minutes >= 1440) return null;
    return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /* ---------- 周的显示 ---------- */
  function updateWeekChrome() {
    const end = addDays(viewWeekStart, 6);
    const sameYear = viewWeekStart.getFullYear() === end.getFullYear();
    const endLabel = sameYear ? monthDay(end) : dotDate(end);

    weekRange.textContent = `${dotDate(viewWeekStart)} – ${endLabel}`;
    weekNumber.textContent = `第 ${isoWeekNumber(viewWeekStart)} 周`;
    weekTag.textContent = `第 ${isoWeekNumber(viewWeekStart)} 周`;
    weekReturn.hidden = isCurrentWeek();
  }

  function renderDayOptions() {
    const dates = weekDates();
    const fragment = document.createDocumentFragment();

    dates.forEach((date, index) => {
      const option = document.createElement("option");
      option.value = dateKey(date);
      option.textContent = `${DAY_NAMES[index]} · ${monthDay(date)}`;
      fragment.append(option);
    });

    dayInput.replaceChildren(fragment);

    if (!dates.some((date) => dateKey(date) === selectedDate)) {
      selectedDate = dateKey(dates[0]);
    }
    dayInput.value = selectedDate;
  }

  /* ---------- 周表 ---------- */
  function compareEntries(a, b) {
    return a.start.localeCompare(b.start) || a.createdAt - b.createdAt;
  }

  function entriesForWeek() {
    const start = dateKey(viewWeekStart);
    const end = dateKey(addDays(viewWeekStart, 6));

    return state.entries
      .filter((entry) => entry.date >= start && entry.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date) || compareEntries(a, b));
  }

  function entriesForDate(dateString) {
    return state.entries
      .filter((entry) => entry.date === dateString)
      .sort(compareEntries);
  }

  function entryKey(entry) {
    return `${entry.start}|${entry.end}|${entry.title}`;
  }

  function updateProgressView(textElement, bar, fill, done, total) {
    textElement.textContent = `${done} / ${total}`;
    bar.setAttribute("aria-valuemax", String(total));
    bar.setAttribute("aria-valuenow", String(done));
    bar.setAttribute("aria-valuetext", `${done} / ${total} 完成`);
    fill.style.width = total ? `${(done / total) * 100}%` : "0%";
  }

  function updateTodayProgress() {
    const todayKey = dateKey(new Date());
    const todayEntries = state.entries.filter((entry) => entry.date === todayKey);
    const done = todayEntries.filter((entry) => entry.done).length;
    updateProgressView(todayProgressText, todayProgressBar, todayProgressFill, done, todayEntries.length);
  }

  function updateDaySelection() {
    dayInput.value = selectedDate;
    weekBoard.querySelectorAll(".day-col").forEach((column) => {
      const isSelected = column.dataset.date === selectedDate;
      column.classList.toggle("is-selected", isSelected);
      const button = column.querySelector(".day-select");
      if (button) button.setAttribute("aria-pressed", String(isSelected));
    });
  }

  function makeDayIconButton(type, label, svg) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-icon-btn";
    button.dataset.dayIcon = type;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = svg;
    return button;
  }

  function renderWeek() {
    updateWeekChrome();

    const entries = entriesForWeek();
    const total = entries.length;
    const done = entries.filter((entry) => entry.done).length;
    const byDate = new Map(weekDates().map((date) => [dateKey(date), []]));

    entries.forEach((entry) => {
      if (byDate.has(entry.date)) byDate.get(entry.date).push(entry);
    });

    itemCount.textContent = `${pad2(total)} ITEMS`;
    updateProgressView(progressText, progressBar, progressFill, done, total);
    updateTodayProgress();

    const today = dateKey(new Date());
    const fragment = document.createDocumentFragment();

    weekDates().forEach((date, index) => {
      const key = dateKey(date);
      const dayEntries = byDate.get(key) || [];
      const column = document.createElement("section");
      column.className = "day-col"
        + (key === today ? " is-today" : "")
        + (key === selectedDate ? " is-selected" : "");
      column.dataset.date = key;
      const isToday = key === today;
      column.setAttribute(
        "aria-label",
        `${isToday ? "今天，" : ""}${DAY_FULL[index]} ${monthDay(date)}，${dayEntries.length} 项`
      );

      const head = document.createElement("header");
      head.className = "day-head";

      const dayButton = document.createElement("button");
      dayButton.type = "button";
      dayButton.className = "day-select";
      dayButton.dataset.daySelect = key;
      dayButton.setAttribute("aria-pressed", String(key === selectedDate));
      const baseLabel = `${isToday ? "今天，" : ""}选择${DAY_FULL[index]} ${monthDay(date)}，共 ${dayEntries.length} 项`;
      dayButton.dataset.baseLabel = baseLabel;
      dayButton.setAttribute("aria-label", baseLabel);

      const dayName = document.createElement("span");
      dayName.className = "day-name";
      dayName.textContent = DAY_NAMES[index];

      const dayDate = document.createElement("span");
      dayDate.className = "day-date";
      dayDate.textContent = monthDay(date);

      dayButton.append(dayName, dayDate);

      const headMain = document.createElement("div");
      headMain.className = "day-head-main";
      headMain.append(dayButton);

      if (key === selectedDate && dayEntries.length) {
        const actions = document.createElement("div");
        actions.className = "day-icon-actions";

        const copyButton = makeDayIconButton(
          "copy",
          `复制${DAY_FULL[index]} ${monthDay(date)} 的日程到另一天`,
          `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5.2" y="5.2" width="7.4" height="7.4" stroke="currentColor" stroke-width="1.2"/>
            <path d="M10.6 5.2V3.4H3.4v7.2h2" stroke="currentColor" stroke-width="1.2"/>
          </svg>`
        );

        const clearButton = makeDayIconButton(
          "clear",
          `清除${DAY_FULL[index]} ${monthDay(date)} 的日程`,
          `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3.2 4.5h9.6M6.2 4.5V3h3.6v1.5M4.7 4.5l.5 8.2h5.6l.5-8.2M6.8 7v3.6M9.2 7v3.6"
                  stroke="currentColor" stroke-width="1.15" stroke-linecap="square"/>
          </svg>`
        );
        clearButton.classList.add("is-danger");

        actions.append(copyButton, clearButton);
        headMain.append(actions);
      }

      const count = document.createElement("span");
      count.className = "day-count";
      count.setAttribute("aria-hidden", "true");
      count.textContent = pad2(dayEntries.length);

      head.append(headMain, count);

      const body = document.createElement("div");
      body.className = "day-body";

      if (!dayEntries.length) {
        const empty = document.createElement("div");
        empty.className = "day-empty";
        empty.textContent = "—";
        empty.setAttribute("aria-label", "暂无安排");
        body.append(empty);
      } else {
        const list = document.createElement("ol");
        list.className = "day-entries";

        dayEntries.forEach((entry) => {
          list.append(makeSlot(entry, DAY_FULL[index], monthDay(date)));
        });

        body.append(list);
      }

      column.append(head, body);
      fragment.append(column);
    });

    weekBoard.replaceChildren(fragment);
    justAddedId = null;
  }

  function makeSlot(entry, dayLabel, dateLabel) {
    const slot = document.createElement("li");
    slot.className = "slot" + (entry.done ? " is-done" : "");
    slot.dataset.id = entry.id;
    if (entry.id === justAddedId) slot.classList.add("is-new");

    const time = document.createElement("span");
    time.className = "slot-time";
    time.textContent = `${entry.start}–${entry.end}`;

    const check = document.createElement("button");
    check.type = "button";
    check.className = "slot-check";
    check.dataset.action = "toggle";
    check.setAttribute("aria-pressed", String(entry.done));
    check.setAttribute(
      "aria-label",
      `${entry.done ? "取消完成" : "标记完成"}：${dayLabel} ${dateLabel} ${entry.start} 至 ${entry.end}，${entry.title}`
    );
    check.innerHTML = `
      <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M1.5 5.1 4 7.5 8.6 2.4" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    `;

    const title = document.createElement("span");
    title.className = "slot-title";
    title.textContent = entry.title;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "slot-delete";
    remove.dataset.action = "delete";
    remove.title = "删除";
    remove.setAttribute("aria-label", `删除：${dayLabel} ${dateLabel} ${entry.start} 至 ${entry.end}，${entry.title}`);
    remove.textContent = "×";

    slot.append(time, check, title, remove);
    return slot;
  }

  function announce(message) {
    live.textContent = "";
    window.setTimeout(() => {
      live.textContent = message;
    }, 30);
  }

  function hideToast() {
    window.clearTimeout(toastTimer);
    toast.classList.remove("is-visible");
    toastUndo.hidden = true;
    toastUndoAction = null;
    window.clearTimeout(toastHideTimer);
    toastHideTimer = window.setTimeout(() => {
      if (!toast.classList.contains("is-visible")) toast.hidden = true;
    }, 220);
  }

  function showToast(message, { undo = null, duration = 2600 } = {}) {
    window.clearTimeout(toastTimer);
    window.clearTimeout(toastHideTimer);
    toastText.textContent = message;
    toastUndo.hidden = !undo;
    toastUndoAction = undo;
    toast.hidden = false;
    window.requestAnimationFrame(() => toast.classList.add("is-visible"));
    toastTimer = window.setTimeout(hideToast, duration);
  }

  /* ---------- 周切换 ---------- */
  function shiftWeek(direction) {
    if (copySourceDate) cancelCopyMode({ restoreFocus: false, silent: true });
    const dates = weekDates();
    let dayIndex = dates.findIndex((date) => dateKey(date) === selectedDate);
    if (dayIndex < 0) dayIndex = 0;

    viewWeekStart = addDays(viewWeekStart, direction * 7);
    selectedDate = dateKey(addDays(viewWeekStart, dayIndex));

    renderDayOptions();
    renderWeek();
  }

  function goToCurrentWeek() {
    if (copySourceDate) cancelCopyMode({ restoreFocus: false, silent: true });
    viewWeekStart = startOfWeek(new Date());
    selectedDate = dateKey(new Date());
    renderDayOptions();
    renderWeek();
  }

  $("#prevWeek").addEventListener("click", () => shiftWeek(-1));
  $("#nextWeek").addEventListener("click", () => shiftWeek(1));
  weekReturn.addEventListener("click", goToCurrentWeek);

  /* ---------- 复制 / 清除 ---------- */
  function startCopyMode(sourceDate) {
    if (copySourceDate === sourceDate) {
      cancelCopyMode();
      return;
    }

    if (copySourceDate) cancelCopyMode({ restoreFocus: false, silent: true });

    copySourceDate = sourceDate;
    weekBoard.querySelectorAll(".day-col").forEach((column) => {
      const isSource = column.dataset.date === sourceDate;
      column.classList.toggle("is-copy-source", isSource);
      column.classList.toggle("is-copy-target", !isSource);

      const dayButton = column.querySelector(".day-select");
      if (!dayButton) return;
      if (isSource) {
        if (dayButton.dataset.baseLabel) dayButton.setAttribute("aria-label", dayButton.dataset.baseLabel);
      } else {
        const info = weekDayInfo(column.dataset.date);
        const count = entriesForDate(column.dataset.date).length;
        if (info) {
          dayButton.setAttribute("aria-label", `复制到${info.fullName} ${info.label}，当前 ${count} 项`);
        }
      }
    });

    const sourceColumn = weekBoard.querySelector(`.day-col[data-date="${cssEscape(sourceDate)}"]`);
    sourceColumn?.querySelector('[data-day-icon="copy"]')?.classList.add("is-active");
    announce("复制模式：点击另一天的标题即可复制。按 Esc 取消。");
  }

  function cancelCopyMode({ restoreFocus = true, silent = false } = {}) {
    if (!copySourceDate) return;

    const sourceDate = copySourceDate;
    copySourceDate = null;

    weekBoard.querySelectorAll(".day-col").forEach((column) => {
      column.classList.remove("is-copy-source", "is-copy-target");
      const dayButton = column.querySelector(".day-select");
      if (dayButton?.dataset.baseLabel) {
        dayButton.setAttribute("aria-label", dayButton.dataset.baseLabel);
      }
    });

    const sourceColumn = weekBoard.querySelector(`.day-col[data-date="${cssEscape(sourceDate)}"]`);
    sourceColumn?.querySelector('[data-day-icon="copy"]')?.classList.remove("is-active");

    if (!silent) announce("已取消复制");
    if (restoreFocus && sourceColumn) {
      const sourceButton = sourceColumn.querySelector('[data-day-icon="copy"]')
        || sourceColumn.querySelector(".day-select");
      sourceButton?.focus();
    }
  }

  function copyDaySchedule(targetDate) {
    if (!copySourceDate) return;

    const sourceDate = copySourceDate;
    const targetInfo = weekDayInfo(targetDate);
    const sourceEntries = entriesForDate(sourceDate);
    if (!targetInfo || !sourceEntries.length) {
      cancelCopyMode({ restoreFocus: false });
      return;
    }

    const existingKeys = new Set(entriesForDate(targetDate).map(entryKey));
    const stamp = Date.now();
    let copied = 0;

    sourceEntries.forEach((entry, index) => {
      const key = entryKey(entry);
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      state.entries.push({
        id: makeId(),
        date: targetDate,
        start: entry.start,
        end: entry.end,
        title: entry.title,
        done: false,
        createdAt: stamp + index
      });
      copied += 1;
    });

    cancelCopyMode({ restoreFocus: false, silent: true });
    if (copied) saveEntries();

    selectedDate = targetDate;
    renderWeek();
    updateDaySelection();

    if (copied) {
      showToast(`已复制 ${copied} 项到 ${targetInfo.name} ${targetInfo.label}`);
    } else {
      showToast(`${targetInfo.name} ${targetInfo.label} 已有相同日程，未重复复制`);
    }

    const targetColumn = weekBoard.querySelector(`.day-col[data-date="${cssEscape(targetDate)}"]`);
    const focusTarget = targetColumn?.querySelector('[data-day-icon="copy"]')
      || targetColumn?.querySelector(".day-select");
    focusTarget?.focus();
  }

  function clearSelectedDay() {
    const date = selectedDate;
    const info = weekDayInfo(date);
    const cleared = entriesForDate(date).map((entry) => ({ ...entry }));
    if (!info || !cleared.length) return;

    if (copySourceDate) cancelCopyMode({ restoreFocus: false, silent: true });

    state.entries = state.entries.filter((entry) => entry.date !== date);
    saveEntries();
    renderWeek();
    updateDaySelection();

    showToast(`已清除 ${info.fullName} ${info.label} 的 ${cleared.length} 项日程`, {
      duration: 6000,
      undo: () => {
        state.entries.push(...cleared);
        saveEntries();
        renderWeek();
        updateDaySelection();
        showToast(`已恢复 ${info.fullName} ${info.label} 的 ${cleared.length} 项日程`);

        const column = weekBoard.querySelector(`.day-col[data-date="${cssEscape(date)}"]`);
        const focusTarget = column?.querySelector('[data-day-icon="copy"]')
          || column?.querySelector(".day-select");
        focusTarget?.focus();
      }
    });

    const column = weekBoard.querySelector(`.day-col[data-date="${cssEscape(date)}"]`);
    column?.querySelector(".day-select")?.focus();
  }

  toastUndo.addEventListener("click", () => {
    if (!toastUndoAction) return;
    const action = toastUndoAction;
    hideToast();
    action();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && copySourceDate) {
      event.preventDefault();
      cancelCopyMode();
    }
  });

  document.addEventListener("click", (event) => {
    if (copySourceDate && !weekBoard.contains(event.target)) {
      cancelCopyMode({ restoreFocus: false });
    }
  });

  /* ---------- 表单 ---------- */
  function clearError() {
    form.classList.remove("is-invalid");
    formError.hidden = true;
    formError.textContent = "";
    document.querySelectorAll(".field").forEach((field) => field.classList.remove("is-invalid"));
    [dayInput, ...timeSegments, activityInput].forEach((input) => input.removeAttribute("aria-invalid"));
  }

  function showError(message, field) {
    form.classList.add("is-invalid");
    formError.textContent = message;
    formError.hidden = false;

    if (field === "time") {
      document.querySelector(".field-time").classList.add("is-invalid");
      timeSegments.forEach((input) => input.setAttribute("aria-invalid", "true"));

      const empty = timeSegments.find((input) => !input.value);
      const invalid = timeSegments.find((input) => {
        const max = input === startHourInput || input === endHourInput ? 23 : 59;
        return input.value && Number(input.value) > max;
      });
      (empty || invalid || startHourInput).focus();
    } else {
      document.querySelector(".field-activity").classList.add("is-invalid");
      activityInput.setAttribute("aria-invalid", "true");
      activityInput.focus();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (copySourceDate) cancelCopyMode({ restoreFocus: false, silent: true });
    clearError();

    const timeRange = readTimeRange();
    const title = activityInput.value.trim().replace(/\s+/g, " ");

    if (timeSegments.some((input) => !input.value.trim())) {
      showError("请填写完整的开始和结束时间（时、分）。", "time");
      return;
    }
    if (timeRange.start.status !== "ok" || timeRange.end.status !== "ok") {
      showError("请输入有效时间：小时 00–23，分钟 00–59。", "time");
      return;
    }
    if (timeToMinutes(timeRange.end.value) <= timeToMinutes(timeRange.start.value)) {
      showError("结束时间需要晚于开始时间。", "time");
      return;
    }
    if (!title) {
      showError("请写下要完成的活动。", "activity");
      return;
    }

    const entry = {
      id: makeId(),
      date: dayInput.value,
      start: timeRange.start.value,
      end: timeRange.end.value,
      title: title.slice(0, 80),
      done: false,
      createdAt: Date.now()
    };

    state.entries.push(entry);
    selectedDate = entry.date;
    saveEntries();

    justAddedId = entry.id;
    renderWeek();
    updateDaySelection();

    clearTimeFields();
    activityInput.value = "";
    startHourInput.focus();

    announce(`已加入：${dayNameFor(entry.date)} ${entry.start} 至 ${entry.end}，${entry.title}`);
  });

  timeSegments.forEach((input) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 2);
      clearError();

      if (input.value.length === 2) {
        const next = nextSegment.get(input);
        if (next) {
          next.focus();
          next.select();
        }
      }
    });

    input.addEventListener("blur", () => tidyTimeSegment(input));
    input.addEventListener("change", clearError);
  });

  [dayInput, activityInput].forEach((input) => {
    input.addEventListener("input", clearError);
    input.addEventListener("change", clearError);
  });

  /* ---------- 选择星期 ---------- */
  dayInput.addEventListener("change", () => {
    if (copySourceDate) cancelCopyMode({ restoreFocus: false, silent: true });
    selectedDate = dayInput.value;
    renderWeek();
    updateDaySelection();
  });

  /* ---------- 打卡 / 删除 ---------- */
  weekBoard.addEventListener("click", (event) => {
    const iconButton = event.target.closest("[data-day-icon]");
    if (iconButton) {
      if (iconButton.dataset.dayIcon === "copy") {
        startCopyMode(selectedDate);
      } else if (iconButton.dataset.dayIcon === "clear") {
        clearSelectedDay();
      }
      return;
    }

    if (copySourceDate) {
      const dayHead = event.target.closest(".day-head");
      if (dayHead) {
        const targetDate = dayHead.closest(".day-col")?.dataset.date;
        if (!targetDate) return;
        if (targetDate === copySourceDate) {
          cancelCopyMode();
        } else {
          copyDaySchedule(targetDate);
        }
        return;
      }

      cancelCopyMode({ restoreFocus: false });
    }

    const dayButton = event.target.closest("[data-day-select]");
    if (dayButton) {
      selectedDate = dayButton.dataset.daySelect;
      renderWeek();
      updateDaySelection();
      const selected = weekBoard.querySelector(`[data-day-select="${cssEscape(selectedDate)}"]`);
      if (selected) selected.focus();
      return;
    }

    const actionButton = event.target.closest("button[data-action]");
    if (!actionButton) return;

    const slot = actionButton.closest(".slot");
    if (!slot) return;

    const id = slot.dataset.id;
    const index = state.entries.findIndex((entry) => entry.id === id);
    if (index < 0) return;

    const entry = state.entries[index];
    const dayLabel = dayNameFor(entry.date);

    if (actionButton.dataset.action === "toggle") {
      entry.done = !entry.done;
      saveEntries();
      renderWeek();
      announce(
        `${entry.done ? "已完成" : "已恢复为未完成"}：${dayLabel} ${entry.start} 至 ${entry.end}，${entry.title}`
      );

      const sameButton = weekBoard.querySelector(`[data-id="${cssEscape(id)}"] .slot-check`);
      if (sameButton) sameButton.focus();
    }

    if (actionButton.dataset.action === "delete") {
      const ordered = entriesForWeek();
      const visualIndex = ordered.findIndex((item) => item.id === id);
      const nextFocus = ordered[visualIndex + 1] || ordered[visualIndex - 1] || null;

      state.entries = state.entries.filter((item) => item.id !== id);
      saveEntries();
      renderWeek();
      announce(`已删除：${dayLabel} ${entry.start} 至 ${entry.end}，${entry.title}`);

      if (nextFocus) {
        const nextButton = weekBoard.querySelector(`[data-id="${cssEscape(nextFocus.id)}"] .slot-check`);
        if (nextButton) nextButton.focus();
      } else {
        dayInput.focus();
      }
    }
  });

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  /* ---------- 初始化 ---------- */
  updateDateLabels(current);
  updateClock();
  window.setInterval(updateClock, 1000);

  loadEntries();
  renderDayOptions();
  renderWeek();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateClock();
  });
})();

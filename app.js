(() => {
  "use strict";

  const STORAGE_KEY = "prince2_v7_practitioner_state_v1";
  const THEME_KEY = "color-scheme";

  const scenarios = window.PRINCE2_SCENARIOS || {};
  const papers = window.PRINCE2_PAPERS || [];
  const papersById = Object.fromEntries(papers.map((p) => [p.id, p]));

  const SYLLABUS_ORDER = [
    "PRINCIPLES",
    "PEOPLE",
    "BUSINESS CASE",
    "ORGANIZATION",
    "PLANS",
    "QUALITY",
    "RISK",
    "ISSUES",
    "PROGRESS",
    "PROCESSES"
  ];

  // Persistent app state
  const state = loadState();

  // Runtime UI state (non-persisted filters & timer)
  let sectionFilter = "ALL";
  let statusFilter = "ALL";
  let searchQuery = "";
  let singleIndex = 0; // Index into filtered display units in "single" mode
  let splitScenarioOpen = false;
  let resetScope = "current"; // "current" | "all"
  let nextMilestonePaperId = null;

  // Timer state
  let timerSecondsLeft = (papersById[state.activePaperId]?.durationMinutes || 150) * 60;
  let timerIntervalId = null;

  // DOM Elements
  const els = {
    announcer: document.getElementById("live-announcer"),
    officialTabs: document.getElementById("official-paper-tabs"),
    extendedTabs: document.getElementById("extended-paper-tabs"),
    extendedTrackLabel: document.getElementById("extended-track-label"),
    workspaceShell: document.getElementById("workspace-shell"),

    timerDisplay: document.getElementById("timer-display"),
    timerToggleBtn: document.getElementById("timer-toggle-btn"),
    timerResetBtn: document.getElementById("timer-reset-btn"),

    toggleSplitBtn: document.getElementById("toggle-split-scenario-btn"),
    openScenarioModalBtn: document.getElementById("open-scenario-modal-btn"),
    openSettingsBtn: document.getElementById("open-settings-btn"),

    passStatusBadge: document.getElementById("pass-status-badge"),
    kpiAnswered: document.getElementById("kpi-answered"),
    kpiScore: document.getElementById("kpi-score"),
    kpiTarget: document.getElementById("kpi-target"),
    progressBar: document.getElementById("paper-progress-bar"),
    officialMasteryCaption: document.getElementById("official-mastery-caption"),
    openResetDialogBtn: document.getElementById("open-reset-dialog-btn"),
    viewSyllabusBtn: document.getElementById("view-syllabus-breakdown-btn"),

    modeAllBtn: document.getElementById("mode-all-btn"),
    modeSingleBtn: document.getElementById("mode-single-btn"),
    questionNavGrid: document.getElementById("question-nav-grid"),

    exhaustionBanner: document.getElementById("exhaustion-banner"),
    exhaustionBannerActions: document.getElementById("exhaustion-banner-actions"),

    activePaperEyebrow: document.getElementById("active-paper-eyebrow"),
    activePaperTitle: document.getElementById("active-paper-title"),
    activeScenarioPill: document.getElementById("active-scenario-pill"),
    activePaperDesc: document.getElementById("active-paper-desc"),

    filterForm: document.getElementById("filter-form"),
    sectionFilterSelect: document.getElementById("section-filter"),
    statusFilterSelect: document.getElementById("status-filter"),
    searchInput: document.getElementById("search-input"),
    clearFiltersBtn: document.getElementById("clear-filters-btn"),
    filterSummaryBar: document.getElementById("filter-summary-bar"),
    filterSummaryText: document.getElementById("filter-summary-text"),

    questionsContainer: document.getElementById("questions-container"),
    singlePager: document.getElementById("single-mode-pager"),
    prevQuestionBtn: document.getElementById("prev-question-btn"),
    nextQuestionBtn: document.getElementById("next-question-btn"),
    singlePagerLabel: document.getElementById("single-pager-label"),

    splitPane: document.getElementById("split-scenario-pane"),
    splitTitle: document.getElementById("split-scenario-title"),
    closeSplitBtn: document.getElementById("close-split-scenario-btn"),
    splitScenarioSelect: document.getElementById("split-scenario-select"),
    splitScenarioBody: document.getElementById("split-scenario-body"),

    scenarioDialog: document.getElementById("scenario-dialog"),
    modalScenarioSelect: document.getElementById("modal-scenario-select"),
    modalScenarioBody: document.getElementById("modal-scenario-body"),

    settingsDialog: document.getElementById("settings-dialog"),
    syllabusBreakdownList: document.getElementById("syllabus-breakdown-list"),
    themeForm: document.getElementById("theme-form"),
    themeSystemLabel: document.getElementById("theme-system-label"),
    installPwaBtn: document.getElementById("install-pwa-btn"),
    overallProgressSummary: document.getElementById("overall-progress-summary"),
    resetAllProgressBtn: document.getElementById("reset-all-progress-btn"),

    milestoneDialog: document.getElementById("milestone-dialog"),
    milestoneKicker: document.getElementById("milestone-kicker"),
    milestoneTitle: document.getElementById("milestone-dialog-title"),
    milestoneBody: document.getElementById("milestone-dialog-body"),
    milestoneNextBtn: document.getElementById("milestone-next-paper-btn"),

    resetDialog: document.getElementById("reset-dialog"),
    resetDialogTitle: document.getElementById("reset-dialog-title"),
    resetDialogMessage: document.getElementById("reset-dialog-message")
  };

  function loadState() {
    const fallback = {
      activePaperId: papers[0]?.id || "paper1",
      viewMode: "all", // "all" | "single"
      answers: {},
      flags: {},
      celebratedPapers: {}
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        activePaperId: papersById[parsed.activePaperId] ? parsed.activePaperId : fallback.activePaperId,
        viewMode: parsed.viewMode === "single" ? "single" : "all",
        answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
        flags: parsed.flags && typeof parsed.flags === "object" ? parsed.flags : {},
        celebratedPapers:
          parsed.celebratedPapers && typeof parsed.celebratedPapers === "object"
            ? parsed.celebratedPapers
            : {}
      };
    } catch (_) {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function getActivePaper() {
    return papersById[state.activePaperId] || papers[0];
  }

  function getPaperAnswers(paperId) {
    if (!state.answers[paperId]) state.answers[paperId] = {};
    return state.answers[paperId];
  }

  function getPaperFlags(paperId) {
    if (!state.flags[paperId]) state.flags[paperId] = {};
    return state.flags[paperId];
  }

  function computePaperStats(paper) {
    const ansMap = getPaperAnswers(paper.id);
    let answered = 0;
    let correct = 0;
    for (const q of paper.questions) {
      const pick = ansMap[q.number];
      if (pick) {
        answered += 1;
        if (pick === q.answer) correct += 1;
      }
    }
    const pct = paper.totalMarks > 0 ? Math.round((correct / paper.totalMarks) * 100) : 0;
    return {
      answered,
      correct,
      total: paper.totalMarks,
      passMarks: paper.passMarks,
      pct,
      isComplete: answered === paper.totalMarks,
      isPassing: correct >= paper.passMarks
    };
  }

  function computeOfficialBankProgress() {
    const officialPapers = papers.filter((p) => p.isOfficial);
    let answered = 0;
    let total = 0;
    let correct = 0;
    for (const p of officialPapers) {
      const s = computePaperStats(p);
      answered += s.answered;
      total += s.total;
      correct += s.correct;
    }
    return {
      answered,
      total,
      correct,
      exhausted: total > 0 && answered === total
    };
  }

  function isAnyModalOpen() {
    return Boolean(document.querySelector("dialog:modal"));
  }

  let announceTimer = null;
  function announce(msg) {
    if (!els.announcer || isAnyModalOpen()) return;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      if (!isAnyModalOpen()) {
        els.announcer.textContent = msg;
      }
    }, 60);
  }

  // Build Paper Selector Tabs
  function renderPaperTabs() {
    els.officialTabs.replaceChildren();
    els.extendedTabs.replaceChildren();

    const officialBank = computeOfficialBankProgress();
    if (officialBank.exhausted) {
      els.extendedTrackLabel.textContent =
        "Part 2 · Extended Scenarios Unlocked! (Official NowByou Papers Completed)";
      els.exhaustionBanner.hidden = false;
      renderExhaustionBannerActions();
    } else {
      els.extendedTrackLabel.textContent =
        "Part 2 · Extended Scenarios (Auto-Prompted After Part 1, or Practice Anytime)";
      els.exhaustionBanner.hidden = true;
    }

    for (const paper of papers) {
      const stats = computePaperStats(paper);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "paper-tab-btn";
      if (paper.id === state.activePaperId) {
        btn.setAttribute("aria-current", "true");
      }

      const titleSpan = document.createElement("span");
      titleSpan.textContent = paper.shortTitle;

      const countSpan = document.createElement("span");
      countSpan.className = "tab-count-pill";
      countSpan.textContent = stats.isComplete
        ? `✓ ${stats.correct}/${stats.total}`
        : `${stats.answered}/${stats.total}`;

      btn.append(titleSpan, countSpan);
      btn.addEventListener("click", () => switchPaper(paper.id));

      if (paper.isOfficial) {
        els.officialTabs.appendChild(btn);
      } else {
        els.extendedTabs.appendChild(btn);
      }
    }
  }

  function renderExhaustionBannerActions() {
    els.exhaustionBannerActions.replaceChildren();
    const extended = papers.filter((p) => !p.isOfficial);
    for (const p of extended) {
      const s = computePaperStats(p);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = p.id === state.activePaperId ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm";
      btn.textContent = `${p.shortTitle} (${s.answered}/${s.total})`;
      btn.addEventListener("click", () => switchPaper(p.id));
      els.exhaustionBannerActions.appendChild(btn);
    }
  }

  function switchPaper(paperId) {
    if (!papersById[paperId]) return;
    state.activePaperId = paperId;
    singleIndex = 0;
    saveState();

    // Reset timer to new paper's duration
    stopTimer();
    timerSecondsLeft = (papersById[paperId].durationMinutes || 150) * 60;
    updateTimerDisplay();

    // Sync scenario selectors to this paper's scenario
    const scenId = papersById[paperId].scenarioId;
    syncScenarioViewers(scenId);

    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
    announce(`Switched to ${papersById[paperId].title}`);
  }

  // Sidebar & Header KPIs
  function renderSidebarSummary() {
    const paper = getActivePaper();
    const stats = computePaperStats(paper);
    const officialBank = computeOfficialBankProgress();

    els.kpiAnswered.textContent = `${stats.answered} / ${stats.total}`;
    els.kpiScore.textContent = `${stats.correct} (${stats.pct}%)`;
    els.kpiTarget.textContent = `${stats.passMarks} / ${stats.total}`;

    els.progressBar.max = stats.total;
    els.progressBar.value = stats.answered;
    els.officialMasteryCaption.textContent = `Official Bank: ${officialBank.answered} / ${officialBank.total}`;

    if (stats.answered === 0) {
      els.passStatusBadge.className = "status-pill status-neutral";
      els.passStatusBadge.textContent = `Pass mark: ${paper.passPercentage}%`;
    } else if (stats.isPassing) {
      els.passStatusBadge.className = "status-pill status-pass";
      els.passStatusBadge.textContent = `✓ Passing (${stats.pct}%)`;
    } else {
      const accuracyOnAnswered = Math.round((stats.correct / stats.answered) * 100);
      els.passStatusBadge.className =
        accuracyOnAnswered >= paper.passPercentage
          ? "status-pill status-pass"
          : "status-pill status-below";
      els.passStatusBadge.textContent =
        accuracyOnAnswered >= paper.passPercentage
          ? `On Track (${accuracyOnAnswered}% acc.)`
          : `${accuracyOnAnswered}% accuracy`;
    }

    // Paper header
    const scenario = scenarios[paper.scenarioId];
    els.activePaperEyebrow.textContent = paper.isOfficial
      ? `Official PeopleCert Sample Paper · ${scenario?.title || ""}`
      : `Extended 70-Question Practice Paper · ${scenario?.title || ""}`;
    els.activePaperTitle.textContent = paper.title;
    els.activeScenarioPill.textContent = scenario ? `Open-Book: ${scenario.title}` : "Scenario Booklet";
    els.activePaperDesc.textContent = paper.description;

    // Mode toggle state
    els.modeAllBtn.setAttribute("aria-pressed", String(state.viewMode === "all"));
    els.modeSingleBtn.setAttribute("aria-pressed", String(state.viewMode === "single"));
  }

  function renderQuestionNavGrid(activeQuestionNumbers = new Set()) {
    const paper = getActivePaper();
    const ansMap = getPaperAnswers(paper.id);
    const flagMap = getPaperFlags(paper.id);

    els.questionNavGrid.replaceChildren();
    const frag = document.createDocumentFragment();

    for (const q of paper.questions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "q-map-btn";
      btn.dataset.qnum = String(q.number);

      const pick = ansMap[q.number];
      let stateDesc = "unanswered";
      if (pick) {
        if (pick === q.answer) {
          btn.classList.add("is-correct");
          stateDesc = "correct";
        } else {
          btn.classList.add("is-incorrect");
          stateDesc = "incorrect";
        }
      }
      if (activeQuestionNumbers.has(q.number)) {
        btn.classList.add("is-active-q");
      }

      btn.textContent = String(q.number);

      if (flagMap[q.number]) {
        const star = document.createElement("span");
        star.className = "q-map-flag";
        star.setAttribute("aria-hidden", "true");
        star.textContent = "★";
        btn.appendChild(star);
        stateDesc += ", flagged";
      }

      btn.setAttribute("aria-label", `Jump to Question ${q.number} (${stateDesc})`);
      btn.addEventListener("click", () => jumpToQuestion(q.number));
      frag.appendChild(btn);
    }

    els.questionNavGrid.appendChild(frag);
  }

  function questionMatchesFilters(q, paperId) {
    if (sectionFilter !== "ALL" && q.section !== sectionFilter) return false;

    const ansMap = getPaperAnswers(paperId);
    const flagMap = getPaperFlags(paperId);
    const pick = ansMap[q.number];

    if (statusFilter === "UNANSWERED" && pick) return false;
    if (statusFilter === "CORRECT" && pick !== q.answer) return false;
    if (statusFilter === "INCORRECT" && (!pick || pick === q.answer)) return false;
    if (statusFilter === "FLAGGED" && !flagMap[q.number]) return false;

    if (searchQuery) {
      const needle = searchQuery.toLowerCase();
      const inStem = q.stem.toLowerCase().includes(needle);
      const inGroup = q.groupIntro ? q.groupIntro.toLowerCase().includes(needle) : false;
      const inOpts = q.options.some((o) => o.text.toLowerCase().includes(needle));
      const inSection = q.section.toLowerCase().includes(needle);
      const inQNum = `q${q.number}` === needle || String(q.number) === needle;
      if (!inStem && !inGroup && !inOpts && !inSection && !inQNum) return false;
    }

    return true;
  }

  /**
   * Groups consecutive matching questions sharing `groupId` into a single display unit
   * so shared matching context and options render authentically together.
   */
  function getFilteredDisplayUnits() {
    const paper = getActivePaper();
    const matchingQuestions = paper.questions.filter((q) => questionMatchesFilters(q, paper.id));
    const units = [];

    for (const q of matchingQuestions) {
      const prev = units[units.length - 1];
      if (q.groupId && prev && prev.groupId === q.groupId) {
        prev.questions.push(q);
      } else {
        units.push({
          groupId: q.groupId || null,
          groupIntro: q.groupIntro || null,
          options: q.options,
          section: q.section,
          questions: [q]
        });
      }
    }
    return { units, totalMatchingQuestions: matchingQuestions.length };
  }

  function jumpToQuestion(qNumber) {
    const paper = getActivePaper();
    const targetQ = paper.questions.find((q) => q.number === qNumber);
    if (!targetQ) return;

    // Clear restrictive filters if target question is currently hidden
    if (!questionMatchesFilters(targetQ, paper.id)) {
      sectionFilter = "ALL";
      statusFilter = "ALL";
      searchQuery = "";
      els.sectionFilterSelect.value = "ALL";
      els.statusFilterSelect.value = "ALL";
      els.searchInput.value = "";
    }

    if (state.viewMode === "single") {
      const { units } = getFilteredDisplayUnits();
      const idx = units.findIndex((u) => u.questions.some((q) => q.number === qNumber));
      if (idx >= 0) singleIndex = idx;
      renderQuestionsView();
    } else {
      renderQuestionsView();
    }

    const cardEl = document.getElementById(`q-card-${paper.id}-${qNumber}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = cardEl.querySelector('input[type="radio"]');
      if (firstInput) firstInput.focus();
    }
  }

  function renderQuestionsView() {
    const paper = getActivePaper();
    const { units, totalMatchingQuestions } = getFilteredDisplayUnits();

    const isFiltered =
      sectionFilter !== "ALL" || statusFilter !== "ALL" || searchQuery.trim().length > 0;
    els.filterSummaryBar.hidden = !isFiltered;
    if (isFiltered) {
      els.filterSummaryText.textContent = `Showing ${totalMatchingQuestions} of ${paper.totalMarks} questions matching active filters.`;
    }

    els.questionsContainer.replaceChildren();

    if (units.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const p = document.createElement("p");
      p.textContent = "No questions match the current filters. Click ‘Clear Filters’ to show all questions.";
      empty.appendChild(p);
      els.questionsContainer.appendChild(empty);
      els.singlePager.hidden = true;
      renderQuestionNavGrid(new Set());
      return;
    }

    let unitsToRender = units;
    const activeNums = new Set();

    if (state.viewMode === "single") {
      if (singleIndex >= units.length) singleIndex = units.length - 1;
      if (singleIndex < 0) singleIndex = 0;
      const unit = units[singleIndex];
      unitsToRender = [unit];
      for (const q of unit.questions) activeNums.add(q.number);

      els.singlePager.hidden = false;
      els.prevQuestionBtn.disabled = singleIndex === 0;
      els.nextQuestionBtn.disabled = singleIndex >= units.length - 1;

      const firstNum = unit.questions[0].number;
      const lastNum = unit.questions[unit.questions.length - 1].number;
      const rangeLabel =
        firstNum === lastNum ? `Question ${firstNum}` : `Matching Set: Questions ${firstNum}–${lastNum}`;
      els.singlePagerLabel.textContent = `${rangeLabel} (${singleIndex + 1} of ${units.length})`;
    } else {
      els.singlePager.hidden = true;
    }

    const frag = document.createDocumentFragment();
    unitsToRender.forEach((unit, idx) => {
      // Strictly apply content-visibility: auto ONLY to below-the-fold units (idx >= 3) in multi-card mode
      const shouldDefer = state.viewMode === "all" && idx >= 3;

      if (unit.groupId) {
        const wrapper = document.createElement("section");
        wrapper.className = "matching-group-wrapper";
        if (shouldDefer) wrapper.classList.add("question-card-deferred");

        const qStart = unit.questions[0].number;
        const qEnd = unit.questions[unit.questions.length - 1].number;
        wrapper.setAttribute("aria-label", `Matching questions ${qStart} to ${qEnd}`);

        const sharedBox = document.createElement("div");
        sharedBox.className = "matching-shared-box";

        const sharedTitle = document.createElement("p");
        sharedTitle.className = "matching-shared-title";
        sharedTitle.textContent = `${unit.section} · Shared Matching Block (Questions ${qStart}–${qEnd})`;

        const sharedIntro = document.createElement("p");
        sharedIntro.className = "matching-shared-intro";
        sharedIntro.textContent = unit.groupIntro || "";

        const sharedOpts = document.createElement("ul");
        sharedOpts.className = "matching-shared-options";
        for (const opt of unit.options) {
          const li = document.createElement("li");
          li.textContent = `${opt.key}. ${opt.text}`;
          sharedOpts.appendChild(li);
        }

        sharedBox.append(sharedTitle, sharedIntro, sharedOpts);
        wrapper.appendChild(sharedBox);

        for (const q of unit.questions) {
          wrapper.appendChild(buildQuestionCard(paper, q, true, false));
        }
        frag.appendChild(wrapper);
      } else {
        frag.appendChild(buildQuestionCard(paper, unit.questions[0], false, shouldDefer));
      }
    });

    els.questionsContainer.appendChild(frag);
    renderQuestionNavGrid(activeNums);
  }

  function buildQuestionCard(paper, q, inMatchingGroup, shouldDefer) {
    const article = document.createElement("article");
    article.id = `q-card-${paper.id}-${q.number}`;
    article.className = "question-card";
    if (inMatchingGroup) article.classList.add("in-matching-group");
    if (shouldDefer) article.classList.add("question-card-deferred");

    populateQuestionCardContent(article, paper, q);
    return article;
  }

  function populateQuestionCardContent(article, paper, q) {
    const ansMap = getPaperAnswers(paper.id);
    const flagMap = getPaperFlags(paper.id);
    const pickedKey = ansMap[q.number] || null;
    const isAnswered = Boolean(pickedKey);
    const isCorrect = isAnswered && pickedKey === q.answer;
    const isFlagged = Boolean(flagMap[q.number]);

    article.classList.toggle("card-correct", isAnswered && isCorrect);
    article.classList.toggle("card-incorrect", isAnswered && !isCorrect);
    article.replaceChildren();

    // Header
    const header = document.createElement("div");
    header.className = "q-card-header";

    const metaLeft = document.createElement("div");
    metaLeft.className = "q-meta-left";

    const numBadge = document.createElement("span");
    numBadge.className = "q-number-badge";
    numBadge.textContent = `Question ${q.number}`;

    const secTag = document.createElement("span");
    secTag.className = "q-section-tag";
    secTag.textContent = q.section;

    metaLeft.append(numBadge, secTag);

    if (isAnswered) {
      const verdict = document.createElement("span");
      verdict.className = `q-verdict-badge ${isCorrect ? "verdict-correct" : "verdict-incorrect"}`;
      verdict.textContent = isCorrect
        ? "✓ Correct (1 / 1 mark)"
        : `✕ Incorrect · Correct is ${q.answer}`;
      metaLeft.appendChild(verdict);
    }

    const actionsRight = document.createElement("div");
    actionsRight.className = "q-actions-right";

    if (isAnswered) {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "btn btn-ghost btn-sm";
      retryBtn.textContent = "Retry";
      retryBtn.setAttribute("aria-label", `Clear and retry Question ${q.number}`);
      retryBtn.addEventListener("click", () => handleClearAnswer(paper, q, article));
      actionsRight.appendChild(retryBtn);
    }

    const flagBtn = document.createElement("button");
    flagBtn.type = "button";
    flagBtn.className = "btn btn-outline btn-sm flag-btn";
    flagBtn.setAttribute("aria-pressed", String(isFlagged));
    flagBtn.textContent = isFlagged ? "★ Flagged" : "☆ Flag";
    flagBtn.setAttribute("aria-label", `Flag Question ${q.number} for review`);
    flagBtn.addEventListener("click", () => {
      const flags = getPaperFlags(paper.id);
      if (flags[q.number]) {
        delete flags[q.number];
      } else {
        flags[q.number] = true;
      }
      saveState();
      populateQuestionCardContent(article, paper, q);
      renderQuestionNavGrid(
        state.viewMode === "single" ? new Set([q.number]) : new Set()
      );
    });
    actionsRight.appendChild(flagBtn);

    header.append(metaLeft, actionsRight);
    article.appendChild(header);

    // Fieldset & Radio Options
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.className = "q-stem";
    legend.textContent = q.stem;
    fieldset.appendChild(legend);

    const optionsStack = document.createElement("div");
    optionsStack.className = "options-stack";

    const radioGroupName = `q_${paper.id}_${q.number}`;

    for (const opt of q.options) {
      const inputId = `${radioGroupName}_${opt.key}`;
      const label = document.createElement("label");
      label.className = "option-choice";
      label.setAttribute("for", inputId);

      const isThisPicked = pickedKey === opt.key;
      const isThisAnswer = q.answer === opt.key;

      if (isAnswered) {
        if (isThisAnswer) {
          label.classList.add("option-is-correct");
        } else if (isThisPicked && !isCorrect) {
          label.classList.add("option-is-wrong-pick");
        }
      }

      const input = document.createElement("input");
      input.type = "radio";
      input.id = inputId;
      input.name = radioGroupName;
      input.value = opt.key;
      input.checked = isThisPicked;

      input.addEventListener("change", () => {
        handleSelectOption(paper, q, opt.key, article, inputId);
      });

      const body = document.createElement("span");
      body.className = "option-body";

      const mainLine = document.createElement("span");
      mainLine.className = "option-main-line";

      const keyPrefix = document.createElement("span");
      keyPrefix.className = "option-key-prefix";
      keyPrefix.textContent = `${opt.key}.`;

      const optText = document.createElement("span");
      optText.textContent = opt.text;

      mainLine.append(keyPrefix, optText);
      body.appendChild(mainLine);

      if (isAnswered) {
        if (isThisPicked && isCorrect) {
          const tag = document.createElement("span");
          tag.className = "option-state-tag option-state-correct";
          tag.textContent = "✓ Your answer — Correct";
          body.appendChild(tag);
        } else if (isThisPicked && !isCorrect) {
          const tag = document.createElement("span");
          tag.className = "option-state-tag option-state-wrong";
          tag.textContent = "✕ Your choice — Incorrect";
          body.appendChild(tag);
        } else if (isThisAnswer) {
          const tag = document.createElement("span");
          tag.className = "option-state-tag option-state-correct";
          tag.textContent = "✓ Official correct answer";
          body.appendChild(tag);
        }
      }

      label.append(input, body);
      optionsStack.appendChild(label);
    }

    fieldset.appendChild(optionsStack);
    article.appendChild(fieldset);

    // Instant Rationale Panel when answered
    if (isAnswered) {
      article.appendChild(buildRationalePanel(q, pickedKey, isCorrect));
    }
  }

  function buildRationalePanel(q, pickedKey, isCorrect) {
    const panel = document.createElement("div");
    panel.className = `rationale-panel ${isCorrect ? "rationale-correct" : "rationale-incorrect"}`;

    const header = document.createElement("div");
    header.className = "rationale-header";

    const headline = document.createElement("strong");
    headline.className = "rationale-headline";
    headline.textContent = isCorrect
      ? `✓ Correct! Option ${q.answer} is the right answer.`
      : `✕ Incorrect — You ticked Option ${pickedKey}. The correct answer is Option ${q.answer}.`;

    const sylChip = document.createElement("span");
    sylChip.className = "syllabus-chip";
    sylChip.textContent = `Syllabus: ${q.syllabusRef}`;

    header.append(headline, sylChip);
    panel.appendChild(header);

    // Highlight selected rationale + correct rationale immediately
    const focusBox = document.createElement("div");
    focusBox.className = "rationale-focus-box";

    if (!isCorrect && q.rationales[pickedKey]) {
      const wrongP = document.createElement("p");
      const wrongStrong = document.createElement("strong");
      wrongStrong.textContent = `Why Option ${pickedKey} is incorrect: `;
      wrongP.append(wrongStrong, document.createTextNode(q.rationales[pickedKey]));
      wrongP.style.setProperty("margin-block-end", "0.6rem");
      focusBox.appendChild(wrongP);
    }

    const rightP = document.createElement("p");
    const rightStrong = document.createElement("strong");
    rightStrong.textContent = `Why Option ${q.answer} is correct: `;
    rightP.append(rightStrong, document.createTextNode(q.rationales[q.answer] || ""));
    focusBox.appendChild(rightP);
    panel.appendChild(focusBox);

    // Full Option-by-Option Breakdown via native <details> & <summary>
    const details = document.createElement("details");
    details.className = "rationale-details";

    const summary = document.createElement("summary");
    summary.textContent = `Inspect full option-by-option rationale (${q.options.map((o) => o.key).join(", ")})`;
    details.appendChild(summary);

    const allList = document.createElement("ul");
    allList.className = "rationale-all-list";
    for (const opt of q.options) {
      const li = document.createElement("li");
      li.className = "rationale-all-item";
      if (opt.key === q.answer) li.classList.add("is-ans-item");

      const prefix = document.createElement("strong");
      prefix.textContent = `Option ${opt.key}: `;
      li.append(prefix, document.createTextNode(q.rationales[opt.key] || ""));
      allList.appendChild(li);
    }
    details.appendChild(allList);
    panel.appendChild(details);

    return panel;
  }

  function handleSelectOption(paper, q, selectedKey, articleEl, inputIdToRestoreFocus) {
    const ansMap = getPaperAnswers(paper.id);
    const wasAlreadyComplete = computePaperStats(paper).isComplete;

    ansMap[q.number] = selectedKey;
    saveState();

    // Re-render only this card + lightweight summaries so viewport doesn't jump
    populateQuestionCardContent(articleEl, paper, q);
    const restoredInput = document.getElementById(inputIdToRestoreFocus);
    if (restoredInput) restoredInput.focus();

    renderPaperTabs();
    renderSidebarSummary();
    renderQuestionNavGrid(
      state.viewMode === "single" ? new Set([q.number]) : new Set()
    );

    const isRight = selectedKey === q.answer;
    announce(
      isRight
        ? `Question ${q.number}: Correct. Option ${selectedKey}.`
        : `Question ${q.number}: Incorrect. You selected ${selectedKey}; correct answer is ${q.answer}.`
    );

    // Check if the student just completed this paper or exhausted the attached official papers!
    const nowStats = computePaperStats(paper);
    if (!wasAlreadyComplete && nowStats.isComplete && !state.celebratedPapers[paper.id]) {
      state.celebratedPapers[paper.id] = true;
      saveState();
      openCompletionMilestoneDialog(paper, nowStats);
    }
  }

  function handleClearAnswer(paper, q, articleEl) {
    const ansMap = getPaperAnswers(paper.id);
    delete ansMap[q.number];
    delete state.celebratedPapers[paper.id];
    saveState();

    populateQuestionCardContent(articleEl, paper, q);
    renderPaperTabs();
    renderSidebarSummary();
    renderQuestionNavGrid(
      state.viewMode === "single" ? new Set([q.number]) : new Set()
    );
  }

  function openCompletionMilestoneDialog(completedPaper, stats) {
    const officialBank = computeOfficialBankProgress();
    els.milestoneBody.replaceChildren();

    // Determine recommended next paper
    const currentIdx = papers.findIndex((p) => p.id === completedPaper.id);
    const nextUnfinished =
      papers.slice(currentIdx + 1).find((p) => !computePaperStats(p).isComplete) ||
      papers.find((p) => !computePaperStats(p).isComplete) ||
      null;

    nextMilestonePaperId = nextUnfinished ? nextUnfinished.id : null;

    if (completedPaper.isOfficial && officialBank.exhausted) {
      els.milestoneKicker.textContent = "All 140 Attached Questions Completed!";
      els.milestoneTitle.textContent = "Official NowByou Exam Bank Exhausted!";
    } else {
      els.milestoneKicker.textContent = stats.isPassing ? "Practitioner Pass Achieved!" : "Paper Complete";
      els.milestoneTitle.textContent = `Completed: ${completedPaper.shortTitle}`;
    }

    const scoreSummary = document.createElement("p");
    scoreSummary.textContent = `You scored ${stats.correct} out of ${stats.total} (${stats.pct}%). The PRINCE2® v7 Practitioner pass mark is ${stats.passMarks}/${stats.total} (${completedPaper.passPercentage}%).`;

    const statusCallout = document.createElement("p");
    statusCallout.style.setProperty("font-weight", "650");
    statusCallout.textContent = stats.isPassing
      ? "✓ Congratulations — your score exceeds the 60% Practitioner pass threshold!"
      : "Tip: Use the ‘Incorrect Only (Review)’ status filter to revisit missed questions and study their PRINCE2 manual references.";

    els.milestoneBody.append(scoreSummary, statusCallout);

    if (officialBank.exhausted) {
      const extMsg = document.createElement("p");
      extMsg.textContent =
        "Now that you have completed the official NowByou papers, continue sharpening your skills with three full 70-question Practitioner papers (210 questions) built in the exact same PeopleCert format for the other three scenarios in your booklet: Scenario 1 (Data Knowledge), Scenario 2 (Louistown City Council), and Scenario 3 (Findef).";
      els.milestoneBody.appendChild(extMsg);
    }

    if (nextUnfinished) {
      els.milestoneNextBtn.hidden = false;
      els.milestoneNextBtn.textContent = `Continue to ${nextUnfinished.shortTitle} →`;
    } else {
      els.milestoneNextBtn.hidden = true;
    }

    els.milestoneDialog.showModal();
  }

  // Scenario Booklet Rendering (Shared between Split Pane & Modal Dialog)
  function populateScenarioSelects(selectedScenarioId) {
    const scenarioList = [
      scenarios.scenario4,
      scenarios.scenario1,
      scenarios.scenario2,
      scenarios.scenario3
    ].filter(Boolean);

    for (const selectEl of [els.splitScenarioSelect, els.modalScenarioSelect]) {
      selectEl.replaceChildren();
      for (const sc of scenarioList) {
        const opt = document.createElement("option");
        opt.value = sc.id;
        opt.textContent = `${sc.title} — ${sc.subtitle}`;
        if (sc.id === selectedScenarioId) opt.selected = true;
        selectEl.appendChild(opt);
      }
    }
  }

  function syncScenarioViewers(scenarioId) {
    const sc = scenarios[scenarioId] || scenarios.scenario4;
    if (!sc) return;
    populateScenarioSelects(sc.id);
    els.splitTitle.textContent = sc.title;
    renderScenarioInto(els.splitScenarioBody, sc);
    renderScenarioInto(els.modalScenarioBody, sc);
  }

  function renderScenarioInto(container, sc) {
    container.replaceChildren();

    const metaGrid = document.createElement("div");
    metaGrid.className = "scenario-meta-grid";

    const addMeta = (label, value) => {
      const row = document.createElement("p");
      const b = document.createElement("strong");
      b.textContent = `${label}: `;
      row.append(b, document.createTextNode(value));
      metaGrid.appendChild(row);
    };

    addMeta("Delivery Approach", sc.deliveryApproach);
    addMeta("Stage Context", sc.currentStage);
    addMeta("Main Output", sc.mainOutput);
    container.appendChild(metaGrid);

    const bgHeading = document.createElement("h3");
    bgHeading.textContent = "Scenario Background";
    container.appendChild(bgHeading);

    for (const para of sc.context) {
      const p = document.createElement("p");
      p.textContent = para;
      container.appendChild(p);
    }

    const planHeading = document.createElement("h3");
    planHeading.textContent = "High-Level Project Stage Plan";
    container.appendChild(planHeading);

    const stagesList = document.createElement("ul");
    stagesList.className = "scenario-stages-list";
    for (const stg of sc.stages) {
      const li = document.createElement("li");
      li.className = "scenario-stage-card";
      const stTitle = document.createElement("strong");
      stTitle.textContent = stg.name;
      const subUl = document.createElement("ul");
      for (const item of stg.items) {
        const subLi = document.createElement("li");
        subLi.textContent = item;
        subUl.appendChild(subLi);
      }
      li.append(stTitle, subUl);
      stagesList.appendChild(li);
    }
    container.appendChild(stagesList);

    if (sc.additionalInfo) {
      const addHeading = document.createElement("h3");
      addHeading.textContent = sc.additionalInfo.title;
      container.appendChild(addHeading);

      const rolesList = document.createElement("ul");
      rolesList.className = "scenario-roles-list";
      for (const r of sc.additionalInfo.items) {
        const li = document.createElement("li");
        li.className = "scenario-role-card";
        const rName = document.createElement("strong");
        rName.textContent = `${r.role}: `;
        li.append(rName, document.createTextNode(r.details));
        rolesList.appendChild(li);
      }
      container.appendChild(rolesList);
    }
  }

  // Syllabus Breakdown & Overall Analytics inside Settings Dialog
  function renderSettingsAnalytics() {
    const paper = getActivePaper();
    const ansMap = getPaperAnswers(paper.id);
    els.syllabusBreakdownList.replaceChildren();

    for (const sec of SYLLABUS_ORDER) {
      const qs = paper.questions.filter((q) => q.section === sec);
      if (qs.length === 0) continue;
      let answered = 0;
      let correct = 0;
      for (const q of qs) {
        if (ansMap[q.number]) {
          answered += 1;
          if (ansMap[q.number] === q.answer) correct += 1;
        }
      }
      const pct = Math.round((correct / qs.length) * 100);

      const row = document.createElement("div");
      row.className = "syllabus-row";

      const nameEl = document.createElement("span");
      nameEl.textContent = sec;

      const track = document.createElement("div");
      track.className = "syllabus-bar-track";
      const fill = document.createElement("div");
      fill.className = "syllabus-bar-fill";
      fill.style.setProperty("--pct", String(pct));
      track.appendChild(fill);

      const statEl = document.createElement("span");
      statEl.textContent = `${correct}/${qs.length} (${answered} ans)`;

      row.append(nameEl, track, statEl);
      els.syllabusBreakdownList.appendChild(row);
    }

    let totalAns = 0;
    let totalCorrect = 0;
    let grandTotal = 0;
    for (const p of papers) {
      const s = computePaperStats(p);
      totalAns += s.answered;
      totalCorrect += s.correct;
      grandTotal += s.total;
    }
    els.overallProgressSummary.textContent = `Across all 5 practice banks (${grandTotal} total questions): ${totalAns} answered, ${totalCorrect} correct.`;
  }

  // Timer Logic
  function updateTimerDisplay() {
    const hrs = Math.floor(timerSecondsLeft / 3600);
    const mins = Math.floor((timerSecondsLeft % 3600) / 60);
    const secs = timerSecondsLeft % 60;
    const pad = (n) => String(n).padStart(2, "0");
    els.timerDisplay.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }

  function stopTimer() {
    if (timerIntervalId !== null) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    els.timerToggleBtn.textContent = "Start";
    els.timerToggleBtn.setAttribute("aria-pressed", "false");
  }

  function toggleTimer() {
    if (timerIntervalId !== null) {
      stopTimer();
      return;
    }
    els.timerToggleBtn.textContent = "Pause";
    els.timerToggleBtn.setAttribute("aria-pressed", "true");
    timerIntervalId = setInterval(() => {
      if (timerSecondsLeft > 0) {
        timerSecondsLeft -= 1;
        updateTimerDisplay();
      } else {
        stopTimer();
        announce("Exam timer has reached zero.");
      }
    }, 1000);
  }

  // Color Scheme 3-State Control (System / Light / Dark)
  const darkMql = window.matchMedia("(prefers-color-scheme: dark)");

  function getStoredTheme() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (_) {
      return null;
    }
  }

  function applyColorSchemeMeta(storedValue) {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.content = storedValue ?? "light dark";
    }
  }

  function syncThemeControlsUI() {
    const stored = getStoredTheme();
    const currentVal = stored ?? "system";
    const sysCurrently = darkMql.matches ? "dark" : "light";
    els.themeSystemLabel.textContent = `System (Currently ${sysCurrently})`;

    const radio = els.themeForm.querySelector(`input[name="color_scheme_pref"][value="${currentVal}"]`);
    if (radio) radio.checked = true;
  }

  // Fallback for <dialog closedby="any"> in browsers lacking HTMLDialogElement.prototype.closedBy (e.g. Safari)
  function installDialogLightDismissFallback() {
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener("pointerdown", (e) => {
          pressedOutside = outside(e, dialog);
        });
        dialog.addEventListener("pointerup", (e) => {
          if (pressedOutside && outside(e, dialog)) dialog.close();
        });
      }
    }
  }

  function bindEvents() {
    installDialogLightDismissFallback();

    // Reset returnValue on all dialogs on close so Esc never leaks stale returnValue
    for (const dlg of document.querySelectorAll("dialog")) {
      dlg.addEventListener("close", () => {
        if (dlg === els.resetDialog && dlg.returnValue === "confirm") {
          performConfirmedReset();
        }
        dlg.returnValue = "";
      });
    }

    // Timer buttons
    els.timerToggleBtn.addEventListener("click", toggleTimer);
    els.timerResetBtn.addEventListener("click", () => {
      stopTimer();
      timerSecondsLeft = (getActivePaper().durationMinutes || 150) * 60;
      updateTimerDisplay();
    });

    // Split scenario view & modal booklet
    els.toggleSplitBtn.addEventListener("click", () => {
      splitScenarioOpen = !splitScenarioOpen;
      els.toggleSplitBtn.setAttribute("aria-pressed", String(splitScenarioOpen));
      els.splitPane.hidden = !splitScenarioOpen;
      els.workspaceShell.classList.toggle("has-split-scenario", splitScenarioOpen);
    });

    els.closeSplitBtn.addEventListener("click", () => {
      splitScenarioOpen = false;
      els.toggleSplitBtn.setAttribute("aria-pressed", "false");
      els.splitPane.hidden = true;
      els.workspaceShell.classList.remove("has-split-scenario");
    });

    els.openScenarioModalBtn.addEventListener("click", () => {
      syncScenarioViewers(getActivePaper().scenarioId);
      els.scenarioDialog.showModal();
    });

    els.splitScenarioSelect.addEventListener("change", (e) => {
      syncScenarioViewers(e.target.value);
    });
    els.modalScenarioSelect.addEventListener("change", (e) => {
      syncScenarioViewers(e.target.value);
    });

    // Settings & Analytics dialog
    const openAnalyticsSettings = () => {
      renderSettingsAnalytics();
      syncThemeControlsUI();
      els.settingsDialog.showModal();
    };
    els.openSettingsBtn.addEventListener("click", openAnalyticsSettings);
    els.viewSyllabusBtn.addEventListener("click", openAnalyticsSettings);

    // Theme radio changes
    els.themeForm.addEventListener("change", (e) => {
      if (e.target.name !== "color_scheme_pref") return;
      const choice = e.target.value;
      try {
        if (choice === "light" || choice === "dark") {
          localStorage.setItem(THEME_KEY, choice);
          applyColorSchemeMeta(choice);
        } else {
          localStorage.removeItem(THEME_KEY);
          applyColorSchemeMeta(null);
        }
      } catch (_) {
        applyColorSchemeMeta(choice === "system" ? null : choice);
      }
      syncThemeControlsUI();
    });

    // Keep system label fresh & sync across tabs (never delete stored override on OS change)
    darkMql.addEventListener("change", () => syncThemeControlsUI());
    window.addEventListener("storage", (e) => {
      if (e.key === THEME_KEY) {
        applyColorSchemeMeta(getStoredTheme());
        syncThemeControlsUI();
      }
    });

    // View mode segmented buttons
    els.modeAllBtn.addEventListener("click", () => {
      state.viewMode = "all";
      saveState();
      renderSidebarSummary();
      renderQuestionsView();
    });

    els.modeSingleBtn.addEventListener("click", () => {
      state.viewMode = "single";
      singleIndex = 0;
      saveState();
      renderSidebarSummary();
      renderQuestionsView();
    });

    els.prevQuestionBtn.addEventListener("click", () => {
      if (singleIndex > 0) {
        singleIndex -= 1;
        renderQuestionsView();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    els.nextQuestionBtn.addEventListener("click", () => {
      singleIndex += 1;
      renderQuestionsView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Filters & debounced search
    els.filterForm.addEventListener("submit", (e) => e.preventDefault());

    els.sectionFilterSelect.addEventListener("change", (e) => {
      sectionFilter = e.target.value;
      singleIndex = 0;
      renderQuestionsView();
    });

    els.statusFilterSelect.addEventListener("change", (e) => {
      statusFilter = e.target.value;
      singleIndex = 0;
      renderQuestionsView();
    });

    let searchDebounce = null;
    els.searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchQuery = e.target.value.trim();
        singleIndex = 0;
        renderQuestionsView();
      }, 200);
    });

    els.clearFiltersBtn.addEventListener("click", () => {
      sectionFilter = "ALL";
      statusFilter = "ALL";
      searchQuery = "";
      els.sectionFilterSelect.value = "ALL";
      els.statusFilterSelect.value = "ALL";
      els.searchInput.value = "";
      singleIndex = 0;
      renderQuestionsView();
    });

    // Milestone dialog next paper CTA
    els.milestoneNextBtn.addEventListener("click", () => {
      els.milestoneDialog.close();
      if (nextMilestonePaperId) {
        switchPaper(nextMilestonePaperId);
      }
    });

    // Reset dialogs
    els.openResetDialogBtn.addEventListener("click", () => {
      resetScope = "current";
      const p = getActivePaper();
      els.resetDialogTitle.textContent = `Reset ${p.shortTitle}?`;
      els.resetDialogMessage.textContent = `This will clear your selected answers and flags for ${p.shortTitle} so you can practice fresh.`;
      els.resetDialog.showModal();
    });

    els.resetAllProgressBtn.addEventListener("click", () => {
      els.settingsDialog.close();
      resetScope = "all";
      els.resetDialogTitle.textContent = "Clear All Progress Across All 5 Papers?";
      els.resetDialogMessage.textContent =
        "This will erase all saved answers and review flags across both official NowByou papers and all three extended scenario banks.";
      els.resetDialog.showModal();
    });

    // Progressive Web App install prompt & offline Service Worker registration
    let deferredInstallPrompt = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (els.installPwaBtn) {
        els.installPwaBtn.hidden = false;
      }
    });

    if (els.installPwaBtn) {
      els.installPwaBtn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => {});
        deferredInstallPrompt = null;
        els.installPwaBtn.hidden = true;
      });
    }

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      if (els.installPwaBtn) {
        els.installPwaBtn.hidden = true;
      }
    });

    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  function performConfirmedReset() {
    if (resetScope === "all") {
      state.answers = {};
      state.flags = {};
      state.celebratedPapers = {};
      announce("Cleared all saved answers across all papers.");
    } else {
      const pid = getActivePaper().id;
      delete state.answers[pid];
      delete state.flags[pid];
      delete state.celebratedPapers[pid];
      announce(`Reset saved answers for ${getActivePaper().shortTitle}.`);
    }
    saveState();
    renderAll();
  }

  function renderAll() {
    renderPaperTabs();
    renderSidebarSummary();
    renderQuestionsView();
  }

  // Initialize application
  updateTimerDisplay();
  syncScenarioViewers(getActivePaper().scenarioId);
  syncThemeControlsUI();
  bindEvents();
  renderAll();
})();

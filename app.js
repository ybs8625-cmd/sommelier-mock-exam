/* Sommelier Mock Exam Web — same UX as NCP trainer (localStorage stats) */
(() => {
  const STATS_KEY = "sommelier_wrong_stats_v1";
  const FONT_KEY = "sommelier_font_delta_v1";
  const HIDE_ANS_KEY = "sommelier_hide_answers_v1";
  const APP_TITLE = "고명외식고 소믈리에 2급 자격증 필기 대비(creat by 지명T)";
  const APP_BRAND = "Sommelier Mock Exam";
  const FONT_MIN = -6;
  const FONT_MAX = 10;

  const state = {
    questions: [],
    qById: {},
    stats: {},
    screen: "home", // home | quiz | result | report
    mode: "exam",
    reviewMode: false,
    wrongOnly: false,
    hideAnswers: false, // 오답노트만: 정답 힌트 숨김 (다음 문제에도 유지)
    shuffleQ: false,
    shuffleO: false,
    reverse: false,
    queue: [],
    prepared: {},
    index: 0,
    results: {},
    choices: {},
    selected: new Set(),
    locked: false,
    fontDelta: 0,
    multiSelecting: false,
  };

  const app = document.getElementById("app");

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
  }
  function applyFont() {
    document.documentElement.style.setProperty("--fs", `${16 + state.fontDelta}px`);
    localStorage.setItem(FONT_KEY, String(state.fontDelta));
  }

  async function boot() {
    app.innerHTML = `<div class="loading">문제 불러오는 중…</div>`;
    try {
      const res = await fetch("questions.json");
      if (!res.ok) throw new Error("questions.json 로드 실패");
      const data = await res.json();
      state.questions = data.filter((q) => q.options && q.answer && q.answer.length);
      state.qById = Object.fromEntries(state.questions.map((q) => [q.id, q]));
      state.stats = loadStats();
      state.fontDelta = Number(localStorage.getItem(FONT_KEY) || 0) || 0;
      // 홈 체크박스는 항상 해제. 오답노트 풀이 중 토글만 세션에서 유지
      state.hideAnswers = false;
      applyFont();
      renderHome();
    } catch (e) {
      app.innerHTML = `<div class="error">로드 실패: ${e.message}<br/>로컬에서는 간단 서버로 열어주세요.</div>`;
    }
  }

  function wrongCount() {
    return Object.values(state.stats).filter((v) => Number(v.wrong || 0) > 0).length;
  }

  function recordAnswer(qid, isCorrect) {
    const key = String(qid);
    const entry = state.stats[key] || { wrong: 0, seen: 0 };
    entry.seen = Number(entry.seen || 0) + 1;
    if (!isCorrect) {
      entry.wrong = Number(entry.wrong || 0) + 1;
      entry.last_wrong = new Date().toISOString().slice(0, 19);
    }
    state.stats[key] = entry;
    saveStats();
  }

  function cumulativeWrongs() {
    const rows = [];
    for (const [id, entry] of Object.entries(state.stats)) {
      const wrong = Number(entry.wrong || 0);
      if (wrong <= 0) continue;
      const q = state.qById[Number(id)];
      if (q) rows.push([wrong, Number(id), q]);
    }
    rows.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    return rows.map((r) => r[2]);
  }

  function sessionWrongs() {
    return Object.keys(state.results)
      .map(Number)
      .filter((i) => !state.results[i])
      .sort((a, b) => a - b)
      .map((i) => state.queue[i]);
  }

  function prepareQuestion(src) {
    const keys = Object.keys(src.options).sort();
    if (!state.shuffleO || keys.length < 2) {
      return {
        id: src.id,
        question: src.question,
        options: { ...src.options },
        answer: [...src.answer],
        multi: !!src.multi || src.answer.length > 1,
        explanation: src.explanation || "",
      };
    }
    const order = keys.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const newOptions = {};
    const oldToNew = {};
    keys.forEach((k, i) => {
      newOptions[k] = src.options[keys[order[i]]];
      oldToNew[keys[order[i]]] = k;
    });
    const newAnswer = src.answer.map((a) => oldToNew[a]).filter(Boolean);
    return {
      id: src.id,
      question: src.question,
      options: newOptions,
      answer: newAnswer,
      multi: !!src.multi || newAnswer.length > 1,
      explanation: src.explanation || "",
    };
  }

  function current() {
    if (!state.prepared[state.index]) {
      state.prepared[state.index] = prepareQuestion(state.queue[state.index]);
    }
    return state.prepared[state.index];
  }

  function chip(text, cls = "muted") {
    return `<span class="chip ${cls}">${escapeHtml(text)}</span>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fontControls() {
    return `
      <div class="font-ctrl">
        <span>글씨</span>
        <button class="btn secondary sm" data-font="-1">작게</button>
        <button class="btn secondary sm ${state.fontDelta === 0 ? "on" : ""}" data-font="0">기본</button>
        <button class="btn secondary sm" data-font="1">크게</button>
        <span>${state.fontDelta === 0 ? "0" : (state.fontDelta > 0 ? "+" : "") + state.fontDelta}</span>
      </div>`;
  }

  function bindFont(root) {
    root.querySelectorAll("[data-font]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-font");
        if (v === "0") state.fontDelta = 0;
        else {
          const n = state.fontDelta + Number(v);
          state.fontDelta = Math.max(FONT_MIN, Math.min(FONT_MAX, n));
        }
        applyFont();
        rerender();
      });
    });
  }

  function rerender() {
    if (state.screen === "home") renderHome();
    else if (state.screen === "quiz") renderQuiz();
    else if (state.screen === "result") renderResult();
    else if (state.screen === "report") renderReport();
  }

  function renderHome() {
    state.screen = "home";
    state.reviewMode = false;
    // 홈 옵션 체크는 항상 해제 상태로 시작
    state.wrongOnly = false;
    state.hideAnswers = false;
    state.shuffleQ = false;
    state.shuffleO = false;
    state.reverse = false;
    app.innerHTML = `
      <div class="shell">
        <div class="hero">
          ${chip("Web", "accent")}
          ${chip("필기 모의고사", "muted")}
          <div class="brand">${escapeHtml(APP_BRAND)}</div>
          <p class="sub">${escapeHtml(APP_TITLE)}</p>
          <div class="stats">
            <div class="stat"><div class="k">문항</div><div class="v">${state.questions.length}</div></div>
            <div class="stat"><div class="k">오답노트</div><div class="v">${wrongCount()}</div></div>
            <div class="stat"><div class="k">저장</div><div class="v">브라우저</div></div>
          </div>
        </div>
        <div class="body">
          <div class="h2">모드 선택</div>
          <div class="modes">
            <div class="mode-card ${state.mode === "exam" ? "active" : ""}" data-mode="exam">
              <strong>시험 모드</strong>
              <span>정답 숨김. 틀리면 오답노트와 해설 표시</span>
            </div>
            <div class="mode-card ${state.mode === "study" ? "active" : ""}" data-mode="study">
              <strong>공부 모드</strong>
              <span>정답 선택지 음영 표시로 바로 학습</span>
            </div>
          </div>
          <div class="panel">
            <div class="h2" style="margin-bottom:.4rem">옵션 (기본: 모두 해제)</div>
            <label class="opt"><input type="checkbox" id="wrongOnly" ${state.wrongOnly ? "checked" : ""}/> 오답노트만 풀기 (누적 틀린 문제)</label>
            <label class="opt"><input type="checkbox" id="hideAnswers" ${state.hideAnswers ? "checked" : ""}/> 오답노트에서 정답 숨기기</label>
            <label class="opt"><input type="checkbox" id="shuffleQ" ${state.shuffleQ ? "checked" : ""}/> 문제 순서 섞기</label>
            <label class="opt"><input type="checkbox" id="shuffleO" ${state.shuffleO ? "checked" : ""}/> 선택지(1/2/3/4) 섞기</label>
            <label class="opt"><input type="checkbox" id="reverse" ${state.reverse ? "checked" : ""}/> 뒤에서부터 풀기</label>
            <div class="hint">PC: ← → / Space 로 이동 · 답 없이 넘기면 오답노트에 추가 · 오답노트 정답 숨기기는 풀이 중에도 토글 가능</div>
          </div>
          <div class="actions">
            <button class="btn" id="startBtn">학습 시작</button>
            <button class="btn secondary" id="reportBtn">오답 리포트</button>
          </div>
        </div>
        <div class="footer">${fontControls()}<span style="color:var(--muted);font-size:.85em">Web Preview</span></div>
      </div>`;

    app.querySelectorAll("[data-mode]").forEach((el) => {
      el.addEventListener("click", () => {
        state.mode = el.getAttribute("data-mode");
        renderHome();
      });
    });
    app.querySelector("#hideAnswers")?.addEventListener("change", (e) => {
      setHideAnswers(e.target.checked);
    });
    app.querySelector("#startBtn").onclick = startQuiz;
    app.querySelector("#reportBtn").onclick = renderReport;
    bindFont(app);
  }

  function setHideAnswers(on) {
    state.hideAnswers = !!on;
    localStorage.setItem(HIDE_ANS_KEY, state.hideAnswers ? "1" : "0");
  }

  function isWrongNoteMode() {
    return !!(state.wrongOnly || state.reviewMode);
  }

  /** 공부 모드: 항상 정답 힌트. 오답노트: hideAnswers면 숨김 */
  function showAnswerHints() {
    if (state.mode !== "study") return false;
    if (isWrongNoteMode()) return !state.hideAnswers;
    return true;
  }

  function startQuiz() {
    state.wrongOnly = app.querySelector("#wrongOnly")?.checked ?? state.wrongOnly;
    setHideAnswers(app.querySelector("#hideAnswers")?.checked ?? state.hideAnswers);
    state.shuffleQ = app.querySelector("#shuffleQ")?.checked ?? state.shuffleQ;
    state.shuffleO = app.querySelector("#shuffleO")?.checked ?? state.shuffleO;
    state.reverse = app.querySelector("#reverse")?.checked ?? state.reverse;

    if (state.wrongOnly) {
      state.queue = cumulativeWrongs();
      if (!state.queue.length) {
        alert("누적 오답이 없습니다. 먼저 문제를 풀어 오답노트를 만드세요.");
        return;
      }
      state.reviewMode = true;
      state.mode = "study";
    } else {
      state.reviewMode = false;
      state.queue = [...state.questions];
      if (state.shuffleQ) {
        for (let i = state.queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
        }
      } else if (state.reverse) {
        state.queue.reverse();
      }
    }
    state.index = 0;
    state.results = {};
    state.choices = {};
    state.prepared = {};
    state.selected = new Set();
    state.locked = false;
    renderQuiz();
  }

  function startWrongRetry() {
    let wrongs = sessionWrongs();
    if (!wrongs.length) wrongs = cumulativeWrongs();
    if (!wrongs.length) {
      alert("틀린 문제가 없습니다.");
      return;
    }
    state.reviewMode = true;
    state.wrongOnly = true;
    state.mode = "study";
    state.shuffleQ = false;
    state.shuffleO = false;
    state.reverse = false;
    state.queue = wrongs;
    state.index = 0;
    state.results = {};
    state.choices = {};
    state.prepared = {};
    state.selected = new Set();
    state.locked = false;
    renderQuiz();
  }

  function renderQuiz() {
    state.screen = "quiz";
    const q = current();
    const multi = !!q.multi || q.answer.length > 1;
    state.multiSelecting = multi && !state.locked;
    const answered = Object.keys(state.results).length;
    const correct = Object.values(state.results).filter(Boolean).length;
    const ratio = ((state.index + 1) / Math.max(state.queue.length, 1)) * 100;
    const modeLabel = state.wrongOnly || state.reviewMode ? "오답노트" : state.mode === "exam" ? "시험 모드" : "공부 모드";
    const ansSet = new Set(q.answer);
    const chosen = state.choices[state.index] || state.selected;

    const optionsHtml = Object.keys(q.options)
      .sort()
      .map((k) => {
        let cls = "choice";
        if (state.locked) {
          if (ansSet.has(k)) cls += " correct";
          else if (chosen.has?.(k) || (chosen instanceof Set ? chosen.has(k) : chosen.includes?.(k))) cls += " wrong";
          else cls += " dim";
        } else {
          if (state.selected.has(k)) cls += " selected";
          else if (showAnswerHints() && ansSet.has(k)) cls += " study-hint";
        }
        return `<button class="${cls}" data-opt="${k}" ${state.locked ? "disabled" : ""}><span class="badge">${k}</span>${escapeHtml(q.options[k])}</button>`;
      })
      .join("");

    let feedback = "";
    let note = "";
    if (state.locked) {
      const ok = !!state.results[state.index];
      const chosenArr = [...(state.choices[state.index] || [])];
      if (state._passed) {
        feedback = `<div class="feedback warn">PASS · 정답 ${q.answer.join(", ")} · 오답노트에 추가됨</div>`;
      } else if (ok) {
        feedback = `<div class="feedback good">정답입니다 · ${q.answer.join(", ")}</div>`;
      } else {
        feedback = `<div class="feedback bad">오답입니다 · 선택 ${(chosenArr.join(", ") || "-")} → 정답 ${q.answer.join(", ")}</div>`;
        const expl = (q.explanation || "").trim() || "해설이 없는 문항입니다.";
        note = `<div class="wrong-note" id="wrongNote"><div class="t">오답노트 · 터치하면 다음</div><div class="b">${escapeHtml(expl.slice(0, 700))}</div></div>`;
      }
    }

    const hideToggle = isWrongNoteMode()
      ? `<label class="opt hide-ans-toggle"><input type="checkbox" id="hideAnsQuiz" ${state.hideAnswers ? "checked" : ""}/> 정답 숨기기</label>`
      : "";

    app.innerHTML = `
      <div class="shell">
        <div class="header">
          <div style="display:flex;justify-content:space-between;gap:.8rem;align-items:flex-start">
            <div>
              <div style="color:var(--accent);font-weight:700;font-size:.9em">${escapeHtml(APP_BRAND)}</div>
              <div style="font-weight:700;margin-top:.15rem">${modeLabel} · Q ${state.index + 1} / ${state.queue.length}</div>
            </div>
            <div class="stat" style="min-width:auto"><div class="k">SCORE</div><div class="v">${correct} / ${answered}</div></div>
          </div>
          ${hideToggle}
        </div>
        <div class="progress"><i style="width:${ratio}%"></i></div>
        <div class="body">
          <div class="qcard">
            ${chip("#" + q.id, "accent")}
            ${multi ? chip("복수 정답", "study") : ""}
            <div class="qtext">${escapeHtml(q.question)}</div>
          </div>
          <div id="options">${optionsHtml}</div>
          ${!state.locked ? `<div class="pass-wrap"><button class="btn secondary" id="passBtn">PASS (모르겠어요)</button></div>` : ""}
          ${feedback}
          ${note}
          ${multi && !state.locked ? `<div class="actions" style="margin-top:.8rem"><button class="btn" id="submitBtn">선택 완료</button></div>` : ""}
        </div>
        <div class="footer">
          ${fontControls()}
          <div class="nav">
            <button class="btn secondary" id="homeBtn">홈</button>
            <button class="btn secondary" id="prevBtn" ${state.index <= 0 ? "disabled" : ""}>← 이전</button>
            <button class="btn" id="nextBtn">다음 →</button>
          </div>
        </div>
      </div>`;

    if (!state.locked) {
      app.querySelectorAll("[data-opt]").forEach((btn) => {
        btn.addEventListener("click", () => onOption(btn.getAttribute("data-opt"), multi));
      });
      app.querySelector("#passBtn")?.addEventListener("click", passQuestion);
      app.querySelector("#submitBtn")?.addEventListener("click", () => submitAnswer(false));
    }
    app.querySelector("#hideAnsQuiz")?.addEventListener("change", (e) => {
      setHideAnswers(e.target.checked);
      renderQuiz();
    });
    app.querySelector("#wrongNote")?.addEventListener("click", nextQuestion);
    app.querySelector("#homeBtn").onclick = renderHome;
    app.querySelector("#prevBtn").onclick = prevQuestion;
    app.querySelector("#nextBtn").onclick = nextQuestion;
    bindFont(app);
  }

  function onOption(key, multi) {
    if (state.locked) return;
    if (multi) {
      if (state.selected.has(key)) state.selected.delete(key);
      else state.selected.add(key);
      renderQuiz();
      return;
    }
    state.selected = new Set([key]);
    submitAnswer(false);
  }

  function submitAnswer(passed) {
    if (state.locked) return;
    const q = current();
    if (!passed && state.selected.size === 0) {
      alert("선택지를 고르세요. 모르면 PASS를 누르세요.");
      return;
    }
    const correct = new Set(q.answer);
    const isCorrect = !passed && [...state.selected].length === correct.size && [...state.selected].every((x) => correct.has(x));
    state.locked = true;
    state._passed = !!passed;
    state.choices[state.index] = new Set(state.selected);
    state.results[state.index] = isCorrect;
    recordAnswer(q.id, isCorrect);
    renderQuiz();
    if (isCorrect) setTimeout(() => nextQuestion(), 900);
  }

  function passQuestion() {
    if (state.locked) return;
    state.selected = new Set();
    submitAnswer(true);
  }

  function markUnansweredAsWrong() {
    if (state.locked || state.results[state.index] !== undefined) return;
    state.selected = new Set();
    state.choices[state.index] = new Set();
    state.results[state.index] = false;
    recordAnswer(current().id, false);
  }

  function flushRemaining() {
    for (let i = 0; i < state.queue.length; i++) {
      if (state.results[i] !== undefined) continue;
      state.results[i] = false;
      state.choices[i] = new Set();
      recordAnswer(state.queue[i].id, false);
    }
  }

  function prevQuestion() {
    if (state.index <= 0) return;
    state.index -= 1;
    state.selected = new Set(state.choices[state.index] || []);
    state.locked = state.results[state.index] !== undefined;
    state._passed = false;
    renderQuiz();
  }

  function nextQuestion() {
    markUnansweredAsWrong();
    if (state.index + 1 >= state.queue.length) {
      flushRemaining();
      renderResult();
      return;
    }
    state.index += 1;
    state.selected = new Set(state.choices[state.index] || []);
    state.locked = state.results[state.index] !== undefined;
    state._passed = false;
    renderQuiz();
  }

  function renderResult() {
    state.screen = "result";
    const answered = Object.keys(state.results).length;
    const correct = Object.values(state.results).filter(Boolean).length;
    const wrongN = answered - correct;
    const wrongs = sessionWrongs();
    const pct = answered ? Math.round((correct / answered) * 1000) / 10 : 0;
    const title = state.reviewMode ? "오답 복습 결과" : "학습 결과";

    app.innerHTML = `
      <div class="shell">
        <div class="hero">${chip("RESULT", "accent")}<div class="brand" style="font-size:1.5em">${title}</div></div>
        <div class="body">
          <div class="result-card">
            <div class="result-score">${correct} / ${answered}</div>
            <div style="color:var(--muted)">정답률 ${pct}% · 오답 ${wrongN}문항</div>
            <div style="margin-top:1rem" class="actions">
              ${wrongs.length ? `<button class="btn" id="retryWrong">${state.reviewMode ? "남은 틀린 문제 계속" : "틀린 문제만 다시 풀기"}</button><button class="btn secondary" id="retryAll">전체 다시 풀기</button>` : `<button class="btn" id="retryAll">다시 풀기</button>`}
              <button class="btn secondary" id="homeBtn">홈</button>
              <button class="btn secondary" id="reportBtn">오답 리포트</button>
            </div>
          </div>
        </div>
        <div class="footer">${fontControls()}</div>
      </div>`;
    app.querySelector("#retryWrong")?.addEventListener("click", startWrongRetry);
    app.querySelector("#retryAll").onclick = () => {
      state.wrongOnly = false;
      renderHome();
      // restore options then start full - simpler: go home
    };
    app.querySelector("#homeBtn").onclick = renderHome;
    app.querySelector("#reportBtn").onclick = renderReport;
    bindFont(app);
  }

  function renderReport() {
    state.screen = "report";
    const rows = [];
    for (const [id, entry] of Object.entries(state.stats)) {
      const wrong = Number(entry.wrong || 0);
      if (wrong <= 0) continue;
      const q = state.qById[Number(id)];
      if (!q) continue;
      rows.push({ wrong, seen: Number(entry.seen || 0), id: Number(id), q });
    }
    rows.sort((a, b) => b.wrong - a.wrong || a.id - b.id);

    app.innerHTML = `
      <div class="shell">
        <div class="header" style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:800;font-size:1.25em">오답 리포트</div>
          <button class="btn secondary sm" id="homeBtn">홈</button>
        </div>
        <div class="body">
          <div class="panel" style="display:flex;justify-content:space-between;gap:.7rem;flex-wrap:wrap;align-items:center">
            <strong>누적 오답 ${rows.length}개 · 많이 틀린 순</strong>
            <button class="btn secondary sm" id="resetBtn">통계 초기화</button>
          </div>
          ${
            !rows.length
              ? `<p style="color:var(--muted)">아직 누적된 오답이 없습니다.</p>`
              : rows
                  .map(
                    (r, i) => `
              <div class="report-row">
                <div>
                  <div><strong>${i + 1}. #${r.id}</strong></div>
                  <div class="report-meta"><span class="wrong">${r.wrong}회 틀림</span> · 풀이 ${r.seen}회</div>
                  <div style="color:var(--muted);font-size:.88em;margin-top:.35rem">${escapeHtml(r.q.question.slice(0, 90))}${r.q.question.length > 90 ? "…" : ""}</div>
                </div>
                <div class="report-btns">
                  <button class="btn secondary sm" data-view="${r.id}">문제·답 보기</button>
                  <button class="btn danger sm" data-del="${r.id}">삭제</button>
                </div>
              </div>`
                  )
                  .join("") +
                `<div class="actions" style="margin-top:1rem"><button class="btn" id="trainBtn">오답노트 학습 시작</button></div>`
          }
        </div>
        <div class="footer">${fontControls()}</div>
      </div>
      <div id="modalHost"></div>`;

    app.querySelector("#homeBtn").onclick = renderHome;
    app.querySelector("#resetBtn")?.addEventListener("click", () => {
      if (confirm("오답 누적 통계를 모두 지울까요?")) {
        state.stats = {};
        saveStats();
        renderReport();
      }
    });
    app.querySelector("#trainBtn")?.addEventListener("click", () => {
      state.wrongOnly = true;
      // fake home checkboxes via state then start
      const fake = () => {};
      state.shuffleQ = false;
      state.shuffleO = false;
      state.reverse = false;
      state.queue = cumulativeWrongs();
      if (!state.queue.length) {
        alert("누적 오답이 없습니다.");
        return;
      }
      state.reviewMode = true;
      state.mode = "study";
      state.index = 0;
      state.results = {};
      state.choices = {};
      state.prepared = {};
      state.selected = new Set();
      state.locked = false;
      renderQuiz();
    });
    app.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => showDetail(Number(btn.getAttribute("data-view"))));
    });
    app.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        delete state.stats[id];
        saveStats();
        renderReport();
      });
    });
    bindFont(app);
  }

  function showDetail(qid) {
    const q = state.qById[qid];
    if (!q) return;
    const ans = new Set(q.answer);
    const host = app.querySelector("#modalHost");
    host.innerHTML = `
      <div class="modal-back" id="modalBack">
        <div class="modal">
          <h3>#${qid}</h3>
          <p style="line-height:1.45">${escapeHtml(q.question)}</p>
          ${Object.keys(q.options)
            .sort()
            .map((k) => `<div class="optline ${ans.has(k) ? "ans" : ""}">${k}. ${escapeHtml(q.options[k])}${ans.has(k) ? " ← 정답" : ""}</div>`)
            .join("")}
          ${q.explanation ? `<p style="color:var(--muted);font-size:.9em;margin-top:1rem;line-height:1.45">${escapeHtml(String(q.explanation).slice(0, 900))}</p>` : ""}
          <div class="actions" style="margin-top:1rem;justify-content:flex-end"><button class="btn" id="closeModal">닫기</button></div>
        </div>
      </div>`;
    const close = () => (host.innerHTML = "");
    host.querySelector("#closeModal").onclick = close;
    host.querySelector("#modalBack").addEventListener("click", (e) => {
      if (e.target.id === "modalBack") close();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (state.screen !== "quiz") return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevQuestion();
    } else if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      nextQuestion();
    }
  });

  boot();
})();

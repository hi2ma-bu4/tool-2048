// pkg/wasm_lib.js
var wasm;
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
var cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
  if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
    cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
  }
  return cachedFloat64ArrayMemory0;
}
var WASM_VECTOR_LEN = 0;
function passArrayF64ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 8, 8) >>> 0;
  getFloat64ArrayMemory0().set(arg, ptr / 8);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function evaluate_pattern(board_js, empty_cells_weight) {
  const ptr0 = passArrayF64ToWasm0(board_js, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.evaluate_pattern(ptr0, len0, empty_cells_weight);
  return ret;
}
function evaluate_board(board_js, smoothness_weight, monotonicity_weight, empty_cells_weight, max_tile_weight) {
  const ptr0 = passArrayF64ToWasm0(board_js, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.evaluate_board(ptr0, len0, smoothness_weight, monotonicity_weight, empty_cells_weight, max_tile_weight);
  return ret;
}
function evaluate_snake_pattern(board_js) {
  const ptr0 = passArrayF64ToWasm0(board_js, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.evaluate_snake_pattern(ptr0, len0);
  return ret;
}
var EXPECTED_RESPONSE_TYPES = /* @__PURE__ */ new Set(["basic", "cors", "default"]);
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);
        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}
function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_wbindgencopytotypedarray_d105febdb9374ca3 = function(arg0, arg1, arg2) {
    new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
  };
  imports.wbg.__wbindgen_init_externref_table = function() {
    const table = wasm.__wbindgen_export_0;
    const offset = table.grow(4);
    table.set(0, void 0);
    table.set(offset + 0, void 0);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
    ;
  };
  return imports;
}
function __wbg_init_memory(imports, memory) {
}
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedFloat64ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}
async function __wbg_init(module_or_path) {
  if (wasm !== void 0) return wasm;
  if (typeof module_or_path !== "undefined") {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn("using deprecated parameters for the initialization function; pass a single object instead");
    }
  }
  if (typeof module_or_path === "undefined") {
    module_or_path = new URL("wasm_lib_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();
  if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
    module_or_path = fetch(module_or_path);
  }
  __wbg_init_memory(imports);
  const { instance, module } = await __wbg_load(await module_or_path, imports);
  return __wbg_finalize_init(instance, module);
}
var wasm_lib_default = __wbg_init;

// src/game/state.ts
var state = {
  board: initializeBoard(),
  score: 0,
  isAIAutoPlaying: false,
  isAICalculating: false,
  autoPlayIntervalId: null,
  searchDepth: 5,
  heuristicWeights: {
    smoothness: 0.1,
    monotonicity: 1,
    emptyCells: 2.7,
    maxTile: 1
  }
};
function resetState() {
  state.board = initializeBoard();
  state.score = 0;
}
if (typeof window !== "undefined") {
  window.getState = () => state;
  window.setBoard = (newBoard) => {
    state.board = newBoard;
  };
}

// src/ui/dom.ts
var SIZE = 4;
var elements = {
  gridContainer: document.getElementById("grid-container"),
  scoreDisplay: document.getElementById("score"),
  calculateBtn: document.getElementById("calculate-btn"),
  resetBtn: document.getElementById("reset-btn"),
  searchDepthInput: document.getElementById("search-depth-input"),
  realtimeCheckbox: document.getElementById("realtime-checkbox"),
  autoAddTileCheckbox: document.getElementById("auto-add-tile-checkbox"),
  aiAlgorithmSelect: document.getElementById("ai-algorithm-select"),
  mergeLimitInput: document.getElementById("merge-limit-input"),
  recUp: document.getElementById("rec-up"),
  recDown: document.getElementById("rec-down"),
  recLeft: document.getElementById("rec-left"),
  recRight: document.getElementById("rec-right"),
  aiMessage: document.getElementById("ai-message"),
  aiAutoPlayBtn: document.getElementById("ai-auto-play-btn"),
  aiIntervalInput: document.getElementById("ai-interval-input")
};
var cellElements = [];
function initializeGrid() {
  elements.gridContainer.innerHTML = "";
  cellElements = Array.from(
    { length: SIZE },
    (_, r) => Array.from({ length: SIZE }, (_2, c) => {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      elements.gridContainer.appendChild(cell);
      return cell;
    })
  );
}
function renderBoard(board) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = cellElements[r][c];
      const value = board[r][c];
      cell.textContent = value === 0 ? "" : String(value);
      const classList = ["grid-cell"];
      if (value !== 0) {
        if (value > 65536) {
          classList.push("tile-default");
        } else {
          classList.push(`tile-${value}`);
        }
      }
      cell.className = classList.join(" ");
    }
  }
}
function updateScore(score) {
  elements.scoreDisplay.textContent = String(score);
}
function resetRecommendations() {
  elements.recUp.textContent = "-%";
  elements.recDown.textContent = "-%";
  elements.recLeft.textContent = "-%";
  elements.recRight.textContent = "-%";
  elements.aiMessage.innerHTML = "\xA0";
}
function displayRecommendations(scores) {
  const recommendationItems = {
    up: elements.recUp.parentElement,
    down: elements.recDown.parentElement,
    left: elements.recLeft.parentElement,
    right: elements.recRight.parentElement
  };
  Object.values(recommendationItems).forEach((item) => {
    item.classList.remove("highlight-best", "highlight-worst");
  });
  const validMoves = Object.entries(scores).filter(([, score]) => score !== -Infinity && score !== void 0);
  if (validMoves.length > 0) {
    const minScore = Math.min(...validMoves.map(([, score]) => score));
    const normalizedScores = Object.fromEntries(validMoves.map(([move, score]) => [move, score - minScore + 1]));
    const totalScore = Object.values(normalizedScores).reduce((sum, s) => sum + s, 0);
    const percentages = {};
    for (const [move, score] of Object.entries(normalizedScores)) {
      percentages[move] = Math.round(score / totalScore * 100);
    }
    elements.recUp.textContent = percentages.up !== void 0 ? `${percentages.up}%` : "-%";
    elements.recDown.textContent = percentages.down !== void 0 ? `${percentages.down}%` : "-%";
    elements.recLeft.textContent = percentages.left !== void 0 ? `${percentages.left}%` : "-%";
    elements.recRight.textContent = percentages.right !== void 0 ? `${percentages.right}%` : "-%";
    const bestMove = Object.keys(normalizedScores).reduce((a, b) => normalizedScores[a] > normalizedScores[b] ? a : b);
    recommendationItems[bestMove].classList.add("highlight-best");
    if (validMoves.length > 1) {
      const worstMove = Object.keys(normalizedScores).reduce((a, b) => normalizedScores[a] < normalizedScores[b] ? a : b);
      if (bestMove !== worstMove) {
        recommendationItems[worstMove].classList.add("highlight-worst");
      }
    }
    elements.aiMessage.textContent = "\u8A08\u7B97\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002";
  } else {
    resetRecommendations();
    elements.aiMessage.textContent = "\u52D5\u304B\u305B\u308B\u624B\u304C\u3042\u308A\u307E\u305B\u3093\u3002";
  }
}

// src/main.ts
var wasm2;
var NUM_WORKERS = 4;
var workers = [];
var moveScores = {};
var completedWorkers = 0;
var tasks = [];
async function main() {
  wasm2 = await wasm_lib_default();
  initializeGrid();
  initializeWorkers();
  initializeApp();
  setupEventListeners();
}
main();
if (typeof window !== "undefined") {
  window.setBoardAndRender = (board) => {
    state.board = board;
    renderBoard(state.board);
  };
  window.getState = () => state;
}
function initializeApp() {
  resetState();
  let board = addRandomTile(state.board);
  board = addRandomTile(board);
  state.board = board;
  updateScore(state.score);
  resetRecommendations();
  renderBoard(state.board);
}
function initializeWorkers() {
  const workerUrl = "dist/ai-worker.js";
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = new Worker(workerUrl, { type: "module" });
    worker.onmessage = (e) => {
      const { move, score } = e.data;
      moveScores[move] = score;
      completedWorkers++;
      if (completedWorkers === tasks.length) {
        finishAICalculation();
      }
    };
    workers.push(worker);
  }
}
function setupEventListeners() {
  elements.resetBtn.addEventListener("click", initializeApp);
  elements.calculateBtn.addEventListener("click", runAI);
  elements.aiAlgorithmSelect.addEventListener("change", handleSettingsChange);
  elements.searchDepthInput.addEventListener("change", handleSettingsChange);
  elements.realtimeCheckbox.addEventListener("change", () => {
    elements.calculateBtn.style.display = elements.realtimeCheckbox.checked ? "none" : "inline-block";
    if (elements.realtimeCheckbox.checked) runAI();
  });
  let pressTimer = null;
  let isLongPress = false;
  elements.gridContainer.addEventListener("mousedown", (e) => {
    const target = e.target;
    const cell = target.closest(".grid-cell");
    if (cell) {
      pressTimer = window.setTimeout(() => {
        isLongPress = true;
        const row = parseInt(cell.getAttribute("data-row"));
        const col = parseInt(cell.getAttribute("data-col"));
        state.board[row][col] = 0;
        renderBoard(state.board);
        if (elements.realtimeCheckbox.checked) runAI();
      }, 500);
    }
  });
  elements.gridContainer.addEventListener("mouseup", (e) => {
    if (pressTimer) clearTimeout(pressTimer);
    if (!isLongPress) {
      const target = e.target;
      const cell = target.closest(".grid-cell");
      if (cell) {
        const row = parseInt(cell.getAttribute("data-row"));
        const col = parseInt(cell.getAttribute("data-col"));
        const currentValue = state.board[row][col];
        state.board[row][col] = currentValue === 0 ? 2 : currentValue * 2;
        renderBoard(state.board);
        if (elements.realtimeCheckbox.checked) runAI();
      }
    }
    isLongPress = false;
  });
  elements.gridContainer.addEventListener("mouseleave", () => {
    if (pressTimer) clearTimeout(pressTimer);
    isLongPress = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName.toLowerCase() === "input") return;
    let direction = null;
    switch (e.key) {
      case "ArrowUp":
      case "w":
        direction = "up";
        break;
      case "ArrowDown":
      case "s":
        direction = "down";
        break;
      case "ArrowLeft":
      case "a":
        direction = "left";
        break;
      case "ArrowRight":
      case "d":
        direction = "right";
        break;
    }
    if (direction) {
      e.preventDefault();
      moveBoard(direction);
    }
  });
  let touchStartX = 0, touchStartY = 0;
  elements.gridContainer.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    },
    { passive: true }
  );
  elements.gridContainer.addEventListener("touchend", (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
  });
  elements.aiAutoPlayBtn.addEventListener("click", toggleAIAutoPlay);
}
function handleSettingsChange() {
  state.searchDepth = parseInt(elements.searchDepthInput.value);
  if (elements.realtimeCheckbox.checked) runAI();
}
function moveBoard(direction) {
  const mergeLimit = parseInt(elements.mergeLimitInput.value, 10) || Infinity;
  const result = simulateMove(state.board, direction, mergeLimit);
  if (result.moved) {
    state.board = result.board;
    state.score += result.score;
    updateScore(state.score);
    if (elements.autoAddTileCheckbox.checked) {
      state.board = addRandomTile(state.board);
    }
    renderBoard(state.board);
    if (elements.realtimeCheckbox.checked) {
      runAI();
    } else {
      resetRecommendations();
    }
  }
}
function handleSwipe(startX, startY, endX, endY) {
  const diffX = endX - startX;
  const diffY = endY - startY;
  const threshold = 50;
  if (Math.abs(diffX) > Math.abs(diffY)) {
    if (Math.abs(diffX) > threshold) moveBoard(diffX > 0 ? "right" : "left");
  } else {
    if (Math.abs(diffY) > threshold) moveBoard(diffY > 0 ? "down" : "up");
  }
}
function runAI() {
  if (state.isAICalculating) return;
  moveScores = {};
  resetRecommendations();
  elements.aiMessage.textContent = "AI\u304C\u8A08\u7B97\u4E2D\u3067\u3059...";
  elements.calculateBtn.disabled = true;
  state.isAICalculating = true;
  const mergeLimit = parseInt(elements.mergeLimitInput.value, 10) || Infinity;
  const moves = ["up", "down", "left", "right"];
  tasks = [];
  for (const move of moves) {
    const simResult = simulateMove(state.board, move, mergeLimit);
    if (simResult.moved) {
      tasks.push({ move, board: simResult.board });
    } else {
      moveScores[move] = -Infinity;
    }
  }
  if (tasks.length === 0) {
    finishAICalculation();
    return;
  }
  completedWorkers = 0;
  tasks.forEach((task, index) => {
    const worker = workers[index % NUM_WORKERS];
    const message = {
      algorithm: elements.aiAlgorithmSelect.value,
      move: task.move,
      board: task.board,
      searchDepth: state.searchDepth,
      heuristicWeights: state.heuristicWeights,
      mergeLimit
    };
    worker.postMessage(message);
  });
}
function finishAICalculation() {
  displayRecommendations(moveScores);
  state.isAICalculating = false;
  elements.calculateBtn.disabled = false;
  if (state.isAIAutoPlaying) {
    handleAutoPlay(moveScores);
  }
  moveScores = {};
}
function toggleAIAutoPlay() {
  state.isAIAutoPlaying = !state.isAIAutoPlaying;
  if (state.isAIAutoPlaying) {
    elements.aiAutoPlayBtn.textContent = "AI\u81EA\u52D5\u64CD\u4F5C\u3092\u505C\u6B62";
    elements.aiAutoPlayBtn.classList.add("playing");
    startAIAutoPlay();
  } else {
    elements.aiAutoPlayBtn.textContent = "AI\u81EA\u52D5\u64CD\u4F5C\u3092\u958B\u59CB";
    elements.aiAutoPlayBtn.classList.remove("playing");
    stopAIAutoPlay();
  }
}
function startAIAutoPlay() {
  const interval = parseInt(elements.aiIntervalInput.value, 10) || 0;
  state.autoPlayIntervalId = window.setInterval(() => {
    if (!state.isAICalculating) {
      runAI();
    }
  }, interval);
}
function stopAIAutoPlay() {
  if (state.autoPlayIntervalId) clearInterval(state.autoPlayIntervalId);
  state.isAIAutoPlaying = false;
  elements.aiAutoPlayBtn.textContent = "AI\u81EA\u52D5\u64CD\u4F5C\u3092\u958B\u59CB";
  elements.aiAutoPlayBtn.classList.remove("playing");
}
function handleAutoPlay(scores) {
  const validMoves = Object.entries(scores).filter(([, score]) => score !== -Infinity && score !== void 0);
  if (validMoves.length > 0) {
    const bestMove = validMoves.reduce((a, b) => a[1] > b[1] ? a : b)[0];
    moveBoard(bestMove);
  } else {
    stopAIAutoPlay();
    elements.aiMessage.textContent = "\u30B2\u30FC\u30E0\u30AA\u30FC\u30D0\u30FC\uFF01AI\u306F\u505C\u6B62\u3057\u307E\u3057\u305F\u3002";
  }
}

// src/game/game.ts
var SIZE2 = 4;
function simulateMove(currentBoard, direction, mergeLimit) {
  const boardIn = new Float64Array(currentBoard.flat());
  const boardOut = new Float64Array(SIZE2 * SIZE2);
  const directionMap = {
    up: 0,
    right: 1,
    down: 2,
    left: 3
  };
  const dir = directionMap[direction];
  const safeMergeLimit = !isFinite(mergeLimit) ? Number.MAX_SAFE_INTEGER : mergeLimit;
  try {
    const encodedResult = wasm2.simulate_move(boardIn, boardOut, dir, safeMergeLimit);
    const score = Math.floor(encodedResult / 10);
    const moved = encodedResult % 10 === 1;
    const newBoard = [];
    for (let i = 0; i < SIZE2; i++) {
      newBoard.push(Array.from(boardOut.slice(i * SIZE2, (i + 1) * SIZE2)));
    }
    return { board: newBoard, score, moved };
  } catch (e) {
    console.error("WASM 'simulate_move' failed:", e);
    return { board: currentBoard, score: 0, moved: false };
  }
}
function getEmptyCells(board) {
  const cells = [];
  for (let r = 0; r < SIZE2; r++) {
    for (let c = 0; c < SIZE2; c++) {
      if (board[r][c] === 0) {
        cells.push({ r, c });
      }
    }
  }
  return cells;
}
function addRandomTile(board) {
  const emptyCells = getEmptyCells(board);
  if (emptyCells.length > 0) {
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newBoard = board.map((row) => [...row]);
    newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  }
  return board;
}
function initializeBoard() {
  return Array.from({ length: SIZE2 }, () => Array(SIZE2).fill(0));
}

// src/ai/ai-worker.ts
var wasmReady = wasm_lib_default();
var evaluationFunctions = {
  heuristic: (board, weights) => {
    const flatBoard = new Float64Array(board.flat());
    return evaluate_board(flatBoard, weights.smoothness, weights.monotonicity, weights.emptyCells, weights.maxTile);
  },
  pattern: (board, weights) => {
    const flatBoard = new Float64Array(board.flat());
    return evaluate_pattern(flatBoard, weights.emptyCells);
  },
  snake: (board) => {
    const flatBoard = new Float64Array(board.flat());
    return evaluate_snake_pattern(flatBoard);
  }
};
self.onmessage = async (e) => {
  await wasmReady;
  const { algorithm, move, board, searchDepth, heuristicWeights, mergeLimit } = e.data;
  const memo = /* @__PURE__ */ new Map();
  const evaluationFunction = evaluationFunctions[algorithm];
  if (!evaluationFunction) {
    throw new Error(`Unknown algorithm: ${algorithm}`);
  }
  const score = expectimax(board, searchDepth - 1, false, memo, evaluationFunction, heuristicWeights, mergeLimit);
  self.postMessage({ move, score });
};
function expectimax(currentBoard, depth, isPlayerTurn, memo, evaluationFunction, weights, mergeLimit) {
  const boardKey = JSON.stringify(currentBoard);
  if (memo.has(boardKey)) {
    return memo.get(boardKey);
  }
  if (depth === 0) {
    return evaluationFunction(currentBoard, weights);
  }
  let resultScore;
  if (isPlayerTurn) {
    let maxScore = -Infinity;
    const moves = ["up", "down", "left", "right"];
    for (const move of moves) {
      const simResult = simulateMove(currentBoard, move, mergeLimit);
      if (simResult.moved) {
        maxScore = Math.max(maxScore, expectimax(simResult.board, depth - 1, false, memo, evaluationFunction, weights, mergeLimit));
      }
    }
    resultScore = maxScore === -Infinity ? 0 : maxScore;
  } else {
    const emptyCells = getEmptyCells(currentBoard);
    if (emptyCells.length === 0) {
      return expectimax(currentBoard, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
    }
    let totalScore = 0;
    for (const cell of emptyCells) {
      const boardWith2 = currentBoard.map((row) => [...row]);
      boardWith2[cell.r][cell.c] = 2;
      totalScore += 0.9 * expectimax(boardWith2, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
      const boardWith4 = currentBoard.map((row) => [...row]);
      boardWith4[cell.r][cell.c] = 4;
      totalScore += 0.1 * expectimax(boardWith4, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
    }
    resultScore = totalScore / emptyCells.length;
  }
  memo.set(boardKey, resultScore);
  return resultScore;
}

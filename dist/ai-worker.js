// pkg/wasm_lib.js
var wasm;
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
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}
function find_best_move_bitboard(js_board, depth) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ptr0 = passArrayF64ToWasm0(js_board, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.find_best_move_bitboard(ptr0, len0, depth);
    deferred2_0 = ret[0];
    deferred2_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
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

// src/game/game.ts
var SIZE = 4;
function operateRow(row, mergeLimit) {
  const newRow = row.filter((val) => val !== 0);
  let score = 0;
  for (let i = 0; i < newRow.length - 1; i++) {
    if (newRow[i] === newRow[i + 1] && newRow[i] < mergeLimit) {
      newRow[i] *= 2;
      score += newRow[i];
      newRow.splice(i + 1, 1);
    }
  }
  while (newRow.length < SIZE) {
    newRow.push(0);
  }
  return { newRow, score };
}
function transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}
function simulateMove(currentBoard, direction, mergeLimit) {
  let tempBoard = currentBoard.map((row) => [...row]);
  let moveScore = 0;
  const originalBoardStr = JSON.stringify(tempBoard);
  if (direction === "up" || direction === "down") {
    tempBoard = transpose(tempBoard);
  }
  for (let i = 0; i < SIZE; i++) {
    let row = tempBoard[i];
    if (direction === "right" || direction === "down") {
      row.reverse();
    }
    const result = operateRow(row, mergeLimit);
    if (direction === "right" || direction === "down") {
      result.newRow.reverse();
    }
    tempBoard[i] = result.newRow;
    moveScore += result.score;
  }
  if (direction === "up" || direction === "down") {
    tempBoard = transpose(tempBoard);
  }
  const boardChanged = JSON.stringify(tempBoard) !== originalBoardStr;
  return { board: tempBoard, score: moveScore, moved: boardChanged };
}
function getEmptyCells(board) {
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) {
        cells.push({ r, c });
      }
    }
  }
  return cells;
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
  if (algorithm === "bitboard") {
    const flatBoard = new Float64Array(board.flat());
    const bestMove = find_best_move_bitboard(flatBoard, searchDepth);
    self.postMessage({ move: bestMove, score: 1 });
    return;
  }
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

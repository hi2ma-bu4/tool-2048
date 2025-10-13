/* tslint:disable */
/* eslint-disable */
export function simulate_move(board_in: Float64Array, board_out: Float64Array, direction: number, merge_limit: number): number;
export function evaluate_pattern(board_js: Float64Array, empty_cells_weight: number): number;
export function evaluate_board(board_js: Float64Array, smoothness_weight: number, monotonicity_weight: number, empty_cells_weight: number, max_tile_weight: number): number;
export function evaluate_snake_pattern(board_js: Float64Array): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly simulate_move: (a: number, b: number, c: number, d: number, e: any, f: number, g: number) => number;
  readonly evaluate_pattern: (a: number, b: number, c: number) => number;
  readonly evaluate_board: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly evaluate_snake_pattern: (a: number, b: number) => number;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

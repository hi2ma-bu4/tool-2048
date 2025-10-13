const esbuild = require("esbuild");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// esbuildのビルドオプション
const buildOptions = [
	{
		entryPoints: ["src/main.ts"],
		bundle: true,
		outfile: "dist/main.js",
		platform: "browser",
		format: "esm",
	},
	{
		entryPoints: ["src/ai/ai-worker.ts"],
		bundle: true,
		outfile: "dist/ai-worker.js",
		platform: "browser",
		format: "esm", // Web WorkerでESMを使い、import.meta.urlを有効にする
		loader: { ".wasm": "file" },
	},
];

async function build() {
	try {
		// wasm-packのビルド
		console.log("Building wasm-lib...");
		execSync("wasm-pack build --target web --no-pack --out-dir ../pkg", { stdio: "inherit", cwd: "./wasm-lib" });
		fs.rmSync("pkg/.gitignore", { force: true });
		console.log("wasm-lib build successful.");

		// TypeScriptのビルド
		console.log("Building TypeScript files...");
		await Promise.all(buildOptions.map((options) => esbuild.build(options)));
		console.log("TypeScript build successful.");

		// WASMファイルをdistにコピー
		const wasmSrc = path.join(__dirname, "pkg", "wasm_lib_bg.wasm");
		const wasmDest = path.join(__dirname, "dist", "wasm_lib_bg.wasm");
		fs.copyFileSync(wasmSrc, wasmDest);
		console.log("Copied wasm file to dist.");

		console.log("Build process completed.");
	} catch (error) {
		console.error("Build failed:", error);
		process.exit(1);
	}
}

build();

import esbuild from "esbuild";

const isDev = process.argv.includes("--dev");

/** @type {import('esbuild').BuildOptions} */
const base = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  sourcemap: isDev ? "inline" : false,
  minify: !isDev,
  outfile: "main.js",
  external: ["obsidian"],
  format: "cjs",
  target: ["es2018"],
  platform: "browser",
};

async function main() {
  try {
    if (isDev) {
      const ctx = await esbuild.context(base);
      await ctx.watch();
      console.log("🔁 watch mode");
    } else {
      await esbuild.build(base);
      console.log("📦 build complete");
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();

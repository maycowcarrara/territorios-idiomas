const fs = require("fs");
const path = require("path");

const ROOT = "./";
const OUTPUT = "PROJECT_FULL_CONTEXT.md";

const IGNORE_DIRS = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".firebase",
    ".next",
    "coverage"
];

const IGNORE_FILES = [
    ".env",
    "package-lock.json",
    "yarn.lock"
];

const VALID_EXT = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
    ".scss",
    ".html",
    ".json",
    ".md",
    ".rules"
];

function walk(dir) {
    let results = [];

    const list = fs.readdirSync(dir);

    for (const file of list) {
        const fullPath = path.join(dir, file);

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {

            if (IGNORE_DIRS.includes(file)) continue;

            results = results.concat(walk(fullPath));

        } else {

            if (IGNORE_FILES.includes(file)) continue;

            const ext = path.extname(file);

            if (VALID_EXT.includes(ext)) {
                results.push(fullPath);
            }

        }
    }

    return results;
}

function generate() {

    const files = walk(ROOT);

    let output = `# PROJECT FULL CONTEXT\n`;
    output += `Generated automatically\n\n`;
    output += `Total files: ${files.length}\n\n`;

    for (const file of files) {

        const relative = path.relative(ROOT, file);
        const content = fs.readFileSync(file, "utf8");

        const ext = path.extname(file).replace(".", "");

        output += `---\n`;
        output += `## FILE: ${relative}\n\n`;
        output += "```" + ext + "\n";
        output += content;
        output += "\n```\n\n";
    }

    fs.writeFileSync(OUTPUT, output);

    console.log(`Export completed.`);
    console.log(`File created: ${OUTPUT}`);
}

generate();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const hwArg = process.argv[2];

if (!hwArg) {
    console.error('Error: specify homework folder name. Example: node build.js hw1');
    process.exit(1);
}

const hwMatch = hwArg.match(/\d+/);
const hwNumber = hwMatch ? hwMatch[0].padStart(2, '0') : '00';
const baseName = `nechshadimov_HW${hwNumber}`;

const hwDir = path.join(__dirname, 'hw', hwArg);
const reportPath = path.join(hwDir, 'report.html');

const finalReportPath = path.join(hwDir, `${baseName}_report.html`);
const zipPath = path.join(hwDir, `${baseName}_code.zip`);

const headerPath = path.join(__dirname, 'header.js');
const footerPath = path.join(__dirname, 'footer.js');
const cssPath = path.join(__dirname, 'styles.css');

if (!fs.existsSync(reportPath)) {
    console.error(`Error: report file not found at: ${reportPath}`);
    process.exit(1);
}

function readComponent(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`Warning: file not found: ${filePath}`);
        return '';
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/module\.exports\s*=\s*[`'"]([\s\S]*?)[`'"];?$/);
    if (match) {
        return match[1];
    }
    return `<script>\n${content}\n</script>`;
}

let html = fs.readFileSync(reportPath, 'utf-8');

html = html.replace(/<script[^>]*src=["'][^"']*(footer|header)\.js["'][^>]*><\/script>/gi, '');
html = html.replace(/<link[^>]*href=["'][^"']*styles\.css["'][^>]*>\s*/gi, '');

if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf-8');
    const styleTag = `<style>\n${css}\n</style>`;
    if (html.includes('</head>')) {
        html = html.replace('</head>', () => `${styleTag}\n</head>`);
    } else {
        html = `${styleTag}\n${html}`;
    }
}

const headerContent = readComponent(headerPath);
if (headerContent && !html.includes('id="header"') && !html.includes('class="header"')) {
    if (html.includes('<body')) {
        html = html.replace(/(<body[^>]*>)/i, (match, p1) => `${p1}\n${headerContent}`);
    } else {
        html = `${headerContent}\n${html}`;
    }
}

const footerContent = readComponent(footerPath);
if (footerContent && !html.includes('id="footer"') && !html.includes('class="footer"')) {
    if (html.includes('</body>')) {
        html = html.replace('</body>', () => `${footerContent}\n</body>`);
    } else {
        html = `${html}\n${footerContent}`;
    }
}

fs.writeFileSync(finalReportPath, html, 'utf-8');
console.log(`Success! Created HTML report: ${finalReportPath}`);

const srcDir = path.join(hwDir, 'src');
const tempDirName = '.temp_build_files';

// Everything under src/, kept with its original structure (so files that
// share a name in different subfolders, e.g. mod.rs, don't collide).
function copyDirRecursive(src, dest) {
    if (path.basename(src) === 'target') return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// All .png files anywhere in the homework folder, except inside src/
// (already covered above) and the build's own scratch/output dirs.
function findPngFiles(dir, baseDir = dir) {
    let results = [];
    const skipDirs = new Set(['target', 'src', tempDirName]);
    const list = fs.readdirSync(dir);

    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            if (!skipDirs.has(file)) {
                results = results.concat(findPngFiles(filePath, baseDir));
            }
        } else if (path.extname(file).toLowerCase() === '.png') {
            results.push(path.relative(baseDir, filePath));
        }
    }
    return results;
}

const pngFiles = findPngFiles(hwDir);
const hasSrc = fs.existsSync(srcDir);

if (hasSrc || pngFiles.length > 0) {
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }

    const tempDir = path.join(hwDir, tempDirName);
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir);

    if (hasSrc) {
        copyDirRecursive(srcDir, path.join(tempDir, 'src'));
    }

    pngFiles.forEach(relPath => {
        const destPath = path.join(tempDir, relPath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(path.join(hwDir, relPath), destPath);
    });

    const zipFileName = `${baseName}_code.zip`;

    // Zip the temp dir's TOP-LEVEL entries by name, not the directory itself
    // ("tar -f zip ." makes bsdtar write a "./" root entry using streamed
    // (data-descriptor) sizes; Windows Explorer's built-in zip viewer chokes
    // on that combination and shows the archive as empty, even though the
    // data is all there -- 7-Zip/WinRAR/unzip open it fine). Passing the
    // entry names explicitly avoids the "./" entry and produces a zip
    // Explorer reads normally.
    const topLevelEntries = fs.readdirSync(tempDir);

    try {
        if (topLevelEntries.length > 0) {
            const args = topLevelEntries.map(e => `"${e}"`).join(' ');
            execSync(`tar -a -c -f "../${zipFileName}" ${args}`, { cwd: tempDir });
            console.log(`Success! Created ZIP archive: ${zipPath}`);
        } else {
            console.log('Nothing to archive after collecting files.');
        }
    } catch (err) {
        console.error('Error creating ZIP archive:', err.message);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
} else {
    console.log('No src/ folder or .png files found in the directory. ZIP archive not created.');
}

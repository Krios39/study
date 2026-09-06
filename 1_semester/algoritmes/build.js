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

function getRsFiles(dir, baseDir = dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            if (file !== 'target') {
                results = results.concat(getRsFiles(filePath, baseDir));
            }
        } else if (file.endsWith('.rs')) {
            results.push(path.relative(baseDir, filePath));
        }
    }
    return results;
}

const rsFiles = getRsFiles(hwDir);

if (rsFiles.length > 0) {
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }

    const tempDir = path.join(hwDir, '.temp_rs_files');
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir);

    const flatFilesList = [];

    rsFiles.forEach(relPath => {
        const fileName = path.basename(relPath);
        fs.copyFileSync(path.join(hwDir, relPath), path.join(tempDir, fileName));
        flatFilesList.push(`"${fileName}"`);
    });

    const zipFileName = `${baseName}_code.zip`;

    try {
        execSync(`tar -a -c -f "../${zipFileName}" ${flatFilesList.join(' ')}`, { cwd: tempDir });
        console.log(`Success! Created flat ZIP archive: ${zipPath}`);
    } catch (err) {
        console.error('Error creating ZIP archive:', err.message);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
} else {
    console.log('No .rs files found in the directory. ZIP archive not created.');
}
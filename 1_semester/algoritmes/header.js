function loadKaTeXAndRender() {
    const katexCSS = document.createElement("link");
    katexCSS.rel = "stylesheet";
    katexCSS.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
    document.head.appendChild(katexCSS);

    const katexScript = document.createElement("script");
    katexScript.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
    katexScript.defer = true;

    katexScript.onload = () => {
        const autoRenderScript = document.createElement("script");
        autoRenderScript.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js";
        autoRenderScript.defer = true;

        autoRenderScript.onload = () => {
            if (window.renderMathInElement) {
                window.renderMathInElement(document.body, {
                    delimiters: [
                        { left: "$$", right: "$$", display: true },
                        { left: "$", right: "$", display: false },
                    ],
                    throwOnError: false,
                });
            }
        };
        document.head.appendChild(autoRenderScript);
    };

    document.head.appendChild(katexScript);
}

document.addEventListener("DOMContentLoaded", () => {
    // --- Генерация шапки отчёта ---
    const pageTitle = document.title.trim();
    const hwMatch = pageTitle.match(/HW\s*(\d+)[:\s-]+(.*)/i);

    let reportTitle = "";
    if (hwMatch) {
        const hwNumber = hwMatch[1];
        const hwTheme = hwMatch[2].trim();
        reportTitle = `Algorithmics (MTAT.03.238) - Homework ${hwNumber}: ${hwTheme}`;
    } else {
        reportTitle = `Algorithmics (MTAT.03.238) - ${pageTitle}`;
    }

    const metaDate = document.querySelector('meta[name="date"]')?.content;
    const displayDate = metaDate || new Date().toISOString().slice(0, 10);

    const studentInfo = {
        name: "Ruslan Nechshadimov",
        curriculum: "Computer Science (MSc)",
        studyYear: "2026",
        email: "ruslan.nechshadimov@ut.ee",
    };

    const headerHTML = `
    <header class="report-header">
      <div class="report-title">${reportTitle}</div>
      <table class="report-meta-table">
        <tr>
          <th>Student:</th>
          <td>${studentInfo.name}</td>
          <th>Study year:</th>
          <td>${studentInfo.studyYear}</td>
        </tr>
        <tr>
          <th>Curriculum:</th>
          <td>${studentInfo.curriculum}</td>
          <th>Date:</th>
          <td>${displayDate}</td>
        </tr>
        <tr>
          <th>University email:</th>
          <td colspan="3"><a href="mailto:${studentInfo.email}">${studentInfo.email}</a></td>
        </tr>
      </table>
      <hr class="report-divider">
    </header>
  `;

    document.body.insertAdjacentHTML("afterbegin", headerHTML);

    // --- Загрузка и рендер формул KaTeX ---
    loadKaTeXAndRender();
});
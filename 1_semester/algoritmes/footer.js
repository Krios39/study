document.addEventListener("DOMContentLoaded", () => {
    const refMetas = document.querySelectorAll('meta[name="reference"]');
    if (refMetas.length === 0) return;

    const references = [];
    const refMap = {};

    refMetas.forEach((meta, index) => {
        const rawContent = meta.getAttribute("content").trim();

        const urlMatch = rawContent.match(/https?:\/\/[^\s]+/i);
        const url = urlMatch ? urlMatch[0] : null;

        let text = rawContent;
        if (url) {
            text = rawContent.replace(url, "").replace(/\|/g, "").trim();
        }

        const key = text.split(/\s+/)[0] || `ref-${index + 1}`;
        const item = { index: index + 1, key, text: text || url, url };

        references.push(item);
        refMap[key] = item;
    });

    let bodyHTML = document.body.innerHTML;
    bodyHTML = bodyHTML.replace(/\[ref:([a-zA-Z0-9_\-]+)\]/g, (match, key) => {
        const ref = refMap[key];
        return ref ? `<sup><a class="ref-link" href="#ref-${ref.index}">[${ref.index}]</a></sup>` : match;
    });
    document.body.innerHTML = bodyHTML;

    const footerHTML = `
    <footer class="report-references">
      <h3>References</h3>
      <ol>
        ${references.map(ref => `
          <li id="ref-${ref.index}">
            <span class="ref-title">${ref.text.replace(/_/g, " ")}</span>
            ${ref.url ? `— <a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.url}</a>` : ""}
          </li>
        `).join("")}
      </ol>
    </footer>
  `;

    document.body.insertAdjacentHTML("beforeend", footerHTML);
});
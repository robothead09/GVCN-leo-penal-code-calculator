(() => {
"use strict";

const cart = []; // array of charge codes, duplicates allowed

const WARN_AT = 15;
const MAX_CHARGES = 20;

const searchInput = document.getElementById("searchInput");
const suggestList = document.getElementById("suggestList");
const chargeList = document.getElementById("chargeList");
const limitWarning = document.getElementById("limitWarning");

const totals = document.getElementById("totals");
const totalCharges = document.getElementById("totalCharges");
const totalJail = document.getElementById("totalJail");
const totalFine = document.getElementById("totalFine");
const totalImpound = document.getElementById("totalImpound");
const totalImpoundValue = document.getElementById("totalImpoundValue");

const clearBtn = document.getElementById("clearBtn");
const calcBtn = document.getElementById("calcBtn");
const copyBtn = document.getElementById("copyBtn");

const byCode = Object.fromEntries(CHARGES.map(c => [c.code, c]));


/* ---------------- helpers ---------------- */

function normalize(str) {
  return str.toLowerCase().replace(/[()]/g, "").trim();
}


/*
Turns:

6-20

into:

(6)20
*/

function formatCode(code) {
  const parts = code.split("-");

  if (parts.length !== 2) {
    return code;
  }

  return `(${parts[0]})${parts[1]}`;
}


function penaltyLine(c) {
  const parts = [];

  if (c.jail) {
    parts.push(`${c.jail}s`);
  }

  if (c.fine) {
    parts.push(`$${c.fine.toLocaleString()}`);
  }

  if (c.impound) {
    parts.push("Impound");
  }

  return parts.length
    ? parts.join(" + ")
    : "No penalty listed";
}


function formatSeconds(total) {
  if (total <= 0) {
    return "0s";
  }

  const m = Math.floor(total / 60);
  const s = total % 60;

  return m
    ? `${m}m ${s}s`
    : `${s}s`;
}


// builds "(x)xx - Name x2, (x)xx - Name" text, collapsing duplicates
function buildChargeText() {

  return groupCart()
    .map(({ code, count }) => {

      const c =
        byCode[code];

      const label =
        `${formatCode(c.code)} - ${c.name}`;

      return count > 1
        ? `${label} x${count}`
        : label;

    })
    .join(", ");

}


function highlight(text, query) {
  const q = normalize(query);

  if (!q) {
    return text;
  }

  const idx = normalize(text).indexOf(q);

  if (idx === -1) {
    return text;
  }

  return (
    text.slice(0, idx) +
    "<mark>" +
    text.slice(idx, idx + q.length) +
    "</mark>" +
    text.slice(idx + q.length)
  );
}


function matchScore(charge, q) {
  const code = normalize(charge.code);
  const name = normalize(charge.name);

  if (code === q) return 100;
  if (code.startsWith(q)) return 90;
  if (name.startsWith(q)) return 80;
  if (name.includes(" " + q)) return 60;
  if (name.includes(q)) return 50;
  if (code.includes(q)) return 40;

  return 0;
}


// sorted once: by Title, then by numeric code
const ALL_SORTED = [...CHARGES].sort((a, b) => {

  if (a.title !== b.title) {
    return a.title - b.title;
  }

  return (
    parseFloat(a.code.split("-")[1]) -
    parseFloat(b.code.split("-")[1])
  );

});


function search(query) {
  const q = normalize(query);

  if (!q) {
    return ALL_SORTED;
  }

  return CHARGES
    .map(c => ({
      c,
      score: matchScore(c, q)
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(x => x.c);
}


/* ---------------- search dropdown ---------------- */

let suggestions = [];
let activeIndex = -1;


function renderSuggestions(query) {

  suggestions = search(query);

  activeIndex =
    suggestions.length
      ? 0
      : -1;

  suggestList.innerHTML = "";


  if (!suggestions.length) {

    suggestList.innerHTML =
      '<li class="suggest-empty">No matching charge or code.</li>';

    suggestList.hidden = false;

    searchInput.setAttribute(
      "aria-expanded",
      "true"
    );

    return;
  }


  suggestions.forEach((c, i) => {

    const li =
      document.createElement("li");

    li.className =
      "suggest-item" +
      (i === 0 ? " is-active" : "");

    li.style.setProperty(
      "--section-color",
      TITLE_COLORS[c.title]
    );

    li.setAttribute(
      "role",
      "option"
    );

    li.dataset.code =
      c.code;


    li.innerHTML = `
      <div class="suggest-main">

        <div class="suggest-name">
          ${highlight(c.name, query)}
        </div>

        <div class="suggest-sub">
          ${formatCode(c.code)} &middot; ${penaltyLine(c)}
        </div>

      </div>

      <span class="suggest-cls suggest-cls--${c.cls}">
        ${c.cls}
      </span>
    `;


    li.addEventListener(
      "mousedown",
      (e) => {

        e.preventDefault();

        addCharge(c.code);

        resetSearch();

      }
    );


    suggestList.appendChild(li);

  });


  suggestList.hidden = false;

  searchInput.setAttribute(
    "aria-expanded",
    "true"
  );

}


function resetSearch() {

  searchInput.value = "";

  suggestList.hidden = true;

  suggestions = [];

  activeIndex = -1;

  searchInput.focus();

}


function updateActiveSuggestion() {

  [...suggestList.children].forEach(
    (li, i) => {

      li.classList.toggle(
        "is-active",
        i === activeIndex
      );

    }
  );


  suggestList
    .children[activeIndex]
    ?.scrollIntoView({
      block: "nearest"
    });

}


searchInput.addEventListener(
  "input",
  () => renderSuggestions(searchInput.value)
);


searchInput.addEventListener(
  "focus",
  () => renderSuggestions(searchInput.value)
);


// click always fires, even when the input already had focus (e.g. right
// after selecting a suggestion, since mousedown prevented it from ever
// blurring) — "focus" alone misses that case and the dropdown stays blank
searchInput.addEventListener(
  "click",
  () => renderSuggestions(searchInput.value)
);


searchInput.addEventListener(
  "keydown",
  (e) => {

    if (
      suggestList.hidden ||
      !suggestions.length
    ) {
      return;
    }


    if (e.key === "ArrowDown") {

      e.preventDefault();

      activeIndex =
        Math.min(
          activeIndex + 1,
          suggestions.length - 1
        );

      updateActiveSuggestion();

    }


    else if (e.key === "ArrowUp") {

      e.preventDefault();

      activeIndex =
        Math.max(
          activeIndex - 1,
          0
        );

      updateActiveSuggestion();

    }


    else if (e.key === "Enter") {

      e.preventDefault();

      const pick =
        suggestions[activeIndex] ||
        suggestions[0];

      if (pick) {

        addCharge(pick.code);

        resetSearch();

      }

    }


    else if (e.key === "Escape") {

      suggestList.hidden = true;

    }

  }
);


document.addEventListener(
  "click",
  (e) => {

    if (
      !e.target.closest(".search-block")
    ) {
      suggestList.hidden = true;
    }

  }
);


/* ---------------- charge list / cart ---------------- */

function addCharge(code) {

  if (cart.length >= MAX_CHARGES) {
    flashLimitWarning();
    return;
  }

  cart.push(code);

  renderList();

  hideTotals();

}


// briefly pulses the cap message so it's noticeable even if it was
// already visible (e.g. user keeps clicking charges after hitting 20)
function flashLimitWarning() {

  updateLimitWarning();

  limitWarning.classList.remove("limit-warning--pulse");

  void limitWarning.offsetWidth; // restart the animation

  limitWarning.classList.add("limit-warning--pulse");

}


function updateLimitWarning() {

  const count = cart.length;

  if (count >= MAX_CHARGES) {

    limitWarning.textContent =
      `Charge limit reached (${count}/${MAX_CHARGES}) — remove a charge to add another.`;

    limitWarning.className =
      "limit-warning limit-warning--cap";

    limitWarning.hidden = false;

  }

  else if (count >= WARN_AT) {

    limitWarning.textContent =
      `Approaching the charge limit (${count}/${MAX_CHARGES}).`;

    limitWarning.className =
      "limit-warning limit-warning--warn";

    limitWarning.hidden = false;

  }

  else {

    limitWarning.hidden = true;

  }

}


function removeCharge(code) {

  const idx = cart.indexOf(code);

  if (idx !== -1) {
    cart.splice(idx, 1);
  }

  renderList();

  hideTotals();

}


// collapses the cart into one entry per unique code, with a count,
// preserving the order each code first appeared in
function groupCart() {

  const order = [];
  const counts = {};

  cart.forEach(code => {

    if (!(code in counts)) {
      counts[code] = 0;
      order.push(code);
    }

    counts[code]++;

  });

  return order.map(code => ({
    code,
    count: counts[code]
  }));

}


function renderList() {

  chargeList.innerHTML = "";


  groupCart().forEach(({ code, count }) => {

    const c =
      byCode[code];

    const li =
      document.createElement("li");

    li.className =
      "charge-item";

    li.style.setProperty(
      "--section-color",
      TITLE_COLORS[c.title]
    );


    li.innerHTML = `
      <div class="charge-item-main">

        <div class="charge-item-name">
          ${c.name}${count > 1 ? ` &times;${count}` : ""}
        </div>

        <div class="charge-item-sub">
          ${formatCode(c.code)} &middot; ${penaltyLine(c)}
        </div>

      </div>

      <button
        type="button"
        class="charge-item-remove"
        aria-label="Remove one ${c.name}"
      >
        &times;
      </button>
    `;


    li
      .querySelector(".charge-item-remove")
      .addEventListener(
        "click",
        () => removeCharge(code)
      );


    chargeList.appendChild(li);

  });


  const has =
    cart.length > 0;

  clearBtn.hidden =
    !has;

  calcBtn.hidden =
    !has;

  updateLimitWarning();

}


function hideTotals() {

  totals.hidden = true;

  copyBtn.textContent =
    "Copy Report";

}


/* ---------------- clear ---------------- */

clearBtn.addEventListener(
  "click",
  () => {

    cart.length = 0;

    renderList();

    hideTotals();

  }
);


/* ---------------- calculate ---------------- */

calcBtn.addEventListener(
  "click",
  () => {

    if (!cart.length) {
      return;
    }


    let jail = 0;
    let fine = 0;
    let impound = false;


    cart.forEach(code => {

      const c =
        byCode[code];

      jail +=
        c.jail || 0;

      fine +=
        c.fine || 0;

      if (c.impound) {
        impound = true;
      }

    });


    const chargeText =
      buildChargeText();


    totalCharges.textContent =
      chargeText;

    totalJail.textContent =
      formatSeconds(jail);

    totalFine.textContent =
      "$" + fine.toLocaleString();

    totalImpoundValue.textContent =
      impound
        ? "Yes"
        : "No";

    totalImpound.classList.toggle(
      "totals-row--flag",
      impound
    );

    totals.hidden =
      false;

  }
);


/* ---------------- copy report ---------------- */

copyBtn.addEventListener(
  "click",
  async () => {

    if (!cart.length) {
      return;
    }


    let jail = 0;
    let fine = 0;
    let impound = false;


    cart.forEach(code => {

      const c =
        byCode[code];

      jail +=
        c.jail || 0;

      fine +=
        c.fine || 0;

      if (c.impound) {
        impound = true;
      }

    });


    const chargeText =
      buildChargeText();


    const report =
      `**Charge(s):** ${chargeText}\n` +
      `*Total Fine:* $${fine.toLocaleString()}\n` +
      `*Jail Time:* ${formatSeconds(jail)}\n` +
      `*Impoundment:* ${impound ? "Yes" : "No"}`;


    try {

      await navigator.clipboard.writeText(
        report
      );

      copyBtn.textContent =
        "Copied!";

      setTimeout(
        () => {
          copyBtn.textContent =
            "Copy Report";
        },
        1500
      );

    }

    catch {

      const textarea =
        document.createElement("textarea");

      textarea.value =
        report;

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();

      copyBtn.textContent =
        "Copied!";

      setTimeout(
        () => {
          copyBtn.textContent =
            "Copy Report";
        },
        1500
      );

    }

  }
);

})();
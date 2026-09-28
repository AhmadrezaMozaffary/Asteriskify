(() => {
  if (window.__asteriskifyInjected) return;
  window.__asteriskifyInjected = true;

  const STORAGE_KEY = "asteriskify_data";
  const MASK = "********";

  const style = document.createElement("style");
  style.textContent = `
    body.asteriskify-spotlight { cursor: crosshair; }
    #asteriskify-spotlight {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(4px) saturate(1.2);
      -webkit-backdrop-filter: blur(4px) saturate(1.2);
    }
  `;
  document.head.appendChild(style);

  let spotlightActive = false;
  let spotlightEl = null;

  function getSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += `#${CSS.escape(el.id)}`;
        path.unshift(selector);
        break;
      }
      let nth = 1;
      let sibling = el;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.nodeName === el.nodeName) nth++;
      }
      if (nth > 1) selector += `:nth-of-type(${nth})`;
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(" > ");
  }

  async function getData() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || {};
  }

  async function saveData(data) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  }

  function asteriskify(el) {
    el.dataset.asteriskifyOriginal = el.innerHTML;
    el.textContent = MASK;
  }

  async function saveEntry(selector, original) {
    const data = await getData();
    const origin = location.origin;
    if (!data[origin]) data[origin] = {};
    data[origin][selector] = original;
    await saveData(data);
  }

  async function applyStored() {
    const data = await getData();
    const entries = data[location.origin];
    if (!entries) return;
    for (const [selector, original] of Object.entries(entries)) {
      const el = document.querySelector(selector);
      if (el) {
        el.dataset.asteriskifyOriginal = original;
        el.textContent = MASK;
      }
    }
  }

  async function clearSite() {
    const data = await getData();
    const entries = data[location.origin] || {};
    for (const [selector, original] of Object.entries(entries)) {
      const el = document.querySelector(selector);
      if (el) el.innerHTML = original;
    }
    delete data[location.origin];
    await saveData(data);
  }

  function onMouseMove(e) {
    if (!spotlightEl) return;
    const mask =
      `radial-gradient(circle 90px at ${e.clientX}px ${e.clientY}px, transparent 90px, black 91px)`;
    spotlightEl.style.webkitMask = mask;
    spotlightEl.style.mask = mask;
  }

  function enableSpotlight() {
    if (!spotlightEl) {
      spotlightEl = document.createElement("div");
      spotlightEl.id = "asteriskify-spotlight";
      document.body.appendChild(spotlightEl);
    }
    document.body.classList.add("asteriskify-spotlight");
    document.addEventListener("mousemove", onMouseMove);
  }

  function disableSpotlight() {
    document.body.classList.remove("asteriskify-spotlight");
    if (spotlightEl) {
      spotlightEl.remove();
      spotlightEl = null;
    }
    document.removeEventListener("mousemove", onMouseMove);
  }

  document.addEventListener(
    "click",
    (e) => {
      if (!spotlightActive) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      if (el === document.body || el === document.documentElement) return;
      const selector = getSelector(el);
      const original = el.innerHTML;
      asteriskify(el);
      saveEntry(selector, original);
      spotlightActive = false;
      disableSpotlight();
    },
    true
  );

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "PING") {
      sendResponse({ ok: true });
    } else if (msg.type === "TOGGLE_SPOTLIGHT") {
      spotlightActive = !spotlightActive;
      if (spotlightActive) enableSpotlight();
      else disableSpotlight();
      sendResponse({ active: spotlightActive });
    } else if (msg.type === "CLEAR_SITE") {
      clearSite().then(() => sendResponse({ ok: true }));
      return true;
    }
  });

  applyStored();
})();

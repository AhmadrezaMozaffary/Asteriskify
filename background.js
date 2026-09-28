chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: "asteriskify-clear",
    title: "Clear asteriskified elements",
    contexts: ["page"]
  });
});

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  await ensureContentScript(tab.id);
  await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SPOTLIGHT" }).catch(() => {});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "asteriskify-clear") {
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_SITE" }).catch(() => {});
  }
});

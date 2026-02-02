export type PageContext = {
  url: string;
  title: string;
  metaDescription: string;
  textContent: string;
};

const MAX_CONTEXT_CHARS = 8000;

export function getPageContext(maxChars = MAX_CONTEXT_CHARS): PageContext {
  if (typeof window === 'undefined') {
    return { url: '', title: '', metaDescription: '', textContent: '' };
  }

  const url = window.location.href;
  const title = document.title || '';
  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute('content') ||
    document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
    '';

  const textContent = extractVisibleText(maxChars);

  return { url, title, metaDescription, textContent };
}

function extractVisibleText(maxChars: number) {
  const root =
    (document.querySelector('main') as HTMLElement | null) ||
    (document.querySelector('article') as HTMLElement | null) ||
    document.body;

  if (!root) return '';

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (
          parent.closest(
            '[data-assistant-chatbox], script, style, noscript, svg, canvas, nav, footer, header'
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.textContent || !node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let text = '';
  while (walker.nextNode()) {
    const value = walker.currentNode.textContent?.trim();
    if (!value) continue;
    text += `${value} `;
    if (text.length >= maxChars) break;
  }

  return text.trim().slice(0, maxChars);
}

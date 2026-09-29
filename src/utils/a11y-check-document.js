// a11y-check-document.js — the bridge between the live editor DOM and a
// document an accessibility checker can test (issue #155).
//
// The checker runs somewhere else (a server with @afixt/afixt-engine) and
// reports each finding by XPath/selector in the document it was sent. To bring
// a finding back to the content, every element in that document carries a
// `data-lexic-a11y-ref` index into the live editor elements it was cloned from.
// The editor then asks Lexical which node owns that live element.
//
// The document is built from the editing DOM rather than from the serialized
// `onContentChange` HTML precisely because only the editing DOM can be mapped
// back to nodes. The two describe the same structure — headings, lists, links,
// images, tables — which is what these checks judge.

export const REF_ATTRIBUTE = 'data-lexic-a11y-ref';

/**
 * Elements of the wrapper the editor puts around the content. A finding on one
 * of these is about the wrapper (its title, its landmarks), which the author
 * neither wrote nor can change, so it is not reported.
 */
const WRAPPER_TAGS = new Set(['html', 'head', 'body', 'main']);

/**
 * Attributes that only exist while editing. Removed so the checker judges the
 * content, not the editing surface's plumbing.
 * @param {Element} element
 */
function stripEditingAttributes(element) {
  element.removeAttribute('contenteditable');
  element.removeAttribute('spellcheck');
  for (const { name } of [...element.attributes]) {
    if (name.startsWith('data-lexical')) {
      element.removeAttribute(name);
    }
  }
}

/**
 * Build the document sent to the checker from the editor's root element.
 *
 * @param {HTMLElement} root the editor's contenteditable root.
 * @param {{ lang?: string, title?: string }} [options]
 * @returns {{ html: string, elements: Element[] }} the serialized document, and
 *   the live elements indexed by the `data-lexic-a11y-ref` each clone carries.
 */
export function buildCheckDocument(root, { lang = 'en', title = 'Content' } = {}) {
  const clone = root.cloneNode(true);
  // A deep clone preserves document order, so the Nth descendant of the clone
  // is the copy of the Nth descendant of the live root.
  const elements = [...root.querySelectorAll('*')];
  [...clone.querySelectorAll('*')].forEach((element, index) => {
    stripEditingAttributes(element);
    element.setAttribute(REF_ATTRIBUTE, String(index));
  });

  const doc = root.ownerDocument.implementation.createHTMLDocument(title);
  doc.documentElement.setAttribute('lang', lang);
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  doc.head.prepend(charset);

  const main = doc.createElement('main');
  main.append(...[...clone.childNodes].map((node) => doc.importNode(node, true)));
  doc.body.append(main);

  return { html: `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`, elements };
}

/**
 * Find the element a finding points at in the parsed check document.
 * @param {Document} doc
 * @param {{ xpath?: string, selector?: string }} issue
 * @returns {Element | null}
 */
function findTarget(doc, issue) {
  if (issue.xpath) {
    try {
      const view = doc.defaultView || globalThis;
      const found = doc.evaluate(
        issue.xpath,
        doc,
        null,
        view.XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue;
      if (found) return found.nodeType === 1 ? found : found.parentElement;
    } catch {
      // An XPath this DOM cannot evaluate: fall through to the selector.
    }
  }
  if (issue.selector) {
    try {
      return doc.querySelector(issue.selector);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Place one finding in the content.
 *
 * @param {Document} doc the check document, parsed (see `parseCheckDocument`).
 * @param {{ xpath?: string, selector?: string }} issue
 * @returns {{ kind: 'content', ref: number } | { kind: 'wrapper' } | { kind: 'unplaced' }}
 *   `content` with the ref of the nearest content element; `wrapper` for a
 *   finding on the editor's own wrapper; `unplaced` when it cannot be located.
 */
export function locateIssue(doc, issue) {
  const target = findTarget(doc, issue);
  if (!target) return { kind: 'unplaced' };

  const owner = target.closest(`[${REF_ATTRIBUTE}]`);
  if (owner) {
    return { kind: 'content', ref: Number(owner.getAttribute(REF_ATTRIBUTE)) };
  }
  if (WRAPPER_TAGS.has(target.localName) || target.closest('head')) {
    return { kind: 'wrapper' };
  }
  return { kind: 'unplaced' };
}

/**
 * Parse a check document for `locateIssue`. Parsing only — DOMParser never
 * runs scripts or loads resources.
 * @param {string} html
 * @returns {Document}
 */
export function parseCheckDocument(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

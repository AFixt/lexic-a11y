import {
  buildCheckDocument,
  locateIssue,
  parseCheckDocument,
  REF_ATTRIBUTE,
} from '../utils/a11y-check-document';

function editingRoot() {
  const root = document.createElement('div');
  root.setAttribute('contenteditable', 'true');
  root.innerHTML =
    '<h2 data-lexical-text="true" spellcheck="false">Title</h2>' +
    '<p><span data-lexical-decorator="true" contenteditable="false"><img src="a.png" alt="A"></span></p>';
  document.body.append(root);
  return root;
}

describe('buildCheckDocument', () => {
  it('wraps the content in a language-tagged document and indexes every element', () => {
    const root = editingRoot();
    const { html, elements } = buildCheckDocument(root, { lang: 'fr', title: 'Contenu' });
    const doc = parseCheckDocument(html);

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(doc.documentElement.getAttribute('lang')).toBe('fr');
    expect(doc.title).toBe('Contenu');
    expect(doc.querySelector('meta[charset]')).not.toBeNull();

    const refs = [...doc.querySelectorAll(`[${REF_ATTRIBUTE}]`)];
    expect(refs).toHaveLength(elements.length);
    refs.forEach((element) => {
      const live = elements[Number(element.getAttribute(REF_ATTRIBUTE))];
      expect(live.localName).toBe(element.localName);
    });
  });

  it('removes editing-only attributes from the copy, not from the editor', () => {
    const root = editingRoot();
    const { html } = buildCheckDocument(root);

    expect(html).not.toMatch(/contenteditable|spellcheck|data-lexical/);
    expect(root.querySelector('span').getAttribute('contenteditable')).toBe('false');
    expect(root.querySelector('[data-lexic-a11y-ref]')).toBeNull();
  });
});

describe('locateIssue', () => {
  const html =
    '<!DOCTYPE html><html lang="en"><head><title>t</title></head><body><main>' +
    '<p data-lexic-a11y-ref="0">Text <a href="#" data-lexic-a11y-ref="1">link</a></p>' +
    '</main></body></html>';
  const doc = parseCheckDocument(html);

  it.each([
    ['an element', { xpath: '/html[1]/body[1]/main[1]/p[1]/a[1]' }, { kind: 'content', ref: 1 }],
    [
      'a text node',
      { xpath: '/html[1]/body[1]/main[1]/p[1]/text()[1]' },
      { kind: 'content', ref: 0 },
    ],
    ['a selector', { selector: 'main > p > a' }, { kind: 'content', ref: 1 }],
    ['the title', { xpath: '/html[1]/head[1]/title[1]' }, { kind: 'wrapper' }],
    ['main', { selector: 'main' }, { kind: 'wrapper' }],
    ['the document', { xpath: '/html[1]' }, { kind: 'wrapper' }],
    ['nothing', { xpath: '/html[1]/body[1]/main[1]/table[1]' }, { kind: 'unplaced' }],
    ['a bad XPath and selector', { xpath: '((', selector: '>>' }, { kind: 'unplaced' }],
    ['no location', {}, { kind: 'unplaced' }],
  ])('places a finding on %s', (_label, issue, expected) => {
    expect(locateIssue(doc, issue)).toEqual(expected);
  });
});

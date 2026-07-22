import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { HeadingOutlinePlugin } from '../components/HeadingOutlinePlugin';
import i18n from '../utils/i18n';

// Heading nodes the mocked $getRoot returns
let mockHeadings = [];

const makeHeading = (key, tag, text) => ({
  __isHeading: true,
  getKey: () => key,
  getTag: () => tag,
  getTextContent: () => text,
  selectStart: jest.fn(),
});

let capturedListener = null;

const mockScrollIntoView = jest.fn();
const mockEditor = {
  registerUpdateListener: jest.fn((listener) => {
    capturedListener = listener;
    return () => {
      capturedListener = null;
    };
  }),
  getEditorState: jest.fn(() => ({ read: (cb) => cb() })),
  getElementByKey: jest.fn(() => ({ scrollIntoView: mockScrollIntoView })),
  update: jest.fn((cb) => cb()),
  focus: jest.fn(),
};

jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

jest.mock('@lexical/rich-text', () => ({
  $isHeadingNode: (node) => Boolean(node && node.__isHeading),
}));

jest.mock('lexical', () => ({
  $getRoot: jest.fn(() => ({
    getChildren: () => mockHeadings,
  })),
  $getNodeByKey: jest.fn((key) => mockHeadings.find((node) => node.getKey() === key) || null),
}));

const renderWithI18n = (component) => {
  return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

const simulateUpdate = (headings) => {
  mockHeadings = headings;
  act(() => {
    capturedListener({ editorState: { read: (cb) => cb() } });
  });
};

describe('HeadingOutlinePlugin', () => {
  beforeEach(() => {
    mockHeadings = [];
    mockEditor.update.mockClear();
    mockEditor.focus.mockClear();
    mockScrollIntoView.mockClear();
  });

  it('shows an empty-state message when there are no headings', () => {
    renderWithI18n(<HeadingOutlinePlugin />);

    expect(screen.getByText(/No headings yet/)).toBeInTheDocument();
  });

  it('is a labelled region and contributes no heading to the host page', () => {
    mockHeadings = [makeHeading('1', 'h1', 'Title')];

    renderWithI18n(<HeadingOutlinePlugin />);

    expect(screen.getByRole('region', { name: 'Document Outline' })).toBeInTheDocument();
    // The panel belongs to a single form control, so its title must not land in
    // the host page's heading outline (issue #88).
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    // ...but the title is still visible as text
    expect(screen.getByText('Document Outline')).toBeInTheDocument();
  });

  it('renders the outline reflecting the document structure', () => {
    mockHeadings = [
      makeHeading('1', 'h1', 'Title'),
      makeHeading('2', 'h2', 'Section'),
      makeHeading('3', 'h3', 'Subsection'),
    ];

    renderWithI18n(<HeadingOutlinePlugin />);

    const nav = screen.getByRole('navigation', { name: 'Document Outline' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /H1 Title/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /H2 Section/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /H3 Subsection/ })).toBeInTheDocument();
  });

  it('updates the outline when the editor content changes', () => {
    renderWithI18n(<HeadingOutlinePlugin />);

    simulateUpdate([makeHeading('1', 'h1', 'New Title')]);

    expect(screen.getByRole('button', { name: /H1 New Title/ })).toBeInTheDocument();
  });

  it('announces a clear warning when a heading level is skipped', () => {
    mockHeadings = [makeHeading('1', 'h1', 'Title'), makeHeading('2', 'h3', 'Deep')];

    renderWithI18n(<HeadingOutlinePlugin />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Heading level skipped: H1 is followed by H3');
    // Not conveyed by color alone: textual "Warning" prefix
    expect(status).toHaveTextContent(/Warning/);
  });

  it('warns about multiple H1 headings', () => {
    mockHeadings = [makeHeading('1', 'h1', 'One'), makeHeading('2', 'h1', 'Two')];

    renderWithI18n(<HeadingOutlinePlugin />);

    expect(screen.getByRole('status')).toHaveTextContent('Multiple H1 headings found (2)');
  });

  it('renders every warning even when two are identical (no key collision)', () => {
    // Two separate H2->H4 jumps produce identical messages (and no H1, so no
    // multiple-H1 warning); both warning items must render.
    mockHeadings = [
      makeHeading('1', 'h2', 'A'),
      makeHeading('2', 'h4', 'B'),
      makeHeading('3', 'h2', 'C'),
      makeHeading('4', 'h4', 'D'),
    ];

    renderWithI18n(<HeadingOutlinePlugin />);

    const items = screen
      .getAllByRole('listitem')
      .filter((li) => li.className.includes('editor-outline-warning'));
    expect(items).toHaveLength(2);
  });

  it('shows no warnings for a well-formed structure', () => {
    mockHeadings = [makeHeading('1', 'h1', 'One'), makeHeading('2', 'h2', 'Two')];

    renderWithI18n(<HeadingOutlinePlugin />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('navigates to a heading when its outline entry is activated', async () => {
    const user = userEvent.setup();
    const heading = makeHeading('1', 'h1', 'Title');
    mockHeadings = [heading];

    renderWithI18n(<HeadingOutlinePlugin />);

    await user.click(screen.getByRole('button', { name: /H1 Title/ }));

    expect(mockScrollIntoView).toHaveBeenCalled();
    expect(heading.selectStart).toHaveBeenCalled();
    expect(mockEditor.focus).toHaveBeenCalled();
  });
});

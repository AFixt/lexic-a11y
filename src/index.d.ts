// Public type declarations for @afixt/lexic-a11y.
//
// The source is JavaScript (see docs/adr/0002-remain-on-javascript.md), so these
// declarations are hand-maintained rather than emitted by `tsc`. They describe
// the exports of `src/lib.js` — the entry Rollup builds into `dist/` — and are
// copied to `dist/index.d.ts` by the build. Keep them in sync when the public
// API changes; `npm run types:check` verifies they compile under `strict`.

import type { i18n as I18n } from 'i18next';
import type { Dispatch, ReactElement, SetStateAction } from 'react';

/** Serialization format passed to `onContentChange`. */
export type OutputFormat = 'html' | 'markdown';

export interface EditorProps {
  /**
   * Called on every edit with the serialized document, in the format chosen by
   * `outputFormat`.
   */
  onContentChange: (content: string) => void;

  /**
   * Format passed to `onContentChange`. Nodes without a Markdown form (tables,
   * images, horizontal rules) are omitted from Markdown output.
   *
   * @defaultValue 'html'
   */
  outputFormat?: OutputFormat;

  /**
   * Optional async upload handler. When provided, the Insert Image dialog gains
   * a drag-and-drop zone and file picker; the handler receives the chosen file
   * and must resolve to the URL to embed. When omitted, the dialog stays
   * URL-only.
   */
  onImageUpload?: (file: File) => Promise<string>;

  /**
   * Optional trusted HTML used to seed the editor once, on mount (e.g. a saved
   * draft or a pre-filled template). Images, tables, and code blocks are
   * preserved. Later changes to this prop are ignored so user edits are never
   * clobbered.
   */
  initialValue?: string;

  /**
   * Whether to render the Document Outline panel below the editing surface.
   * Off by default, so the editor stays minimal chrome and suits short-form
   * embedded fields (a reply box, a ticket description). Pass `true` for
   * long-form authoring, where a live heading map earns its space.
   *
   * @defaultValue false
   */
  showOutline?: boolean;
}

/**
 * The accessible rich text editor. Self-contained: it creates its own Lexical
 * composer, so it does not need to be wrapped in one.
 */
declare function Editor(props: EditorProps): ReactElement;

export default Editor;

export interface ToolbarPluginProps {
  /** Whether the keyboard-shortcut help overlay is currently open. */
  showDocs: boolean;
  /** State setter used to toggle the help overlay (also bound to Ctrl/Cmd+D). */
  setShowDocs: Dispatch<SetStateAction<boolean>>;
  /** See {@link EditorProps.onImageUpload}. */
  onImageUpload?: (file: File) => Promise<string>;
}

/**
 * The editor toolbar, exported for advanced use. It reads the active editor
 * from Lexical's composer context, so it must be rendered inside a
 * `LexicalComposer`. Most consumers should render {@link Editor} instead, which
 * already includes it.
 */
export declare function ToolbarPlugin(props: ToolbarPluginProps): ReactElement;

/**
 * The package's pre-configured `i18next` instance, with the editor's English
 * strings registered. Pass it to `I18nextProvider`, or call `addResourceBundle`
 * on it to add languages.
 */
export declare const i18n: I18n;

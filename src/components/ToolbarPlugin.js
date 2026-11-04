// ToolbarPlugin.js
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  $isListItemNode,
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  KEY_ESCAPE_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HEADING_FORMATS, TEXT_FORMATS, useAllowedFormats } from '../utils/allowed-formats';
import { isSafeUrl, sanitizeUrl } from '../utils/sanitize-url';

import { $createImageNode } from './ImageNode';
import { useTooltip } from './Tooltip';

export function ToolbarPlugin({ showDocs, setShowDocs, onImageUpload, allowedFormats }) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const allowed = useAllowedFormats(allowedFormats);
  const can = useCallback((format) => allowed.has(format), [allowed]);
  // Real tooltips (not title attributes) shown on hover/focus after a short delay
  const { getTriggerProps, tooltip } = useTooltip();
  // Modifier label for shortcut hints in tooltips, matching the platform
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
  const modKey = isMac ? 'Cmd' : 'Ctrl';
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [activeHeadingTag, setActiveHeadingTag] = useState(null);
  const [isOrderedListActive, setIsOrderedListActive] = useState(false);
  const [isUnorderedListActive, setIsUnorderedListActive] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isLinkActive, setIsLinkActive] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageDecorative, setImageDecorative] = useState(false);
  // Upload UI is only offered when the host app configures an upload handler.
  const canUploadImage = typeof onImageUpload === 'function';
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | error
  const [uploadMessage, setUploadMessage] = useState('');
  const dialogRef = useRef(null);
  const urlInputRef = useRef(null);
  // The editor selection captured when the link dialog opens. The dialog steals
  // DOM focus and re-focusing the editor on Insert collapses the live selection,
  // so we restore this snapshot before applying the link — otherwise a selected
  // word gets re-inserted (e.g. "lexical" → "lexicallexical").
  const savedLinkSelectionRef = useRef(null);
  const imageUrlInputRef = useRef(null);
  const imageFileInputRef = useRef(null);

  // Alt text is required unless the image is explicitly marked decorative
  const canInsertImage = Boolean(imageUrl.trim() && (imageAlt.trim() !== '' || imageDecorative));

  const closeImageDialog = useCallback(() => {
    setShowImageDialog(false);
    setImageUrl('');
    setImageAlt('');
    setImageDecorative(false);
    setIsDraggingImage(false);
    setUploadStatus('idle');
    setUploadMessage('');
  }, []);

  // Run a dropped/selected file through the configured upload handler and use
  // the returned URL. The handler owns where the bytes actually go (S3, API,
  // data URL, …); this component only needs a URL back.
  const handleImageFile = useCallback(
    async (file) => {
      if (!canUploadImage || !file) return;
      if (!file.type || !file.type.startsWith('image/')) {
        setUploadStatus('error');
        setUploadMessage(t('imageUploadInvalidType'));
        return;
      }
      setUploadStatus('uploading');
      setUploadMessage(t('imageUploading'));
      try {
        const url = await onImageUpload(file);
        if (typeof url !== 'string' || url.trim() === '') {
          throw new Error('Upload handler did not return a URL');
        }
        setImageUrl(url.trim());
        setUploadStatus('idle');
        setUploadMessage(t('imageUploadComplete'));
      } catch (error) {
        console.error('Image upload failed:', error);
        setUploadStatus('error');
        setUploadMessage(t('imageUploadError'));
      }
    },
    [canUploadImage, onImageUpload, t],
  );

  const insertImage = useCallback(() => {
    if (!canInsertImage) return;
    setShowImageDialog(false);
    editor.focus();
    editor.update(() => {
      try {
        const imageNode = $createImageNode({
          src: imageUrl.trim(),
          alt: imageDecorative ? '' : imageAlt.trim(),
          decorative: imageDecorative,
        });
        $insertNodes([imageNode]);
      } catch (error) {
        console.error('Error inserting image:', error);
      }
    });
    setImageUrl('');
    setImageAlt('');
    setImageDecorative(false);
  }, [canInsertImage, editor, imageUrl, imageAlt, imageDecorative]);

  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState('3');
  const [tableColumns, setTableColumns] = useState('3');
  const [tableHeaders, setTableHeaders] = useState(true);
  const tableRowsInputRef = useRef(null);

  const closeTableDialog = useCallback(() => {
    setShowTableDialog(false);
    setTableRows('3');
    setTableColumns('3');
    setTableHeaders(true);
  }, []);

  // Rows/columns must be positive integers within a sane bound
  const isValidTableSize = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20;
  };
  const canInsertTable = isValidTableSize(tableRows) && isValidTableSize(tableColumns);

  const insertTable = useCallback(() => {
    if (!canInsertTable) return;
    setShowTableDialog(false);
    editor.focus();
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      rows: String(Number.parseInt(tableRows, 10)),
      columns: String(Number.parseInt(tableColumns, 10)),
      // Header *row* only (matches the "Include header row" checkbox). Marking the
      // first column as headers too would emit <th> row-headers that the export
      // step can only scope as columns, mislabeling them for screen readers.
      includeHeaders: { rows: tableHeaders, columns: false },
    });
    setTableRows('3');
    setTableColumns('3');
    setTableHeaders(true);
  }, [canInsertTable, editor, tableRows, tableColumns, tableHeaders]);
  const [isInlineCode, setIsInlineCode] = useState(false);
  const [isCodeBlockActive, setIsCodeBlockActive] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isQuoteActive, setIsQuoteActive] = useState(false);
  const toolbarRef = useRef(null);
  const rovingIndexRef = useRef(0);

  // All focusable toolbar controls, in DOM order (excludes dialog controls)
  const getToolbarButtons = useCallback(() => {
    if (!toolbarRef.current) return [];
    return Array.from(toolbarRef.current.querySelectorAll('.toolbar-group > button')).filter(
      (button) => !button.disabled,
    );
  }, []);

  // WAI-ARIA toolbar pattern: a single tab stop with a roving tabindex.
  // Exactly one control keeps tabindex="0"; the rest get tabindex="-1".
  const applyRovingTabIndex = useCallback(() => {
    const buttons = getToolbarButtons();
    if (buttons.length === 0) return;
    if (rovingIndexRef.current >= buttons.length) {
      rovingIndexRef.current = 0;
    }
    buttons.forEach((button, index) => {
      button.tabIndex = index === rovingIndexRef.current ? 0 : -1;
    });
  }, [getToolbarButtons]);

  // Re-apply after every render so newly added/enabled buttons stay managed
  useEffect(applyRovingTabIndex);

  // Arrow-key navigation between toolbar controls (wraps), Home/End jump
  const handleToolbarKeyDown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;

    const buttons = getToolbarButtons();
    if (buttons.length === 0) return;

    // Only handle when focus is on a toolbar control (not the link dialog)
    const currentIndex = buttons.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    e.preventDefault();
    let nextIndex;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % buttons.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else {
      nextIndex = buttons.length - 1;
    }

    rovingIndexRef.current = nextIndex;
    applyRovingTabIndex();
    buttons[nextIndex].focus();
  };

  // Keep the roving index in sync when a control gains focus (e.g. via click)
  const handleToolbarFocus = (e) => {
    const buttons = getToolbarButtons();
    const index = buttons.indexOf(e.target);
    if (index !== -1) {
      rovingIndexRef.current = index;
      applyRovingTabIndex();
    }
  };
  // Helper to apply heading formatting with toggle functionality
  const setHeading = useCallback(
    (tag) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        // Check if selection is already the same heading type
        let isAlreadyHeadingType = false;
        const anchorNode = selection.anchor.getNode();
        const focusNode = selection.focus.getNode();

        // Check the nearest block parent of selection
        const anchorParent = anchorNode.getParent();
        const focusParent = focusNode.getParent();

        // Simple case: heading is direct parent
        if (
          ($isHeadingNode(anchorParent) && anchorParent.getTag() === tag) ||
          ($isHeadingNode(focusParent) && focusParent.getTag() === tag)
        ) {
          isAlreadyHeadingType = true;
        }

        try {
          if (isAlreadyHeadingType) {
            // Convert to paragraph if already the heading type
            $setBlocksType(selection, () => $createParagraphNode());
          } else {
            // Convert to specified heading type
            $setBlocksType(selection, () => $createHeadingNode(tag));
          }
        } catch (error) {
          console.error('Error applying heading:', error);
          // Fallback implementation
          if (isAlreadyHeadingType) {
            const paragraph = $createParagraphNode();
            selection.insertNodes([paragraph]);
          } else {
            const element = $createHeadingNode(tag);
            selection.insertNodes([element]);
          }
        }
      });
    },
    [editor],
  );

  // Find the LinkNode containing a node, if any (walks up the tree)
  const findLinkNode = (node) => {
    let current = node;
    let depth = 0;
    while (current && depth < 10) {
      if ($isLinkNode(current)) {
        return current;
      }
      try {
        current = current.getParent();
      } catch (_e) {
        return null;
      }
      depth++;
    }
    return null;
  };

  // Open the link dialog, pre-filled from an existing link when the
  // cursor/selection is inside one (edit mode), or from the selected text
  const openLinkDialog = useCallback(() => {
    savedLinkSelectionRef.current = null;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Snapshot the live selection so Insert can restore it after the dialog
        // closes (see savedLinkSelectionRef).
        savedLinkSelectionRef.current = {
          anchorKey: selection.anchor.key,
          anchorOffset: selection.anchor.offset,
          anchorType: selection.anchor.type,
          focusKey: selection.focus.key,
          focusOffset: selection.focus.offset,
          focusType: selection.focus.type,
        };
        const linkNode = findLinkNode(selection.anchor.getNode());
        if (linkNode) {
          // Editing an existing link: pre-fill its URL and text
          setLinkUrl(linkNode.getURL());
          setLinkText(linkNode.getTextContent());
        } else {
          const selectedText = selection.getTextContent();
          if (selectedText) {
            setLinkText(selectedText);
          }
        }
      }
    });
    setShowLinkDialog(true);
  }, [editor]);

  // Remove the link at the current selection
  const removeLink = useCallback(() => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkText('');
    editor.focus();
  }, [editor]);

  // Helper to toggle a code block (code <-> paragraph)
  const toggleCodeBlock = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      // Determine whether the selection is already inside a code block
      const anchorNode = selection.anchor.getNode();
      const focusNode = selection.focus.getNode();
      const isAlreadyCode =
        $isCodeNode(anchorNode) ||
        $isCodeNode(anchorNode.getParent()) ||
        $isCodeNode(focusNode) ||
        $isCodeNode(focusNode.getParent());

      try {
        if (isAlreadyCode) {
          // Toggle back to a paragraph when already a code block
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createCodeNode());
        }
      } catch (error) {
        console.error('Error applying code block:', error);
      }
    });
  }, [editor]);

  // Strip all inline marks from the selection and reset blocks to paragraphs
  const clearFormatting = useCallback(() => {
    // $setBlocksType cannot unwrap list items, so detect a list selection and
    // remove it via the list command before resetting the remaining blocks.
    let inList = false;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        inList = selection.getNodes().some((node) => {
          const parent = node.getParent ? node.getParent() : null;
          return (
            $isListNode(node) ||
            $isListItemNode(node) ||
            $isListNode(parent) ||
            $isListItemNode(parent)
          );
        });
      }
    });
    if (inList) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }

    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      try {
        // Clear inline text formats (bold/italic/underline/strikethrough/code)
        // and any inline styles on the selected text nodes
        selection.getNodes().forEach((node) => {
          if ($isTextNode(node)) {
            node.setFormat(0);
            node.setStyle('');
          }
        });

        // Reset block-level formatting back to plain paragraphs
        $setBlocksType(selection, () => $createParagraphNode());
      } catch (error) {
        console.error('Error clearing formatting:', error);
      }
    });
  }, [editor]);

  // Helper to toggle blockquote formatting (quote <-> paragraph)
  const toggleQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      // Determine whether the selection is already inside a quote block
      const anchorNode = selection.anchor.getNode();
      const focusNode = selection.focus.getNode();
      const isAlreadyQuote =
        $isQuoteNode(anchorNode) ||
        $isQuoteNode(anchorNode.getParent()) ||
        $isQuoteNode(focusNode) ||
        $isQuoteNode(focusNode.getParent());

      try {
        if (isAlreadyQuote) {
          // Toggle back to a paragraph when already a quote
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      } catch (error) {
        console.error('Error applying blockquote:', error);
      }
    });
  }, [editor]);

  // Register keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (!mod && e.key !== 'Escape') return;

      // Basic formatting shortcuts.
      // NOTE: Ctrl/Cmd+B, +I, and +U are intentionally NOT handled here —
      // Lexical's RichTextPlugin already handles them natively. Dispatching
      // FORMAT_TEXT_COMMAND again from this document-level listener applied
      // the format a second time (a net no-op), a bug caught by the E2E suite.
      if (mod && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            // Open the same accessible dialog as the toolbar button
            // (replaces the old, far less accessible window.prompt)
            if (can('link')) {
              e.preventDefault();
              openLinkDialog();
            }
            break;
          case 'd':
            e.preventDefault();
            setShowDocs((prevState) => !prevState);
            break;
          case 'q':
            if (e.shiftKey && can('blockquote')) {
              // Ctrl/Cmd + Shift + Q toggles blockquote
              e.preventDefault();
              toggleQuote();
            }
            break;
          case '8':
            if (e.shiftKey && can('bulletList')) {
              // For * (Shift+8)
              e.preventDefault();
              editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            }
            break;
          case '7':
            if (e.shiftKey && can('numberedList')) {
              // For & (Shift+7)
              e.preventDefault();
              editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            }
            break;
          case 'e':
            // Ctrl/Cmd + E toggles inline code; + Shift toggles a code block
            if (e.shiftKey ? can('codeBlock') : can('code')) {
              e.preventDefault();
              if (e.shiftKey) {
                toggleCodeBlock();
              } else {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
              }
            }
            break;
          case 'x':
            if (e.shiftKey && can('strikethrough')) {
              // Ctrl/Cmd + Shift + X toggles strikethrough
              e.preventDefault();
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
            }
            break;
          case '\\':
            // Ctrl/Cmd + \ clears formatting (Google Docs convention)
            e.preventDefault();
            clearFormatting();
            break;
          case 'm':
            if (e.shiftKey && can('image')) {
              // Ctrl/Cmd + Shift + M opens the insert-image dialog
              e.preventDefault();
              setShowImageDialog(true);
            }
            break;
          case 'l':
            if (e.shiftKey && can('table')) {
              // Ctrl/Cmd + Shift + L opens the insert-table dialog
              e.preventDefault();
              setShowTableDialog(true);
            }
            break;
          case '-':
          case '_':
            // Ctrl/Cmd + Shift + - inserts a horizontal rule (Shift+- is '_'
            // on US layouts, so accept both keys)
            if (e.shiftKey && can('horizontalRule')) {
              e.preventDefault();
              editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
            }
            break;
          default:
            break;
        }
      }

      // Heading shortcuts with Ctrl/Cmd + Alt + [1-6]
      if (mod && e.altKey) {
        const tag = `h${e.key}`;
        if (HEADING_FORMATS.includes(tag) && can(tag)) {
          e.preventDefault();
          setHeading(tag);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    editor,
    can,
    setShowDocs,
    t,
    setHeading,
    openLinkDialog,
    toggleQuote,
    toggleCodeBlock,
    clearFormatting,
  ]);

  // Ctrl/Cmd+B, +I and +U are handled by Lexical's RichTextPlugin, not by the
  // listener above, so a disallowed inline format is stopped at the command
  // itself. Critical priority runs this before RichTextPlugin's own handler.
  useEffect(() => {
    return editor.registerCommand(
      FORMAT_TEXT_COMMAND,
      (format) => TEXT_FORMATS.includes(format) && !can(format),
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, can]);

  // Register Escape key to close link dialog
  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (showLinkDialog) {
          setShowLinkDialog(false);
          return true;
        }
        if (showImageDialog) {
          closeImageDialog();
          return true;
        }
        if (showTableDialog) {
          closeTableDialog();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [
    editor,
    showLinkDialog,
    showImageDialog,
    closeImageDialog,
    showTableDialog,
    closeTableDialog,
  ]);

  // Track undo/redo availability so the buttons can enable/disable
  useEffect(() => {
    const removeCanUndoListener = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false; // Don't block other handlers
      },
      COMMAND_PRIORITY_LOW,
    );

    const removeCanRedoListener = editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false; // Don't block other handlers
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      removeCanUndoListener();
      removeCanRedoListener();
    };
  }, [editor]);

  // Helper function to toggle list formats
  const toggleList = useCallback(
    (listType) => {
      try {
        if (listType === 'bullet' && isUnorderedListActive) {
          // Remove the list if it's already active
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        } else if (listType === 'number' && isOrderedListActive) {
          // Remove the list if it's already active
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        } else {
          // Apply the appropriate list type
          if (listType === 'bullet') {
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          } else if (listType === 'number') {
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          }
        }
      } catch (error) {
        console.error('Error toggling list:', error);
      }
    },
    [editor, isOrderedListActive, isUnorderedListActive],
  );

  // Update active formats when selection changes
  useEffect(() => {
    const updateToolbar = () => {
      try {
        const editorState = editor.getEditorState();

        editorState.read(() => {
          try {
            const selection = $getSelection();

            // Reset all format states when there's no valid selection
            if (!selection || !$isRangeSelection(selection)) {
              setActiveHeadingTag(null);
              setIsOrderedListActive(false);
              setIsUnorderedListActive(false);
              setIsBold(false);
              setIsItalic(false);
              setIsUnderline(false);
              setIsStrikethrough(false);
              setIsLinkActive(false);
              setIsInlineCode(false);
              setIsCodeBlockActive(false);
              setIsQuoteActive(false);
              return;
            }

            // Check for text formatting (bold, italic, etc.)
            try {
              // Reflect the format that applies at the current selection. This
              // includes a collapsed caret: Lexical's hasFormat() returns the
              // format that newly typed text would take, so the buttons light up
              // when the cursor simply sits inside formatted text — matching the
              // behavior users expect from other rich-text editors.
              setIsBold(selection.hasFormat('bold'));
              setIsItalic(selection.hasFormat('italic'));
              setIsUnderline(selection.hasFormat('underline'));
              setIsStrikethrough(selection.hasFormat('strikethrough'));
              setIsInlineCode(selection.hasFormat('code'));
            } catch (_error) {
              // Reset formatting state on error
              setIsBold(false);
              setIsItalic(false);
              setIsUnderline(false);
              setIsStrikethrough(false);
              setIsInlineCode(false);
            }

            // Check for headings, lists, etc.
            let headingTag = null;
            let orderedListActive = false;
            let unorderedListActive = false;
            let linkActive = false;
            let codeBlockActive = false;
            let quoteActive = false;

            try {
              // Get the anchor node safely
              const anchorNode = selection.anchor.getNode();
              if (!anchorNode) return;

              // Helper to check for headings
              const findHeadingTag = (node) => {
                if (!node) return null;

                // Check if node is a heading
                if ($isHeadingNode(node)) {
                  return node.getTag();
                }

                // Check parent
                try {
                  const parent = node.getParent();
                  if (parent && $isHeadingNode(parent)) {
                    return parent.getTag();
                  }
                } catch (_e) {
                  // Ignore errors when getting parent
                }

                return null;
              };

              // Find headings
              headingTag = findHeadingTag(anchorNode);

              // Detect whether the cursor/selection is inside a link
              linkActive = findLinkNode(anchorNode) !== null;
              // Detect whether the selection is inside a code block. Check both
              // anchor and focus so the active state matches toggleCodeBlock's logic.
              const focusNode = selection.focus.getNode();
              codeBlockActive =
                $isCodeNode(anchorNode) ||
                $isCodeNode(anchorNode.getParent()) ||
                $isCodeNode(focusNode) ||
                $isCodeNode(focusNode.getParent());
              // Detect whether the selection is inside a quote block. Check both
              // anchor and focus so the active state matches toggleQuote's logic.
              quoteActive =
                $isQuoteNode(anchorNode) ||
                $isQuoteNode(anchorNode.getParent()) ||
                $isQuoteNode(focusNode) ||
                $isQuoteNode(focusNode.getParent());

              // Helper to safely get parent
              const getParentSafely = (node) => {
                if (!node) return null;
                try {
                  return node.getParent();
                } catch (_e) {
                  return null;
                }
              };

              // Check for lists by traversing up the tree
              let current = anchorNode;
              let depth = 0;
              while (current && depth < 10) {
                if ($isListItemNode(current)) {
                  // Found a list item, find its parent list
                  let listParent = getParentSafely(current);
                  while (listParent && !$isListNode(listParent)) {
                    listParent = getParentSafely(listParent);
                  }

                  if (listParent && $isListNode(listParent)) {
                    try {
                      const listType = listParent.getListType();
                      if (listType === 'bullet') {
                        unorderedListActive = true;
                      } else if (listType === 'number') {
                        orderedListActive = true;
                      }
                    } catch (_e) {
                      // Ignore list type errors
                    }
                  }
                  break;
                }

                current = getParentSafely(current);
                depth++;
              }
            } catch (_e) {
              // Silently fail node traversal
            }

            // Update state with active formats
            setActiveHeadingTag(headingTag);
            setIsOrderedListActive(orderedListActive);
            setIsUnorderedListActive(unorderedListActive);
            setIsLinkActive(linkActive);
            setIsCodeBlockActive(codeBlockActive);
            setIsQuoteActive(quoteActive);
          } catch (_e) {
            // Reset all states if there's an error
            setActiveHeadingTag(null);
            setIsOrderedListActive(false);
            setIsUnorderedListActive(false);
            setIsBold(false);
            setIsItalic(false);
            setIsUnderline(false);
            setIsStrikethrough(false);
            setIsLinkActive(false);
            setIsInlineCode(false);
            setIsCodeBlockActive(false);
            setIsQuoteActive(false);
          }
        });
      } catch (_error) {
        // Silently fail the entire update
      }
    };

    // Run on mount and register a listener
    updateToolbar();

    // Set up two listeners - one for editor changes and one for selection changes
    const removeUpdateListener = editor.registerUpdateListener(() => {
      // Just call updateToolbar - it has its own error handling
      updateToolbar();
    });

    // Also register for selection changes
    const removeSelectionListener = editor.registerCommand(
      'selection-change',
      () => {
        updateToolbar();
        return false; // Don't block other handlers
      },
      COMMAND_PRIORITY_HIGH,
    );

    // Clean up both listeners
    return () => {
      removeUpdateListener();
      removeSelectionListener();
    };
  }, [editor]);

  // Focus URL input when dialog opens
  useEffect(() => {
    if (!showLinkDialog) return undefined;

    // Slight delay to ensure the dialog is fully rendered; guard the ref in
    // case the dialog was closed before the timeout fires
    const timeoutId = setTimeout(() => {
      if (urlInputRef.current) {
        urlInputRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [showLinkDialog]);

  // Focus image URL input when the image dialog opens
  useEffect(() => {
    if (!showImageDialog) return undefined;
    const timeoutId = setTimeout(() => {
      // Don't steal focus if the user has already moved into a dialog field.
      if (imageUrlInputRef.current && document.activeElement?.tagName !== 'INPUT') {
        imageUrlInputRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [showImageDialog]);

  // Focus the rows input when the table dialog opens
  useEffect(() => {
    if (!showTableDialog) return undefined;
    const timeoutId = setTimeout(() => {
      if (tableRowsInputRef.current && document.activeElement?.tagName !== 'INPUT') {
        tableRowsInputRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [showTableDialog]);

  return (
    <div
      ref={toolbarRef}
      className="editor-toolbar"
      role="toolbar"
      aria-label={t('editorToolbar')}
      aria-orientation="horizontal"
      onKeyDown={handleToolbarKeyDown}
      onFocus={handleToolbarFocus}
    >
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => {
            // aria-disabled keeps the button focusable/announced; no-op when unavailable.
            if (canUndo) editor.dispatchCommand(UNDO_COMMAND, undefined);
          }}
          aria-label={t('undo')}
          {...getTriggerProps('undo', `${t('undo')} (${modKey}+Z)`)}
          className="undo-button"
          aria-disabled={!canUndo}
        >
          <svg
            className="icon-undo"
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 14L4 9L9 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 9H15C17.7614 9 20 11.2386 20 14C20 16.7614 17.7614 19 15 19H8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            if (canRedo) editor.dispatchCommand(REDO_COMMAND, undefined);
          }}
          aria-label={t('redo')}
          {...getTriggerProps('redo', `${t('redo')} (${modKey}+Y)`)}
          className="redo-button"
          aria-disabled={!canRedo}
        >
          <svg
            className="icon-redo"
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 14L20 9L15 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 9H9C6.23858 9 4 11.2386 4 14C4 16.7614 6.23858 19 9 19H16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="toolbar-group">
        {can('bold') ? (
          <button
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
            aria-label={t('bold')}
            {...getTriggerProps('bold', `${t('bold')} (${modKey}+B)`)}
            className={isBold ? 'active' : ''}
            aria-pressed={isBold}
          >
            <svg
              className="icon-bold"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 12H14C16.2091 12 18 10.2091 18 8C18 5.79086 16.2091 4 14 4H6V12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 12H15C17.2091 12 19 13.7909 19 16C19 18.2091 17.2091 20 15 20H6V12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {can('italic') ? (
          <button
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
            aria-label={t('italic')}
            {...getTriggerProps('italic', `${t('italic')} (${modKey}+I)`)}
            className={isItalic ? 'active' : ''}
            aria-pressed={isItalic}
          >
            <svg
              className="icon-italic"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 4H10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 20H5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14.5 4L9.5 20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {can('underline') ? (
          <button
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
            aria-label={t('underline')}
            {...getTriggerProps('underline', `${t('underline')} (${modKey}+U)`)}
            className={isUnderline ? 'active' : ''}
            aria-pressed={isUnderline}
          >
            <svg
              className="icon-underline"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 3V10C6 13.3137 8.68629 16 12 16C15.3137 16 18 13.3137 18 10V3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 21H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {can('strikethrough') ? (
          <button
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
            aria-label={t('strikethrough')}
            {...getTriggerProps('strikethrough', `${t('strikethrough')} (${modKey}+Shift+X)`)}
            className={isStrikethrough ? 'active' : ''}
            aria-pressed={isStrikethrough}
          >
            <svg
              className="icon-strikethrough"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 12H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 6C16 6 14.5 4 12 4C9.5 4 8 5.5 8 7.5C8 9.5 9 10 12 11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 13C15.5 14 16 15 16 17C16 19.5 13.5 20.5 12 20.5C10 20.5 8 19 8 19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {can('code') ? (
          <button
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
            aria-label={t('inlineCode')}
            {...getTriggerProps('inlineCode', `${t('inlineCode')} (${modKey}+E)`)}
            className={isInlineCode ? 'active' : ''}
            aria-pressed={isInlineCode}
          >
            <svg
              className="icon-inline-code"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 6L2 12L8 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 6L22 12L16 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {can('codeBlock') ? (
          <button
            onClick={toggleCodeBlock}
            aria-label={t('codeBlock')}
            {...getTriggerProps('codeBlock', `${t('codeBlock')} (${modKey}+Shift+E)`)}
            className={`code-block-button ${isCodeBlockActive ? 'active' : ''}`}
            aria-pressed={isCodeBlockActive}
          >
            <svg
              className="icon-code-block"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M9 10L7 12L9 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 10L17 12L15 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <button
          onClick={clearFormatting}
          aria-label={t('clearFormatting')}
          {...getTriggerProps('clearFormatting', `${t('clearFormatting')} (${modKey}+\\)`)}
          className="clear-formatting-button"
        >
          <svg
            className="icon-clear-formatting"
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 4H20M11 4L7 20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 13L21 19M21 13L15 19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {HEADING_FORMATS.some(can) ? (
        <div className="toolbar-group">
          {can('h1') ? (
            <button
              onClick={() => setHeading('h1')}
              aria-label={t('heading1')}
              {...getTriggerProps('heading1', `${t('heading1')} (${modKey}+Alt+1)`)}
              className={`heading-button ${activeHeadingTag === 'h1' ? 'active' : ''}`}
              aria-pressed={activeHeadingTag === 'h1' ? true : false}
            >
              H1
            </button>
          ) : null}
          {can('h2') ? (
            <button
              onClick={() => setHeading('h2')}
              aria-label={t('heading2')}
              {...getTriggerProps('heading2', `${t('heading2')} (${modKey}+Alt+2)`)}
              className={`heading-button ${activeHeadingTag === 'h2' ? 'active' : ''}`}
              aria-pressed={activeHeadingTag === 'h2' ? true : false}
            >
              H2
            </button>
          ) : null}
          {can('h3') ? (
            <button
              onClick={() => setHeading('h3')}
              aria-label={t('heading3')}
              {...getTriggerProps('heading3', `${t('heading3')} (${modKey}+Alt+3)`)}
              className={`heading-button ${activeHeadingTag === 'h3' ? 'active' : ''}`}
              aria-pressed={activeHeadingTag === 'h3' ? true : false}
            >
              H3
            </button>
          ) : null}
          {can('h4') ? (
            <button
              onClick={() => setHeading('h4')}
              aria-label={t('heading4')}
              {...getTriggerProps('heading4', `${t('heading4')} (${modKey}+Alt+4)`)}
              className={`heading-button ${activeHeadingTag === 'h4' ? 'active' : ''}`}
              aria-pressed={activeHeadingTag === 'h4' ? true : false}
            >
              H4
            </button>
          ) : null}
          {can('h5') ? (
            <button
              onClick={() => setHeading('h5')}
              aria-label={t('heading5')}
              {...getTriggerProps('heading5', `${t('heading5')} (${modKey}+Alt+5)`)}
              className={`heading-button ${activeHeadingTag === 'h5' ? 'active' : ''}`}
              aria-pressed={activeHeadingTag === 'h5' ? true : false}
            >
              H5
            </button>
          ) : null}
          {can('h6') ? (
            <button
              onClick={() => setHeading('h6')}
              aria-label={t('heading6')}
              {...getTriggerProps('heading6', `${t('heading6')} (${modKey}+Alt+6)`)}
              className={`heading-button ${activeHeadingTag === 'h6' ? 'active' : ''}`}
              aria-pressed={activeHeadingTag === 'h6' ? true : false}
            >
              H6
            </button>
          ) : null}
        </div>
      ) : null}

      {can('blockquote') ? (
        <div className="toolbar-group">
          <button
            onClick={toggleQuote}
            aria-label={t('blockquote')}
            {...getTriggerProps('blockquote', `${t('blockquote')} (${modKey}+Shift+Q)`)}
            className={`quote-button ${isQuoteActive ? 'active' : ''}`}
            aria-pressed={isQuoteActive}
          >
            <svg
              className="icon-quote"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 7H10V12C10 14 9 16 6 17M14 7H17V12C17 14 16 16 13 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : null}

      {can('link') || can('image') || can('table') ? (
        <div className="toolbar-group">
          {can('link') ? (
            <button
              className={`link-button ${isLinkActive ? 'active' : ''}`}
              onClick={openLinkDialog}
              aria-label={isLinkActive ? t('editLink') : t('insertLink')}
              {...getTriggerProps(
                'link',
                `${isLinkActive ? t('editLink') : t('insertLink')} (${modKey}+K)`,
              )}
              aria-pressed={isLinkActive ? true : false}
            >
              <svg
                className="icon-link"
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 17H7C4.24 17 2 14.76 2 12C2 9.24 4.24 7 7 7H9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M15 17H17C19.76 17 22 14.76 22 12C22 9.24 19.76 7 17 7H15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path d="M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
          {can('image') ? (
            <button
              className="image-button"
              onClick={() => setShowImageDialog(true)}
              aria-label={t('insertImage')}
              {...getTriggerProps('insertImage', `${t('insertImage')} (${modKey}+Shift+M)`)}
            >
              <svg
                className="icon-image"
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
                <path
                  d="M21 15L16 10L5 20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          {can('table') ? (
            <button
              className="table-button"
              onClick={() => setShowTableDialog(true)}
              aria-label={t('insertTable')}
              {...getTriggerProps('insertTable', `${t('insertTable')} (${modKey}+Shift+L)`)}
            >
              <svg
                className="icon-table"
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M3 10H21" stroke="currentColor" strokeWidth="2" />
                <path d="M9 10V20" stroke="currentColor" strokeWidth="2" />
                <path d="M15 10V20" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}

      {can('bulletList') || can('numberedList') ? (
        <div className="toolbar-group">
          {can('bulletList') ? (
            <button
              onClick={() => toggleList('bullet')}
              aria-label={t('bulletList')}
              {...getTriggerProps('bulletList', `${t('bulletList')} (${modKey}+Shift+8)`)}
              className={isUnorderedListActive ? 'active' : ''}
              aria-pressed={isUnorderedListActive ? true : false}
            >
              <svg
                className="icon-list-ul"
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="4" cy="6" r="2" fill="currentColor" />
                <line
                  x1="9"
                  y1="6"
                  x2="20"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="4" cy="12" r="2" fill="currentColor" />
                <line
                  x1="9"
                  y1="12"
                  x2="20"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="4" cy="18" r="2" fill="currentColor" />
                <line
                  x1="9"
                  y1="18"
                  x2="20"
                  y2="18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
          {can('numberedList') ? (
            <button
              onClick={() => toggleList('number')}
              aria-label={t('numberedList')}
              {...getTriggerProps('numberedList', `${t('numberedList')} (${modKey}+Shift+7)`)}
              className={isOrderedListActive ? 'active' : ''}
              aria-pressed={isOrderedListActive ? true : false}
            >
              <svg
                className="icon-list-ol"
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M3 6H4V7H3V6Z" fill="currentColor" />
                <path
                  d="M3 10V9H5V6H3V5H5V4H4V3H3V4H2V6H3V7H2V9H3V10H2V12H5V10H3Z"
                  fill="currentColor"
                />
                <path d="M3 18H4V15H2V16H3V18Z" fill="currentColor" />
                <line
                  x1="9"
                  y1="6"
                  x2="20"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="9"
                  y1="12"
                  x2="20"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="9"
                  y1="18"
                  x2="20"
                  y2="18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}

      {can('horizontalRule') ? (
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)}
            aria-label={t('insertHorizontalRule')}
            {...getTriggerProps(
              'insertHorizontalRule',
              `${t('insertHorizontalRule')} (${modKey}+Shift+-)`,
            )}
            className="horizontal-rule-button"
          >
            <svg
              className="icon-horizontal-rule"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}

      <div className="toolbar-group toolbar-right">
        <button
          onClick={() => setShowDocs((prevState) => !prevState)}
          aria-label={t('showHelp')}
          {...getTriggerProps('showHelp', `${t('showHelp')} (${modKey}+D)`)}
          aria-pressed={showDocs}
          className={`docs-button ${showDocs ? 'active' : ''}`}
        >
          <svg
            className="icon-help"
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 18V18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M12 15C12 11 16 11 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {showLinkDialog ? (
        <div
          className="link-dialog-overlay"
          onClick={(e) => {
            // Close only on a genuine backdrop click, not on clicks that
            // bubble up from the dialog contents (e.g. focusing the URL field).
            if (e.target === e.currentTarget) {
              setShowLinkDialog(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowLinkDialog(false);
            }
          }}
          role="presentation"
        >
          <div
            ref={dialogRef}
            className="link-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-dialog-title"
            tabIndex={-1}
          >
            <h2 id="link-dialog-title" className="link-dialog-title">
              {isLinkActive ? t('editLink') : t('insertLink')}
            </h2>
            <div className="link-dialog-form">
              <div className="form-group">
                <label htmlFor="link-url">{t('url')}:</label>
                <input
                  ref={urlInputRef}
                  type="text"
                  id="link-url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  aria-required="true"
                  aria-invalid={linkUrl.trim() !== '' && !isSafeUrl(linkUrl)}
                  aria-describedby={
                    linkUrl.trim() !== '' && !isSafeUrl(linkUrl) ? 'link-url-error' : undefined
                  }
                />
                {linkUrl.trim() !== '' && !isSafeUrl(linkUrl) ? (
                  <p id="link-url-error" className="link-dialog-error" role="alert">
                    {t('linkUrlInvalid')}
                  </p>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="link-text">{t('text')}:</label>
                <input
                  type="text"
                  id="link-text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder={t('linkText')}
                />
              </div>

              <div className="link-dialog-buttons">
                {isLinkActive ? (
                  <button type="button" className="remove-link-button" onClick={removeLink}>
                    {t('removeLink')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowLinkDialog(false);
                    // Return focus to the editor when the dialog closes
                    editor.focus();
                    setTimeout(() => {
                      setLinkUrl('');
                      setLinkText('');
                    }, 50);
                  }}
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className="insert-button"
                  onClick={() => {
                    // Reject unsafe URLs (javascript:, data:, …) before they can
                    // ever reach a LinkNode and be written to the live DOM href.
                    if (isSafeUrl(linkUrl)) {
                      const safeUrl = sanitizeUrl(linkUrl);
                      // Close dialog first to prevent editor focus issues
                      setShowLinkDialog(false);

                      // Small delay to ensure the dialog is fully closed
                      setTimeout(() => {
                        editor.focus();
                        editor.update(() => {
                          // Restore the selection captured when the dialog opened;
                          // re-focusing the editor collapses the live one.
                          const saved = savedLinkSelectionRef.current;
                          if (saved) {
                            try {
                              const restored = $createRangeSelection();
                              restored.anchor.set(
                                saved.anchorKey,
                                saved.anchorOffset,
                                saved.anchorType,
                              );
                              restored.focus.set(
                                saved.focusKey,
                                saved.focusOffset,
                                saved.focusType,
                              );
                              $setSelection(restored);
                            } catch {
                              // Stale node keys — fall back to the live selection
                            }
                          }
                          const selection = $getSelection();
                          if ($isRangeSelection(selection)) {
                            const existingLink = findLinkNode(selection.anchor.getNode());
                            if (existingLink) {
                              // Editing in place: select the existing link's contents so
                              // TOGGLE_LINK updates its URL rather than duplicating text.
                              existingLink.select(0, existingLink.getChildrenSize());
                              editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
                                url: safeUrl,
                                target: '_blank',
                              });
                            } else if (linkText && selection.isCollapsed()) {
                              // If there's link text but no selection, insert the text with the link
                              selection.insertText(linkText);
                              // Need to get selection again after text insertion
                              const updatedSelection = $getSelection();
                              if ($isRangeSelection(updatedSelection)) {
                                updatedSelection.modify('backward', linkText.length, 'character');
                                editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
                                  url: safeUrl,
                                  target: '_blank',
                                });
                              }
                            } else {
                              // Apply link to the current selection
                              editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
                                url: safeUrl,
                                target: '_blank',
                              });
                            }
                          }
                        });
                        savedLinkSelectionRef.current = null;
                        setLinkUrl('');
                        setLinkText('');
                      }, 50);
                    } else {
                      setShowLinkDialog(false);
                      setLinkUrl('');
                      setLinkText('');
                    }
                  }}
                  disabled={!isSafeUrl(linkUrl)}
                >
                  {t('insert')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showImageDialog ? (
        <div
          className="link-dialog-overlay"
          onClick={(e) => {
            // Only close when the backdrop itself is clicked
            if (e.target === e.currentTarget) {
              closeImageDialog();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeImageDialog();
            }
          }}
          role="presentation"
        >
          <div
            className="link-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-dialog-title"
            tabIndex={-1}
          >
            <h3 id="image-dialog-title">{t('insertImage')}</h3>
            <div className="link-dialog-form">
              {canUploadImage ? (
                <div className="form-group">
                  <div
                    className={`image-dropzone ${isDraggingImage ? 'dragover' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(true);
                    }}
                    onDragLeave={() => setIsDraggingImage(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(false);
                      handleImageFile(e.dataTransfer.files && e.dataTransfer.files[0]);
                    }}
                    role="presentation"
                  >
                    <p className="image-dropzone-hint">{t('imageDropHint')}</p>
                    <button
                      type="button"
                      className="upload-button"
                      onClick={() => imageFileInputRef.current && imageFileInputRef.current.click()}
                    >
                      {t('chooseImageFile')}
                    </button>
                    {/* Hidden native input; the button above is the accessible
                        control, so keep the input out of the tab order. */}
                    <input
                      ref={imageFileInputRef}
                      type="file"
                      accept="image/*"
                      className="visually-hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={(e) => {
                        handleImageFile(e.target.files && e.target.files[0]);
                        // Allow re-selecting the same file later
                        e.target.value = '';
                      }}
                    />
                  </div>
                  <p
                    className={`upload-status ${
                      uploadStatus === 'error' ? 'upload-status-error' : ''
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {uploadMessage}
                  </p>
                </div>
              ) : null}
              <div className="form-group">
                <label htmlFor="image-url">
                  {canUploadImage ? t('orPasteUrl') : `${t('url')}:`}
                </label>
                <input
                  ref={imageUrlInputRef}
                  type="text"
                  id="image-url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.png"
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="image-alt">{t('altText')}:</label>
                <input
                  type="text"
                  id="image-alt"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder={t('enterAltText')}
                  disabled={imageDecorative}
                  aria-required={!imageDecorative}
                  aria-describedby="image-alt-hint"
                />
                <p id="image-alt-hint" className="form-hint">
                  {t('altTextHint')}
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="image-decorative">
                  <input
                    type="checkbox"
                    id="image-decorative"
                    checked={imageDecorative}
                    onChange={(e) => setImageDecorative(e.target.checked)}
                  />{' '}
                  {t('decorativeImage')}
                </label>
              </div>

              <div className="link-dialog-buttons">
                <button type="button" className="cancel-button" onClick={closeImageDialog}>
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className="insert-button"
                  onClick={insertImage}
                  disabled={!canInsertImage}
                >
                  {t('insert')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showTableDialog ? (
        <div
          className="link-dialog-overlay"
          onClick={(e) => {
            // Only close when the backdrop itself is clicked
            if (e.target === e.currentTarget) {
              closeTableDialog();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeTableDialog();
            }
          }}
          role="presentation"
        >
          <div
            className="link-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-dialog-title"
            tabIndex={-1}
          >
            <h3 id="table-dialog-title">{t('insertTable')}</h3>
            <div className="link-dialog-form">
              <div className="form-group">
                <label htmlFor="table-rows">{t('tableRows')}:</label>
                <input
                  ref={tableRowsInputRef}
                  type="number"
                  id="table-rows"
                  min="1"
                  max="20"
                  value={tableRows}
                  onChange={(e) => setTableRows(e.target.value)}
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="table-columns">{t('tableColumns')}:</label>
                <input
                  type="number"
                  id="table-columns"
                  min="1"
                  max="20"
                  value={tableColumns}
                  onChange={(e) => setTableColumns(e.target.value)}
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="table-headers">
                  <input
                    type="checkbox"
                    id="table-headers"
                    checked={tableHeaders}
                    onChange={(e) => setTableHeaders(e.target.checked)}
                  />{' '}
                  {t('includeHeaderRow')}
                </label>
              </div>

              <div className="link-dialog-buttons">
                <button type="button" className="cancel-button" onClick={closeTableDialog}>
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className="insert-button"
                  onClick={insertTable}
                  disabled={!canInsertTable}
                >
                  {t('insert')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {tooltip}
    </div>
  );
}

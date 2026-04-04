import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

/**
 * Custom CodeMirror theme built from the Autocode design tokens.
 *
 * Background #101010 (editor canvas), gutter/line-number colors follow the
 * text-faint → text-muted hierarchy, selection and search use the
 * accent teal, and the cursor is the accent color.
 */

const editorChrome = EditorView.theme(
  {
    '&': {
      backgroundColor: '#101010',
      color: '#e4e4e7'
    },
    '.cm-content': {
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      caretColor: '#2dd4a8',
      lineHeight: '1.6'
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#2dd4a8',
      borderLeftWidth: '1.5px'
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(45, 212, 168, 0.15) !important'
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.025)'
    },
    '.cm-gutters': {
      backgroundColor: '#101010',
      color: '#52525b',
      border: 'none'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.025)',
      color: '#71717a'
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 16px'
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      border: 'none',
      color: '#71717a'
    },
    '.cm-tooltip': {
      backgroundColor: '#171a1f',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      color: '#e4e4e7',
      borderRadius: '8px'
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: 'rgba(45, 212, 168, 0.10)',
        color: '#e4e4e7'
      }
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(45, 212, 168, 0.20)',
      outline: '1px solid rgba(45, 212, 168, 0.30)',
      borderRadius: '2px'
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(45, 212, 168, 0.30)'
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      outline: 'none'
    },
    '.cm-panels': {
      backgroundColor: '#111316',
      color: '#e4e4e7'
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid rgba(255, 255, 255, 0.06)'
    },
    '.cm-panel.cm-search label': {
      color: '#a1a1aa'
    },
    '.cm-textfield': {
      backgroundColor: '#171a1f',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      color: '#e4e4e7',
      borderRadius: '4px'
    },
    '.cm-button': {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      color: '#e4e4e7',
      borderRadius: '4px'
    }
  },
  { dark: true }
);

const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#c084fc' },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: '#e4e4e7' },
  { tag: [t.function(t.variableName), t.labelName], color: '#7dd3fc' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#fbbf24' },
  { tag: [t.definition(t.name), t.separator], color: '#e4e4e7' },
  {
    tag: [t.typeName, t.className, t.changed, t.annotation, t.modifier, t.self, t.namespace],
    color: '#67e8f9'
  },
  { tag: t.number, color: '#fbbf24' },
  { tag: [t.operator, t.operatorKeyword], color: '#a1a1aa' },
  { tag: [t.url, t.escape, t.regexp, t.link], color: '#f87171' },
  { tag: t.special(t.string), color: '#5eead4' },
  { tag: [t.meta, t.comment], color: '#636b7d', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#7dd3fc', textDecoration: 'underline' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#fbbf24' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#5eead4' },
  { tag: t.invalid, color: '#f87171' },
  { tag: t.propertyName, color: '#d4d4d8' },
  { tag: t.definition(t.propertyName), color: '#d4d4d8' },
  { tag: t.tagName, color: '#f472b6' },
  { tag: t.attributeName, color: '#fb923c' },
  { tag: t.variableName, color: '#e4e4e7' },
  { tag: t.definition(t.variableName), color: '#93c5fd' }
]);

export const autocodeEditorTheme: Extension = [editorChrome, syntaxHighlighting(highlightStyle)];

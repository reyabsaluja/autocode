import type { Extension } from '@codemirror/state';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';

export function inferLanguageSupport(relativePath: string): Extension[] {
  const extension = relativePath.split('.').pop()?.toLowerCase();

  if (!extension) {
    return [];
  }

  switch (extension) {
    case 'js':
    case 'jsx':
      return [javascript({ jsx: extension === 'jsx' })];
    case 'ts':
    case 'tsx':
      return [javascript({ jsx: extension === 'tsx', typescript: true })];
    case 'json':
      return [json()];
    case 'html':
      return [html()];
    case 'css':
    case 'scss':
    case 'less':
      return [css()];
    case 'md':
    case 'mdx':
      return [markdown()];
    case 'py':
      return [python()];
    case 'rs':
      return [rust()];
    case 'go':
      return [go()];
    case 'java':
      return [java()];
    case 'php':
      return [php()];
    case 'sql':
      return [sql()];
    case 'xml':
    case 'svg':
      return [xml()];
    case 'yaml':
    case 'yml':
      return [yaml()];
    default:
      return [];
  }
}

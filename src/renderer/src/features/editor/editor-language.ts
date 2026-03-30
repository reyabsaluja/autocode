import { useEffect, useState } from 'react';

import type { Extension } from '@codemirror/state';

type LanguageLoader = () => Promise<Extension[]>;

const languageLoaderCache = new Map<string, Promise<Extension[]>>();

const languageLoaders: Record<string, LanguageLoader> = {
  css: async () => [(await import('@codemirror/lang-css')).css()],
  go: async () => [(await import('@codemirror/lang-go')).go()],
  html: async () => [(await import('@codemirror/lang-html')).html()],
  java: async () => [(await import('@codemirror/lang-java')).java()],
  js: async () => [(await import('@codemirror/lang-javascript')).javascript()],
  jsx: async () => [(await import('@codemirror/lang-javascript')).javascript({ jsx: true })],
  json: async () => [(await import('@codemirror/lang-json')).json()],
  less: async () => [(await import('@codemirror/lang-css')).css()],
  md: async () => [(await import('@codemirror/lang-markdown')).markdown()],
  mdx: async () => [(await import('@codemirror/lang-markdown')).markdown()],
  php: async () => [(await import('@codemirror/lang-php')).php()],
  py: async () => [(await import('@codemirror/lang-python')).python()],
  rs: async () => [(await import('@codemirror/lang-rust')).rust()],
  scss: async () => [(await import('@codemirror/lang-css')).css()],
  sql: async () => [(await import('@codemirror/lang-sql')).sql()],
  svg: async () => [(await import('@codemirror/lang-xml')).xml()],
  ts: async () => [(await import('@codemirror/lang-javascript')).javascript({ typescript: true })],
  tsx: async () => [(await import('@codemirror/lang-javascript')).javascript({ jsx: true, typescript: true })],
  xml: async () => [(await import('@codemirror/lang-xml')).xml()],
  yaml: async () => [(await import('@codemirror/lang-yaml')).yaml()],
  yml: async () => [(await import('@codemirror/lang-yaml')).yaml()]
};

export function useWorkspaceLanguageSupport(relativePath: string | null) {
  const languageKey = getLanguageKey(relativePath);
  const [extensions, setExtensions] = useState<Extension[]>([]);

  useEffect(() => {
    let isCancelled = false;

    if (!languageKey) {
      setExtensions([]);
      return;
    }

    // Load language packages on demand so the editor bundle stays focused on the
    // active file type instead of eagerly shipping every supported language.
    loadLanguageSupport(languageKey)
      .then((nextExtensions) => {
        if (!isCancelled) {
          setExtensions(nextExtensions);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setExtensions([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [languageKey]);

  return extensions;
}

function getLanguageKey(relativePath: string | null): string | null {
  const extension = relativePath?.split('.').pop()?.toLowerCase();

  if (!extension || !(extension in languageLoaders)) {
    return null;
  }

  return extension;
}

function loadLanguageSupport(languageKey: string): Promise<Extension[]> {
  const cached = languageLoaderCache.get(languageKey);

  if (cached) {
    return cached;
  }

  const loader = languageLoaders[languageKey];
  if (!loader) {
    return Promise.resolve([]);
  }

  const pendingLoad = loader()
    .then((extensions) => extensions)
    .catch((error) => {
      languageLoaderCache.delete(languageKey);
      throw error;
    });

  languageLoaderCache.set(languageKey, pendingLoad);
  return pendingLoad;
}

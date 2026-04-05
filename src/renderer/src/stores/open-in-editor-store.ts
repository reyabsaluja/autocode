import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ExternalEditor } from '../lib/editor-icon-assets';

interface OpenInEditorState {
  preferredEditor: ExternalEditor;
  setPreferredEditor: (editor: ExternalEditor) => void;
}

export const useOpenInEditorStore = create<OpenInEditorState>()(
  persist(
    (set) => ({
      preferredEditor: 'finder',
      setPreferredEditor: (editor) => set({ preferredEditor: editor })
    }),
    {
      name: 'autocode-open-in-editor'
    }
  )
);

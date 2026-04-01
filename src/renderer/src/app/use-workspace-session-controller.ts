import { useCallback, useEffect, type RefObject } from 'react';

import type { Project } from '@shared/domain/project';

import type { WorkspaceEditorHandle } from '../features/editor/workspace-editor-surface';
import { useUnsavedChangesGuard } from '../features/editor/use-unsaved-changes-guard';
import { useCreateTaskWorkspaceMutation, useTaskWorkspacesQuery } from '../features/tasks/task-hooks';
import { useWorkspaceStore } from '../stores/workspace-store';

interface UseWorkspaceSessionControllerInput {
  editorRef: RefObject<WorkspaceEditorHandle | null>;
  projects: Project[];
}

export function useWorkspaceSessionController({
  editorRef,
  projects
}: UseWorkspaceSessionControllerInput) {
  const selectedTaskId = useWorkspaceStore((state) => state.selectedTaskId);
  const selectedProjectId = useWorkspaceStore((state) => state.selectedProjectId);
  const selectProject = useWorkspaceStore((state) => state.selectProject);
  const selectTask = useWorkspaceStore((state) => state.selectTask);
  const { dialogProps, requestTransition } = useUnsavedChangesGuard(editorRef);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const effectiveProjectId = selectedProject?.id ?? null;
  const taskWorkspacesQuery = useTaskWorkspacesQuery(effectiveProjectId);
  const createTaskMutation = useCreateTaskWorkspaceMutation(effectiveProjectId);
  const taskWorkspaces = taskWorkspacesQuery.data ?? [];
  const selectedTaskWorkspace =
    taskWorkspaces.find((workspace) => workspace.task.id === selectedTaskId) ?? null;

  const requestProjectSelection = useCallback(
    (projectId: number | null) => {
      if (projectId === selectedProjectId) {
        return;
      }

      requestTransition({
        body: createContextSwitchBody(editorRef),
        key: `project:${projectId ?? 'none'}`,
        run: () => {
          selectProject(projectId);
        }
      });
    },
    [editorRef, requestTransition, selectProject, selectedProjectId]
  );

  const requestTaskSelection = useCallback(
    (taskId: number | null) => {
      if (taskId === selectedTaskId) {
        return;
      }

      requestTransition({
        body: createContextSwitchBody(editorRef),
        key: `task:${taskId ?? 'none'}`,
        run: () => {
          selectTask(taskId);
        }
      });
    },
    [editorRef, requestTransition, selectTask, selectedTaskId]
  );

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId !== null) {
        requestProjectSelection(null);
        return;
      }

      if (selectedTaskId !== null) {
        requestTaskSelection(null);
      }

      return;
    }

    const selectedStillExists = projects.some((project) => project.id === selectedProjectId);

    if (!selectedStillExists) {
      requestProjectSelection(projects[0]?.id ?? null);
    }
  }, [
    projects,
    requestProjectSelection,
    requestTaskSelection,
    selectedProjectId,
    selectedTaskId
  ]);

  useEffect(() => {
    createTaskMutation.reset();
  }, [createTaskMutation, effectiveProjectId]);

  useEffect(() => {
    if (selectedProjectId !== null && effectiveProjectId === null) {
      return;
    }

    if (effectiveProjectId === null) {
      if (selectedTaskId !== null) {
        requestTaskSelection(null);
      }

      return;
    }

    if (taskWorkspacesQuery.isLoading) {
      return;
    }

    if (taskWorkspaces.length === 0) {
      if (selectedTaskId !== null) {
        requestTaskSelection(null);
      }

      return;
    }

    const selectedStillExists = taskWorkspaces.some((workspace) => workspace.task.id === selectedTaskId);

    if (!selectedStillExists) {
      requestTaskSelection(taskWorkspaces[0]?.task.id ?? null);
    }
  }, [
    effectiveProjectId,
    requestTaskSelection,
    selectedProjectId,
    selectedTaskId,
    taskWorkspaces,
    taskWorkspacesQuery.isLoading
  ]);

  const createTaskWorkspace = useCallback(
    async (input: { description: string; title: string }) => {
      const workspace = await createTaskMutation.mutateAsync(input);
      requestTaskSelection(workspace.task.id);
    },
    [createTaskMutation, requestTaskSelection]
  );

  return {
    contextSwitchDialogProps: dialogProps,
    createTaskMutation,
    createTaskWorkspace,
    requestProjectSelection,
    requestTaskSelection,
    selectedProject,
    selectedProjectId,
    selectedTaskId,
    selectedTaskWorkspace,
    taskWorkspaces,
    taskWorkspacesQuery
  };
}

function createContextSwitchBody(editorRef: RefObject<WorkspaceEditorHandle | null>): string {
  return `Save or discard your changes to ${
    editorRef.current?.getActiveFilePath() ?? 'the current file'
  } before leaving this workspace.`;
}

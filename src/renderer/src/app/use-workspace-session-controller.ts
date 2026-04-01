import { useCallback, useEffect, type RefObject } from 'react';

import type { Project } from '@shared/domain/project';
import type { TaskWorkspace } from '@shared/domain/task-workspace';

import type { WorkspaceEditorHandle } from '../features/editor/workspace-editor-surface';
import { useUnsavedChangesGuard } from '../features/editor/use-unsaved-changes-guard';
import {
  useCreateTaskWorkspaceMutation,
  useDeleteTaskWorkspaceMutation,
  useTaskWorkspacesQuery
} from '../features/tasks/task-hooks';
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
  const deleteTaskMutation = useDeleteTaskWorkspaceMutation(effectiveProjectId);
  const taskWorkspaces = taskWorkspacesQuery.data ?? [];
  const selectedTaskWorkspace =
    taskWorkspaces.find((workspace) => workspace.task.id === selectedTaskId) ?? null;

  const reconcileProjectSelection = useCallback(
    (projectId: number | null) => {
      if (projectId === selectedProjectId) {
        return;
      }

      selectProject(projectId);
    },
    [selectProject, selectedProjectId]
  );

  const reconcileTaskSelection = useCallback(
    (taskId: number | null) => {
      if (taskId === selectedTaskId) {
        return;
      }

      selectTask(taskId);
    },
    [selectTask, selectedTaskId]
  );

  const requestProjectSelection = useCallback(
    (projectId: number | null) => {
      if (projectId === selectedProjectId) {
        return;
      }

      requestTransition({
        body: createContextSwitchBody(editorRef),
        key: `project:${projectId ?? 'none'}`,
        run: () => {
          reconcileProjectSelection(projectId);
        }
      });
    },
    [editorRef, reconcileProjectSelection, requestTransition, selectedProjectId]
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
          reconcileTaskSelection(taskId);
        }
      });
    },
    [editorRef, reconcileTaskSelection, requestTransition, selectedTaskId]
  );

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId !== null) {
        reconcileProjectSelection(null);
        return;
      }

      if (selectedTaskId !== null) {
        reconcileTaskSelection(null);
      }

      return;
    }

    const selectedStillExists = projects.some((project) => project.id === selectedProjectId);

    if (!selectedStillExists) {
      reconcileProjectSelection(projects[0]?.id ?? null);
    }
  }, [
    projects,
    reconcileProjectSelection,
    reconcileTaskSelection,
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
        reconcileTaskSelection(null);
      }

      return;
    }

    if (taskWorkspacesQuery.isLoading) {
      return;
    }

    if (taskWorkspaces.length === 0) {
      if (selectedTaskId !== null) {
        reconcileTaskSelection(null);
      }

      return;
    }

    const selectedStillExists = taskWorkspaces.some((workspace) => workspace.task.id === selectedTaskId);

    if (!selectedStillExists) {
      reconcileTaskSelection(taskWorkspaces[0]?.task.id ?? null);
    }
  }, [
    effectiveProjectId,
    reconcileTaskSelection,
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

  const requestTaskDeletion = useCallback(
    (workspace: TaskWorkspace) => {
      const confirmed = window.confirm(
        `Delete "${workspace.task.title}" and its task workspace?\n\nThis also removes its Codex runs and worktree.`
      );

      if (!confirmed) {
        return;
      }

      const deleteWorkspace = () => {
        void deleteTaskMutation.mutateAsync({ taskId: workspace.task.id }).catch((error) => {
          window.alert(
            error instanceof Error ? error.message : 'Autocode could not delete this task workspace.'
          );
        });
      };

      if (workspace.task.id === selectedTaskId) {
        requestTransition({
          body: `Save or discard your changes to ${
            editorRef.current?.getActiveFilePath() ?? 'the current file'
          } before deleting this task workspace.`,
          key: `delete-task:${workspace.task.id}`,
          run: deleteWorkspace,
          title: 'Unsaved workspace edits'
        });
        return;
      }

      deleteWorkspace();
    },
    [deleteTaskMutation, editorRef, requestTransition, selectedTaskId]
  );

  return {
    contextSwitchDialogProps: dialogProps,
    createTaskMutation,
    createTaskWorkspace,
    deleteTaskMutation,
    requestProjectSelection,
    requestTaskDeletion,
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

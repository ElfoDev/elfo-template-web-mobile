import type { Task } from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, createTask, deleteTask, fetchTasks, updateTask } from "@/lib/api";
import { refreshSession } from "@/lib/auth-client";

export type TasksState =
  | { status: "loading" }
  | { status: "ok"; tasks: Task[] }
  | { status: "error"; error: string };

function messageOf(err: unknown): string {
  if (err instanceof ApiRequestError && err.status === 401) refreshSession();
  return err instanceof Error ? err.message : String(err);
}

/**
 * The signed-in user's tasks: loads on mount and exposes create / toggle / remove.
 * Mutations update the list with the API's answer; failures go to `mutationError`.
 */
export function useTasks() {
  const [state, setState] = useState<TasksState>({ status: "loading" });
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setTasks = useCallback((update: (tasks: Task[]) => Task[]) => {
    if (!mounted.current) return;
    setState((current) =>
      current.status === "ok" ? { status: "ok", tasks: update(current.tasks) } : current,
    );
  }, []);

  const setPending = useCallback((id: string, pending: boolean) => {
    if (!mounted.current) return;
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const tasks = await fetchTasks();
      if (mounted.current) setState({ status: "ok", tasks });
    } catch (err) {
      if (mounted.current) setState({ status: "error", error: messageOf(err) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Returns true when the task was created (so the screen can clear its input). */
  const add = useCallback(
    async (title: string): Promise<boolean> => {
      setMutationError(null);
      try {
        const task = await createTask(title);
        setTasks((tasks) => [task, ...tasks]);
        return true;
      } catch (err) {
        if (mounted.current) setMutationError(messageOf(err));
        return false;
      }
    },
    [setTasks],
  );

  const toggle = useCallback(
    async (task: Task) => {
      setMutationError(null);
      setPending(task.id, true);
      try {
        const updated = await updateTask(task.id, { done: !task.done });
        setTasks((tasks) => tasks.map((t) => (t.id === updated.id ? updated : t)));
      } catch (err) {
        if (mounted.current) setMutationError(messageOf(err));
      } finally {
        setPending(task.id, false);
      }
    },
    [setTasks, setPending],
  );

  const remove = useCallback(
    async (task: Task) => {
      setMutationError(null);
      setPending(task.id, true);
      try {
        await deleteTask(task.id);
        setTasks((tasks) => tasks.filter((t) => t.id !== task.id));
      } catch (err) {
        if (mounted.current) setMutationError(messageOf(err));
      } finally {
        setPending(task.id, false);
      }
    },
    [setTasks, setPending],
  );

  return { state, mutationError, pendingIds, reload, add, toggle, remove };
}

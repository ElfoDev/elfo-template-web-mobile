import { createTaskSchema } from "@repo/shared";
import { useState } from "react";
import { ActivityIndicator, FlatList, Text, TextInput, View } from "react-native";
import { Button } from "@/components/button";
import { FormMessage } from "@/components/form-message";
import { TaskItem } from "@/components/task-item";
import { useTasks } from "@/hooks/use-tasks";

export default function TasksScreen() {
  const { state, mutationError, pendingIds, reload, add, toggle, remove } = useTasks();
  const [title, setTitle] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function submit() {
    const parsed = createTaskSchema.safeParse({ title });
    if (!parsed.success) {
      setInputError(parsed.error.issues[0]?.message ?? "Título inválido");
      return;
    }
    setInputError(null);
    // Clear right away so the user can type the next task while this one is saved;
    // on failure, give the text back (unless they already typed something else).
    setTitle("");
    setAdding(true);
    const created = await add(parsed.data.title);
    setAdding(false);
    if (!created) setTitle((current) => current || parsed.data.title);
  }

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <View className="gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <View className="flex-row gap-2">
          <TextInput
            aria-label="Nova tarefa"
            placeholder="Nova tarefa"
            placeholderTextColor="#a3a3a3"
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
            className="h-12 flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
          <Button title="Adicionar" loading={adding} onPress={() => void submit()} />
        </View>
        <FormMessage message={inputError ?? mutationError} />
      </View>

      {state.status === "loading" && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      )}

      {state.status === "error" && (
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-base text-neutral-700 dark:text-neutral-300">
            {state.error}
          </Text>
          <Button variant="secondary" title="Tentar de novo" onPress={() => void reload()} />
        </View>
      )}

      {state.status === "ok" && (
        <FlatList
          data={state.tasks}
          keyExtractor={(task) => task.id}
          contentContainerClassName="gap-2 p-4"
          renderItem={({ item }) => (
            <TaskItem
              task={item}
              pending={pendingIds.has(item.id)}
              onToggle={(task) => void toggle(task)}
              onDelete={(task) => void remove(task)}
            />
          )}
          ListEmptyComponent={
            <Text className="mt-12 text-center text-base text-neutral-500">
              Nenhuma tarefa ainda. Crie a primeira acima.
            </Text>
          }
        />
      )}
    </View>
  );
}

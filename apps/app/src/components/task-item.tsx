import Ionicons from "@expo/vector-icons/Ionicons";
import type { Task } from "@repo/shared";
import { Pressable, Text, View } from "react-native";

type Props = {
  task: Task;
  pending: boolean;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
};

export function TaskItem({ task, pending, onToggle, onDelete }: Props) {
  return (
    <View
      className={`flex-row items-center gap-3 rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900 ${pending ? "opacity-50" : ""}`}
    >
      <Pressable
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.title}
        disabled={pending}
        onPress={() => onToggle(task)}
        hitSlop={8}
        className="flex-1 flex-row items-center gap-3"
      >
        <Ionicons
          name={task.done ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={task.done ? "#059669" : "#a3a3a3"}
        />
        <Text
          className={`flex-1 text-base ${task.done ? "text-neutral-400 line-through" : "text-neutral-900 dark:text-white"}`}
        >
          {task.title}
        </Text>
      </Pressable>
      <Pressable
        role="button"
        aria-label={`Apagar "${task.title}"`}
        disabled={pending}
        onPress={() => onDelete(task)}
        hitSlop={8}
        className="active:opacity-60"
      >
        <Ionicons name="trash-outline" size={20} color="#dc2626" />
      </Pressable>
    </View>
  );
}

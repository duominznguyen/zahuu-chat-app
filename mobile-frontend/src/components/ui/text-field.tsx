import { forwardRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField({ label, error, className, ...rest }, ref) {
    return (
      <View className="gap-1.5">
        {label && (
          <Text className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor="#a1a1aa"
          className={`h-12 rounded-xl border px-4 text-base text-zinc-900 dark:text-zinc-100 ${
            error
              ? "border-danger dark:border-danger-dark"
              : "border-zinc-200 dark:border-zinc-800"
          } ${className ?? ""}`}
          {...rest}
        />
        {error && (
          <Text className="text-sm text-danger dark:text-danger-dark">
            {error}
          </Text>
        )}
      </View>
    );
  },
);

import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from "react-native";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

interface ButtonProps extends Omit<PressableProps, "children"> {
  children: string;
  variant?: Variant;
  loading?: boolean;
}

const containerByVariant: Record<Variant, string> = {
  primary: "bg-primary dark:bg-primary-dark",
  secondary: "bg-zinc-100 dark:bg-zinc-800",
  destructive: "bg-danger dark:bg-danger-dark",
  ghost: "bg-transparent",
};

const textByVariant: Record<Variant, string> = {
  primary: "text-white dark:text-zinc-900",
  secondary: "text-zinc-900 dark:text-zinc-100",
  destructive: "text-white dark:text-zinc-900",
  ghost: "text-primary dark:text-primary-dark",
};

export function Button({
  children,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...rest
}: ButtonProps & { className?: string }) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      className={`h-12 flex-row items-center justify-center rounded-xl px-4 ${containerByVariant[variant]} ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "secondary" || variant === "ghost" ? "#0D9488" : "#fff"
          }
        />
      ) : (
        <Text className={`text-base font-semibold ${textByVariant[variant]}`}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

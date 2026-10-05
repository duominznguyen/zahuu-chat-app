import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Có lỗi xảy ra", onRetry }: ErrorStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

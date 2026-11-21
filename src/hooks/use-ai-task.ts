import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Wraps an AI server call: loading/error state, toast on failure, refreshes activity on success. */
export function useAiTask<TInput, TResult>(fn: (input: TInput) => Promise<TResult>, successMessage?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      if (successMessage) toast.success(successMessage);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });
}

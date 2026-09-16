import { useToast } from "@/hooks/use-toast";
import { Toast, ToastDescription, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastViewport>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          {title ? <ToastTitle>{title}</ToastTitle> : null}
          {description ? <ToastDescription>{description}</ToastDescription> : null}
          {action}
        </Toast>
      ))}
    </ToastViewport>
  );
}

declare module "*.css";

interface Window {
  turnstile?: {
    render(
      container: HTMLElement,
      options: {
        sitekey: string;
        callback?: (token: string) => void;
        "expired-callback"?: () => void;
      },
    ): string;
    reset(widgetId?: string): void;
  };
}

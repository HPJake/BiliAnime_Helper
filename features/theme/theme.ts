export type ThemePreference = "auto" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "auto">;

export type BilibiliThemeSignals = {
  backgroundColor?: string;
  colorScheme?: string;
  cookieTheme?: string;
  tokens: string[];
};

export function resolveThemePreference(
  preference: ThemePreference,
  bilibiliTheme: ResolvedTheme | null,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  return preference === "auto" ? bilibiliTheme ?? systemTheme : preference;
}

export function inferBilibiliTheme(signals: BilibiliThemeSignals): ResolvedTheme | null {
  const cookieTheme = signals.cookieTheme?.toLocaleLowerCase();
  if (cookieTheme === "dark" || cookieTheme === "light") return cookieTheme;

  const tokens = signals.tokens.join(" ").toLocaleLowerCase();
  if (/(?:^|[\s_-])(dark|night|black)(?:$|[\s_-])/.test(tokens)) return "dark";
  if (/(?:^|[\s_-])(light|day)(?:$|[\s_-])/.test(tokens)) return "light";

  const colorScheme = signals.colorScheme?.toLocaleLowerCase() ?? "";
  if (colorScheme.includes("dark") && !colorScheme.includes("light")) return "dark";
  if (colorScheme.includes("light") && !colorScheme.includes("dark")) return "light";

  const luminance = parseBackgroundLuminance(signals.backgroundColor);
  if (luminance !== null && luminance < 0.35) return "dark";
  if (luminance !== null && luminance > 0.65) return "light";
  return null;
}

export function detectBilibiliTheme(
  documentValue: Document = document,
  windowValue: Window = window
): ResolvedTheme | null {
  const root = documentValue.documentElement;
  const body = documentValue.body;
  const rootStyle = windowValue.getComputedStyle(root);
  const bodyStyle = body ? windowValue.getComputedStyle(body) : null;
  const cookieTheme = /(?:^|;\s*)theme_style=(dark|light)(?:;|$)/i.exec(documentValue.cookie)?.[1];
  const tokens = [root, body]
    .filter((element): element is HTMLElement => element !== null)
    .flatMap((element) => [
      element.className,
      element.getAttribute("data-theme") ?? "",
      element.getAttribute("data-color-scheme") ?? "",
      element.getAttribute("data-mode") ?? ""
    ]);

  return inferBilibiliTheme({
    tokens,
    ...(cookieTheme ? { cookieTheme } : {}),
    colorScheme: bodyStyle?.colorScheme || rootStyle.colorScheme,
    backgroundColor: nonTransparentColor(bodyStyle?.backgroundColor, rootStyle.backgroundColor)
  });
}

function nonTransparentColor(...colors: Array<string | undefined>): string | undefined {
  return colors.find((color) => color && !/rgba?\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(color));
}

function parseBackgroundLuminance(color: string | undefined): number | null {
  if (!color) return null;
  const values = color.match(/[\d.]+/g)?.map(Number);
  if (!values || values.length < 3 || values.some((value) => !Number.isFinite(value))) return null;
  if (values.length >= 4 && values[3] === 0) return null;
  const [red, green, blue] = values.slice(0, 3).map((value) => value / 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

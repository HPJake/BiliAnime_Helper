import { useEffect, useState } from "react";
import { StateMessage } from "../../components/StateMessage";
import { DEFAULT_SETTINGS, type AppSettings } from "../../domain/settings";
import type { SettingsService } from "../../services/settings/SettingsService";
import type { ResolvedTheme, ThemePreference } from "../theme/theme";

type SettingsViewProps = {
  onThemePreferenceChange: (preference: ThemePreference) => void;
  resolvedTheme: ResolvedTheme;
  service: SettingsService;
  version: string;
};

type Feedback = {
  detail: string;
  error: boolean;
  title: string;
};

export function SettingsView({
  onThemePreferenceChange,
  resolvedTheme,
  service,
  version
}: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"notifications" | "badge" | "theme" | "refresh" | "cache" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelled = false;
    service.getSettings()
      .then((value) => {
        if (!cancelled) setSettings(value);
      })
      .catch(() => {
        if (!cancelled) setFeedback({
          title: "无法读取设置",
          detail: "当前显示默认设置，请重新打开插件后再试。",
          error: true
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  async function updateSetting(
    key: "notificationsEnabled" | "badgeEnabled",
    value: boolean,
    busyKey: "notifications" | "badge"
  ) {
    const previous = settings;
    setBusy(busyKey);
    setFeedback(null);
    setSettings({ ...settings, [key]: value });
    try {
      setSettings(await service.updateSettings({ [key]: value }));
    } catch {
      setSettings(previous);
      setFeedback({ title: "设置未保存", detail: "本地存储暂时不可用，请稍后重试。", error: true });
    } finally {
      setBusy(null);
    }
  }

  async function updateThemePreference(value: ThemePreference) {
    const previous = settings;
    setBusy("theme");
    setFeedback(null);
    setSettings({ ...settings, themePreference: value });
    onThemePreferenceChange(value);
    try {
      setSettings(await service.updateSettings({ themePreference: value }));
    } catch {
      setSettings(previous);
      onThemePreferenceChange(previous.themePreference);
      setFeedback({ title: "设置未保存", detail: "本地存储暂时不可用，请稍后重试。", error: true });
    } finally {
      setBusy(null);
    }
  }

  async function refreshNow() {
    setBusy("refresh");
    setFeedback(null);
    try {
      await service.refreshNow();
      setFeedback({ title: "刷新完成", detail: "缓存已更新；返回各页面即可查看最新数据。", error: false });
    } catch {
      setFeedback({ title: "刷新失败", detail: "无法连接后台数据服务，请稍后重试。", error: true });
    } finally {
      setBusy(null);
    }
  }

  async function clearCache() {
    setBusy("cache");
    setFeedback(null);
    try {
      await service.clearCache();
      setFeedback({ title: "缓存已清理", detail: "追番列表、提醒状态和设置均已保留。", error: false });
    } catch {
      setFeedback({ title: "清理失败", detail: "本地存储暂时不可用，请稍后重试。", error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="settings-view" aria-labelledby="settings-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PREFERENCES</p>
          <h2 id="settings-title">设置</h2>
        </div>
        <span className="version-chip">v{version}</span>
      </div>

      {feedback ? (
        <StateMessage
          detail={feedback.detail}
          title={feedback.title}
          tone={feedback.error ? "error" : "neutral"}
        />
      ) : null}

      <section className="settings-card" aria-labelledby="appearance-settings-title">
        <div className="settings-card__heading">
          <h3 id="appearance-settings-title">外观</h3>
          <span>当前为{resolvedTheme === "dark" ? "深色" : "浅色"}</span>
        </div>
        <div className="theme-options" role="radiogroup" aria-label="界面颜色">
          {THEME_OPTIONS.map((option) => (
            <label className="theme-option" key={option.value}>
              <input
                checked={settings.themePreference === option.value}
                disabled={loading || busy !== null}
                name="theme-preference"
                onChange={() => void updateThemePreference(option.value)}
                type="radio"
                value={option.value}
              />
              <span aria-hidden="true" className={`theme-swatch theme-swatch--${option.value}`} />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card" aria-labelledby="notifications-settings-title">
        <div className="settings-card__heading">
          <h3 id="notifications-settings-title">通知</h3>
          <span>预计播出提醒</span>
        </div>
        <ToggleRow
          checked={settings.notificationsEnabled}
          description="动画到达预计播出时间时发送系统通知。"
          disabled={loading || busy !== null}
          label="系统通知"
          onChange={(checked) => void updateSetting("notificationsEnabled", checked, "notifications")}
        />
      </section>

      <section className="settings-card" aria-labelledby="badge-settings-title">
        <div className="settings-card__heading">
          <h3 id="badge-settings-title">角标</h3>
          <span>未读集数</span>
        </div>
        <ToggleRow
          checked={settings.badgeEnabled}
          description="在浏览器工具栏图标上显示未查看的播出事件数。"
          disabled={loading || busy !== null}
          label="显示未读角标"
          onChange={(checked) => void updateSetting("badgeEnabled", checked, "badge")}
        />
      </section>

      <section className="settings-card settings-action-card" aria-labelledby="data-settings-title">
        <div className="settings-card__heading">
          <h3 id="data-settings-title">数据</h3>
          <span>排期与榜单</span>
        </div>
        <p>清除旧缓存并立即更新追番排期；其他页面会在打开时获取最新数据。</p>
        <button className="primary-button" disabled={busy !== null} onClick={() => void refreshNow()} type="button">
          {busy === "refresh" ? "正在刷新…" : "立即刷新"}
        </button>
      </section>

      <section className="settings-card settings-action-card" aria-labelledby="storage-settings-title">
        <div className="settings-card__heading">
          <h3 id="storage-settings-title">存储</h3>
          <span>仅清理可恢复数据</span>
        </div>
        <p>删除 AniList 与 Bangumi 缓存，不会删除追番列表、设置或提醒记录。</p>
        <button className="secondary-button" disabled={busy !== null} onClick={() => void clearCache()} type="button">
          {busy === "cache" ? "正在清理…" : "清理缓存"}
        </button>
      </section>

      <section className="settings-card about-card" aria-labelledby="about-settings-title">
        <div className="settings-card__heading">
          <h3 id="about-settings-title">关于</h3>
          <span>Version {version}</span>
        </div>
        <p>BiliAnime Helper is an unofficial browser extension and is not affiliated with Bilibili or AniList.</p>
        <small>无需账号；追番、设置与提醒状态保存在本地浏览器中。</small>
      </section>
    </section>
  );
}

const THEME_OPTIONS: Array<{
  description: string;
  label: string;
  value: ThemePreference;
}> = [
  { value: "auto", label: "跟随 B 站", description: "读取当前 B 站页面，无法读取时跟随系统。" },
  { value: "light", label: "浅色", description: "始终使用当前的明亮界面。" },
  { value: "dark", label: "深色", description: "始终使用低亮度深色界面。" }
];

type ToggleRowProps = {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function ToggleRow({ checked, description, disabled, label, onChange }: ToggleRowProps) {
  return (
    <label className="settings-toggle">
      <span className="settings-toggle__copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="toggle-track" aria-hidden="true"><span /></span>
    </label>
  );
}

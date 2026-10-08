import { DEFAULT_UNIFIED_SETTINGS, type ClientSettings } from "@t3tools/contracts/settings";
import type { CSSProperties, ReactNode } from "react";

import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow, SettingsSection } from "./settingsLayout";
import { type SettingsSearchItemId, searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

type BooleanKey = "liquidGlassEnabled" | "squircleCornersEnabled" | "menuGlideEnabled";
type StrengthKey =
  | "liquidGlassRefraction"
  | "liquidGlassFrost"
  | "liquidGlassShine"
  | "menuGlideStretch";

function ToggleRow({
  searchId,
  settingKey,
  label,
  description,
  preview,
}: {
  searchId: SettingsSearchItemId;
  settingKey: BooleanKey;
  label: string;
  description: string;
  preview?: ReactNode;
}) {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const value = settings[settingKey];
  const defaultValue = DEFAULT_UNIFIED_SETTINGS[settingKey];
  return (
    <SettingsRow
      {...searchableSetting(searchId)}
      description={description}
      resetAction={
        value !== defaultValue ? (
          <SettingResetButton
            label={label.toLowerCase()}
            onClick={() => updateSettings({ [settingKey]: defaultValue })}
          />
        ) : null
      }
      control={
        <div className="flex items-center gap-3">
          {preview}
          <Switch
            aria-label={label}
            checked={value}
            onCheckedChange={(checked) => updateSettings({ [settingKey]: Boolean(checked) })}
          />
        </div>
      }
    />
  );
}

function StrengthRow({
  searchId,
  settingKey,
  label,
  description,
  disabled,
}: {
  searchId: SettingsSearchItemId;
  settingKey: StrengthKey;
  label: string;
  description: string;
  disabled: boolean;
}) {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const value: ClientSettings[StrengthKey] = settings[settingKey];
  const defaultValue = DEFAULT_UNIFIED_SETTINGS[settingKey];
  const sliderStyle = {
    "--settings-slider-progress": `${value}%`,
    "--settings-slider-fill-offset": `${0.5 - value / 100}rem`,
  } as CSSProperties;
  return (
    <SettingsRow
      {...searchableSetting(searchId)}
      description={description}
      resetAction={
        value !== defaultValue ? (
          <SettingResetButton
            label={label.toLowerCase()}
            onClick={() => updateSettings({ [settingKey]: defaultValue })}
          />
        ) : null
      }
      control={
        <div
          className="flex w-full items-center gap-3 data-disabled:opacity-50 sm:w-52"
          data-disabled={disabled || undefined}
        >
          <output
            className="min-w-12 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium tabular-nums text-foreground"
            htmlFor={settingKey}
          >
            {value}%
          </output>
          <input
            aria-label={label}
            className="settings-slider min-w-0 flex-1"
            disabled={disabled}
            id={settingKey}
            max={100}
            min={0}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (Number.isInteger(next) && next >= 0 && next <= 100) {
                updateSettings({ [settingKey]: next });
              }
            }}
            step={5}
            style={sliderStyle}
            type="range"
            value={value}
          />
        </div>
      }
    />
  );
}

/** Striped backdrop under a glass chip, so refraction and frost changes show live. */
function LiquidGlassPreview() {
  return (
    <div
      aria-hidden
      className="relative h-10 w-28 overflow-hidden rounded-lg border border-border"
      style={{
        background:
          "repeating-linear-gradient(115deg, var(--primary) 0 6px, var(--background) 6px 13px, var(--info, #3b82f6) 13px 17px, var(--background) 17px 24px)",
      }}
    >
      <div className="dropdown-glass absolute inset-x-3 inset-y-1.5 flex items-center justify-center rounded-lg text-2xs font-medium text-foreground shadow-lg">
        Glass
      </div>
    </div>
  );
}

export function LiquidGlassSettingsSection() {
  const enabled = useScopedSettings().liquidGlassEnabled;
  return (
    <SettingsSection id="appearance-liquid-glass" title="Liquid glass">
      <ToggleRow
        searchId="liquid-glass"
        settingKey="liquidGlassEnabled"
        label="Liquid glass"
        description="Menus, popovers and dialogs refract what is behind them and catch light at the edges."
        preview={<LiquidGlassPreview />}
      />
      <StrengthRow
        searchId="liquid-glass-refraction"
        settingKey="liquidGlassRefraction"
        label="Refraction"
        description="How strongly the glass edge bends the content behind it. Desktop and Chromium browsers only."
        disabled={!enabled}
      />
      <StrengthRow
        searchId="liquid-glass-frost"
        settingKey="liquidGlassFrost"
        label="Frost"
        description="Blur behind the glass. Lower is clearer, higher keeps text easier to read."
        disabled={!enabled}
      />
      <StrengthRow
        searchId="liquid-glass-shine"
        settingKey="liquidGlassShine"
        label="Edge shine"
        description="Brightness of the light catching the glass rim."
        disabled={!enabled}
      />
      <ToggleRow
        searchId="squircle-corners"
        settingKey="squircleCornersEnabled"
        label="Squircle corners"
        description="Continuous macOS-style corners instead of circular ones."
      />
    </SettingsSection>
  );
}

export function MenuGlideSettingsRows() {
  const enabled = useScopedSettings().menuGlideEnabled;
  return (
    <>
      <ToggleRow
        searchId="menu-glide"
        settingKey="menuGlideEnabled"
        label="Gliding highlight"
        description="The highlight in menus and lists slides between items."
      />
      <StrengthRow
        searchId="menu-glide-stretch"
        settingKey="menuGlideStretch"
        label="Liquid stretch"
        description="How much the highlight stretches when it moves fast."
        disabled={!enabled}
      />
    </>
  );
}

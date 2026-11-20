import React from 'react';
import { Eye, EyeOff, ImagePlus, Lock, Maximize, Trash2, Unlock } from 'lucide-react';
import { UnderlayState } from '../../../types';
import { InspectorSection } from '../../ui/InspectorSection';
import { ToggleSwitch } from '../../ui/ToggleSwitch';

interface UnderlaySectionProps {
  underlay: UnderlayState;
  onSetImage: (src: string) => void;
  onUpdate: (partial: Partial<UnderlayState>) => void;
  onFitToSheet: () => void;
  onClear: () => void;
}

export const UnderlaySection: React.FC<UnderlaySectionProps> = ({
  underlay,
  onSetImage,
  onUpdate,
  onFitToSheet,
  onClear,
}) => {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onSetImage(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const summary = underlay.src
    ? underlay.visible
      ? `${Math.round(underlay.opacity * 100)}%`
      : 'скрыта'
    : 'нет';

  return (
    <InspectorSection
      title="Подложка (эскиз)"
      icon={<ImagePlus className="w-3.5 h-3.5" />}
      summary={summary}
      collapsible
      defaultOpen={Boolean(underlay.src)}
      storageKey="eznc_sec_underlay"
      headerRight={
        underlay.src ? (
          <button
            type="button"
            onClick={onClear}
            title="Удалить подложку"
            className="text-[11px] flex items-center gap-1 text-danger hover:opacity-80 font-medium transition-opacity cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        ) : undefined
      }
    >
      <p className="text-[11px] text-muted leading-snug">
        Фоновый эскиз для обводки. Только для текущей сессии, в G-код не попадает.
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="w-full text-xs text-fg-secondary file:mr-2.5 file:rounded-md file:border file:border-line file:bg-surface-subtle file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-fg hover:file:bg-surface-hover file:transition-colors file:cursor-pointer"
      />

      {underlay.src && (
        <div className="space-y-2.5 pt-0.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted font-medium">Прозрачность</span>
              <span className="font-mono text-xs text-fg font-semibold">
                {Math.round(underlay.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(underlay.opacity * 100)}
              onChange={(e) =>
                onUpdate({ opacity: (parseFloat(e.target.value) || 50) / 100 })
              }
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={onFitToSheet}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-fg bg-surface-subtle hover:bg-surface-hover border border-line rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
          >
            <Maximize className="w-3.5 h-3.5 text-muted" />
            <span>Разместить по листу</span>
          </button>

          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-secondary font-medium flex items-center gap-1.5">
              {underlay.visible ? (
                <Eye className="w-3.5 h-3.5 text-muted" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-muted" />
              )}
              Показывать на холсте
            </span>
            <ToggleSwitch
              checked={underlay.visible}
              ariaLabel="Показывать подложку на холсте"
              onChange={(visible) => onUpdate({ visible })}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-secondary font-medium flex items-center gap-1.5">
              {underlay.frozen ? (
                <Lock className="w-3.5 h-3.5 text-muted" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-muted" />
              )}
              Зафиксировать положение
            </span>
            <ToggleSwitch
              checked={underlay.frozen}
              ariaLabel="Зафиксировать положение подложки"
              onChange={(frozen) => onUpdate({ frozen })}
            />
          </div>
        </div>
      )}
    </InspectorSection>
  );
};

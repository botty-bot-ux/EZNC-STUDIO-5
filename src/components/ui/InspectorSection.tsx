import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface InspectorSectionProps {
  title: string;
  icon?: React.ReactNode;
  /** Короткая сводка справа в шапке (например, размеры листа или границы станка). */
  summary?: React.ReactNode;
  /** Произвольный элемент управления справа в шапке (например, ToggleSwitch или кнопка). */
  headerRight?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Ключ в localStorage для запоминания открытого/свёрнутого состояния секции. */
  storageKey?: string;
  children: React.ReactNode;
}

function readStoredOpen(storageKey: string | undefined, fallback: boolean): boolean {
  if (!storageKey) return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

/**
 * Единая секция инспектора: чёткая горизонтальная разделительная линия,
 * опциональное сворачивание с запоминанием состояния и табличная сводка справа.
 */
export const InspectorSection: React.FC<InspectorSectionProps> = ({
  title,
  icon,
  summary,
  headerRight,
  collapsible = false,
  defaultOpen = true,
  storageKey,
  children,
}) => {
  const [open, setOpen] = useState<boolean>(() =>
    collapsible ? readStoredOpen(storageKey, defaultOpen) : true
  );

  const toggle = () => {
    if (!collapsible) return;
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, next ? '1' : '0');
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  };

  return (
    <section className="border-b border-line last:border-b-0">
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 min-h-[38px]">
        {collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left group cursor-pointer"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 text-muted group-hover:text-fg shrink-0 transition-transform duration-150 ${
                open ? 'rotate-90' : ''
              }`}
            />
            {icon && <span className="text-muted shrink-0 flex items-center">{icon}</span>}
            <span className="text-xs font-semibold text-fg truncate">{title}</span>
            {summary && (
              <span className="ml-auto font-mono text-[11px] text-muted truncate pl-2">
                {summary}
              </span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {icon && <span className="text-muted shrink-0 flex items-center">{icon}</span>}
            <span className="text-xs font-semibold text-fg truncate">{title}</span>
            {summary && (
              <span className="ml-auto font-mono text-[11px] text-muted truncate pl-2">
                {summary}
              </span>
            )}
          </div>
        )}

        {headerRight && <div className="shrink-0 flex items-center gap-1.5">{headerRight}</div>}
      </div>

      {(!collapsible || open) && <div className="px-3.5 pb-3.5 space-y-2.5">{children}</div>}
    </section>
  );
};

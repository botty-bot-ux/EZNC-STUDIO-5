import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { LineObject } from '../../../types';
import { round3 } from '../../../lib/utils/num';
import { PropertyInput } from './PropertyInput';

interface LinePropertiesProps {
  obj: LineObject;
  onUpdate: (partial: Partial<LineObject>) => void;
}

export const LineProperties: React.FC<LinePropertiesProps> = ({ obj, onUpdate }) => {
  const dx = obj.endX - obj.startX;
  const dy = obj.endY - obj.startY;
  const length = Math.hypot(dx, dy);
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;

  const handleLengthChange = (nextLen: number) => {
    const safeLen = Math.max(0.1, nextLen);
    const dir = length > 1e-6 ? angleRad : 0;
    onUpdate({
      endX: round3(obj.startX + Math.cos(dir) * safeLen),
      endY: round3(obj.startY + Math.sin(dir) * safeLen),
    });
  };

  const handleAngleChange = (nextDeg: number) => {
    const rad = (nextDeg * Math.PI) / 180;
    const len = length > 1e-6 ? length : 100;
    onUpdate({
      endX: round3(obj.startX + Math.cos(rad) * len),
      endY: round3(obj.startY + Math.sin(rad) * len),
    });
  };

  const handleSwapPoints = () => {
    onUpdate({
      startX: obj.endX,
      startY: obj.endY,
      endX: obj.startX,
      endY: obj.startY,
    });
  };

  return (
    <div className="space-y-3">
      {/* Главные понятные параметры отрезка: Длина и Угол */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyInput
          layout="stacked"
          label="Длина, мм"
          value={length}
          onChange={handleLengthChange}
          decimals={1}
          step={1}
          fallbackValue={10}
        />
        <PropertyInput
          layout="stacked"
          label="Угол, °"
          value={angleDeg}
          onChange={handleAngleChange}
          decimals={1}
          step={5}
          fallbackValue={0}
        />
      </div>

      {/* Точные координаты концов */}
      <div className="pt-2 border-t border-line space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span className="font-medium">Координаты концов</span>
          <button
            type="button"
            onClick={handleSwapPoints}
            title="Поменять начало и конец местами (развернуть направление резки)"
            className="inline-flex items-center gap-1 text-[11px] text-fg-secondary hover:text-fg transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>Развернуть</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5 min-w-0">
            <PropertyInput label="X1" value={obj.startX} onChange={(startX) => onUpdate({ startX })} decimals={1} step={1} />
            <PropertyInput label="Y1" value={obj.startY} onChange={(startY) => onUpdate({ startY })} decimals={1} step={1} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <PropertyInput label="X2" value={obj.endX} onChange={(endX) => onUpdate({ endX })} decimals={1} step={1} />
            <PropertyInput label="Y2" value={obj.endY} onChange={(endY) => onUpdate({ endY })} decimals={1} step={1} />
          </div>
        </div>
      </div>
    </div>
  );
};

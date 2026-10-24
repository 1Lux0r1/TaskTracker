"use client";

import { useState } from "react";
import { PLAN_PERIOD_PRESETS, PLAN_SCALES } from "@/lib/planning/period";

type Range = { from: string; to: string };

type Props = {
  preset: string;
  scale: string;
  from: string;
  to: string;
  /** Месяцы каждой заготовки: выбор заготовки сразу показывает её границы. */
  ranges: Record<string, Range>;
};

/**
 * Поля периода под кнопкой «Фильтры». Заготовка и месяцы связаны: выбрал
 * «Текущий квартал» — месяцы встали на квартал, поправил месяц — период
 * стал своим. Иначе на экране было бы одно, а показано другое.
 */
export function PeriodFields({ preset: initialPreset, scale, from: initialFrom, to: initialTo, ranges }: Props) {
  const [preset, setPreset] = useState(initialPreset);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  return (
    <>
      <label className="field">
        Период
        <select
          name="period"
          value={preset}
          onChange={(event) => {
            const value = event.target.value;
            setPreset(value);
            const range = ranges[value];
            if (range) {
              setFrom(range.from);
              setTo(range.to);
            }
          }}
          className="input"
        >
          {PLAN_PERIOD_PRESETS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        С месяца
        <input
          type="month"
          name="from"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPreset("custom");
          }}
          className="input"
        />
      </label>
      <label className="field">
        По месяц
        <input
          type="month"
          name="to"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPreset("custom");
          }}
          className="input"
        />
      </label>
      <label className="field">
        Шкала
        <select name="scale" defaultValue={scale} className="input">
          {PLAN_SCALES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  projects: { id: string; code: string; name: string }[];
  selected: string;
  /** Адрес раздела: проект уходит в него параметром projectId. */
  basePath: string;
  label?: string;
};

/** Переключение проекта без отдельной кнопки: выбрали — показали. */
export function ProjectSwitch({ projects, selected, basePath, label = "Проект" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="field">
      {label}
      <select
        value={selected}
        disabled={pending}
        className="input w-72"
        onChange={(event) => {
          const next = event.target.value;
          startTransition(() => router.push(`${basePath}?projectId=${next}`));
        }}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.code} — {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}

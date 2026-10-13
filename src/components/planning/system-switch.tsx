import Link from "next/link";

type Props = {
  systems: { id: string; code: string; name: string }[];
  selected: string;
  basePath: string;
};

/** Выбор системы — только когда их несколько. */
export function SystemSwitch({ systems, selected, basePath }: Props) {
  if (systems.length < 2) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
      Система:
      {systems.map((system) => (
        <Link
          key={system.id}
          href={`${basePath}?system=${system.id}`}
          data-on={system.id === selected}
          className="fchip"
        >
          {system.code}
          <span className="fchip-n">{system.name}</span>
        </Link>
      ))}
    </div>
  );
}

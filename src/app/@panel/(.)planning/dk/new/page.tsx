import { OverlayPanel } from "@/components/overlay-panel";
import { overlayMode } from "@/lib/overlay";
import { NewDkScreen } from "@/app/planning/dk/new/screen";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Та же форма, но поверх экрана, с которого её открыли. */
export default async function Panel(props: Props) {
  const params = await props.searchParams;
  return (
    <OverlayPanel title="Новый ДК" note="Верхнеуровневая задача блока" mode={overlayMode(params.panel)}>
      <NewDkScreen searchParams={Promise.resolve(params)} inPanel />
    </OverlayPanel>
  );
}

import { OverlayPanel } from "@/components/overlay-panel";
import { overlayMode } from "@/lib/overlay";
import { NewLetterScreen } from "@/app/letters/new/screen";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Та же форма, но поверх экрана, с которого её открыли. */
export default async function Panel(props: Props) {
  const params = await props.searchParams;
  return (
    <OverlayPanel title="Внести письмо" mode={overlayMode(params.panel)}>
      <NewLetterScreen searchParams={Promise.resolve(params)} inPanel />
    </OverlayPanel>
  );
}

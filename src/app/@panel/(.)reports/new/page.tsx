import { OverlayPanel } from "@/components/overlay-panel";
import { overlayMode } from "@/lib/overlay";
import { NewReportScreen } from "@/app/reports/new/screen";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Та же форма, но поверх экрана, с которого её открыли. */
export default async function Panel(props: Props) {
  const params = await props.searchParams;
  return (
    <OverlayPanel title="Новый отчёт" mode={overlayMode(params.panel)}>
      <NewReportScreen searchParams={Promise.resolve(params)} inPanel />
    </OverlayPanel>
  );
}

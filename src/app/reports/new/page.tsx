import { NewReportScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewReportPage() {
  return <NewReportScreen searchParams={Promise.resolve({})} />;
}

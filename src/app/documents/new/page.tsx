import { NewDocumentScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  return <NewDocumentScreen searchParams={Promise.resolve({})} />;
}

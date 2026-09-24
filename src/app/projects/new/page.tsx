import { NewProjectScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  return <NewProjectScreen searchParams={Promise.resolve({})} />;
}

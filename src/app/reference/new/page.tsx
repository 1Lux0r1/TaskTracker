import { NewReferenceScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewReferencePage(props: PageProps<"/reference/new">) {
  return <NewReferenceScreen searchParams={props.searchParams} />;
}

import { NewLetterScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewLetterPage(props: PageProps<"/letters/new">) {
  return <NewLetterScreen searchParams={props.searchParams} />;
}

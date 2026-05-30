import { createContentPage } from "../_lib/create-content-page";

const { generateMetadata, default: Page } = createContentPage({
  slug: "donate",
  layout: "prose",
});

export { generateMetadata };
export default Page;

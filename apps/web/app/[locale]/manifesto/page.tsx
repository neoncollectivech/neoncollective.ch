import { createContentPage } from "../_lib/create-content-page";

const { generateMetadata, default: Page } = createContentPage({
  slug: "manifesto",
  layout: "prose",
});

export { generateMetadata };
export default Page;

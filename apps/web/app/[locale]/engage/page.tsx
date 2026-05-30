import { createContentPage } from "../_lib/create-content-page";

const { generateMetadata, default: Page } = createContentPage({
  slug: "engage",
  layout: "prose",
});

export { generateMetadata };
export default Page;

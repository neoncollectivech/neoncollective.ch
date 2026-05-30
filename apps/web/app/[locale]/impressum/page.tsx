import { createContentPage } from "../_lib/create-content-page";

const { generateMetadata, default: Page } = createContentPage({
  slug: "impressum",
  layout: "wide",
});

export { generateMetadata };
export default Page;

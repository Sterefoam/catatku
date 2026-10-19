import { CategoriesView } from "@/components/categories/categories-view";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";

export const metadata = { title: "Kategori" };

export default async function KategoriPage() {
  const user = await requireUser();
  const categories = getCategories(user.id);

  return <CategoriesView categories={categories} />;
}

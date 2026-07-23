import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import type { CreateMenuCategoryInput, CreateMenuItemInput } from "@le-tandoor/shared";
import { useMenu } from "../../hooks/queries";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { useT } from "../../lib/i18n";

export default function MenuAdmin() {
  const { data: categories } = useMenu();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { t, lang } = useT();
  const urdu = lang === "ur";

  const [categoryName, setCategoryName] = useState("");
  const [itemForms, setItemForms] = useState<Record<string, { name: string; price: string; options: string }>>({});

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["menu"] });
  }

  const createCategory = useMutation({
    mutationFn: (input: CreateMenuCategoryInput) => api.post("/menu/categories", input),
    onSuccess: () => {
      invalidate();
      setCategoryName("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("menuAdmin.error")),
  });

  const createItem = useMutation({
    mutationFn: (input: CreateMenuItemInput) => api.post("/menu/items", input),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : t("menuAdmin.error")),
  });

  const deactivateItem = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/items/${id}`),
    onSuccess: invalidate,
  });

  function updateForm(categoryId: string, field: "name" | "price" | "options", value: string) {
    setItemForms((prev) => {
      const current = prev[categoryId] ?? { name: "", price: "", options: "" };
      return { ...prev, [categoryId]: { ...current, [field]: value } };
    });
  }

  function submitItem(categoryId: string) {
    const form = itemForms[categoryId];
    if (!form?.name || !form?.price) {
      setError(t("menuAdmin.nameRequired"));
      return;
    }
    setError(null);
    const options = form.options
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .map((name) => ({ name, priceDelta: 0 }));
    createItem.mutate({
      categoryId,
      name: form.name,
      price: Number(form.price),
      active: true,
      options,
    });
    setItemForms((prev) => ({ ...prev, [categoryId]: { name: "", price: "", options: "" } }));
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className={clsx("mb-2 font-display text-lg font-semibold text-burgundy", urdu && "font-urdu")}>
          {t("menuAdmin.newCategory")}
        </h3>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder={t("menuAdmin.categoryPlaceholder")}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <button
            className={clsx("btn-primary whitespace-nowrap", urdu && "font-urdu text-base")}
            disabled={!categoryName}
            onClick={() => createCategory.mutate({ name: categoryName, position: categories?.length ?? 0 })}
          >
            {t("menuAdmin.add")}
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-700">{error}</p>}

      {categories?.map((category) => (
        <div key={category.id} className="card">
          <h3 className="font-display text-lg font-semibold text-burgundy">{category.name}</h3>
          <div className="mt-2 divide-y divide-burgundy/10">
            {category.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className={item.active ? "font-medium text-burgundy" : "font-medium text-burgundy/40 line-through"}>
                    {item.name}
                  </p>
                  {item.options.length > 0 && (
                    <p className="text-xs text-burgundy/50">{item.options.map((o) => o.name).join(", ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gold-dark">{formatMoney(item.price)}</span>
                  {item.active && (
                    <button
                      className={clsx("text-sm text-red-600", urdu && "font-urdu text-base")}
                      onClick={() => deactivateItem.mutate(item.id)}
                    >
                      {t("menuAdmin.deactivate")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              className="input sm:col-span-2"
              placeholder={t("menuAdmin.dishName")}
              value={itemForms[category.id]?.name ?? ""}
              onChange={(e) => updateForm(category.id, "name", e.target.value)}
            />
            <input
              className="input"
              placeholder={t("menuAdmin.price")}
              type="number"
              step="0.01"
              value={itemForms[category.id]?.price ?? ""}
              onChange={(e) => updateForm(category.id, "price", e.target.value)}
            />
            <input
              className="input"
              placeholder={t("menuAdmin.options")}
              value={itemForms[category.id]?.options ?? ""}
              onChange={(e) => updateForm(category.id, "options", e.target.value)}
            />
          </div>
          <button
            className={clsx("btn-outline mt-2", urdu && "font-urdu text-base")}
            onClick={() => submitItem(category.id)}
          >
            {t("menuAdmin.addDish")}
          </button>
        </div>
      ))}
    </div>
  );
}

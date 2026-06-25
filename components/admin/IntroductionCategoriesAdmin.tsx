"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  isActive: boolean;
};

export function IntroductionCategoriesAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || undefined }),
    });
    if (!res.ok) {
      toast.error("Could not create category");
      return;
    }
    toast.success("Category created");
    setName("");
    setDescription("");
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    load();
  }

  if (loading) return null;

  return (
    <div className="card p-6 space-y-4 mt-6">
      <h2 className="font-semibold">Introduction Categories</h2>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-2 text-sm border border-border rounded-lg px-3 py-2"
          >
            <div>
              <span className="font-medium">{c.name}</span>
              {c.isSystem && (
                <span className="text-xs text-muted-foreground ml-2">system</span>
              )}
              {!c.isActive && (
                <span className="text-xs text-destructive ml-2">disabled</span>
              )}
            </div>
            {!c.isSystem && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleActive(c.id, c.isActive)}
              >
                {c.isActive ? "Disable" : "Enable"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="space-y-2 pt-2 border-t border-border">
        <Input
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" size="sm">
          Create category
        </Button>
      </form>
    </div>
  );
}

import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, X } from "lucide-react";

interface ProductForm {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  category: string;
  flavors: string[];
  available: boolean;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  category: "Pastéis",
  flavors: [],
  available: true,
};

export default function AdminProducts() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [newFlavor, setNewFlavor] = useState("");

  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.product.list.useQuery();

  const createMutation = trpc.product.create.useMutation({
    onSuccess: () => {
      toast.success("Produto criado com sucesso!");
      utils.product.list.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.product.update.useMutation({
    onSuccess: () => {
      toast.success("Produto atualizado!");
      utils.product.list.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.product.delete.useMutation({
    onSuccess: () => {
      toast.success("Produto excluído!");
      utils.product.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const openDialog = (product?: any) => {
    if (product) {
      setEditingId(product.id);
      setForm({
        name: product.name,
        description: product.description || "",
        price: product.price,
        imageUrl: product.imageUrl || "",
        category: product.category || "Pastéis",
        flavors: product.flavors || [],
        available: product.available,
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingId(null);
    setForm(emptyForm);
    setNewFlavor("");
  };

  const handleSubmit = () => {
    if (!form.name || !form.price) {
      toast.error("Nome e preço são obrigatórios");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        ...form,
        flavors: form.flavors.length > 0 ? form.flavors : undefined,
      });
    } else {
      createMutation.mutate({
        ...form,
        flavors: form.flavors.length > 0 ? form.flavors : undefined,
      });
    }
  };

  const addFlavor = () => {
    if (newFlavor.trim() && !form.flavors.includes(newFlavor.trim())) {
      setForm({ ...form, flavors: [...form.flavors, newFlavor.trim()] });
      setNewFlavor("");
    }
  };

  const removeFlavor = (flavor: string) => {
    setForm({ ...form, flavors: form.flavors.filter((f) => f !== flavor) });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      deleteMutation.mutate({ id });
    }
  };

  // Agrupa produtos por categoria
  const productsByCategory = products?.reduce((acc: Record<string, any[]>, product) => {
    const cat = product.category || "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {}) || {};

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Produtos</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Gerencie o cardápio
            </p>
          </div>
          <Button onClick={() => openDialog()} className="btn-primary">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo Produto</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : products?.length === 0 ? (
          <Card className="card-accessible">
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                Nenhum produto cadastrado
              </p>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Produto
              </Button>
            </CardContent>
          </Card>
        ) : (
          Object.entries(productsByCategory).map(([category, categoryProducts]) => (
            <Card key={category} className="card-accessible">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg sm:text-xl">{category}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryProducts.map((product: any) => (
                    <div
                      key={product.id}
                      className={`border rounded-xl overflow-hidden bg-card ${
                        !product.available ? "opacity-60" : ""
                      }`}
                    >
                      {product.imageUrl && (
                        <div className="h-28 sm:h-32 bg-muted">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-3 sm:p-4">
                        {/* Nome e Status */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-sm sm:text-base line-clamp-1 flex-1">
                            {product.name}
                          </h3>
                          <Badge 
                            variant={product.available ? "default" : "secondary"}
                            className="shrink-0 text-xs"
                          >
                            {product.available ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>

                        {/* Preço - Destaque */}
                        <div className="mb-3">
                          <p className="text-xl sm:text-2xl font-bold text-primary">
                            R$ {parseFloat(product.price).toFixed(2)}
                          </p>
                        </div>

                        {/* Descrição */}
                        {product.description && (
                          <p className="text-xs sm:text-sm text-muted-foreground mb-3 line-clamp-2">
                            {product.description}
                          </p>
                        )}

                        {/* Sabores */}
                        {product.flavors && product.flavors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {product.flavors.slice(0, 3).map((flavor: string) => (
                              <Badge key={flavor} variant="outline" className="text-xs">
                                {flavor}
                              </Badge>
                            ))}
                            {product.flavors.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{product.flavors.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Botões de Ação - Separados do preço */}
                        <div className="flex gap-2 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => openDialog(product)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 px-3"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Product Form Dialog */}
        <Dialog open={showDialog} onOpenChange={closeDialog}>
          <DialogContent className="dialog-content sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {editingId ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="label-accessible">Nome *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Pastel"
                  className="input-accessible"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className="label-accessible">Preço *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="8.00"
                    className="input-accessible"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="label-accessible">Categoria</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Pastéis"
                    className="input-accessible"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="label-accessible">Descrição</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descrição do produto..."
                  className="textarea-accessible min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl" className="label-accessible">URL da Imagem</Label>
                <Input
                  id="imageUrl"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="input-accessible"
                />
              </div>

              <div className="space-y-2">
                <Label className="label-accessible">Sabores (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newFlavor}
                    onChange={(e) => setNewFlavor(e.target.value)}
                    placeholder="Adicionar sabor..."
                    className="input-accessible"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFlavor();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addFlavor}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {form.flavors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.flavors.map((flavor) => (
                      <Badge key={flavor} variant="secondary" className="gap-1 pr-1">
                        {flavor}
                        <button
                          type="button"
                          onClick={() => removeFlavor(flavor)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Switch
                  id="available"
                  checked={form.available}
                  onCheckedChange={(checked) => setForm({ ...form, available: checked })}
                />
                <Label htmlFor="available" className="cursor-pointer">
                  Produto disponível para venda
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : editingId
                  ? "Salvar Alterações"
                  : "Criar Produto"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

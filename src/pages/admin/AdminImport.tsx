import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import {
  Upload, FileSpreadsheet, FileJson, Image, CheckCircle2, XCircle,
  AlertTriangle, Loader2, ArrowRight, RotateCcw, Download, Eye,
  Package, Tag, Layers, BarChart3, FolderOpen, Plus, X, Files,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

/* ── Types ── */
interface PreviewResult {
  field_mapping: Record<string, string>;
  category_mapping: Record<string, string>;
  total_categories: number;
  total_products: number;
  total_variants: number;
  total_json_fallback: number;
  conflicts: { type: string; sku?: string; slug?: string; sugestao?: string }[];
  sample_products: { slug: string; name: string; variants: number; category: string }[];
  images_available: number;
}

interface ExecuteResult {
  job_id: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface JobReport {
  job: any;
  items: any[];
}

type Step = "upload" | "preview" | "executing" | "result";

/* ── Component ── */
const AdminImport = () => {
  const [step, setStep] = useState<Step>("upload");
  const [csvProductFiles, setCsvProductFiles] = useState<{ name: string; content: string }[]>([]);
  const [csvCategoryFiles, setCsvCategoryFiles] = useState<{ name: string; content: string }[]>([]);
  const [jsonProductFiles, setJsonProductFiles] = useState<{ name: string; content: string }[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});
  const [uploadingImages, setUploadingImages] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [report, setReport] = useState<JobReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);

  // Past imports
  const { data: pastJobs = [], refetch: refetchJobs } = useQuery({
    queryKey: ["import-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("import_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  /* ── Helpers ── */
  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file, "UTF-8");
    });

  const mergedCsvProducts = () => csvProductFiles.map((f) => f.content).join("\n");
  const mergedCsvCategories = () => csvCategoryFiles.map((f) => f.content).join("\n");
  const mergedJsonProducts = () => {
    if (jsonProductFiles.length === 0) return null;
    if (jsonProductFiles.length === 1) return jsonProductFiles[0].content;
    // Merge multiple JSON arrays
    try {
      const allProducts: any[] = [];
      for (const f of jsonProductFiles) {
        const parsed = JSON.parse(f.content);
        const arr = Array.isArray(parsed) ? parsed : parsed.products || [];
        allProducts.push(...arr);
      }
      return JSON.stringify(allProducts);
    } catch {
      return jsonProductFiles[0].content;
    }
  };

  /* ── Classify and add files ── */
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    let csvProdCount = 0, csvCatCount = 0, jsonCount = 0, imgCount = 0;

    for (const file of fileArr) {
      const name = file.name.toLowerCase();

      if (file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name)) {
        imgCount++;
        continue; // images handled separately below
      }

      if (name.endsWith(".csv")) {
        const content = await readFile(file);
        if (name.includes("categori")) {
          setCsvCategoryFiles((prev) => [...prev, { name: file.name, content }]);
          csvCatCount++;
        } else {
          setCsvProductFiles((prev) => [...prev, { name: file.name, content }]);
          csvProdCount++;
        }
      } else if (name.endsWith(".json")) {
        const content = await readFile(file);
        setJsonProductFiles((prev) => [...prev, { name: file.name, content }]);
        jsonCount++;
      }
    }

    // Images
    const imgs = fileArr.filter((f) =>
      f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name)
    );
    if (imgs.length > 0) {
      setImageFiles((prev) => [...prev, ...imgs]);
      imgCount = imgs.length;
    }

    const parts: string[] = [];
    if (csvProdCount) parts.push(`${csvProdCount} CSV(s) de produtos`);
    if (csvCatCount) parts.push(`${csvCatCount} CSV(s) de categorias`);
    if (jsonCount) parts.push(`${jsonCount} JSON(s)`);
    if (imgCount) parts.push(`${imgCount} imagens`);
    if (parts.length > 0) toast.success(`Adicionados: ${parts.join(", ")}`);
  }, []);

  /* ── Individual zone handlers ── */
  const handleCsvProductFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const content = await readFile(file);
      setCsvProductFiles((prev) => [...prev, { name: file.name, content }]);
    }
    toast.success(`${files.length} CSV(s) de produtos adicionados`);
    e.target.value = "";
  }, []);

  const handleCsvCategoryFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const content = await readFile(file);
      setCsvCategoryFiles((prev) => [...prev, { name: file.name, content }]);
    }
    toast.success(`${files.length} CSV(s) de categorias adicionados`);
    e.target.value = "";
  }, []);

  const handleJsonFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const content = await readFile(file);
      setJsonProductFiles((prev) => [...prev, { name: file.name, content }]);
    }
    toast.success(`${files.length} JSON(s) adicionados`);
    e.target.value = "";
  }, []);

  const handleImageFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imgs = Array.from(files).filter((f) =>
      f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name)
    );
    setImageFiles((prev) => [...prev, ...imgs]);
    toast.success(`${imgs.length} imagens adicionadas`);
    e.target.value = "";
  }, []);

  /* ── Drag & Drop ── */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const allFiles: File[] = [];

    // Support folder drops via webkitGetAsEntry
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }

    if (entries.length > 0) {
      const readEntry = (entry: FileSystemEntry): Promise<File[]> =>
        new Promise((resolve) => {
          if (entry.isFile) {
            (entry as FileSystemFileEntry).file((f) => resolve([f]));
          } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            reader.readEntries(async (subEntries) => {
              const results: File[] = [];
              for (const sub of subEntries) {
                const files = await readEntry(sub);
                results.push(...files);
              }
              resolve(results);
            });
          } else {
            resolve([]);
          }
        });

      for (const entry of entries) {
        const files = await readEntry(entry);
        allFiles.push(...files);
      }
    } else {
      allFiles.push(...Array.from(e.dataTransfer.files));
    }

    if (allFiles.length > 0) {
      await processFiles(allFiles);
    }
  }, [processFiles]);

  /* ── Upload images to storage ── */
  const uploadImages = async (): Promise<Record<string, string>> => {
    if (imageFiles.length === 0) return {};
    setUploadingImages(true);
    const map: Record<string, string> = {};
    const timestamp = Date.now();

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const compressed = await compressImage(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      // Mantém safeName como chave, mas troca extensão p/ casar com o tipo após compressão
      const compressedExt = compressed.name.split(".").pop();
      const safeNameNoExt = safeName.replace(/\.[^.]+$/, "");
      const storedName = `${safeNameNoExt}.${compressedExt}`;
      const path = `imports/${timestamp}/${storedName}`;

      try {
        const { error } = await supabase.storage.from("product-images").upload(path, compressed, {
          cacheControl: "3600",
          upsert: true,
          contentType: compressed.type,
        });
        if (error) {
          console.error(`Upload failed for ${file.name}:`, error.message);
          continue;
        }
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        map[file.name] = urlData.publicUrl;
        map[safeName] = urlData.publicUrl;
        map[`imagens/${file.name}`] = urlData.publicUrl;
        map[`images/${file.name}`] = urlData.publicUrl;
      } catch (err) {
        console.error(`Upload error for ${file.name}:`, err);
      }
    }

    setImagesMap(map);
    setUploadingImages(false);
    toast.success(`${Object.keys(map).length / 4} imagens enviadas ao storage`);
    return map;
  };

  /* ── Actions ── */
  const doPreview = async () => {
    const csv = mergedCsvProducts();
    if (!csv) {
      toast.error("Envie pelo menos um CSV de produtos");
      return;
    }
    setLoading(true);
    try {
      let imgMap = imagesMap;
      if (imageFiles.length > 0 && Object.keys(imagesMap).length === 0) {
        imgMap = await uploadImages();
      }
      const { data, error } = await supabase.functions.invoke("import-catalog", {
        body: {
          csv_products: csv,
          csv_categories: mergedCsvCategories() || null,
          json_products: mergedJsonProducts(),
          images_map: imgMap,
          file_name: csvProductFiles.map((f) => f.name).join(", "),
        },
      });
      if (error) throw error;
      setPreview(data as PreviewResult);
      setStep("preview");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar preview");
    } finally {
      setLoading(false);
    }
  };

  const doExecute = async () => {
    setStep("executing");
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-catalog?action=execute`;
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          csv_products: mergedCsvProducts(),
          csv_categories: mergedCsvCategories() || null,
          json_products: mergedJsonProducts(),
          images_map: imagesMap,
          file_name: csvProductFiles.map((f) => f.name).join(", "),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro");
      setResult(data as ExecuteResult);
      setStep("result");
      refetchJobs();
      toast.success("Importação concluída!");
    } catch (err: any) {
      toast.error(err.message || "Erro na importação");
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const doRollback = async (jobId: string) => {
    if (!confirm("Deseja reverter esta importação? Produtos e variantes criados serão excluídos.")) return;
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-catalog?action=rollback&jobId=${jobId}`;
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      toast.success(`Rollback: ${data.rolled_back} itens revertidos`);
      refetchJobs();
    } catch (err: any) {
      toast.error(err.message || "Erro no rollback");
    } finally {
      setLoading(false);
    }
  };

  const viewReport = async (jobId: string) => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-catalog?action=report&jobId=${jobId}`;
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      setReport(data as JobReport);
    } catch (err: any) {
      toast.error("Erro ao carregar relatório");
    }
  };

  const resetAll = () => {
    setStep("upload");
    setCsvProductFiles([]);
    setCsvCategoryFiles([]);
    setJsonProductFiles([]);
    setImageFiles([]);
    setImagesMap({});
    setPreview(null);
    setResult(null);
    setReport(null);
  };

  const removeFile = (type: string, index: number) => {
    if (type === "csv-prod") setCsvProductFiles((prev) => prev.filter((_, i) => i !== index));
    if (type === "csv-cat") setCsvCategoryFiles((prev) => prev.filter((_, i) => i !== index));
    if (type === "json") setJsonProductFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const totalFiles = csvProductFiles.length + csvCategoryFiles.length + jsonProductFiles.length + imageFiles.length;

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Upload size={16} className="text-primary" /> Importação de Catálogo
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Importe produtos, variantes e categorias via CSV/JSON
          </p>
        </div>
        {step !== "upload" && (
          <Button variant="outline" size="sm" onClick={resetAll} className="text-xs">
            <RotateCcw size={14} className="mr-1" /> Nova importação
          </Button>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs">
        {["Upload", "Preview", "Executando", "Resultado"].map((label, i) => {
          const steps: Step[] = ["upload", "preview", "executing", "result"];
          const active = steps.indexOf(step) >= i;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${active ? "bg-primary" : "bg-border"}`} />}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                active ? "bg-primary/15 text-primary font-medium" : "bg-secondary text-muted-foreground"
              }`}>
                <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">
                  {i + 1}
                </span>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="glass-card p-6 space-y-5">
          {/* Unified Drop Zone */}
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all ${
              isDragging
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-border hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <Files size={36} className={isDragging ? "text-primary" : "text-muted-foreground"} />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Arraste e solte todos os arquivos e pastas aqui
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSVs, JSONs e imagens — tudo de uma vez. Pastas são processadas recursivamente.
              </p>
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                <Plus size={14} /> Selecionar Arquivos
                <input
                  type="file"
                  multiple
                  accept=".csv,.json,image/*"
                  className="hidden"
                  onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
                />
              </label>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                <FolderOpen size={14} /> Selecionar Pastas
                {/* @ts-ignore - webkitdirectory is valid but not in TS types */}
                <input
                  type="file"
                  multiple
                  // @ts-ignore
                  webkitdirectory=""
                  className="hidden"
                  onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
                />
              </label>
            </div>
          </div>

          {/* Individual zones (click to add more) */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CSV Produtos */}
            <label className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${
              csvProductFiles.length > 0 ? "border-primary/30 bg-primary/5" : "border-border"
            }`}>
              <FileSpreadsheet size={28} className={csvProductFiles.length > 0 ? "text-primary" : "text-muted-foreground"} />
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">
                  {csvProductFiles.length > 0 ? `✓ ${csvProductFiles.length} CSV(s) de produtos` : "CSV de Produtos"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {csvProductFiles.length > 0
                    ? csvProductFiles.map((f) => f.name).join(", ")
                    : "Selecione um ou mais CSVs"}
                </p>
              </div>
              <input type="file" accept=".csv" multiple className="hidden" onChange={handleCsvProductFiles} />
            </label>

            {/* CSV Categorias */}
            <label className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${
              csvCategoryFiles.length > 0 ? "border-primary/30 bg-primary/5" : "border-border"
            }`}>
              <Tag size={28} className={csvCategoryFiles.length > 0 ? "text-primary" : "text-muted-foreground"} />
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">
                  {csvCategoryFiles.length > 0 ? `✓ ${csvCategoryFiles.length} CSV(s) de categorias` : "CSV de Categorias"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {csvCategoryFiles.length > 0
                    ? csvCategoryFiles.map((f) => f.name).join(", ")
                    : "Selecione um ou mais CSVs"}
                </p>
              </div>
              <input type="file" accept=".csv" multiple className="hidden" onChange={handleCsvCategoryFiles} />
            </label>

            {/* JSON */}
            <label className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${
              jsonProductFiles.length > 0 ? "border-primary/30 bg-primary/5" : "border-border"
            }`}>
              <FileJson size={28} className={jsonProductFiles.length > 0 ? "text-primary" : "text-muted-foreground"} />
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">
                  {jsonProductFiles.length > 0 ? `✓ ${jsonProductFiles.length} JSON(s)` : "JSON (opcional)"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {jsonProductFiles.length > 0
                    ? jsonProductFiles.map((f) => f.name).join(", ")
                    : "Selecione um ou mais JSONs"}
                </p>
              </div>
              <input type="file" accept=".json" multiple className="hidden" onChange={handleJsonFiles} />
            </label>

            {/* Imagens */}
            <label className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${
              imageFiles.length > 0 ? "border-primary/30 bg-primary/5" : "border-border"
            }`}>
              <FolderOpen size={28} className={imageFiles.length > 0 ? "text-primary" : "text-muted-foreground"} />
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">
                  {imageFiles.length > 0 ? `✓ ${imageFiles.length} imagens` : "Imagens"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {imageFiles.length > 0
                    ? `${(imageFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB`
                    : "Selecione múltiplas imagens"}
                </p>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageFiles} />
            </label>
          </div>

          {/* File list */}
          {totalFiles > 0 && (
            <div className="glass-card p-4 !bg-secondary/30 space-y-2">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Files size={13} className="text-primary" /> {totalFiles} arquivo(s) carregados
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {csvProductFiles.map((f, i) => (
                  <span key={`cp-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                    <FileSpreadsheet size={10} /> {f.name}
                    <button onClick={(e) => { e.preventDefault(); removeFile("csv-prod", i); }} className="hover:text-destructive">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {csvCategoryFiles.map((f, i) => (
                  <span key={`cc-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/30 text-accent-foreground text-[10px] font-medium">
                    <Tag size={10} /> {f.name}
                    <button onClick={(e) => { e.preventDefault(); removeFile("csv-cat", i); }} className="hover:text-destructive">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {jsonProductFiles.map((f, i) => (
                  <span key={`j-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-medium">
                    <FileJson size={10} /> {f.name}
                    <button onClick={(e) => { e.preventDefault(); removeFile("json", i); }} className="hover:text-destructive">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {imageFiles.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                    <Image size={10} /> {imageFiles.length} imagens ({(imageFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB)
                    <button onClick={(e) => { e.preventDefault(); setImageFiles([]); }} className="hover:text-destructive">
                      <X size={10} />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="glass-card p-4 !bg-secondary/30">
            <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-warning" /> Formato esperado
            </h4>
            <div className="grid md:grid-cols-2 gap-3 text-[11px] text-muted-foreground">
              <div>
                <p className="font-medium text-foreground/80 mb-1">CSV de Produtos (separador: ;)</p>
                <code className="block bg-background/50 p-2 rounded text-[10px] font-mono overflow-x-auto">
                  nome;slug;descricao;preco;categoria;sku;status;imagem;galeria_imagens;opcao1_nome;opcao1_valor
                </code>
              </div>
              <div>
                <p className="font-medium text-foreground/80 mb-1">CSV de Categorias (separador: ;)</p>
                <code className="block bg-background/50 p-2 rounded text-[10px] font-mono overflow-x-auto">
                  nome;slug;status
                </code>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              A IA auto-detecta colunas mesmo com nomes diferentes (ex: "titulo" → "name", "preco" → "price").
              Galeria separada por <code>|</code>. Status: Ativo/Inativo.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={doPreview} disabled={csvProductFiles.length === 0 || loading} className="gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
              Gerar Preview
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card p-4 text-center">
              <Tag size={20} className="text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-foreground">{preview.total_categories}</div>
              <div className="text-xs text-muted-foreground">Categorias</div>
            </div>
            <div className="glass-card p-4 text-center">
              <Package size={20} className="text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-foreground">{preview.total_products}</div>
              <div className="text-xs text-muted-foreground">Produtos</div>
            </div>
            <div className="glass-card p-4 text-center">
              <Layers size={20} className="text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-foreground">{preview.total_variants}</div>
              <div className="text-xs text-muted-foreground">Variantes</div>
            </div>
            <div className="glass-card p-4 text-center">
              <Image size={20} className="text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-foreground">{preview.images_available}</div>
              <div className="text-xs text-muted-foreground">Imagens</div>
            </div>
          </div>

          {/* Field mapping */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Mapeamento de Campos (IA)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(preview.field_mapping).map(([orig, mapped]) => (
                <div key={orig} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 text-xs">
                  <span className="text-muted-foreground truncate">{orig}</span>
                  <ArrowRight size={10} className="text-primary shrink-0" />
                  <span className="font-medium text-foreground truncate">{mapped}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conflicts */}
          {preview.conflicts.length > 0 && (
            <div className="glass-card p-5 border-warning/20">
              <h3 className="text-sm font-semibold text-warning mb-3 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Conflitos detectados ({preview.conflicts.length})
              </h3>
              <div className="space-y-1.5">
                {preview.conflicts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-warning/5 text-xs">
                    <span className="text-warning font-medium">{c.type}</span>
                    {c.sku && <span className="text-muted-foreground">SKU: {c.sku}</span>}
                    {c.slug && <span className="text-muted-foreground">Slug: {c.slug}</span>}
                    {c.sugestao && <span className="text-foreground/70 ml-auto">→ {c.sugestao}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample products */}
          {preview.sample_products.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Amostra de Produtos</h3>
              <div className="space-y-1">
                {preview.sample_products.map((p) => (
                  <div key={p.slug} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 text-xs">
                    <div>
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-muted-foreground ml-2">/{p.slug}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{p.category}</span>
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {p.variants} var.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
              Voltar
            </Button>
            <Button onClick={doExecute} disabled={loading} className="gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Executar Importação
            </Button>
          </div>
        </div>
      )}

      {/* Step: Executing */}
      {step === "executing" && (
        <div className="glass-card p-12 flex flex-col items-center gap-4 text-center">
          <Loader2 size={40} className="text-primary animate-spin" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Importando catálogo...</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Processando categorias, produtos e variantes. Isso pode levar alguns minutos.
            </p>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === "result" && result && (
        <div className="space-y-4">
          <div className="glass-card p-6 text-center">
            <CheckCircle2 size={40} className="text-success mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Importação Concluída!</h3>
            <p className="text-xs text-muted-foreground">Job ID: {result.job_id}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold font-mono text-success">{result.created}</div>
              <div className="text-xs text-muted-foreground">Criados</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold font-mono text-primary">{result.updated}</div>
              <div className="text-xs text-muted-foreground">Atualizados</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold font-mono text-warning">{result.skipped}</div>
              <div className="text-xs text-muted-foreground">Ignorados</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-bold font-mono text-destructive">{result.errors}</div>
              <div className="text-xs text-muted-foreground">Erros</div>
            </div>
          </div>

          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => viewReport(result.job_id)} className="gap-1.5">
              <Eye size={13} /> Ver Relatório
            </Button>
            <Button variant="outline" size="sm" onClick={() => doRollback(result.job_id)} className="gap-1.5 text-destructive hover:text-destructive">
              <RotateCcw size={13} /> Rollback
            </Button>
          </div>
        </div>
      )}

      {/* Report modal */}
      {report && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Relatório Detalhado</h3>
            <Button variant="ghost" size="sm" onClick={() => setReport(null)} className="text-xs">
              Fechar
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {report.items?.map((item: any) => (
              <div key={item.id} className="flex items-center gap-2 p-2 rounded text-xs bg-secondary/30">
                <span className="text-muted-foreground w-8 shrink-0">#{item.line_number}</span>
                <span className={`w-16 shrink-0 font-medium ${
                  item.status === "success" ? "text-success"
                    : item.status === "error" ? "text-destructive"
                    : "text-warning"
                }`}>
                  {item.status === "success" ? "✓" : item.status === "error" ? "✗" : "⊘"} {item.action}
                </span>
                <span className="text-muted-foreground w-20 shrink-0">{item.entity_type}</span>
                <span className="text-foreground truncate flex-1">
                  {item.data?.name || item.data?.nome || item.data?.sku || "—"}
                </span>
                {item.error_message && (
                  <span className="text-destructive truncate max-w-[200px]">{item.error_message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past imports */}
      {pastJobs.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <BarChart3 size={14} className="text-primary" /> Importações Anteriores
          </h3>
          <div className="space-y-1">
            {pastJobs.map((job: any) => (
              <div key={job.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  job.status === "completed" ? "bg-success"
                    : job.status === "rolled_back" ? "bg-warning"
                    : "bg-muted-foreground"
                }`} />
                <span className="text-foreground font-medium truncate flex-1">
                  {job.file_name || "Importação"}
                </span>
                <span className="text-muted-foreground">
                  {format(new Date(job.created_at), "dd/MM HH:mm")}
                </span>
                <span className="text-success font-mono">+{job.created_count}</span>
                <span className="text-primary font-mono">↻{job.updated_count}</span>
                <span className="text-destructive font-mono">✗{job.error_count}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => viewReport(job.id)}>
                    <Eye size={12} />
                  </Button>
                  {job.status === "completed" && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => doRollback(job.id)}>
                      <RotateCcw size={12} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminImport;

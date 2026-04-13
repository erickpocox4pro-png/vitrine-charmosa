import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── helpers ── */
function fixEncoding(text: string): string {
  const replacements = new Map<string, string>([
    ["\u00C3\u00A1", "á"], ["\u00C3\u00A9", "é"], ["\u00C3\u00AD", "í"],
    ["\u00C3\u00B3", "ó"], ["\u00C3\u00BA", "ú"], ["\u00C3\u00A3", "ã"],
    ["\u00C3\u00B5", "õ"], ["\u00C3\u00A7", "ç"], ["\u00C3\u0089", "É"],
    ["\u00C3\u009A", "Ú"], ["\u00C3\u0080", "À"], ["\u00C3\u0082", "Â"],
    ["\u00C3\u0088", "È"], ["\u00C3\u008A", "Ê"], ["\u00C3\u008C", "Ì"],
    ["\u00C3\u008E", "Î"], ["\u00C3\u0092", "Ò"], ["\u00C3\u0094", "Ô"],
    ["\u00C3\u0099", "Ù"], ["\u00C3\u009B", "Û"], ["\u00C3\u00A2", "â"],
    ["\u00C3\u00AA", "ê"], ["\u00C3\u00AE", "î"], ["\u00C3\u00B4", "ô"],
    ["\u00C3\u00BB", "û"], ["\u00C3\u00A4", "ä"], ["\u00C3\u00AB", "ë"],
    ["\u00C3\u00AF", "ï"], ["\u00C3\u00B6", "ö"], ["\u00C3\u00BC", "ü"],
  ]);
  let fixed = text;
  for (const [broken, correct] of replacements) {
    fixed = fixed.replaceAll(broken, correct);
  }
  return fixed;
}

function parseCSV(raw: string): Record<string, string>[] {
  const text = fixEncoding(raw);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(";").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = values[i] || ""));
    return obj;
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* Auto-map fields */
const FIELD_MAP: Record<string, string[]> = {
  name: ["nome", "name", "titulo", "title", "produto", "product"],
  slug: ["slug", "handle", "url"],
  description: ["descricao", "description", "desc", "corpo_html", "body_html"],
  short_description: ["descricao_curta", "short_description", "resumo"],
  price: ["preco", "price", "valor", "preco_original", "variant_price"],
  original_price: ["preco_promocional", "compare_at_price", "preco_comparacao", "sale_price"],
  category: ["categoria", "category", "tipo", "type", "product_type"],
  sku: ["sku", "codigo", "code", "variant_sku"],
  status: ["status", "situacao", "ativo", "published"],
  image_url: ["imagem", "image", "image_src", "imagem_principal", "main_image"],
  gallery: ["galeria_imagens", "gallery", "images", "variant_image"],
  tags: ["tags", "etiquetas", "keywords"],
  brand: ["marca", "brand", "vendor", "fornecedor"],
  weight: ["peso", "weight", "variant_grams"],
  stock: ["estoque", "stock", "inventory", "variant_inventory_qty"],
  option1_name: ["opcao1_nome", "option1_name", "option1 name"],
  option1_value: ["opcao1_valor", "option1_value", "option1 value"],
  option2_name: ["opcao2_nome", "option2_name", "option2 name"],
  option2_value: ["opcao2_valor", "option2_value", "option2 value"],
  option3_name: ["opcao3_nome", "option3_name", "option3 name"],
  option3_value: ["opcao3_valor", "option3_value", "option3 value"],
};

function autoMapFields(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    for (const [canonical, aliases] of Object.entries(FIELD_MAP)) {
      if (aliases.includes(h) || h === canonical) {
        mapping[header] = canonical;
        break;
      }
    }
    if (!mapping[header]) mapping[header] = header;
  }
  return mapping;
}

function mapRow(row: Record<string, string>, fieldMapping: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [original, canonical] of Object.entries(fieldMapping)) {
    if (row[original] !== undefined) mapped[canonical] = row[original];
  }
  return mapped;
}

function statusToBool(val: string): boolean {
  const lower = val.toLowerCase().trim();
  return ["ativo", "active", "true", "1", "sim", "yes", "published"].includes(lower);
}

/* ── Main handler ── */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization") || "";

  // Admin check via anon client
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service client for writes
  const supabase = createClient(supabaseUrl, serviceKey);

  // Check admin role
  const { data: roleCheck } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!roleCheck) {
    return new Response(JSON.stringify({ error: "Sem permissão" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "preview";

    if (action === "report") {
      const jobId = url.searchParams.get("jobId");
      const { data: job } = await supabase.from("import_jobs").select("*").eq("id", jobId).single();
      const { data: items } = await supabase.from("import_job_items").select("*").eq("job_id", jobId).order("line_number");
      return new Response(JSON.stringify({ job, items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "rollback") {
      const jobId = url.searchParams.get("jobId");
      const { data: items } = await supabase
        .from("import_job_items")
        .select("*")
        .eq("job_id", jobId)
        .eq("status", "success")
        .eq("action", "created");

      let rolled = 0;
      if (items) {
        for (const item of items) {
          if (item.entity_type === "product_variant") {
            await supabase.from("product_variants").delete().eq("id", item.entity_id);
            rolled++;
          }
        }
        for (const item of items) {
          if (item.entity_type === "product") {
            await supabase.from("product_images").delete().eq("product_id", item.entity_id);
            await supabase.from("products").delete().eq("id", item.entity_id);
            rolled++;
          }
        }
        for (const item of items) {
          if (item.entity_type === "category") {
            await supabase.from("categories").delete().eq("id", item.entity_id);
            rolled++;
          }
        }
      }

      await supabase.from("import_jobs").update({ status: "rolled_back" }).eq("id", jobId);
      return new Response(JSON.stringify({ rolled_back: rolled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json();
    const { csv_products, csv_categories, json_products, images_map, file_name } = body;

    // Parse CSVs
    const productRows = csv_products ? parseCSV(csv_products) : [];
    const categoryRows = csv_categories ? parseCSV(csv_categories) : [];

    // Auto-map fields
    const prodHeaders = productRows.length > 0 ? Object.keys(productRows[0]) : [];
    const catHeaders = categoryRows.length > 0 ? Object.keys(categoryRows[0]) : [];
    const prodMapping = autoMapFields(prodHeaders);
    const catMapping = autoMapFields(catHeaders);

    // Map rows
    const mappedProducts = productRows.map((r) => mapRow(r, prodMapping));
    const mappedCategories = categoryRows.map((r) => mapRow(r, catMapping));

    // Also parse JSON fallback
    let jsonFallback: any[] = [];
    if (json_products) {
      try {
        const parsed = JSON.parse(json_products);
        jsonFallback = Array.isArray(parsed) ? parsed : parsed.products || [];
      } catch { /* ignore */ }
    }

    // Group products by slug
    const productGroups: Record<string, typeof mappedProducts> = {};
    for (const row of mappedProducts) {
      const name = row.name || "";
      const slug = row.slug || slugify(name);
      if (!slug) continue;
      if (!productGroups[slug]) productGroups[slug] = [];
      productGroups[slug].push({ ...row, slug });
    }

    // Detect conflicts
    const conflicts: any[] = [];
    const skusSeen = new Set<string>();
    for (const [slug, rows] of Object.entries(productGroups)) {
      for (const row of rows) {
        if (row.sku) {
          if (skusSeen.has(row.sku)) {
            conflicts.push({ type: "sku_duplicado", sku: row.sku, slug });
          }
          skusSeen.add(row.sku);
        }
      }
    }

    // Check existing slugs
    const slugs = Object.keys(productGroups);
    if (slugs.length > 0) {
      const { data: existing } = await supabase
        .from("products")
        .select("slug")
        .in("slug", slugs);
      if (existing) {
        for (const e of existing) {
          conflicts.push({ type: "slug_existente", slug: e.slug, sugestao: "Será atualizado (upsert)" });
        }
      }
    }

    // Preview
    const preview = {
      field_mapping: prodMapping,
      category_mapping: catMapping,
      total_categories: mappedCategories.length,
      total_products: Object.keys(productGroups).length,
      total_variants: mappedProducts.length,
      total_json_fallback: jsonFallback.length,
      conflicts,
      sample_products: Object.entries(productGroups).slice(0, 5).map(([slug, rows]) => ({
        slug,
        name: rows[0].name,
        variants: rows.length,
        category: rows[0].category,
      })),
      images_available: images_map ? Object.keys(images_map).length : 0,
    };

    if (action === "preview") {
      return new Response(JSON.stringify(preview), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute import
    if (action === "execute") {
      // Create job
      const { data: job } = await supabase
        .from("import_jobs")
        .insert({
          admin_user_id: user.id,
          status: "processing",
          file_name: file_name || "import",
          total_items: mappedProducts.length + mappedCategories.length,
        })
        .select()
        .single();

      const jobId = job!.id;
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const jobItems: any[] = [];

      // 1. Import categories
      for (let i = 0; i < mappedCategories.length; i++) {
        const cat = mappedCategories[i];
        const catSlug = cat.slug || slugify(cat.name || "");
        if (!catSlug || !cat.name) {
          errorCount++;
          jobItems.push({
            job_id: jobId, line_number: i + 1, entity_type: "category",
            action: "skipped", status: "error", error_message: "Nome ou slug ausente",
            data: cat,
          });
          continue;
        }

        const { data: existing } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", catSlug)
          .maybeSingle();

        if (existing) {
          await supabase.from("categories").update({
            name: cat.name,
            is_active: cat.status ? statusToBool(cat.status) : true,
          }).eq("id", existing.id);
          updatedCount++;
          jobItems.push({
            job_id: jobId, line_number: i + 1, entity_type: "category",
            entity_id: existing.id, action: "updated", status: "success", data: cat,
          });
        } else {
          const { data: newCat } = await supabase
            .from("categories")
            .insert({ name: cat.name, slug: catSlug, is_active: cat.status ? statusToBool(cat.status) : true })
            .select()
            .single();
          createdCount++;
          jobItems.push({
            job_id: jobId, line_number: i + 1, entity_type: "category",
            entity_id: newCat?.id, action: "created", status: "success", data: cat,
          });
        }
      }

      // 2. Import products
      let lineNum = mappedCategories.length;
      for (const [slug, rows] of Object.entries(productGroups)) {
        lineNum++;
        const main = rows[0];
        const name = main.name;
        if (!name) {
          errorCount++;
          jobItems.push({
            job_id: jobId, line_number: lineNum, entity_type: "product",
            action: "skipped", status: "error", error_message: "Nome ausente", data: main,
          });
          continue;
        }

        // Resolve category
        let categoryId: string | null = null;
        let categoryName = main.category || "Sem categoria";
        if (main.category) {
          const catSlug = slugify(main.category);
          const { data: catData } = await supabase
            .from("categories")
            .select("id")
            .eq("slug", catSlug)
            .maybeSingle();
          if (catData) categoryId = catData.id;
        }

        // Resolve image
        let imageUrl = main.image_url || "";
        if (images_map && imageUrl && images_map[imageUrl]) {
          imageUrl = images_map[imageUrl];
        }
        if (!imageUrl) imageUrl = "/placeholder.svg";

        const price = parseFloat(main.price || "0") || 0;
        const originalPrice = main.original_price ? parseFloat(main.original_price) || null : null;
        const isActive = main.status ? statusToBool(main.status) : true;

        // Check existing product
        const { data: existingProd } = await supabase
          .from("products")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        let productId: string;

        if (existingProd) {
          await supabase.from("products").update({
            name, description: main.description || "",
            short_description: main.short_description || "",
            price, original_price: originalPrice,
            category: categoryName, category_id: categoryId,
            image_url: imageUrl, is_active: isActive,
            brand: main.brand || "", tags: main.tags ? main.tags.split(",").map((t: string) => t.trim()) : [],
            weight: main.weight ? parseFloat(main.weight) : null,
          }).eq("id", existingProd.id);
          productId = existingProd.id;
          updatedCount++;
          jobItems.push({
            job_id: jobId, line_number: lineNum, entity_type: "product",
            entity_id: productId, action: "updated", status: "success", data: main,
          });
        } else {
          const { data: newProd, error: prodErr } = await supabase
            .from("products")
            .insert({
              name, slug, description: main.description || "",
              short_description: main.short_description || "",
              price, original_price: originalPrice,
              category: categoryName, category_id: categoryId,
              image_url: imageUrl, is_active: isActive,
              brand: main.brand || "", tags: main.tags ? main.tags.split(",").map((t: string) => t.trim()) : [],
              weight: main.weight ? parseFloat(main.weight) : null,
            })
            .select()
            .single();

          if (prodErr || !newProd) {
            errorCount++;
            jobItems.push({
              job_id: jobId, line_number: lineNum, entity_type: "product",
              action: "created", status: "error",
              error_message: prodErr?.message || "Erro ao criar produto", data: main,
            });
            continue;
          }
          productId = newProd.id;
          createdCount++;
          jobItems.push({
            job_id: jobId, line_number: lineNum, entity_type: "product",
            entity_id: productId, action: "created", status: "success", data: main,
          });
        }

        // Gallery images
        const galleryStr = main.gallery || "";
        if (galleryStr) {
          const galleryImages = galleryStr.split("|").map((u: string) => u.trim()).filter(Boolean);
          for (let gi = 0; gi < galleryImages.length; gi++) {
            let gUrl = galleryImages[gi];
            if (images_map && images_map[gUrl]) gUrl = images_map[gUrl];
            await supabase.from("product_images").insert({
              product_id: productId, image_url: gUrl, sort_order: gi,
            });
          }
        }

        // 3. Create variants
        for (let vi = 0; vi < rows.length; vi++) {
          const vRow = rows[vi];
          lineNum++;
          const sku = vRow.sku || "";

          // Check existing variant by sku
          let variantExists = false;
          if (sku) {
            const { data: existingVar } = await supabase
              .from("product_variants")
              .select("id")
              .eq("product_id", productId)
              .ilike("name", sku)
              .maybeSingle();
            variantExists = !!existingVar;
          }

          const variantName = [
            vRow.option1_value, vRow.option2_value, vRow.option3_value,
          ].filter(Boolean).join(" / ") || sku || "Padrão";

          const variantPrice = parseFloat(vRow.price || "0") || price;
          const variantStock = parseInt(vRow.stock || "0") || 0;
          const variantActive = vRow.status ? statusToBool(vRow.status) : true;

          let variantImageUrl: string | undefined;
          if (vRow.gallery && images_map && images_map[vRow.gallery]) {
            variantImageUrl = images_map[vRow.gallery];
          }

          if (variantExists) {
            skippedCount++;
            jobItems.push({
              job_id: jobId, line_number: lineNum, entity_type: "product_variant",
              action: "skipped", status: "skipped",
              error_message: "Variante já existe", data: vRow,
            });
            continue;
          }

          const { data: newVar, error: varErr } = await supabase
            .from("product_variants")
            .insert({
              product_id: productId,
              name: variantName,
              size: vRow.option1_name === "Tamanho" || vRow.option1_name === "Size" ? vRow.option1_value : (vRow.size || null),
              color: vRow.option1_name === "Cor" || vRow.option1_name === "Color" ? vRow.option1_value : (vRow.color || null),
              price: variantPrice,
              stock: variantStock,
              is_active: variantActive,
            })
            .select()
            .single();

          if (varErr || !newVar) {
            errorCount++;
            jobItems.push({
              job_id: jobId, line_number: lineNum, entity_type: "product_variant",
              action: "created", status: "error",
              error_message: varErr?.message || "Erro ao criar variante", data: vRow,
            });
          } else {
            createdCount++;
            jobItems.push({
              job_id: jobId, line_number: lineNum, entity_type: "product_variant",
              entity_id: newVar.id, action: "created", status: "success", data: vRow,
            });

            // Variant image
            if (variantImageUrl) {
              await supabase.from("product_images").insert({
                product_id: productId, variant_id: newVar.id,
                image_url: variantImageUrl, sort_order: 0,
              });
            }
          }
        }
      }

      // Save job items in batches
      const BATCH = 100;
      for (let i = 0; i < jobItems.length; i += BATCH) {
        await supabase.from("import_job_items").insert(jobItems.slice(i, i + BATCH));
      }

      // Update job
      await supabase.from("import_jobs").update({
        status: "completed",
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        completed_at: new Date().toISOString(),
        summary: {
          total_categories: mappedCategories.length,
          total_products: Object.keys(productGroups).length,
          total_variants: mappedProducts.length,
        },
      }).eq("id", jobId);

      return new Response(JSON.stringify({
        job_id: jobId,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

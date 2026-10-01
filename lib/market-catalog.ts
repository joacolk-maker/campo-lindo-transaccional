import { PRODUCTS } from './market';

type SeasonalityRow = [number, number, number, number, number, number, number, number[]];
type SeasonalitySnapshot = {
  dimensions: {
    products: string[];
    varieties: string[];
    qualities: string[];
  };
  rows: SeasonalityRow[];
};

export type MarketCatalog = Record<string, Record<string, string[]>>;

const sourceUrl = 'https://joacolk-maker.github.io/campo-claro-odepa/data/seasonality-v2.json';

function fallbackCatalog(): MarketCatalog {
  return Object.fromEntries(PRODUCTS.map((product) => [product, { 'Sin especificar': ['Primera', 'Segunda', 'Sin especificar'] }]));
}

export async function loadMarketCatalog(): Promise<MarketCatalog> {
  const response = await fetch(sourceUrl, { cache: 'force-cache' });
  if (!response.ok) throw new Error('No fue posible cargar el catálogo ODEPA');
  const snapshot = await response.json() as SeasonalitySnapshot;
  const allowedProducts = new Set<string>(PRODUCTS);
  const values = new Map<string, Map<string, Set<string>>>();

  snapshot.rows.forEach((row) => {
    const product = snapshot.dimensions.products[row[3]];
    const variety = snapshot.dimensions.varieties[row[4]];
    const quality = snapshot.dimensions.qualities[row[5]];
    if (!allowedProducts.has(product) || !variety || !quality) return;
    const varieties = values.get(product) ?? new Map<string, Set<string>>();
    const qualities = varieties.get(variety) ?? new Set<string>();
    qualities.add(quality);
    varieties.set(variety, qualities);
    values.set(product, varieties);
  });

  const catalog = fallbackCatalog();
  values.forEach((varieties, product) => {
    catalog[product] = Object.fromEntries([...varieties.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([variety, qualities]) => [variety, [...qualities].sort((a, b) => a.localeCompare(b, 'es'))]));
  });
  return catalog;
}

export { fallbackCatalog };

// The token radar's model, radar-2, rewritten: one sealed snapshot in, one ranked board out.
//
// The board ranks every slug on the snapshot's watchlist — the floor, never a ceiling —
// plus every other pre-token protocol the house rule would rank, the early rows the radar
// exists to find. A protocol counts as pre-token when its snapshot entry records no token
// at all: no market cap, no CoinGecko id, no symbol. Protocols whose token already trades
// are kept apart and shown at the market's own value, never mixed into the ranked board.
// Wrapped, staked and bridged products of a token that already trades are no launch
// candidates either, and the same rule that keeps them off the watchlist keeps them off
// the board.
//
// Implied value is built only from the snapshot's own figures:
//
//   catMultiple  median mcap/TVL of the live-token protocols in the same category (three
//                comparables at least, else the global median over all live-token
//                protocols), clamped to [0.05, 1.0]. A category's multiple is what the
//                market already pays for that kind of protocol, read out of this
//                snapshot, never a hand-written number.
//   base         tvl_usd times catMultiple
//   growth       change_7d clamped to [-60, 120] per cent
//   growthMult   1 + (growth / 100) times the growth weight
//   maturity     0.6 + min(age_days, 1095) / 1095 times 0.4 (age unknown: 365 days)
//   chainMult    1 + 0.04 times ln(chains), capped at 1.20: a protocol live on more
//                chains has more surface for a launch, but the effect stays small.
//   implied      max(1, round(base times growthMult times maturity times chainMult))
//
// The constants are the model's own, stated in the dashboard and changeable in the model
// sandbox. No protocol name is ever special-cased: the same function scores every row.

/** One protocol entry of the snapshot: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string; // the protocol's key in the snapshot
  name: string; // display name, as the snapshot spells it
  category: string | null; // its DefiLlama category, or null when the snapshot names none
  chains: string[]; // every chain the protocol runs on
  tvl_usd: number; // total value locked, in dollars
  change_7d: number | null; // TVL change over seven days, in per cent, or null
  mcap_usd: number | null; // market cap, in dollars, or null when there is no token
  listed_at: string | null; // first listing date, YYYY-MM-DD, or null
  gecko_id: string | null; // CoinGecko id, or null when there is no token
  symbol: string | null; // token symbol, or null when there is no token
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string; // the snapshot's date, YYYY-MM-DD
  source: string; // where the snapshot came from
  floor_usd: number; // the watchlist's TVL floor, in dollars
  protocols: SnapshotProtocol[]; // every protocol the snapshot carries
  watchlist: string[]; // the slugs the watchlist names
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  growth_weight: number; // how much a 7d move counts, per unit of clamped growth
  growth_floor: number; // the lowest 7d change the model believes, in per cent
  growth_cap: number; // the highest 7d change the model believes, in per cent
  maturity_floor: number; // the maturity multiplier of a brand-new protocol
  maturity_range: number; // how much maturity can add above its floor
  maturity_days: number; // the age at which maturity stops growing, in days
  unknown_age_days: number; // the age assumed when listed_at is missing, in days
  cat_multiple_min: number; // the lowest category multiple the model allows
  cat_multiple_max: number; // the highest category multiple the model allows
  cat_min_comparables: number; // live protocols a category needs for its own multiple
  chain_weight: number; // how much each log-chain adds to the chain multiplier
  chain_cap: number; // the highest chain multiplier the model allows
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5, // a 7d move counts half
  growth_floor: -60, // a 7d fall past -60% counts as -60%
  growth_cap: 120, // a 7d rise past 120% counts as 120%
  maturity_floor: 0.6, // a newborn protocol keeps 60% of its base
  maturity_range: 0.4, // age can add up to 40% more
  maturity_days: 1095, // three years to full maturity
  unknown_age_days: 365, // a missing listing date counts as one year old
  cat_multiple_min: 0.05, // no category is worth less than 5% of its TVL
  cat_multiple_max: 1.0, // no category is worth more than its TVL
  cat_min_comparables: 3, // fewer than three live comps is noise, not a multiple
  chain_weight: 0.04, // each log-chain adds 4%
  chain_cap: 1.2, // chains can add at most 20%
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = "radar-2";

/** How many live-token protocols the dashboard's Live token view carries, by market cap. */
export const LIVE_ROWS = 40;

/** One category's comparable multiple, derived from the snapshot's live-token protocols. */
export interface CategoryMultiple {
  category: string; // the category this multiple belongs to
  multiple: number; // the clamped multiple the model applies, to four decimals
  comparables: number; // how many live-token protocols the median came from
  raw_median: number; // the median mcap/TVL before the clamp, to four decimals
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string; // what to do, in the words a farmer can follow
  cost: string; // what it costs, capital and gas
  time: string; // how long it takes
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number; // 1 is the strongest implied value
  slug: string; // the protocol's key
  name: string; // display name
  category: string | null; // its category, or null
  chains: string[]; // every chain it runs on
  tvl_usd: number; // total value locked, in dollars
  change_7d: number | null; // TVL change over seven days, in per cent, or null
  mcap_usd: number | null; // market cap, or null: every board row is pre-token
  listed_at: string | null; // first listing date, or null
  gecko_id: string | null; // CoinGecko id, or null: every board row is pre-token
  symbol: string | null; // token symbol, or null: every board row is pre-token
  token_status: "pre-token"; // every board row is pre-token by construction
  age_days: number | null; // days from listed_at to the snapshot date, or null
  implied_value_usd: number; // the model's implied value, in whole dollars
  model: { // how this row's implied value was built
    category_multiple: number; // the category multiple applied
    comparables: number; // live comps behind that multiple
    growth_pct: number; // the clamped 7d change, in per cent
    growth_multiplier: number; // the growth multiplier, to four decimals
    maturity_multiplier: number; // the maturity multiplier, to four decimals
    chain_multiplier: number; // the chain multiplier, to four decimals
    age_days: number | null; // the age the maturity multiplier used, or null
  };
  farm_steps: string[]; // the farm plan, one string per step
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number; // 1 is the strongest implied value
  slug: string; // the protocol's key
  name: string; // display name
  category: string | null; // its category, or null
  chains: string[]; // every chain it runs on
  tvl_usd: number; // total value locked, in dollars
  change_7d: number | null; // TVL change over seven days, in per cent, or null
  mcap_usd: number | null; // market cap, or null: every board row is pre-token
  listed_at: string | null; // first listing date, or null
  age_days: number | null; // days from listed_at to the snapshot date, or null
  implied_value_usd: number; // the model's implied value, in whole dollars
  category_multiple: number; // the category multiple applied
  comparables: number; // live comps behind that multiple
  growth_multiplier: number; // the growth multiplier, to four decimals
  maturity_multiplier: number; // the maturity multiplier, to four decimals
  chain_multiplier: number; // the chain multiplier, to four decimals
  watchlist: boolean; // true when the slug is on the snapshot's watchlist
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string; // the protocol's key
  name: string; // display name
  category: string | null; // its category, or null
  chains: string[]; // every chain it runs on
  tvl_usd: number; // total value locked, in dollars
  mcap_usd: number | null; // market cap, in dollars
  change_7d: number | null; // TVL change over seven days, in per cent, or null
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string; // the snapshot's date
  source: string; // where the snapshot came from
  floor_usd: number; // the watchlist's TVL floor, in dollars
  model: ModelConstants; // the constants the board was scored with
  model_version: string; // the model's version label
  watchlist_size: number; // how many slugs the watchlist names
  board_size: number; // how many rows the board holds
  early_size: number; // how many board rows are below the watchlist floor
  live_size: number; // how many live-token rows the dashboard carries
  global_multiple: number; // the fallback multiple over all live-token protocols
  category_multiples: CategoryMultiple[]; // one per category with a live protocol
  rows: RadarRow[]; // the board in compact form, strongest first
  live: LiveRow[]; // the live-token protocols, by market cap
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

/** The headline figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number; // how many slugs the watchlist names
  board_size: number; // how many rows the board holds
  early_size: number; // how many board rows are below the watchlist floor
  live_size: number; // how many live-token rows the dashboard carries
}

const DAY_MS = 86_400_000;

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking: a product of a token that trades. */
const WRAPPED_TERM = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name: the exchange's own product, not a launch candidate. */
const EXCHANGE_NAME_START = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Categories the watchlist rule excludes: bridged, staked and exchange products. */
const BLOCKED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);

/** A finite number, else `fallback`. */
function numOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) {
    return null;
  }
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  const listedMs = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(listedMs)) {
    return null;
  }
  return Math.max(0, Math.floor((asOfMs - listedMs) / DAY_MS));
}

/** The median of a sorted copy; null when empty. */
function middleValue(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const ordered = [...values].sort((a, b) => a - b);
  const half = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) {
    return ordered[half]!;
  }
  return (ordered[half - 1]! + ordered[half]!) / 2;
}

/** A number rounded to four decimals, for the multipliers the board and the page show. */
const round4dp = (n: number): number => Math.round(n * 1e4) / 1e4;

/**
 * Every category's multiple, from the snapshot's own live-token protocols: the median
 * mcap/TVL of the category's live protocols when at least `cat_min_comparables` of them
 * exist, else the global median over all live-token protocols. Clamped to
 * [cat_multiple_min, cat_multiple_max]: a median over one or two protocols is noise,
 * not a multiple, and no category is worth more than its TVL. A category with no live
 * protocol at all falls back to the global median too.
 */
export function categoryMultiples(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { byCategory: Map<string, CategoryMultiple>; global: number } {
  const traded = snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const globalRaw = middleValue(traded.map((p) => p.mcap_usd! / p.tvl_usd)) ?? 0.2;
  const global = Math.min(
    model.cat_multiple_max,
    Math.max(model.cat_multiple_min, globalRaw),
  );
  const ratiosByCat = new Map<string, number[]>();
  for (const p of traded) {
    const key = p.category ?? "Other";
    const list = ratiosByCat.get(key) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    ratiosByCat.set(key, list);
  }
  const byCategory = new Map<string, CategoryMultiple>();
  for (const [category, ratios] of ratiosByCat) {
    const raw = middleValue(ratios)!;
    const multiple =
      ratios.length >= model.cat_min_comparables
        ? Math.min(model.cat_multiple_max, Math.max(model.cat_multiple_min, raw))
        : global;
    byCategory.set(category, {
      category,
      multiple: round4dp(multiple),
      comparables: ratios.length,
      raw_median: round4dp(raw),
    });
  }
  return { byCategory, global };
}

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  multiples: { byCategory: Map<string, CategoryMultiple>; global: number },
): {
  implied: number;
  catMult: number;
  comparables: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const growthRaw = numOr(protocol.change_7d, 0);
  const growthPct = Math.min(
    model.growth_cap,
    Math.max(model.growth_floor, growthRaw),
  );
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) *
      model.maturity_range;
  const chainMult = Math.min(
    model.chain_cap,
    1 + model.chain_weight * Math.log(Math.max(1, protocol.chains.length)),
  );
  const entry = multiples.byCategory.get(protocol.category ?? "Other");
  const catMult = entry !== undefined ? entry.multiple : multiples.global;
  const comparables = entry !== undefined ? entry.comparables : 0;
  const base = protocol.tvl_usd * catMult;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult));
  return { implied, catMult, comparables, growthPct, growthMult, maturityMult, chainMult, age };
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or
 * bridged product of a token that already trades, not a versioned pool, not an exchange
 * product. This is the watchlist's own rule, applied to every protocol below the floor too.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) {
    return false;
  }
  if (p.category === "CEX") {
    return false;
  }
  if (BLOCKED_CATEGORIES.has(p.category ?? "")) {
    return false;
  }
  if (VERSION_SUFFIX.test(p.name)) {
    return false;
  }
  if (WRAPPED_TERM.test(p.name)) {
    return false;
  }
  if (EXCHANGE_NAME_START.test(p.name)) {
    return false;
  }
  return true;
}

/** The snapshot's protocols keyed by slug. */
function indexBySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const lookup = indexBySlug(snapshot.protocols);
  const multiples = categoryMultiples(snapshot, model);
  const picked = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it
  // cannot, but the board's coverage is the gate's row and is never gambled on a missing
  // record).
  for (const slug of snapshot.watchlist) {
    const found = lookup.get(slug);
    if (found !== undefined) {
      picked.set(slug, found);
    }
  }
  // The early radar: every other pre-token protocol the house rule would rank, below the
  // floor. No cap: the radar exists to find them all, and a board of a few hundred rows
  // is well inside the gate.
  for (const p of snapshot.protocols) {
    if (!picked.has(p.slug) && isRankable(p)) {
      picked.set(p.slug, p);
    }
  }

  const scored = [...picked.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, multiples);
    return { proto: p, ...v };
  });
  scored.sort(
    (a, b) =>
      b.implied - a.implied ||
      (a.proto.slug < b.proto.slug ? -1 : a.proto.slug > b.proto.slug ? 1 : 0),
  );
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.proto.slug,
    name: s.proto.name,
    category: s.proto.category,
    chains: s.proto.chains,
    tvl_usd: s.proto.tvl_usd,
    change_7d: s.proto.change_7d,
    mcap_usd: s.proto.mcap_usd,
    listed_at: s.proto.listed_at,
    gecko_id: s.proto.gecko_id,
    symbol: s.proto.symbol,
    token_status: "pre-token",
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.catMult,
      comparables: s.comparables,
      growth_pct: s.growthPct,
      growth_multiplier: round4dp(s.growthMult),
      maturity_multiplier: round4dp(s.maturityMult),
      chain_multiplier: round4dp(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.proto, s.age).map(stepText),
  }));
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) {
    return (
      `the board misses ${missing.length} watchlist slug` +
      `${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 5).join(", ")}`
    );
  }
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) {
      return `rank ${i + 1} is ${ranks[i]}`;
    }
  }
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${i + 1} outranks row ${i} on implied value`;
    }
  }
  if (
    board.length >= 2 &&
    board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd
  ) {
    return (
      `all ${board.length} rows share the same implied value ` +
      `$${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`
    );
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) {
      return `${r.slug} has ${steps.length} farm steps`;
    }
    for (const s of steps) {
      if (s.length < 20 || s.length > 600) {
        return `${r.slug} has a farm step of ${s.length} characters`;
      }
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let joined = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (joined.length > 600) {
    joined = `${joined.slice(0, 596)}...`;
  }
  if (joined.length < 20) {
    joined = `${joined} Hold the position and check the protocol's own page.`;
  }
  return joined;
}

/** The first chain a protocol names, or a neutral phrase. */
function firstChain(p: SnapshotProtocol): string {
  if (p.chains.length > 0) {
    return p.chains[0]!;
  }
  return "its main chain";
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function stakeFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) {
    return 250;
  }
  if (p.tvl_usd >= 1_000_000_000) {
    return 150;
  }
  if (p.tvl_usd >= 100_000_000) {
    return 100;
  }
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdFor(age: number | null): number {
  if (age === null) {
    return 30;
  }
  if (age < 180) {
    return 60;
  }
  if (age < 365) {
    return 45;
  }
  return 30;
}

/** Cheap chains where a transaction costs about a dollar, from the protocol's own chain list. */
const LOW_FEE_CHAINS = new Set([
  "Base", "Arbitrum", "Optimism", "zkSync Era",
  "Polygon", "BNB Chain", "Avalanche", "Blast",
  "Linea", "Scroll", "Mantle", "Mode",
  "Fraxtal", "Gnosis", "Celo", "Sei",
  "Sui", "Aptos", "Starknet", "Manta",
  "Zora", "opBNB", "BSC", "Fantom",
  "Kava", "Near", "zkSync",
]);

/** What one transaction costs on the protocol's main chain, in dollars. */
export function gasUsd(p: SnapshotProtocol): number {
  const chain = firstChain(p);
  if (chain === "Ethereum") {
    return 12;
  }
  if (chain === "Solana") {
    return 0.1;
  }
  if (LOW_FEE_CHAINS.has(chain)) {
    return 1;
  }
  return 3;
}

/** One category rule: the keywords it matches and the action it writes. */
interface FarmRule {
  keys: string[];
  write: (name: string, capital: number, chain: string) => string;
}

/** The first qualifying action per category, in the order the rules are tried. */
const FIRST_ACTIONS: FarmRule[] = [
  {
    keys: ["lend", "cdp", "collateral"],
    write: (name, capital, chain) =>
      `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`,
  },
  {
    keys: ["dex", "yield", "leveraged farm"],
    write: (name, capital, chain) =>
      `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`,
  },
  {
    keys: ["bridge"],
    write: (name, capital, chain) =>
      `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`,
  },
  {
    keys: ["staking", "restak"],
    write: (name, capital, chain) =>
      `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`,
  },
  {
    keys: ["perpetual", "derivative"],
    write: (name, capital, chain) =>
      `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`,
  },
  {
    keys: ["prediction"],
    write: (name, capital, chain) =>
      `Fund $${capital} and place one market position on ${name}.`,
  },
  {
    keys: ["curator", "allocator"],
    write: (name, capital, chain) =>
      `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`,
  },
  {
    keys: ["stable"],
    write: (name, capital, chain) =>
      `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`,
  },
  {
    keys: ["rwa"],
    write: (name, capital, chain) =>
      `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`,
  },
  {
    keys: ["insurance"],
    write: (name, capital, chain) =>
      `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`,
  },
];

/** The second qualifying action per category: a different feature of the same protocol. */
const SECOND_ACTIONS: FarmRule[] = [
  {
    keys: ["lend", "cdp", "collateral"],
    write: (name, capital) =>
      `Borrow $${Math.max(10, Math.round(capital / 5))} against the supply on ${name} and repay it a week later, so the wallet shows both sides of the market.`,
  },
  {
    keys: ["dex", "yield", "leveraged farm"],
    write: (name, capital, chain) =>
      `Swap $${Math.max(10, Math.round(capital / 5))} through ${name}'s pool on ${chain} in the opposite direction, so the wallet shows a trade as well as liquidity.`,
  },
  {
    keys: ["bridge"],
    write: (name) =>
      `Bridge a second, smaller amount back through ${name} a week later, so the wallet shows repeat use.`,
  },
  {
    keys: ["staking", "restak"],
    write: (name) =>
      `Claim or restake one reward through ${name} after a week, so the wallet shows an active stake.`,
  },
  {
    keys: ["perpetual", "derivative"],
    write: (name) =>
      `Close the hedge on ${name} and open a second one a week later, so the wallet shows repeat trading.`,
  },
  {
    keys: ["prediction"],
    write: (name) =>
      `Settle one market position on ${name} and open another, so the wallet shows repeat activity.`,
  },
  {
    keys: ["curator", "allocator"],
    write: (name, capital, chain) =>
      `Deposit a second, smaller amount into another ${name} vault on ${chain} a week later.`,
  },
  {
    keys: ["stable"],
    write: (name) =>
      `Redeem a small part of the stable asset through ${name} and deposit it again, so the wallet shows both directions.`,
  },
  {
    keys: ["rwa"],
    write: (name) =>
      `Claim one yield distribution from ${name} and hold the rest, so the wallet shows an active holder.`,
  },
];

/** The first rule whose keywords the category carries, or undefined when none matches. */
function matchingRule(rules: FarmRule[], category: string): FarmRule | undefined {
  for (const rule of rules) {
    if (rule.keys.some((key) => category.includes(key))) {
      return rule;
    }
  }
  return undefined;
}

/** The category's first action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const cat = (p.category ?? "").toLowerCase();
  const rule = matchingRule(FIRST_ACTIONS, cat);
  if (rule !== undefined) {
    return rule.write(p.name, capital, chain);
  }
  return `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
}

/** The category's second qualifying action: a different feature of the same protocol. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const cat = (p.category ?? "").toLowerCase();
  const rule = matchingRule(SECOND_ACTIONS, cat);
  if (rule !== undefined) {
    return rule.write(p.name, capital, chain);
  }
  return `Use a second feature of ${p.name} on ${chain}, such as a swap, a vote or a second deposit, from the same wallet.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. Gas follows the protocol's main chain: Ethereum is dear, a
 * cheap L2 is about a dollar, Solana is cents.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = firstChain(p);
  const capital = stakeFor(p);
  const hold = holdFor(age);
  const gas = gasUsd(p);
  const gasPhrase = gas < 1 ? `under $${gas.toFixed(2)} of gas` : `about $${gas} of gas`;
  const open = actionFor(p, capital, chain);
  const follow = secondActionFor(p, capital, chain);
  return [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: "under $3 of gas for the first transaction", time: "5 minutes" },
    { text: open, cost: `$${capital} of capital and ${gasPhrase}`, time: "15 minutes to set up" },
    { text: follow, cost: gasPhrase, time: "10 minutes" },
    { text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`, cost: `${gasPhrase} a week`, time: "10 minutes a week" },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`, cost: "no fee to check, and never pay to claim", time: "10 minutes" },
    { text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`, cost: "nothing but the log", time: "5 minutes" },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  const traded = snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== "CEX")
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS);
  return traded.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
    change_7d: p.change_7d,
  }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    comparables: row.model.comparables,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const multiples = categoryMultiples(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const watchlist = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: multiples.global,
    category_multiples: [...multiples.byCategory.values()].sort(
      (a, b) => b.multiple - a.multiple || a.category.localeCompare(b.category),
    ),
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError("snapshot.json is not JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new SnapshotError("snapshot.json is not JSON object");
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) {
    throw new SnapshotError("snapshot.json has no as_of date");
  }
  if (typeof o.source !== "string") {
    throw new SnapshotError("snapshot.json has no source");
  }
  if (typeof o.floor_usd !== "number" || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) {
    throw new SnapshotError("snapshot.json has no floor_usd");
  }
  if (!Array.isArray(o.protocols)) {
    throw new SnapshotError("snapshot.json has no protocols array");
  }
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== "string")) {
    throw new SnapshotError("snapshot.json has no watchlist of slugs");
  }
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    }
    const p = v as Record<string, unknown>;
    if (
      typeof p.slug !== "string" ||
      typeof p.name !== "string" ||
      typeof p.tvl_usd !== "number" ||
      !Number.isFinite(p.tvl_usd)
    ) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === "string" ? p.category : null,
      chains: Array.isArray(p.chains)
        ? p.chains.filter((c): c is string => typeof c === "string")
        : [],
      tvl_usd: p.tvl_usd,
      change_7d:
        typeof p.change_7d === "number" && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd:
        typeof p.mcap_usd === "number" && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === "string" ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === "string" ? p.gecko_id : null,
      symbol: typeof p.symbol === "string" ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return "window.RADAR=" + JSON.stringify(radar) + ";\n";
}

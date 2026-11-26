// quote_common.js — shared helpers, fund categories and risk mapping for the Quotation Tool.
// Depends on prsa_data.js and arf_data.js being loaded first.

// ─── Formatters ───────────────────────────────────────────────────────────────
function fEUR(n) { return '€' + Math.round(n || 0).toLocaleString('en-IE'); }
function fNum(n) { return Math.round(n || 0).toLocaleString('en-IE'); }
function pct(n)  { return ((n || 0) * 100).toFixed(2) + '%'; }
function parseNum(s) {
  var v = parseFloat(String(s == null ? '' : s).replace(/[€,\s]/g, ''));
  return isNaN(v) ? 0 : v;
}
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fmtDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toLocaleDateString('en-IE', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function fmtDateLong(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toLocaleDateString('en-IE', { day:'numeric', month:'long', year:'numeric' });
}
function ageBetween(dobStr, atStr) {
  return (new Date(atStr) - new Date(dobStr)) / (365.25 * 24 * 3600 * 1000);
}

// ─── SRI display (ESMA / PRIIPs ESMA risk rating 1–7) ───────────────────
var ESMA_COLORS = ['', '#1a9e5c', '#4ab566', '#a0c840', '#f5c400', '#f5820a', '#e03333', '#990000'];
var ESMA_LABELS = ['', 'Very Low', 'Low', 'Low to Medium', 'Medium', 'Medium to High', 'High', 'Very High'];

// Formats an indicative risk class: whole number (decimals only if asked).
function fmtRisk(v, decimals) { return decimals ? (+v).toFixed(1) : String(Math.round(v)); }

// ─── Fund categories (Portfolio Builder grouping — brochure pp.19 and 31) ─────
// label: group heading in the builder · short: per-fund tag in the builder and the pack
var FUND_CATEGORIES = [
  { key:'ma',  label:'Multi-Asset Solutions',         short:'Multi-asset' },
  { key:'pg',  label:'Protected Growth',              short:'Protected growth' },
  { key:'cbb', label:'Complementary Building Blocks', short:'Building block' },
  { key:'idx', label:'Index-Tracking',                short:'Index tracker' }
];
var FUND_CATEGORY_OF = {
  // PRSA fund ids
  dm15:'ma', dm50:'ma', dm75:'ma',
  ss30:'pg', ss50:'pg', ss75:'pg',
  bsri:'cbb', afie:'cbb', afisd:'cbb', cash:'cbb',
  etfw:'idx', etfs:'idx', etfe:'idx',
  // ARF fund ids (where they differ)
  afsd:'cbb', bsge:'cbb', hesc:'idx', hmw:'idx', hsp:'idx'
};
var FUND_CATEGORY_MAP = {};
FUND_CATEGORIES.forEach(function(c) { FUND_CATEGORY_MAP[c.key] = c; });

// ─── Asset split (indicative) ─────────────────────────────────────────────────
// DMAS funds: look-through exposure from the factsheets (FUND_FACTSHEET, prsa_data.js). The published
// figures include derivatives and total over 100%, so each class is rescaled to its share of the total.
// Every other fund: its nominal split (`assets` in the fund data). For Strategy Select that is the
// stock/bond mix whose RETURN the fund aims to match (brochure pp.33–34), not what it holds — its
// factsheet exposures are not reliable at the moment, so they are not used. Either way the split is
// always shown as indicative.
var ASSET_CLASSES = [
  { key:'eq',   label:'Equity' },
  { key:'fi',   label:'Fixed income' },
  { key:'cash', label:'Cash' },
  { key:'com',  label:'Commodities' },
  { key:'alt',  label:'Alternatives' }
];
var ASSET_FROM_FACTSHEET = ['dm15', 'dm50', 'dm75'];
// A fund's asset split as fractions summing to 1: { eq, fi, cash, com, alt }.
function fundAssets(f) {
  var fs = ASSET_FROM_FACTSHEET.indexOf(f.id) >= 0 && typeof FUND_FACTSHEET !== 'undefined' ? FUND_FACTSHEET[f.id] : null;
  if (fs) {
    var g = { eq: fs.equity || 0, fi: fs.bonds || 0, cash: 0, com: fs.commodities || 0, alt: fs.alt || 0 };
    var t = g.eq + g.fi + g.com + g.alt;
    if (t > 0) { for (var k in g) g[k] /= t; return g; }
  }
  var a = f.assets || {};
  return { eq: a.eq || 0, fi: a.fi || 0, cash: a.cash || 0, com: 0, alt: 0 };
}
// Share of a fund mix ([{ fund, weight }]) by asset class, as fractions of the mix.
function assetSplit(mix) {
  var out = {}, tot = 0;
  ASSET_CLASSES.forEach(function(c) { out[c.key] = 0; });
  (mix || []).forEach(function(m) { tot += m.weight; });
  (mix || []).forEach(function(m) {
    var a = fundAssets(m.fund), w = tot ? m.weight / tot : 0;
    ASSET_CLASSES.forEach(function(c) { out[c.key] += w * a[c.key]; });
  });
  return out;
}
// Which split bases a mix uses, for the note under the split: { factsheet, target } (DMAS, Strategy Select).
function assetSplitBasis(mix) {
  var b = { factsheet: false, target: false };
  (mix || []).forEach(function(m) {
    if (ASSET_FROM_FACTSHEET.indexOf(m.fund.id) >= 0) b.factsheet = true;
    else if (FUND_CATEGORY_OF[m.fund.id] === 'pg') b.target = true;
  });
  return b;
}

// ─── Managed strategy → suitable client risk ratings ──────────────────────────
// Glidepath strategies (DIS/Autopilot/Life Cycle) don't have a published SRI — the fund
// mix moves over time — so each strategy is mapped to the client ratings it suits [min, max].
// Business-supplied mapping (2026-10-06). The same ids apply to Standard and Non-Standard
// PRSAs. Ratings outside every range (1, 6, 7) match no managed strategy.
var STRATEGY_SUITABLE = {
  dis:   [3, 4],
  ap_ba: [2, 3], ap_dy: [3, 4], ap_op: [3, 5],
  lc_ba: [2, 3], lc_dy: [3, 5], lc_op: [4, 5]
};
function strategySuitableRange(strat) {
  return strat && strat.gpKey ? STRATEGY_SUITABLE[strat.id] || null : null;
}
// { aligned, direction: 'higher' | 'lower' | null, range } — direction is the strategy's
// risk relative to the client (higher = client's rating is below the suitable range).
function strategyRiskFit(strat, sri) {
  var rg = strategySuitableRange(strat);
  if (!rg || !sri) return { aligned: true, direction: null, range: rg };
  if (sri < rg[0]) return { aligned: false, direction: 'higher', range: rg };
  if (sri > rg[1]) return { aligned: false, direction: 'lower', range: rg };
  return { aligned: true, direction: null, range: rg };
}
function fmtRatingRange(rg) { return rg[0] === rg[1] ? String(rg[0]) : rg[0] + '–' + rg[1]; }
// Strategy family plus profile, e.g. 'Autopilot Dynamic' or 'Life Cycle Balanced'; null for DIY.
function strategyFullName(strat) {
  if (!strat || !strat.gpKey) return null;
  var prof = strategyProfile(strat);
  return prof ? strat.label + ' ' + prof : strat.label;
}
function strategyProfile(strat) {
  if (!strat || !strat.sub) return null;
  if (/Balanced/.test(strat.sub)) return 'Balanced';
  if (/Dynamic/.test(strat.sub)) return 'Dynamic';
  if (/Opportunity/.test(strat.sub)) return 'Opportunity';
  return null;
}

// Portfolio risk switch. When false, neither the tool nor the pack shows a portfolio-level risk figure
// or compares one with the client's rating. Individual fund ratings and the glidepath risk-profile
// check (strategyRiskFit) are not affected.
var PORTFOLIO_SRI_ON = false;

// Blended portfolio ESMA risk rating (SRRI method). Uses FUND_RISK from fund_risk_data.js (generated by
// tools/sri/build_risk_data.py): annualised volatility of the mix from the covariance of 5 years of weekly
// returns, mapped to the SRRI class bands. Indicative only: there is no regulatory rule for blended portfolios.
// RISK_BAND_FLOOR: in a blend each fund's volatility is raised to the bottom of its published band where
// its measured volatility falls below it (so a published 6 goes in at no less than 15%).
var RISK_BAND_FLOOR = true;
var RISK_ID_ALIAS = { afsd:'afisd', bsge:'bsri', hesc:'etfe', hmw:'etfw', hsp:'etfs' };   // ARF/IB ids -> PRSA ids
var RISK_BAND_LOWER = [0, 0.5, 2, 5, 10, 15, 25];                                          // lower vol bound (%) of class 1..7

function riskClassFromVol(volPct) {
  var b = FUND_RISK.bands;
  for (var i = 0; i < b.length; i++) if (volPct < b[i]) return i + 1;
  return b.length + 1;
}

// items: [{ id, weight }] (weights need not sum to 1). Returns
// { vol (%), cls (1-7), exact (unrounded vol, %), basis ('published' for one fund, else 'blended') } or null.
function portfolioRisk(items) {
  if (typeof FUND_RISK === 'undefined') return null;
  var ids = FUND_RISK.ids, pos = [], tot = 0;
  (items || []).forEach(function(it) {
    var id = RISK_ID_ALIAS[it.id] || it.id, k = ids.indexOf(id);
    if (k < 0 || !(it.weight > 0)) return;
    pos.push({ k: k, id: id, w: it.weight }); tot += it.weight;
  });
  if (!pos.length) return null;
  pos.forEach(function(p) { p.w /= tot; });
  var cov = FUND_RISK.cov, pub = (typeof FUNDS_MAP !== 'undefined') ? FUNDS_MAP : {};
  // scale factor per fund for the band floor (covariance scaled so correlations are unchanged)
  pos.forEach(function(p) {
    var v = FUND_RISK.vol[p.id], e = pub[p.id] && pub[p.id].esma;
    p.f = (RISK_BAND_FLOOR && e && v > 0 && v < RISK_BAND_LOWER[e - 1]) ? RISK_BAND_LOWER[e - 1] / v : 1;
  });
  var v2 = 0;
  pos.forEach(function(a) { pos.forEach(function(b) { v2 += a.w * b.w * a.f * b.f * cov[a.k][b.k]; }); });
  var vol = Math.sqrt(Math.max(v2, 0)) * 100;
  if (pos.length === 1) {   // a single fund shows its published rating
    var e1 = pub[pos[0].id] && pub[pos[0].id].esma;
    return { vol: vol, exact: vol, cls: e1 || riskClassFromVol(vol), basis: 'published' };
  }
  return { vol: vol, exact: vol, cls: riskClassFromVol(vol), basis: 'blended' };
}
// Blended risk of an engine/builder mix: [{ fund, weight }]
function mixRisk(mix) {
  return portfolioRisk(mix.map(function(x) { return { id: x.fund.id, weight: x.weight }; }));
}
function fmtVol(v) { return (+v).toFixed(1) + '%'; }

// Blended risk of a glidepath's fund mix at policy start and at retirement.
// Glidepath weights are indexed by months remaining to retirement (0 = at retirement).
// Returns { start, end (classes), startVol, endVol (%) }.
function glidepathSriPath(strat, termMonths) {
  if (!strat || !strat.gpKey || typeof GP_DATA === 'undefined') return null;
  var gp = GP_DATA[strat.gpKey];
  function at(m) {
    var w = gp.weights[Math.max(0, Math.min(m, 540))];
    return portfolioRisk(gp.funds.map(function(id, i) { return { id: id, weight: w[i] }; }));
  }
  var s = at(termMonths), e = at(0);
  if (!s || !e) return null;
  return { start: s.cls, end: e.cls, startVol: s.vol, endVol: e.vol };
}


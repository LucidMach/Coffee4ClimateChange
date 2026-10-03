# Australia waste, methane and outreach illustration

The opening **Australia** view explores possible scale, independently of **Our records**. Its figures are not measured Nile savings, a forecast of uptake, completed outreach or an estimate of all Australian methane emissions. The existing transfer engine continues to report climate benefit as unknown.

The opening leads with **Less coffee waste. Less methane.** and links to the [COP31 Presidency's priorities, UNFCCC, 9 June 2026](https://unfccc.int/news/cop31-presidency-announces-new-targets-on-global-electrification-cutting-waste-resilient-cities): halving global waste **growth** by 2035, zero waste and methane reduction, and circular material use. Matching usable beans and by-products with accepting recipients supports those priorities; it does not demonstrate achievement of the global targets.

## Sources and boundary

- [RMIT, 23 August 2023](https://www.rmit.edu.au/news/all-news/2023/aug/coffee-concrete): about 75,000 tonnes of spent coffee grounds generated in Australia each year. This is an estimate of generation, not a measured quantity available to Nile or sent to landfill. Its moisture/weight basis is not established on that page.
- [IBISWorld, October 2025, page 1, hosted by Restaurant & Catering Australia](https://arca.org.au/wp-content/uploads/2025/12/IBISWorld2025.pdf): estimated 28,154 café and coffee-shop **businesses** for 2025–26. This is a dated industry estimate, not a live list, count of locations or recipient database.
- [NGA Factors 2026](https://www.dcceew.gov.au/sites/default/files/documents/national-greenhouse-accounts-factors-2026.pdf): Table 15, food waste to landfill, 2.1 t CO₂e/t; Table 44, compost methane component, 0.021 t CO₂e/t; Table 38, methane GWP over 100 years, 28. CO₂e is used only as an intermediate unit to calculate methane here; the opening no longer displays a separate GHG-reduction metric.

These are **generic food-waste proxies**, assuming compatible wet-weight quantities, not validated coffee-specific factors. The selected portion is assumed otherwise headed to landfill and successfully moved to compost. The default assumes no landfill gas capture; users can vary capture in the assumptions panel.

Landfill factors represent emissions released over the waste's lifetime, potentially decades. The displayed methane is the lifetime consequence of one year's waste cohort, **not methane avoided within a single year**. The comparison excludes extra transport and energy, process credits, substitution benefits and site-specific treatment differences. Diversion can prevent methane emissions; this product does not recapture gas.

The **1–10% slider advances in 0.5% steps**. It applies the same percentage to two **independent scenario goals**: national grounds diversion and café outreach. Contacting 1% of cafés does not establish 1% of grounds diverted. The national grounds estimate is not a café-only inventory; cafés have different waste volumes and may already divert their grounds. The outreach target is rounded to a whole business and never counted as businesses actually contacted.

## Arithmetic

For a shared scenario percentage `s` and landfill gas capture `c` percent:

```text
Q = 75,000 × s / 100                         tonnes of grounds per year
L = 2.1 × (1 − c / 100)                      illustrative landfill CO₂e factor
Methane change = Q × (L − 0.021) / 28         lifetime tonnes CH₄
Cafe outreach target = round(28,154 × s / 100) businesses, not contacts
```

Default `s = 1`, `c = 0`: **750 tonnes of annual grounds**, approximately **55.7 tonnes methane** in the lifetime comparison, and about **282 café businesses to target**. At `s = 1.5`: 1,125 tonnes grounds, approximately 83.5 tonnes methane and about 422 businesses. Figures are rounded for readability, not measured precisely. Negative values remain visible and mean increased methane emissions in that comparison.

## Before claiming project impact

Validate the coffee-specific factor and moisture basis, actual disposal and gas capture, accepted destination use, collection and treatment energy, transport, source versions and time boundary. Existing organics collection may already avoid landfill. Keep surplus beans, grounds, chaff, pulp and husks distinct. This model is never automatically applied to a listing, receipt or reuse report.

The calculator is in `src/lib/climate-scenario.ts`; the selector, inputs and source panel are in `src/components/coffee-metrics.tsx`.

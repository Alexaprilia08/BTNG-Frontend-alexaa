"use strict";

const API_URL = "https://api-web.dnccudinus.org/api/mobil";

// The API uses Indonesian values, the interface uses English labels.
const LABELS = {
  Listrik: "Electric", Bensin: "Petrol", Diesel: "Diesel", Hybrid: "Hybrid",
  Matic: "Automatic", Manual: "Manual", CVT: "CVT"
};
const t = (v) => LABELS[v] || v;
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const isSold = (c) => String(c.status).toLowerCase() === "sold";

const $ = (id) => document.getElementById(id);
const els = {
  grid: $("grid"), state: $("state"), count: $("resultCount"), search: $("search"),
  fuel: $("fuel"), sort: $("sort"), chips: $("brandChips"), modal: $("modal")
};

let cars = [];
const filters = { q: "", brand: "all", fuel: "all", sort: "new" };

/* ---------- API ---------- */
async function loadCars() {
  showSkeletons();
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Server responded with " + res.status);
    const json = await res.json();
    const list = Array.isArray(json) ? json : json.data;
    if (!Array.isArray(list)) throw new Error("Unexpected response format");
    cars = list;
    setupFilters();
    renderStats();
    renderHero();
    render();
  } catch (err) {
    console.error(err);
    els.grid.setAttribute("aria-busy", "false");
    els.grid.innerHTML = "";
    els.count.textContent = "Could not load cars";
    showState("We couldn't reach the showroom", "Check your connection and try again.", true);
  }
}

/* ---------- Rendering ---------- */
function showSkeletons() {
  els.state.hidden = true;
  els.grid.setAttribute("aria-busy", "true");
  els.grid.innerHTML = '<div class="card ghost skeleton"></div>'.repeat(6);
}

function showState(title, text, retry) {
  els.state.hidden = false;
  els.state.innerHTML = "";
  const h = document.createElement("h3"); h.textContent = title;
  const p = document.createElement("p"); p.textContent = text;
  els.state.append(h, p);
  if (retry) {
    const b = document.createElement("button");
    b.className = "btn"; b.textContent = "Try again";
    b.addEventListener("click", loadCars);
    els.state.append(b);
  }
}

function renderStats() {
  $("statTotal").textContent = cars.length;
  $("statAvail").textContent = cars.filter((c) => !isSold(c)).length;
  $("statBrands").textContent = new Set(cars.map((c) => c.brand)).size;
}

let heroTimer = null;

function renderHero() {
  const top = cars.filter((c) => !isSold(c)).sort((a, b) => b.harga - a.harga).slice(0, 5);
  if (!top.length) return;
  const thumbs = $("thumbs"), bg = $("heroBg"), bar = $("heroBar");
  let current = 0;
  thumbs.innerHTML = "";

  const show = (i) => {
    current = (i + top.length) % top.length;
    const c = top[current];
    bg.classList.add("swap");
    setTimeout(() => { bg.style.backgroundImage = `url("${c.foto}")`; bg.classList.remove("swap"); }, 220);
    $("heroName").textContent = c.nama;
    $("heroMeta").textContent = `${c.brand} · ${c.tahun} · ${t(c.transmisi)} · ${t(c.bahan_bakar)}`;
    $("heroPrice").textContent = rupiah(c.harga);
    $("heroCount").textContent = `${current + 1} / ${top.length}`;
    thumbs.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", k === current));
  };

  top.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", "Feature " + c.nama);
    const im = document.createElement("img"); im.src = c.foto; im.alt = "";
    b.append(im); b.addEventListener("click", () => show(i));
    thumbs.append(b);
  });

  $("heroPrev").onclick = () => show(current - 1);
  $("heroNext").onclick = () => show(current + 1);
  $("heroView").onclick = () => openModal(top[current]);

  // Auto-advance, paused while the visitor interacts or prefers reduced motion.
  clearInterval(heroTimer);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = () => { if (!calm) { clearInterval(heroTimer); heroTimer = setInterval(() => show(current + 1), 6000); } };
  const stop = () => clearInterval(heroTimer);
  bar.onmouseenter = stop; bar.onmouseleave = start;
  bar.onfocusin = stop; bar.onfocusout = start;

  show(0);
  start();
}

function setupFilters() {
  const brands = ["all", ...new Set(cars.map((c) => c.brand))];
  els.chips.innerHTML = "";
  brands.forEach((b) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = b === "all" ? "All brands" : b;
    chip.dataset.brand = b;
    chip.setAttribute("aria-pressed", b === filters.brand);
    els.chips.append(chip);
  });
  const fuels = [...new Set(cars.map((c) => c.bahan_bakar))];
  els.fuel.innerHTML = '<option value="all">All fuel types</option>' +
    fuels.map((f) => `<option value="${f}">${t(f)}</option>`).join("");
}

function filtered() {
  const q = filters.q.trim().toLowerCase();
  const list = cars.filter((c) =>
    (filters.brand === "all" || c.brand === filters.brand) &&
    (filters.fuel === "all" || c.bahan_bakar === filters.fuel) &&
    (!q || (c.nama + " " + c.brand).toLowerCase().includes(q)));
  const sorts = {
    new: (a, b) => b.id - a.id,
    low: (a, b) => a.harga - b.harga,
    high: (a, b) => b.harga - a.harga,
    year: (a, b) => b.tahun - a.tahun || b.harga - a.harga
  };
  return list.sort(sorts[filters.sort]);
}

function render() {
  const list = filtered();
  els.grid.setAttribute("aria-busy", "false");
  els.grid.innerHTML = "";
  els.count.textContent = `${list.length} of ${cars.length} cars`;
  if (!list.length) {
    showState("No cars match your search", "Try another brand or clear the filters.", false);
    return;
  }
  els.state.hidden = true;
  const frag = document.createDocumentFragment();
  list.forEach((c) => frag.append(buildCard(c)));
  els.grid.append(frag);
}

function buildCard(c) {
  const sold = isSold(c);
  const card = document.createElement("article");
  card.className = "card" + (sold ? " is-sold" : "");
  card.innerHTML = `
    <div class="card-img">
      <img loading="lazy" alt="">
      <span class="num"></span>
      <span class="badge ${sold ? "sold" : ""}">${sold ? "Sold" : "Available"}</span>
    </div>
    <div class="card-body">
      <span class="brand"></span>
      <h3></h3>
      <div class="spec-row"><div><small>Year</small><span class="y"></span></div><div><small>Gearbox</small><span class="tr"></span></div><div><small>Fuel</small><span class="fu"></span></div></div>
      <div class="card-foot">
        <div class="price"><small>Price</small><strong></strong></div>
        <button class="link-btn" type="button">View details</button>
      </div>
    </div>`;
  const img = card.querySelector("img");
  img.src = c.foto; img.alt = c.nama;
  img.addEventListener("error", () => { img.removeAttribute("src"); img.parentElement.classList.add("skeleton"); });
  card.querySelector(".num").textContent = c.id;
  card.querySelector(".brand").textContent = c.brand;
  card.querySelector("h3").textContent = c.nama;
  card.querySelector(".y").textContent = c.tahun;
  card.querySelector(".tr").textContent = t(c.transmisi);
  card.querySelector(".fu").textContent = t(c.bahan_bakar);
  card.querySelector("strong").textContent = rupiah(c.harga);
  card.querySelector(".link-btn").addEventListener("click", () => openModal(c));
  return card;
}

/* ---------- Modal ---------- */
function openModal(c) {
  const sold = isSold(c);
  $("mImg").src = c.foto; $("mImg").alt = c.nama;
  $("mTitle").textContent = c.nama;
  $("mPrice").textContent = rupiah(c.harga);
  const s = $("mStatus");
  s.textContent = sold ? "Sold" : "Available"; s.className = "badge" + (sold ? " sold" : "");
  $("mCta").hidden = sold;
  const rows = [["Brand", c.brand], ["Year", c.tahun], ["Transmission", t(c.transmisi)], ["Fuel", t(c.bahan_bakar)]];
  $("mSpecs").innerHTML = "";
  rows.forEach(([k, v]) => {
    const d = document.createElement("div");
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    d.append(dt, dd); $("mSpecs").append(d);
  });
  els.modal.showModal();
}

/* ---------- Events ---------- */
els.search.addEventListener("input", (e) => { filters.q = e.target.value; render(); });
els.fuel.addEventListener("change", (e) => { filters.fuel = e.target.value; render(); });
els.sort.addEventListener("change", (e) => { filters.sort = e.target.value; render(); });
els.chips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  filters.brand = chip.dataset.brand;
  els.chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === chip));
  render();
});
$("mClose").addEventListener("click", () => els.modal.close());
els.modal.addEventListener("click", (e) => { if (e.target === els.modal) els.modal.close(); });
$("mCta").addEventListener("click", () => els.modal.close());

const toggle = $("navToggle"), menu = $("menu");
toggle.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
menu.addEventListener("click", (e) => {
  if (e.target.tagName === "A") { menu.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
});

loadCars();
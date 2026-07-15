// --- Supabase kapcsolat beállítása ---
const SUPABASE_URL = "https://yaeanqmfbrnluidpyckm.supabase.co"; // pl. https://xxxxxxxxxxxx.supabase.co
const SUPABASE_KEY = "sb_publishable_kceFgbYSZMDFODTJ_7nSAw_ZcGz6Am9";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserRole = null; // "admin" vagy "member" lesz, bejelentkezés után töltjük ki

// --- HTML elemek kikeresése ---
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const welcomeText = document.getElementById("welcome-text");
const logoutBtn = document.getElementById("logout-btn");

// --- Bejelentkezés kezelése ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    loginError.textContent = "Hibás email vagy jelszó.";
    return;
  }

  loginError.textContent = "";
});

// --- Kijelentkezés kezelése ---
logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload(); // egyszerűen újratöltjük az oldalt
});

// --- Oldal betöltésekor: ellenőrizzük, hogy van-e már aktív munkamenet ---
async function showMainView(user) {
  loginView.style.display = "none";
  mainView.style.display = "block";
  document.getElementById("shame-wall").classList.remove("hidden");
  document.getElementById("glory-wall").classList.remove("hidden");

  // Lekérjük a saját nevünket és szerepkörünket egyben
  const { data: profile } = await supabaseClient
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  welcomeText.textContent = `Bejelentkezve: ${profile.name}`;
  currentUserRole = profile.role;

  loadProducts();
  loadOwnTransactions();
  loadAllBalances();
}

// --- Termékek betöltése és megjelenítése gombokként ---
let allProducts = []; // globálisan tároljuk, hogy szűréskor ne kelljen újra lekérdezni

async function loadProducts() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error("Hiba a termékek betöltésekor:", error);
    return;
  }

  allProducts = products;
  renderProductList();
}

// --- Kiemeli a keresett szövegrészt a termék nevében ---
function highlightMatch(text, search) {
  if (!search) return text;

  const index = text.toLowerCase().indexOf(search.toLowerCase());
  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + search.length);
  const after = text.slice(index + search.length);

  return `${before}<mark>${match}</mark>${after}`;
}

// --- A jelenlegi keresés + kategória-szűrő alapján kirajzolja a listát ---
function renderProductList() {
  const searchTerm = document.getElementById("product-search").value.trim();
  const selectedCategory = document.getElementById("category-filter").value;

   

  const filtered = allProducts.filter((product) => {
    
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch =
      searchTerm === "" ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const productList = document.getElementById("product-list");
  productList.innerHTML = "";

  if (filtered.length === 0) {
    productList.innerHTML = `<p class="empty-text">Nincs ilyen termék.</p>`;
    return;
  }

  filtered.forEach((product) => {
    if (selectedCategory === "all" && searchTerm === "") {
    productList.innerHTML = `<p class="empty-text">Írj be egy keresőszót, vagy válassz kategóriát a listázáshoz.</p>`;
    return;
  }
    const btn = document.createElement("button");
    btn.innerHTML = `${highlightMatch(product.name, searchTerm)} - ${product.price} Ft`;
    btn.addEventListener("click", () => openQuantityModal(product));
    productList.appendChild(btn);
  });
}

// --- Kereső és kategória-szűrő eseménykezelése ---
document.getElementById("product-search").addEventListener("input", renderProductList);
document.getElementById("category-filter").addEventListener("change", renderProductList);

// --- Új tranzakció felírása, amikor rákattintanak egy termékre ---
async function addTransaction(product, quantity = 1) {
  const { data: userData } = await supabaseClient.auth.getUser();
  const currentUserId = userData.user.id;

  const { error } = await supabaseClient.from("transactions").insert({
    user_id: currentUserId,
    product_id: product.id,
    price_at_time: product.price,
    quantity: quantity,
  });

  if (error) {
    alert("Hiba történt a felírás során: " + error.message);
    return;
  }

  loadOwnTransactions();
  loadAllBalances();
}

// --- Saját tranzakciók betöltése és megjelenítése ---
// --- Saját tranzakciók betöltése és megjelenítése ---
async function loadOwnTransactions() {
  const { data: userData } = await supabaseClient.auth.getUser();
  const currentUserId = userData.user.id;

  const { data: transactions, error } = await supabaseClient
    .from("transactions")
    .select("id, price_at_time, quantity, created_at, products(name)")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Hiba a tranzakciók betöltésekor:", error);
    return;
  }

  const { data: payments, error: paymentsError } = await supabaseClient
    .from("payments")
    .select("amount")
    .eq("user_id", currentUserId);

  if (paymentsError) {
    console.error("Hiba a befizetések betöltésekor:", paymentsError);
    return;
  }

  renderTransactionAccordion("transactions-container", transactions, { showDelete: false });

  const total = transactions.reduce(
    (sum, t) => sum + Number(t.price_at_time) * Number(t.quantity),
    0
  );
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = totalPaid -total;

  document.getElementById("balance-text").textContent = `${balance} Ft`;
}

// --- Mindenki egyenlegének betöltése és megjelenítése ---
async function loadAllBalances() {
  // 1. Az összes felhasználó lekérése (név szerint)
  const { data: users, error: usersError } = await supabaseClient
    .from("users")
    .select("id, name");

  if (usersError) {
    console.error("Hiba a felhasználók betöltésekor:", usersError);
    return;
  }

  // 2. Az összes tranzakció lekérése (mindenkié, nem csak a sajátunk)
  const { data: transactions, error: transError } = await supabaseClient
    .from("transactions")
    .select("user_id, price_at_time, quantity");

  if (transError) {
    console.error("Hiba a tranzakciók betöltésekor:", transError);
    return;
  }

  // 2b. Az összes befizetés lekérése is
  const { data: payments, error: paymentsError } = await supabaseClient
    .from("payments")
    .select("user_id, amount");

  if (paymentsError) {
    console.error("Hiba a befizetések betöltésekor:", paymentsError);
    return;
  }

  // 3. Összegzés felhasználónként (JavaScript oldalon)
  const balances = {}; // pl. { "user-uuid-1": 2400, "user-uuid-2": 800 }

 transactions.forEach((t) => {
    if (!balances[t.user_id]) {
      balances[t.user_id] = 0;
    }
    balances[t.user_id] += Number(t.price_at_time) * Number(t.quantity);
});

  payments.forEach((p) => {
    if (!balances[p.user_id]) {
      balances[p.user_id] = 0;
    }
    balances[p.user_id] -= Number(p.amount);
  });

  // 4. Táblázat kirajzolása

  const tbody = document.getElementById("all-balances-body");
  tbody.innerHTML = "";
  users.forEach((user) => {
  const total = balances[user.id] || 0;

  const row = document.createElement("tr");

  const detailButtonHtml = `<button class="detail-btn" data-user-id="${user.id}" data-user-name="${user.name}">Részletek</button>`;

  row.innerHTML = `
    <td>${user.name}</td>
    <td> ${total*-1} Ft</td>
    <td>${detailButtonHtml}</td>
  `;
  tbody.appendChild(row);
  
});

// Ha admin vagyunk, minden "Részletek" gombra rákötjük az eseménykezelőt
document.querySelectorAll(".detail-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    showAdminDetail(btn.dataset.userId, btn.dataset.userName);
  });
});
loadShameWall();
 loadGloryWall();
}

// --- Admin: egy adott user összes tranzakciójának megjelenítése törlés-gombbal ---
// --- Admin: egy adott user összes tranzakciójának és befizetésének megjelenítése ---
async function showAdminDetail(userId, userName) {
  const isAdmin = currentUserRole === "admin";

  document.getElementById("admin-detail-title").textContent = `${userName} részletei`;

  const panel = document.getElementById("admin-detail-view");
  panel.style.display = "block";
  panel.dataset.currentUserId = userId;

  document.getElementById("admin-detail-close-btn").onclick = closeAdminDetail;

  // Admin-only rész (tartozás, tételek, befizetés-form) csak adminnak látszik
  document.getElementById("admin-only-section").style.display = isAdmin ? "block" : "none";

  // --- Befizetések betöltése (ezt mindenki látja) ---
  const { data: payments, error: paymentsError } = await supabaseClient
    .from("payments")
    .select("id, amount, created_at, recorder:created_by(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("Hiba a befizetések betöltésekor:", paymentsError);
    return;
  }

  const paymentsBody = document.getElementById("admin-payments-body");
  paymentsBody.innerHTML = "";
  let totalPaid = 0;

  payments.forEach((p) => {
    totalPaid += Number(p.amount);
    const date = new Date(p.created_at).toLocaleString("hu-HU");
    const recorderName = p.recorder ? p.recorder.name : "Ismeretlen";

    const deleteCellHtml = isAdmin
      ? `<button data-payment-id="${p.id}" class="delete-payment-btn">Törlés</button>`
      : "";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${date}</td>
      <td>${p.amount} Ft</td>
      <td>${recorderName}</td>
      <td>${deleteCellHtml}</td>
    `;
    paymentsBody.appendChild(row);
  });

  // Sima usernek itt véget is ér: csak a befizetéseket látja
  if (!isAdmin) {
    return;
  }

  // --- Innentől csak admin számára: tranzakciók, egyenleg, befizetés-form ---
  const { data: transactions, error } = await supabaseClient
    .from("transactions")
    .select("id, price_at_time, quantity, created_at, products(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Hiba a részletek betöltésekor:", error);
    return;
  }

  const totalSpent = transactions.reduce(
    (sum, t) => sum + Number(t.price_at_time) * Number(t.quantity),
    0
);
  const balance = totalSpent - totalPaid;
  const hasOutstandingBalance = balance > 0;

  renderTransactionAccordion("admin-detail-container", transactions, {
    showDelete: hasOutstandingBalance,
    onDelete: async (transactionId) => {
      const confirmed = confirm("Biztosan törlöd ezt a tételt?");
      if (!confirmed) return;

      const { error } = await supabaseClient
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) {
        alert("Hiba a törlés során: " + error.message);
        return;
      }

      showAdminDetail(userId, userName);
      loadAllBalances();
      loadOwnTransactions();
    },
  });

  document.getElementById("admin-detail-balance").textContent = `${balance} Ft`;

  document.querySelectorAll(".delete-payment-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = confirm("Biztosan törlöd ezt a befizetést?");
      if (!confirmed) return;

      const { error } = await supabaseClient
        .from("payments")
        .delete()
        .eq("id", btn.dataset.paymentId);

      if (error) {
        alert("Hiba a törlés során: " + error.message);
        return;
      }

      showAdminDetail(userId, userName);
      loadAllBalances();
      loadOwnTransactions();
    });
  });

  document.getElementById("payment-submit-btn").onclick = async () => {
    const amountInput = document.getElementById("payment-amount");
    const amount = Number(amountInput.value);

    if (!amount || amount <= 0) {
      alert("Adj meg egy érvényes összeget!");
      return;
    }

    await recordPayment(userId, amount, userName);
    amountInput.value = "";
  };

  document.getElementById("payment-full-btn").onclick = async () => {
    if (balance <= 0) {
      alert("Nincs tartozás.");
      return;
    }

    await recordPayment(userId, balance, userName);
  };
}

// --- Új befizetés rögzítése ---
async function recordPayment(userId, amount, userName) {
  const { data: adminData } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient.from("payments").insert({
    user_id: userId,
    amount: amount,
    created_by: adminData.user.id,
  });

  if (error) {
    alert("Hiba a befizetés rögzítésekor: " + error.message);
    return;
  }

  showAdminDetail(userId, userName);
  loadAllBalances();
  loadOwnTransactions();
}
// --- Admin: részletek panel bezárása ---
function closeAdminDetail() {
  document.getElementById("admin-detail-view").style.display = "none";
}

// --- Figyeli a bejelentkezés-állapot változásait: oldalbetöltéskor,
// bejelentkezéskor és kijelentkezéskor is lefut ---
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    showMainView(session.user);
  } else {
    loginView.style.display = "block";
    mainView.style.display = "none";
    document.getElementById("shame-wall").classList.add("hidden");
    document.getElementById("glory-wall").classList.add("hidden");
  }
});

// --- Szégyenfal: top 10 legnagyobb tartozás ---
async function loadShameWall() {
  const { data: users, error: usersError } = await supabaseClient
    .from("users")
    .select("id, name");

  if (usersError) {
    console.error("Hiba a felhasználók betöltésekor:", usersError);
    return;
  }

  const { data: transactions, error: transError } = await supabaseClient
    .from("transactions")
    .select("user_id, price_at_time, quantity");

  if (transError) {
    console.error("Hiba a tranzakciók betöltésekor:", transError);
    return;
  }

  const { data: payments, error: paymentsError } = await supabaseClient
    .from("payments")
    .select("user_id, amount");

  if (paymentsError) {
    console.error("Hiba a befizetések betöltésekor:", paymentsError);
    return;
  }

  const balances = {};

  transactions.forEach((t) => {
    balances[t.user_id] = (balances[t.user_id] || 0) + Number(t.price_at_time) * Number(t.quantity);
  });

  payments.forEach((p) => {
    balances[p.user_id] = (balances[p.user_id] || 0) - Number(p.amount);
  });

  const ranking = users
    .map((u) => ({ name: u.name, balance: balances[u.id] || 0 }))
    .filter((u) => u.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  const list = document.getElementById("shame-list");
  list.innerHTML = "";

  if (ranking.length === 0) {
    list.innerHTML = `<li class="shame-empty">Senki nem lóg semmivel 🎉</li>`;
    return;
  }

  ranking.forEach((u) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="shame-name">${u.name}</span>
      <span class="shame-amount">${u.balance} Ft</span>
    `;
    list.appendChild(li);
  });
}

// --- Dicsőségfal: top 10 legnagyobb túlfizetés ---
async function loadGloryWall() {
  const { data: users, error: usersError } = await supabaseClient
    .from("users")
    .select("id, name");

  if (usersError) {
    console.error("Hiba a felhasználók betöltésekor:", usersError);
    return;
  }

  const { data: transactions, error: transError } = await supabaseClient
    .from("transactions")
    .select("user_id, price_at_time, quantity");

  if (transError) {
    console.error("Hiba a tranzakciók betöltésekor:", transError);
    return;
  }

  const { data: payments, error: paymentsError } = await supabaseClient
    .from("payments")
    .select("user_id, amount");

  if (paymentsError) {
    console.error("Hiba a befizetések betöltésekor:", paymentsError);
    return;
  }

  const balances = {};

  transactions.forEach((t) => {
    balances[t.user_id] = (balances[t.user_id] || 0) + Number(t.price_at_time) * Number(t.quantity);
  });

  payments.forEach((p) => {
    balances[p.user_id] = (balances[p.user_id] || 0) - Number(p.amount);
  });

  // Túlfizetés = negatív egyenleg, minél kisebb (negatívabb), annál nagyobb a túlfizetés
  const ranking = users
    .map((u) => ({ name: u.name, overpaid: -(balances[u.id] || 0) }))
    .filter((u) => u.overpaid > 0)
    .sort((a, b) => b.overpaid - a.overpaid)
    .slice(0, 10);

  const list = document.getElementById("glory-list");
  list.innerHTML = "";

  if (ranking.length === 0) {
    list.innerHTML = `<li class="glory-empty">Még senki nem fizetett túl</li>`;
    return;
  }

  ranking.forEach((u) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="glory-name">${u.name}</span>
      <span class="glory-amount">+${u.overpaid} Ft</span>
    `;
    list.appendChild(li);
  });
}

const HONAP_NEVEK = [
  "Január", "Február", "Március", "Április", "Május", "Június",
  "Július", "Augusztus", "Szeptember", "Október", "November", "December"
];

// --- Tranzakciók megjelenítése év/hónap szerint lenyitható listaként ---
function renderTransactionAccordion(containerId, transactions, options = {}) {
  const showDelete = options.showDelete || false;
  const onDelete = options.onDelete || null;

  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (transactions.length === 0) {
    container.innerHTML = `<p class="empty-text">Még nincs egyetlen tétel sem.</p>`;
    return;
  }

  // Csoportosítás: { év: { hónap: [tételek] } }
  const groups = {};
  transactions.forEach((t) => {
    const d = new Date(t.created_at);
    const year = d.getFullYear();
    const month = d.getMonth();
    if (!groups[year]) groups[year] = {};
    if (!groups[year][month]) groups[year][month] = [];
    groups[year][month].push(t);
  });

  const years = Object.keys(groups).sort((a, b) => b - a);

  years.forEach((year) => {
    const yearWrapper = document.createElement("div");
    yearWrapper.className = "accordion-year";

    const yearHeader = document.createElement("button");
    yearHeader.type = "button";
    yearHeader.className = "accordion-header year-header";
    yearHeader.textContent = year;

    const yearBody = document.createElement("div");
    yearBody.className = "accordion-body";
    yearBody.style.display = "none";

    const months = Object.keys(groups[year]).sort((a, b) => b - a);

    months.forEach((month) => {
      const monthWrapper = document.createElement("div");
      monthWrapper.className = "accordion-month";

      const monthHeader = document.createElement("button");
      monthHeader.type = "button";
      monthHeader.className = "accordion-header month-header";
      monthHeader.textContent = HONAP_NEVEK[month];

      const monthBody = document.createElement("div");
      monthBody.className = "accordion-body";
      monthBody.style.display = "none";

      const table = document.createElement("table");
      table.className = "ledger-table";
      table.innerHTML = `
        <thead>
          <tr>
            <th>Dátum</th>
            <th>Termék</th>
            <th class="num-col">Ár</th>
            ${showDelete ? "<th></th>" : ""}
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector("tbody");

     groups[year][month].forEach((t) => {
  const date = new Date(t.created_at).toLocaleString("hu-HU");
  const deleteHtml = showDelete
    ? `<td><button data-transaction-id="${t.id}" class="delete-btn">Törlés</button></td>`
    : "";

  const productLabel =
    t.quantity > 1 ? `${t.products.name} × ${t.quantity}` : t.products.name;
  const lineTotal = Number(t.price_at_time) * Number(t.quantity);

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${date}</td>
    <td>${productLabel}</td>
    <td>${lineTotal} Ft</td>
    ${deleteHtml}
  `;
  tbody.appendChild(row);
});

      monthBody.appendChild(table);
      monthWrapper.appendChild(monthHeader);
      monthWrapper.appendChild(monthBody);
      yearBody.appendChild(monthWrapper);

      monthHeader.addEventListener("click", () => {
        const isOpen = monthBody.style.display === "block";
        monthBody.style.display = isOpen ? "none" : "block";
        monthHeader.classList.toggle("open", !isOpen);
      });
    });

    yearWrapper.appendChild(yearHeader);
    yearWrapper.appendChild(yearBody);
    container.appendChild(yearWrapper);

    yearHeader.addEventListener("click", () => {
      const isOpen = yearBody.style.display === "block";
      yearBody.style.display = isOpen ? "none" : "block";
      yearHeader.classList.toggle("open", !isOpen);
    });
  });

  if (showDelete && onDelete) {
    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => onDelete(btn.dataset.transactionId));
    });
  }
}

// --- Valós idejű frissítés: minden bejelentkezett böngészőben ---
supabaseClient
  .channel("public-changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "transactions" },
    () => {
      refreshEverything();
    }
  )
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "payments" },
    () => {
      refreshEverything();
    }
  )
  .subscribe();

// --- Mindent frissít, amit egy tranzakció/befizetés érint ---
function refreshEverything() {
  loadOwnTransactions();
  loadAllBalances(); // ez már hívja a loadShameWall() és loadGloryWall() függvényeket is

  // Ha admin, és épp nyitva van valakinek a részletes nézete, azt is frissítjük
  const panel = document.getElementById("admin-detail-view");
  if (panel.style.display === "block" && panel.dataset.currentUserId) {
    const userId = panel.dataset.currentUserId;
    const userName = document.getElementById("admin-detail-title").textContent.replace(" tételei", "");
    showAdminDetail(userId, userName);
  }
}

let pendingProduct = null;

// --- Mennyiség-választó modal megnyitása ---
function openQuantityModal(product) {
  pendingProduct = product;
  document.getElementById("quantity-modal-title").textContent = product.name;

  const select = document.getElementById("quantity-select");
  select.innerHTML = "";
  for (let i = 1; i <= 20; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    if (i === 1) opt.selected = true;
    select.appendChild(opt);
  }

  document.getElementById("quantity-modal").classList.remove("hidden");
}

function closeQuantityModal() {
  pendingProduct = null;
  document.getElementById("quantity-modal").classList.add("hidden");
}

document.getElementById("quantity-cancel-btn").addEventListener("click", closeQuantityModal);

document.getElementById("quantity-confirm-btn").addEventListener("click", () => {
  const quantity = Number(document.getElementById("quantity-select").value);
  if (pendingProduct) {
    addTransaction(pendingProduct, quantity);
  }
  closeQuantityModal();
});
// --- Service worker regisztrálása (PWA telepíthetőséghez) ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => console.log("Service worker regisztrálva."))
      .catch((err) => console.error("Service worker hiba:", err));
  });
}
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
async function loadProducts() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error("Hiba a termékek betöltésekor:", error);
    return;
  }

  const productList = document.getElementById("product-list");
  productList.innerHTML = ""; // kiürítjük, mielőtt újratöltjük

  products.forEach((product) => {
    const btn = document.createElement("button");
    btn.textContent = `${product.name} - ${product.price} Ft`;
    btn.addEventListener("click", () => addTransaction(product));
    productList.appendChild(btn);
  });
}

// --- Új tranzakció felírása, amikor rákattintanak egy termékre ---
async function addTransaction(product) {
  const { data: userData } = await supabaseClient.auth.getUser();
  const currentUserId = userData.user.id;

  const { error } = await supabaseClient.from("transactions").insert({
    user_id: currentUserId,
    product_id: product.id,
    price_at_time: product.price,
  });

  if (error) {
    alert("Hiba történt a felírás során: " + error.message);
    return;
  }

  // Sikeres felírás után frissítjük a saját tranzakciólistát és egyenleget
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
    .select("id, price_at_time, created_at, products(name)")
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

  const tbody = document.getElementById("transactions-body");
  tbody.innerHTML = "";

  let total = 0;

  transactions.forEach((t) => {
    total += Number(t.price_at_time);

    const row = document.createElement("tr");
    const date = new Date(t.created_at).toLocaleString("hu-HU");
    row.innerHTML = `
      <td>${date}</td>
      <td>${t.products.name}</td>
      <td>${t.price_at_time} Ft</td>
    `;
    tbody.appendChild(row);
  });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = total - totalPaid;

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
    .select("user_id, price_at_time");

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
    balances[t.user_id] += Number(t.price_at_time);
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

  const detailButtonHtml =
    currentUserRole === "admin"
      ? `<button class="detail-btn" data-user-id="${user.id}" data-user-name="${user.name}">Részletek</button>`
      : "";

  row.innerHTML = `
    <td>${user.name}</td>
    <td>${total} Ft</td>
    <td>${detailButtonHtml}</td>
  `;
  tbody.appendChild(row);
});

// Ha admin vagyunk, minden "Részletek" gombra rákötjük az eseménykezelőt
if (currentUserRole === "admin") {
  document.querySelectorAll(".detail-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById("admin-detail-view");
      const isOpenForThisUser =
        panel.style.display === "block" &&
        panel.dataset.currentUserId === btn.dataset.userId;

      if (isOpenForThisUser) {
        closeAdminDetail();
      } else {
        showAdminDetail(btn.dataset.userId, btn.dataset.userName);
      }
    });
  });
}
}

// --- Admin: egy adott user összes tranzakciójának megjelenítése törlés-gombbal ---
// --- Admin: egy adott user összes tranzakciójának és befizetésének megjelenítése ---
async function showAdminDetail(userId, userName) {
  const { data: transactions, error } = await supabaseClient
    .from("transactions")
    .select("id, price_at_time, created_at, products(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Hiba a részletek betöltésekor:", error);
    return;
  }

  const { data: payments, error: paymentsError } = await supabaseClient
    .from("payments")
    .select("id, amount, created_at, recorder:created_by(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("Hiba a befizetések betöltésekor:", paymentsError);
    return;
  }

  document.getElementById("admin-detail-title").textContent = `${userName} tételei`;
  const panel = document.getElementById("admin-detail-view");
panel.style.display = "block";
panel.dataset.currentUserId = userId;

document.getElementById("admin-detail-close-btn").onclick = closeAdminDetail;

  // --- Tranzakciók táblázat ---
  const tbody = document.getElementById("admin-detail-body");
  tbody.innerHTML = "";

  let totalSpent = 0;

// Előbb kiszámoljuk a befizetett összeget, hogy tudjuk, van-e még tartozás
const totalPaidPreview = payments.reduce((sum, p) => sum + Number(p.amount), 0);
const totalSpentPreview = transactions.reduce((sum, t) => sum + Number(t.price_at_time), 0);
const hasOutstandingBalance = totalSpentPreview - totalPaidPreview > 0;

transactions.forEach((t) => {
    totalSpent += Number(t.price_at_time);

    const date = new Date(t.created_at).toLocaleString("hu-HU");
    const row = document.createElement("tr");

    const deleteButtonHtml = hasOutstandingBalance
      ? `<button data-transaction-id="${t.id}" class="delete-btn">Törlés</button>`
      : "";

    row.innerHTML = `
      <td>${date}</td>
      <td>${t.products.name}</td>
      <td>${t.price_at_time} Ft</td>
      <td>${deleteButtonHtml}</td>
    `;
    tbody.appendChild(row);
});

  // --- Befizetések táblázat ---
  const paymentsBody = document.getElementById("admin-payments-body");
  paymentsBody.innerHTML = "";

  let totalPaid = 0;

payments.forEach((p) => {
    totalPaid += Number(p.amount);

    const date = new Date(p.created_at).toLocaleString("hu-HU");
    const recorderName = p.recorder ? p.recorder.name : "Ismeretlen";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${date}</td>
      <td>${p.amount} Ft</td>
      <td>${recorderName}</td>
      <td><button data-payment-id="${p.id}" class="delete-payment-btn">Törlés</button></td>
    `;
    paymentsBody.appendChild(row);
});

  const balance = totalSpent - totalPaid;
  document.getElementById("admin-detail-balance").textContent = `${balance} Ft`;

  // --- Törlés gombok (tranzakciók) ---
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = confirm("Biztosan törlöd ezt a tételt?");
      if (!confirmed) return;

      const { error } = await supabaseClient
        .from("transactions")
        .delete()
        .eq("id", btn.dataset.transactionId);

      if (error) {
        alert("Hiba a törlés során: " + error.message);
        return;
      }

      showAdminDetail(userId, userName);
      loadAllBalances();
      loadOwnTransactions();
    });
  });

  // --- Törlés gombok (befizetések) ---
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

  // --- "Befizetés rögzítése" gomb ---
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

  // --- "Teljes tartozás kifizetve" gomb ---
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
  }
});
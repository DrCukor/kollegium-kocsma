# 🍺 Kollégiumi Kocsma

Egy egyszerű, ingyenes webalkalmazás, ami a kollégiumi kocsma hagyományos "filírásos" (papírcetlis) elszámolási rendszerét váltja le egy átlátható, digitális megoldásra.

## Miért készült?

A kollégiumi közösségben eddig papírra írta fel mindenki, mit fogyasztott. Ez az app ugyanezt a bizalmi rendszert digitalizálja: mindenki látja a saját és mindenki más egyenlegét, az adminok pedig kezelik a termékeket, a befizetéseket és az új tagok felvételét.

## Funkciók

- 🔐 Email alapú bejelentkezés, biztonságos jogosultságkezeléssel
- 🍻 Fogyasztás felírása kategóriák szerint (sör, rövid, bor, üdítő, rágcsa), kereséssel és mennyiség-választással
- 💰 Saját és közösségi egyenleg valós idejű követése
- 💳 Részleges vagy teljes befizetés rögzítése, nyomon követhetően (ki, mikor, mennyit)
- 🏆 "Szégyenfal" és "Dicsőségfal" — a legnagyobb tartozók és túlfizetők toplistája
- 👤 Admin felület: felhasználó- és termékkezelés, tranzakciók áttekintése/törlése
- 📱 Telepíthető, app-szerű élmény (PWA) Androidon és iOS-en egyaránt
- ⚡ Valós idejű frissítés minden bejelentkezett eszközön

## Technológia

- **Frontend**: sima HTML, CSS, JavaScript (nincs build-lépés)
- **Backend / adatbázis**: [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security)
- **Hosting**: GitHub Pages

## Használat

Az élő oldal itt érhető el: `https://drcukor.github.io/kollegium-kocsma/`

Mobilon a böngésző "Hozzáadás a kezdőképernyőhöz" opciójával telepíthető, és úgy viselkedik, mint egy natív alkalmazás.

## Megjegyzés

Ez a projekt egy kis, zárt közösség (max ~100 fő) számára készült, nem nyilvános regisztrációval — a felhasználókat az admin veszi fel kézzel.

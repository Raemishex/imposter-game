# Imposter (Cəsus) Oyunu 🕵️

Imposter (və ya Cəsus Kimdir?) oyununa xoş gəlmisiniz! Bu layihə React, Vite və Socket.io ilə yığılmış həm online, həm də eyni cihazda (Local / Pass-and-Play) oynana bilən interaktiv çoxoyunçulu partiya oyunudur. 

## 🎮 Oyunun Qaydaları

Oyunun əsas məqsədi vətəndaşların (crewmates) cəsusu (imposter) tapmaq, cəsusun isə gizli sözü təxmin etmək və ya sona qədər kimliyini gizlətməkdir.

### 🎭 Rollar
* **Vətəndaşlar (Crewmates):** Bütün vətəndaşlara eyni gizli söz verilir. Onların məqsədi bir-birilərinə üstüörtülü ipucları verərək cəsusu tapmaqdır. İpucu verərkən elə söz deyilməlidir ki, cəsus sözü anlamasın, lakin digər vətəndaşlar sənin də sözü bildiyini anlasınlar.
* **Cəsus (Imposter):** Gizli sözü bilmir, yalnız sözün hansı **kateqoriyaya** aid olduğunu (Məs: Meyvə, Film) bilir. Məqsədi o kateqoriyaya uyğun saxta ipucları verərək vətəndaşları aldatmaq və səsvermədə digərlərinin hədəf olmasını təmin etməkdir.
* **Jester (Təlxək):** (Qoşula bilər) Əsas məqsədi səsvermədə hədəf olmaq (özünü cəsus kimi göstərmək) və oyundan atılmaqdır. Əgər Jester səsvermədə atılsa, **o qalib gəlir!**

### 🔄 Oyunun Axını (Game Loop)
1. **Kartların Baxılması:** Oyun başladıqda hər kəsə ardıcıllıqla telefonu gizli şəkildə verib klikləməklə öz roluna və (varsa) gizli sözünə baxması xahiş olunur (Local rejim üçün).
2. **Müzakirə (Discussion):** 
   - Hər bir oyunçu mövcud sözlə bağlı bir ipucu verir.
   - İpucları daxil etmək üçün xüsusi taymer olur (misal üçün, 60 saniyə). Taymer bitdikdə və ya "Pass" edildikdə növbə digərinə keçir.
3. **Səsvermə (Voting):** Bütün ipucları eşidildikdən sonra səsvermə mərhələsinə keçilir.
   - Səsvermə paneli üzərindən oyunçular şübhələndikləri şəxsə səs verirlər.
   - Ən çox səs alan oyunçu **eliminasiya edilir**.
4. **Növbəti Raund (Next Round) və Kim Qazandı?:**
   - Atılan şəxs (İmposter, Vətəndaş və ya Jester) göstərilir.
   - Əgər imposterlərdən hələ də qalanlar varsa (və ya bərabərlik yoxdursa) oyun **Yeni Müzakirə** ilə davam edir. Eyni sözlə qalan oyunçular daha çox ipucu verir.
   - Əgər atılan *Jester* isə — oyunu birbaşa Jester qazanır.
   - *Bütün İmposterlər* atılıbsa — Vətəndaşlar (Crewmates) qazanır.
   - Daha *çox İmposter* qalıbsa və səs çoxluğu onlardadırsa — İmposterlər qazanır.
   - *İmposterin Son Şansı:* Əgər imposter oyundan atılsa belə, əsl sözü tapıb daxil edə bilsə ("Imposter Son Şans"), oyunu o qazanır! 🎯

### 👻 İzləyici Rejimi (Spectator Mode)
Oyun zamanı çoxlu səs yığıb oyundan çıxarılan oyunçular (eliminasiya olanlar) serverdən və ya oyundan asılı qalmır/atılmırlar. Onlar **İzləyici rejiminə (Spectator Mode)** keçirlər. 
- Müzakirə zamanı öz fikirlərini yaza bilməzlər (butonlar passivdir).
- Səsvermədə kiməsə səs verə bilməzlər.
- Sadəcə qırmızı qeyd ilə canlı olaraq oyunun sonrakı ardıcıllığına baxa və qərarları izləyə bilərlər.

---

## ⚡ Əlavə Xüsusiyyətlər (Features)
- **Local / Pass-and-Play Rejimi:** Eyni otaqda tək bir telefon əldən-ələ gəzdirilərək (offline formda) rahatlıqla oynana bilər. Səsvermə vaxtı da gizli panel qorunulur.
- **Online Rejim (Sockets):** Dünyanın fərqli yerindəki dostlarla otaq vasitəsilə 4 rəqəmli şifrə və ya otaq adı ilə birləşib oynama şansı.
- **Xaos Rejimi (Chaos Mode):** Hər oyunda fərqli bir çətinlik gələ bilər:
  - 🙈 **Kor Raund:** İmposter üçün belə kateqoriya göstərilmir.
  - 👥 **İkili Bəla:** Normal şanzla əlavə bir İmposter cəlb olur.
  - ⚡ **Sürət Raund:** Hər oyunçuya ayrılan ipucu və səsvermə vaxtı yarıya endirilir.
- **Troll Mod:** Xüsusi parametrlə hər kəsi İmposter etmək və qarışıqlıq yaratmaq :)

---

## 💻 Tech Stack
- **Frontend / UI:** React, Vite, Tailwind CSS, Framer Motion (animasiyalar, 3D Card flipləri)
- **State Management:** Zustand
- **Backend / Realtime Eventlər:** Node.js, Express, Socket.io
- **Tərcümələr / i18n:** Built-in sadə tərcümə lüğəti sistemi (AZ, EN, TR, RU)
- **Deployments:** Frontend -> Vercel | Backend -> Render.com

---

## 🚀 Quraşdırılma və İşlədilməsi
Əgər bu proyektin üzərində yerli olaraq inkişaf etdirmək və (run etmək) istəyirsinizsə:

1. **Repozitoriyanı klonlayın:**
```bash
git clone https://github.com/Raemishex/imposter-game.git
cd imposter-game
```

2. **Backend və Frontend paketlərini yükləyin:**
```bash
npm install
```

3. **Backend serverini yandırın:**
```bash
node server/index.js
```

4. **Frontend-i inkişaf rejimində (dev) yandırın:**
```bash
npm run dev
```

Brauzerinizdə Vite-ın verdiyi porta daxil olun (adətən `localhost:5173`) və oyun hazır olacaq!

*Əyləncəli Oyunlar!* 🎉

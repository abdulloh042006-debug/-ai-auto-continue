# AI Auto Continue

Bepul AI avtomatlashtirish uchun GitHub Pages + GitHub Actions + GitHub Models asosidagi boshlang‘ich loyiha. Bu loyiha **Claude.ai chatlarini boshqarmaydi**. AI javoblari GitHub Issues ichida saqlanadi; AI repo fayllarini avtomatik o‘zgartirmaydi.

## Ishga tushirish

1. Settings → Pages → Source: **GitHub Actions** ni tanlang.
2. Actions → Publish Site workflow ishga tushganini tekshiring.
3. Saytdan yangi vazifa yarating va ochilgan GitHub issue-ni tasdiqlang.
4. Har ~5 daqiqada GitHub Actions aktiv vazifalarni tekshiradi va mavjud javobdan keyin `Continue` so‘rovini beradi (har yurishda ko‘pi bilan 3 qadam).
5. To‘xtatish uchun tegishli issue-ni yoping.

## Cheklovlar

GitHub Models va GitHub Actions bepul tarif limitlari bor; ularning ishlashi va aniqligi kafolatlanmaydi. So‘rovlar va javoblar **public repo** dagi GitHub Issues orqali ommaga ochiq ko‘rinishi mumkin. Maxfiy ma’lumot yubormang. GitHub Models ruxsati uchun `models: read` kerak. Dastlabki prototip kod tahrirlamaydi.

`npm test` — lokal tekshiruv. Node.js 22+; qo‘shimcha npm paket yo‘q.

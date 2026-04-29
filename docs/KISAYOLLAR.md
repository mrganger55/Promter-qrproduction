# ⌨️ KISAYOLLAR & DAVRANIŞLAR

> Üst seviye için → [SISTEM.md](../SISTEM.md)

**Son güncellenme:** 2026-04-29 — İterasyon 17

---

## Klavye

| Tuş | Yer | Etki |
|---|---|---|
| `←` | Kontrol paneli + Prompter | Önceki sayfa (ilk sayfadayken önceki şarkının son sayfası) |
| `→` | Kontrol paneli + Prompter | Sonraki sayfa (son sayfadayken sonraki şarkının ilk sayfası) |
| `Ctrl+S` | Editör (kontrol paneli) | Düzenlemeyi kaydet |

**Diğer tüm kısayollar bilinçli olarak kapalı** (Space, Home, End, M, F, Esc, ↑, ↓). Yanlış basış sahnede risk.

---

## Mouse / Buton davranışları

| Buton | Davranış |
|---|---|
| ↑ ↓ (setlist) | Item taşı, **scroll pozisyonu korunur** (it.17 fix) |
| 🗑 | Tek onay penceresi |
| Bulk 🗑 | Tek onay penceresi |
| ⬆⬇ kaydırma | Onay YOK (hızlı, geri alınabilir) |
| ▶ Auto-play | Sadece bu butonla otomatik geçiş başlar |
| Sanatçı mesajı **Göster** | Mesaj alt bantta görünür, kaldırana kadar kalır |
| Sanatçı mesajı **Gizle** | Mesajı kaldırır |
| **Flash** (it.17) | **Mousedown** → flash başlar, **mouseup** → durur (basılı tut) |
| **Boyut slider** (it.17) | Real-time, anında prompter ekranına yansır |

---

## Sahne-güvenli kurallar (değişmez)

> Bu kuralları SAHNEDE bir kere yanlış uygulamak = sanatçıyı zora sokmak. Asla kaldırma.

1. **Otomatik tetikleme yok**: Auto-play sadece ▶ ile, countdown bitince değil
2. **Mesaj manuel kaybolur**: Saniye bazlı timeout YOK
3. **Tek silme onayı**: Yanlışlıkla silmek zor olsun
4. **Kaydırma onayı YOK**: Hızlı ve geri alınabilir
5. **Klavye dar**: Sadece ← → + Ctrl+S
6. **Cache version bump**: Her değişiklikte; aksi halde "düzelmedi" yanılgısı (bkz. feedback_cache_busting)

---

## Setlist davranışı (it.17 sonrası)

- Sol başta: ☐ checkbox
- Sonra: **şarkı sıra numarası** (sadece type='song'; talk/break atlar)
- Sonra: başlık + ton
- Sağ tarafta: hover ile ↑ ↓ 🗑 ✏

Numara prompter'a gönderilmez, sadece kontrol paneli görsel yardımı.

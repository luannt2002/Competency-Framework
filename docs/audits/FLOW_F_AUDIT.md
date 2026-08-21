# FLOW F — Gamification (rà 2026-08-20, chỉ phân loại chưa vá)
Bước:  10 ĐỦ · 5 THIẾU · 0 ĐỨT · 4 SAI
F1  XP node done theo depth 10/50/200/500 | ĐỦ | node-progress.ts:217 + insertXpOnce
F2  Streak daily +5 | ĐỦ | xp-award.ts:69, DB có data
F3  Milestone +50/+300 | ĐỦ | xp-rules.ts:42
F4  Badge +25 | ĐỦ | badge-evaluator.ts:77
F5  Skill verified +30 | THIẾU | verifyEvidence không insert XP
F6  XP không giảm | ĐỦ | chỉ insert dương
F7  Hearts max 5, -1 sai | ĐỦ | upsert atomic GREATEST
F8  -1 heart/ngày bỏ học | THIẾU | không có decay
F9  Skip task -0.5 heart | THIẾU | markTaskSkipped không đụng hearts
F10 Refill +1/4h | SAI | next_refill_at ĐƯỢC GHI nhưng không có gì đọc → refill không bao giờ xảy ra (xác tướng)
F11 Ôn bài cũ +1 heart | THIẾU | replay không mất (đúng) nhưng không có path +1
F12 Streak tick 2 path | ĐỦ | node done + daily task, idempotent/ngày, TZ VN cố định
F13 Reset streak hiển thị | SAI | không reset hàng ngày, topbar stale giữa các ngày
F14 Badge 3/7/30/100 | SAI | evaluator hỗ trợ, seed thiếu 3 ngày và 100 ngày
F15 Badge engine + hiển thị | ĐỦ | 8 rule kinds, profile + toast
F16 Creator custom badge | THIẾU | không có CRUD
F17 Crown cap 5 | ĐỦ | crowns.ts:26, mastered +2
F18 Crown màu theo source | SAI | chỉ render số amber, không màu gray/blue/gold
F19 Topbar XP/streak/hearts | ĐỦ | layout.tsx:30-88 + realtime runner
Ghi chú: lõi XP/streak/crown đầy đủ có data thật. Hearts yếu nhất: chỉ có "mất", "kiếm lại" không tồn tại.

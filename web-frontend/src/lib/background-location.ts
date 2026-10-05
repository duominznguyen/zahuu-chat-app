import type { Location } from "react-router-dom";

// Mở 1 modal TỪ TRONG 1 trang đã sẵn là modal/standalone (vd mở AddMembers từ
// GroupMembers, mở /u/:userId từ GroupMembers) phải trỏ background về ĐÚNG
// trang gốc (vd /chat/:id), không phải chính location hiện tại — nếu không,
// background sẽ là path của modal/standalone đang mở (route đó cũng được
// đăng ký làm trang standalone ở <Routes> chính), khiến backdrop hiện nhầm
// thành bản standalone (full-page card) thay vì giữ nguyên layout chat phía
// sau. `navigate(-1)` vẫn luôn đúng vì dựa vào lịch sử trình duyệt, không
// liên quan tới giá trị background này.
export function rootBackground(location: Location): Location {
  const current = (location.state as { background?: Location } | null)?.background;
  return current ?? location;
}

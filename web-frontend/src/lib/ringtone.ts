// Tiếng chuông tổng hợp bằng Web Audio, không cần file âm thanh. Trình duyệt chặn
// phát âm thanh trước khi có thao tác của người dùng, nên lỗi khi tạo AudioContext
// được bỏ qua — khi đó chỉ không có tiếng, overlay vẫn hiện.
let context: AudioContext | null = null;
let timer: number | null = null;

function beep() {
  if (!context) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
  osc.connect(gain).connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.6);
}

export function startRingtone() {
  if (timer !== null) return;
  try {
    context = new AudioContext();
  } catch {
    return;
  }
  beep();
  timer = window.setInterval(beep, 1500);
}

export function stopRingtone() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  void context?.close().catch(() => {});
  context = null;
}

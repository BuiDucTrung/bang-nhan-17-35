"use client";

import { useLayoutEffect } from "react";

const KEY_MAX = 56; // phím cao nhất (máy màn hình lớn)
const KEY_MIN = 44; // phím thấp nhất vẫn dễ bấm (chuẩn Apple: 44pt)

/**
 * Co giãn bàn số để câu hỏi + ô trả lời + bàn số luôn nằm trọn trong vùng nhìn thấy của Safari,
 * từ iPhone SE (màn thấp) tới iPhone Pro Max. Màn quá thấp thì bật chế độ gọn (`play-compact`)
 * để thu nhỏ khoảng cách và cỡ chữ phụ trước khi thu nhỏ phím.
 * Chỉ đo lại khi đổi chiều rộng (xoay máy), không đo lại khi thanh Safari co/giãn lúc cuộn,
 * nên bàn số không nhảy kích thước trong lúc đang chơi.
 */
export function useFitKeypad(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    let lastWidth = -1;

    const room = () => {
      const kp = document.querySelector<HTMLElement>(".keypad");
      if (!kp) return null;
      const top = kp.getBoundingClientRect().top + window.scrollY;
      const gap = parseFloat(getComputedStyle(kp).rowGap) || 8;
      const card = kp.closest<HTMLElement>(".card");
      const below = card ? parseFloat(getComputedStyle(card).paddingBottom) + 2 : 0;
      return (window.innerHeight - top - below - 8 - gap * 3) / 4;
    };

    const fit = (force = false) => {
      if (!force && window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      root.classList.remove("play-compact");
      root.style.setProperty("--key-h", `${KEY_MAX}px`);
      let h = room();
      if (h == null) return;
      if (h < 52) {
        root.classList.add("play-compact");
        h = room() ?? KEY_MIN;
      }
      root.style.setProperty("--key-h", `${Math.max(KEY_MIN, Math.min(KEY_MAX, Math.floor(h)))}px`);
    };

    fit(true);
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    document.fonts?.ready.then(() => fit(true));
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      root.classList.remove("play-compact");
      root.style.removeProperty("--key-h");
    };
  }, [active]);
}

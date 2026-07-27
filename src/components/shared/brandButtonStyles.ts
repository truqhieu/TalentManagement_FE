/**
 * Bộ class nút màu thương hiệu #006C49 (đồng bộ thanh header xanh), dùng cho các màn đã
 * chuyển sang tông xanh — hiện là Phòng ban & nhóm và Lịch thi & Người chấm.
 *
 * Đây là opt-in theo từng màn, KHÔNG phải token toàn app: các màn khác vẫn dùng nút tím
 * mặc định của `buttonVariants`. Muốn đổi màu, sửa đúng file này là mọi màn đã opt-in đổi theo.
 *
 * Dark mode dùng emerald-400 cho chữ/viền vì #006C49 quá tối trên nền tối; riêng nút nền đặc
 * vẫn giữ #006C49 (chữ trắng trên nền tối vẫn đủ tương phản).
 */
export const BRAND_BTN_SOLID =
  'bg-[#006C49] text-white shadow-none hover:bg-[#00583B] active:bg-[#004430]'

export const BRAND_BTN_OUTLINE =
  'border-[#006C49]/40 bg-transparent text-[#006C49] shadow-none hover:border-[#006C49]/60 hover:bg-[#006C49]/10 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10'

export const BRAND_BTN_GHOST =
  'text-[#006C49] hover:bg-[#006C49]/10 hover:text-[#006C49] dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400'

export const BRAND_BTN_SOFT =
  'bg-[#006C49]/10 text-[#006C49] shadow-none hover:bg-[#006C49]/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25'

/** Chữ/icon màu thương hiệu (link trong bảng, hover của icon button). */
export const BRAND_TEXT = 'text-[#006C49] dark:text-emerald-400'
